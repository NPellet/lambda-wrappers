import { AWSLambda } from "@sentry/serverless";
import { Handler } from "aws-lambda";


export function wrapSentry<TEvent, TResult>(
  handler: Handler<TEvent, TResult>
): Handler<TEvent, TResult> {
  return AWSLambda.wrapHandler(handler, { captureAllSettledReasons: true });
}

export const Sentry = AWSLambda;
