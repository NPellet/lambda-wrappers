import otelapi from "@opentelemetry/api";
import { Sentry } from "../lambda/utils/sentry";

export const recordException = (e: any) => {
  if (process.env.USE_SENTRY) {
    Sentry.captureException(e);
  }

  if (process.env.USE_OPENTELEMETRY) {
    if (otelapi.trace.getActiveSpan().isRecording()) {
      otelapi.trace.getActiveSpan()?.recordException(e);
    }
  }
};
