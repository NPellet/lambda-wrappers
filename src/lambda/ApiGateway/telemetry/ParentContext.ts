import otelapi, {
  ROOT_CONTEXT,
  Context as OtelContext,
  TraceFlags,
} from '@opentelemetry/api';
import { APIGatewayEvent } from 'aws-lambda';
import { loggers } from 'winston';
import { AwsApiGatewayRequest } from '../../../util/apigateway/apigateway';
import { AwsEventBridgeEvent } from '../../../util/eventbridge';
import { log } from '../../utils/logger';
import {
  contextPayloadGetter,
  extractCtxFromLambdaEnv,
} from '../../utils/telemetry';

export const telemetryFindApiGatewayParent = (event: APIGatewayEvent) => {
  let ctx: OtelContext = ROOT_CONTEXT;
  let tryHeaders: boolean = false;

  if (ctx == ROOT_CONTEXT || tryHeaders) {
    ctx = otelapi.propagation.extract(
      ROOT_CONTEXT,
      event.headers,
      contextPayloadGetter
    );
  }

  if (ctx == ROOT_CONTEXT) {
    ctx = extractCtxFromLambdaEnv();
  }
  /*
  const spanContext = otelapi.trace.getSpan(ctx)?.spanContext();
  let tryHeaders: boolean = false;
  if (
    spanContext &&
    (spanContext.traceFlags & TraceFlags.SAMPLED) === TraceFlags.SAMPLED
  ) {
    return ctx;
  } else {
    tryHeaders = true;
  }
*/

  if (ctx === ROOT_CONTEXT) {
    log.info(
      "Couldn't find a parent context for this API Gateway invocation. Defaulting to ROOT_CONTEXT"
    );
  }
  return ctx;
};
