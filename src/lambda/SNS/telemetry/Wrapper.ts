import {
  Callback,
  Context,
  Handler,
  SNSEvent,
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
import {
  flush,
  getFaasTelemetryAttributes,
  tracer,
} from '../../utils/telemetry';
import { telemetryFindSNSParent } from './ParentContext';
import { getAwsResourceFromArn } from '../../../util/aws';
import { log } from '../../utils/logger';

export const wrapTelemetrySNS = <T, U>(handler: Handler<SNSEvent>) => {
  return async function (
    event: SNSEvent,
    context: Context,
    callback: Callback
  ) {
    const record = event.Records[0];

    const parentContext = telemetryFindSNSParent(record);

    let attributes: Attributes = {
      [SemanticAttributes.MESSAGE_TYPE]: MessageTypeValues.RECEIVED,
      [SemanticAttributes.FAAS_TRIGGER]: FaasTriggerValues.PUBSUB,
      [SemanticAttributes.FAAS_INVOKED_PROVIDER]: FaasInvokedProviderValues.AWS,
      [SemanticAttributes.MESSAGING_SYSTEM]: record.EventSource,
      [SemanticAttributes.MESSAGE_ID]: record.Sns.MessageId,
      ['messaging.source']: record.EventSubscriptionArn,
    };

    const span = tracer.startSpan(
      'SNS: ' + getAwsResourceFromArn(record.Sns.TopicArn),
      {
        kind: SpanKind.SERVER,
        attributes: attributes,
      },
      parentContext
    );

    // No flushing, we're in the inner loop
    try {
      const out = await otelapi.context.with(
        otelapi.trace.setSpan(parentContext, span),
        () => handler(event, context, callback)
      );
      span.end();
      await flush();
      return out;
    } catch (e) {
      log.error('Telemetry: SNS lambda execution has errored');
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
      await flush();
      throw e;
    }
  };
};

export const getSNSTelemetryAttributes = (
  event: SNSEvent,
  out: void,
  context: Context
) => {
  return {
    //  source: event.Records[0].EventSource,
    topic: event.Records[0].Sns.TopicArn,
    ...getFaasTelemetryAttributes(context),
  };
};
