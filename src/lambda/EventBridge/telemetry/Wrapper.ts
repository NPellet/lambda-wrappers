import otelapi, { trace, SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { Callback, Context, EventBridgeEvent, Handler } from "aws-lambda";
import { log } from "../../utils/logger";
import { flush, tracer } from "../../utils/telemetry";
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

    try {
      
      const out = await otelapi.context.with(
        trace.setSpan(parentCtx, eventBridgeSpan),
        () => {
          return handler(event, context, callback);
        }
      );

      log.error('EventBridge lambda execution has succeeded. Goodbye');
      eventBridgeSpan.end();
      await flush();
      return out;

    } catch (e) {
      
      log.error('EventBridge lambda execution has errored. Goodbye');
      eventBridgeSpan.setStatus({ code: SpanStatusCode.ERROR });
      eventBridgeSpan.end();
      await flush();

      throw e;
    }
  };
};
