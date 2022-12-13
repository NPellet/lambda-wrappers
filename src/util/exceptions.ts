import otelapi from '@opentelemetry/api';
import { Sentry } from '../lambda/utils/sentry';

export const recordException = (e: any) => {
  Sentry.captureException(e);

  if (otelapi.trace.getActiveSpan()?.isRecording()) {
    otelapi.trace.getActiveSpan()?.recordException(e);
  }
};
