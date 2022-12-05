import otelapi, {
  ROOT_CONTEXT,
  Context as OtelContext,
} from "@opentelemetry/api";
import { EventBridgeEvent } from "aws-lambda";
import {
  contextPayloadGetter,
  extractCtxFromLambdaEnv,
} from "../../utils/telemetry";

export const telemetryFindEventBridgeParent = <T>(
  event: EventBridgeEvent<string, T>
) => {
  let ctx: OtelContext = ROOT_CONTEXT;

  if (event.detail) {
    ctx = otelapi.propagation.extract(
      ROOT_CONTEXT,
      event.detail,
      contextPayloadGetter
    );
  }
  if (ctx == ROOT_CONTEXT) {
    // Fallback to the lambda environment
    ctx = extractCtxFromLambdaEnv();
  }

  return ctx;
};
