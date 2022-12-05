import { AWSLambda } from "@sentry/serverless";
import { Handler } from "aws-lambda";

AWSLambda.init({
  dsn: process.env.sentryDSN,
  tracesSampleRate: 0.5,
  // we're calling staging environment 'development' for some reason and local development is called 'local'
  environment: process.env.STAGE || process.env.NODE_ENV,
});

export function wrapSentry<TEvent, TResult>(
  handler: Handler<TEvent, TResult>
): Handler<TEvent, TResult> {
  return AWSLambda.wrapHandler(handler, { captureAllSettledReasons: true });
}

export const Sentry = AWSLambda;
