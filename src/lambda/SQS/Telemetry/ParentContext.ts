import otelapi, {
  ROOT_CONTEXT,
  Context as OtelContext,
  TextMapGetter,
} from '@opentelemetry/api';
import { SQSMessageAttributes, SQSRecord } from 'aws-lambda';

const contextPayloadGetter: TextMapGetter<SQSMessageAttributes> = {
  keys: (carrier: SQSMessageAttributes) => {
    return Object.keys(carrier);
  },

  get: (carrier: SQSMessageAttributes, key: string) => {
    return carrier[key]?.stringValue;
  },
};

export const telemetryFindSQSParent = (event: SQSRecord) => {
  let ctx: OtelContext = ROOT_CONTEXT;

  ctx = otelapi.propagation.extract(
    ROOT_CONTEXT,
    event.messageAttributes,
    contextPayloadGetter
  );

  return ctx;
};
