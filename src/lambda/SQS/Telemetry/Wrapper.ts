import { Context, SQSBatchItemFailure, SQSEvent, SQSRecord } from 'aws-lambda';
import { Attributes, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import * as otelapi from '@opentelemetry/api';
import {
  FaasInvokedProviderValues,
  FaasTriggerValues,
  MessageTypeValues,
  SemanticAttributes,
} from '@opentelemetry/semantic-conventions';
import { getFaasTelemetryAttributes, tracer } from '../../utils/telemetry';
import { log } from '../../utils/logger';
import { telemetryFindSQSParent } from './ParentContext';
import { getAwsResourceFromArn } from '../../../util/aws';
import { ConfigGeneral, METER_NAME } from '../../config';

export const wrapTelemetrySQS = <T, U>(
  handler: (
    record: SQSRecord,
    context: Context
  ) => Promise<void | SQSBatchItemFailure>,
  config: ConfigGeneral | undefined
) => {
  const sqs_message_counter = config?.metricNames?.sqs_records_total
    ? otelapi.metrics
        .getMeter(METER_NAME)
        .createCounter(config?.metricNames?.sqs_records_total, {
          valueType: otelapi.ValueType.INT,
        })
    : undefined;

  return async function (event: SQSRecord, context: Context) {
    const parentContext = telemetryFindSQSParent(event);

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

    sqs_message_counter?.add(
      1,
      getSQSRecordTelemetryAttributes(event, context)
    );

    const span = tracer.startSpan(
      'SQS: ' + getAwsResourceFromArn(event.eventSourceARN),
      {
        kind: SpanKind.SERVER,
        attributes: attributes,
      },
      parentContext
    );

    // The handler here cannot fail (see sqs.ts implementation)
    /* try { */

    try {
      const out = await otelapi.context.with(
        otelapi.trace.setSpan(parentContext, span),
        () => handler(event, context)
      );

      span.end();
      return out;
    } catch (e) {
      log.error('SQS wrapper reports a failed SQS message');
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
      throw e;
    }
    /*} catch (e) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
      throw e;
    }*/
  };
};

export const getSQSRecordTelemetryAttributes = (
  record: SQSRecord,
  context: Context
) => {
  return {
    region: record.awsRegion,
    source: record.eventSource,
    ...getFaasTelemetryAttributes(context),
  };
};

export const getSQSTelemetryAttributes = (
  event: SQSEvent,
  out: any,
  context: Context
) => {
  return {
    //num_records: String(event.Records.length),
    ...getFaasTelemetryAttributes(context),
  };
};
