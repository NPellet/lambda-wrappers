import otelapi, {
  ROOT_CONTEXT,
  Context as OtelContext,
  TextMapGetter,
} from '@opentelemetry/api';
import {
  SNSEventRecord,
  SNSMessageAttributes,
  SQSMessageAttributes,
  SQSRecord,
} from 'aws-lambda';

const contextPayloadGetter: TextMapGetter<SNSMessageAttributes> = {
  keys: (carrier: SNSMessageAttributes) => {
    return Object.keys(carrier);
  },

  get: (carrier: SNSMessageAttributes, key: string) => {
    return carrier[key]?.Value;
  },
};

export const telemetryFindSNSParent = (event: SNSEventRecord) => {
  let ctx: OtelContext = ROOT_CONTEXT;

  ctx = otelapi.propagation.extract(
    ROOT_CONTEXT,
    event.Sns.MessageAttributes,
    contextPayloadGetter
  );

  return ctx;
};
