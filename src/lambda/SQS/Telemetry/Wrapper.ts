import { Context, SQSBatchItemFailure, SQSRecord } from 'aws-lambda';
import { Attributes, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import * as otelapi from '@opentelemetry/api';
import {
  FaasInvokedProviderValues,
  FaasTriggerValues,
  MessageTypeValues,
  SemanticAttributes,
} from '@opentelemetry/semantic-conventions';
import { tracer } from '../../utils/telemetry';
import { log } from '../../utils/logger';
import { telemetryFindSQSParent } from './ParentContext';

export const wrapTelemetrySQS = <T, U>(
  handler: (
    record: SQSRecord,
    context: Context
  ) => Promise<void | SQSBatchItemFailure>
) => {
  return async function (event: SQSRecord, context: Context) {
    const parentContext = telemetryFindSQSParent(event);
    const eventData = event;

    let attributes: Attributes = {
      [SemanticAttributes.MESSAGE_TYPE]: MessageTypeValues.RECEIVED,
      [SemanticAttributes.FAAS_TRIGGER]: FaasTriggerValues.PUBSUB,
      [SemanticAttributes.FAAS_INVOKED_PROVIDER]: FaasInvokedProviderValues.AWS,
      [SemanticAttributes.MESSAGING_SYSTEM]: 'SQS',
      [SemanticAttributes.MESSAGE_ID]: event.messageId,
      ['messaging.source']: event.eventSource,
      ['messaging.source.arn']: event.eventSourceARN,
      [SemanticAttributes.MESSAGE_ID]: event.messageId,
    };

    event.eventSource;

    const span = tracer.startSpan(
      'SQS Receive',
      {
        kind: SpanKind.SERVER,
        attributes: attributes,
      },
      parentContext
    );

    try {
      const out = await otelapi.context.with(
        otelapi.trace.setSpan(parentContext, span),
        () => handler(event, context)
      );

      if (out) {
        log.error('SQS wrapper reports a failed SQS message');
        span.setStatus({ code: SpanStatusCode.ERROR });
      }

      span.end();
      return out;
    } catch (e) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
      throw e;
    }
  };
};
