import otelapi, {
  ROOT_CONTEXT,
  Context as OtelContext,
} from '@opentelemetry/api';
import { APIGatewayEvent } from 'aws-lambda';
import { log } from '../../utils/logger';
import {
  contextPayloadGetter,
  extractCtxFromLambdaEnv,
} from '../../utils/telemetry';

export const telemetryFindApiGatewayParent = (event: APIGatewayEvent) => {
  let ctx: OtelContext = ROOT_CONTEXT;
  
  if (ctx == ROOT_CONTEXT ) {
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
