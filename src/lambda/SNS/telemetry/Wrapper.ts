import {
  Context,
  SNSEventRecord,
  SQSBatchItemFailure,
  SQSRecord,
} from 'aws-lambda';
import { Attributes, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import * as otelapi from '@opentelemetry/api';
import {
  FaasInvokedProviderValues,
  FaasTriggerValues,
  MessageTypeValues,
  SemanticAttributes,
} from '@opentelemetry/semantic-conventions';
import { tracer } from '../../utils/telemetry';
import { telemetryFindSNSParent } from './ParentContext';
import { getAwsResourceFromArn } from '../../../util/aws';

export const wrapTelemetrySNS = <T, U>(
  handler: (record: SNSEventRecord, context: Context) => Promise<void>
) => {
  return async function (event: SNSEventRecord, context: Context) {
    const parentContext = telemetryFindSNSParent(event);
    const eventData = event;

    let attributes: Attributes = {
      [SemanticAttributes.MESSAGE_TYPE]: MessageTypeValues.RECEIVED,
      [SemanticAttributes.FAAS_TRIGGER]: FaasTriggerValues.PUBSUB,
      [SemanticAttributes.FAAS_INVOKED_PROVIDER]: FaasInvokedProviderValues.AWS,
      [SemanticAttributes.MESSAGING_SYSTEM]: event.EventSource,
      [SemanticAttributes.MESSAGE_ID]: event.Sns.MessageId,
      ['messaging.source']: event.EventSubscriptionArn,
    };

    const span = tracer.startSpan(
      'SNS: ' + getAwsResourceFromArn(event.Sns.TopicArn),
      {
        kind: SpanKind.SERVER,
        attributes: attributes,
      },
      parentContext
    );

    const out = await otelapi.context.with(
      otelapi.trace.setSpan(parentContext, span),
      () => handler(event, context)
    );
    span.end();
    return out;
  };
};
