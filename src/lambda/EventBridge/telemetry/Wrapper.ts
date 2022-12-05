import otelapi, { trace, context, SpanKind } from "@opentelemetry/api";
import { Callback, Context, EventBridgeEvent, Handler } from "aws-lambda";
import { tracer } from "../../utils/telemetry";
import { telemetryFindEventBridgeParent } from "./ParentContext";

export const wrapTelemetryEventBridge = <T>(
  handler: Handler<EventBridgeEvent<string, T>>
) => {
  return async function (
    event: EventBridgeEvent<string, T>,
    context: Context,
    callback: Callback
  ) {
    const parentCtx = telemetryFindEventBridgeParent(event);
    const eventBridgeSpan = tracer.startSpan(
      `Event Bridge trigger`,
      {
        kind: SpanKind.SERVER,
        attributes: {
          ["lendis.eventbridge.source"]: event.source,
          ["lendis.eventbridge.type"]: event["detail-type"],
        },
      },
      parentCtx
    );

    const out = await otelapi.context.with(
      trace.setSpan(parentCtx, eventBridgeSpan),
      () => {
        return handler(event, context, callback);
      }
    );

    eventBridgeSpan.end();
    return out;
  };
};
