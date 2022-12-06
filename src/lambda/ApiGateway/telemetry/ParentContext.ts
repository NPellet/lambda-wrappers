import otelapi, {
  ROOT_CONTEXT,
  Context as OtelContext,
  TraceFlags,
} from "@opentelemetry/api";
import { APIGatewayEvent } from "aws-lambda";
import { AwsApiGatewayRequest } from "../../../util/apigateway/apigateway";
import {
  contextPayloadGetter,
  extractCtxFromLambdaEnv,
} from "../../utils/telemetry";

export const telemetryFindApiGatewayParent = <T>(
  event: AwsApiGatewayRequest<T>
) => {
  let ctx: OtelContext = ROOT_CONTEXT;

  if (ctx == ROOT_CONTEXT) {
    ctx = extractCtxFromLambdaEnv();
  }

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

  if (ctx == ROOT_CONTEXT || tryHeaders) {
    ctx = otelapi.propagation.extract(
      ROOT_CONTEXT,
      event.getHeaders(),
      contextPayloadGetter
    );
  }

  return ctx;
};
