import {
  Context as OtelContext,
  SpanKind,
  propagation,
  SpanStatusCode,
  TextMapGetter,
  ROOT_CONTEXT,
} from "@opentelemetry/api";
import api from "@opentelemetry/api";
import { Callback, Context, Handler } from "aws-lambda";
import {
  SemanticAttributes,
  SemanticResourceAttributes,
} from "@opentelemetry/semantic-conventions";
import { getAwsFromAccountFromArn } from "../../util/aws";
import { AWSXRAY_TRACE_ID_HEADER } from "@opentelemetry/propagator-aws-xray";
import { LambdaInitSecretHandler } from "../../util/LambdaHandler";

export const tracer = api.trace.getTracerProvider().getTracer("aws_lambda");

export const traceContextEnvironmentKey = "_X_AMZN_TRACE_ID";

export const extractCtxFromLambdaEnv = () => {
  return propagation.extract(
    ROOT_CONTEXT,
    { [AWSXRAY_TRACE_ID_HEADER]: process.env[traceContextEnvironmentKey] },
    contextPayloadGetter
  );
};

/**
 * Wraps the handler with opentelementry.
 * The force flush call is not performed by the generic lambda wrapper
 * It MUST be implemented by the wrapper method passed as argument to this function
 * @param handler The handler to wrap
 * @param wrapper A specific wrapper method that wraps around the generically-wrapped lambda handler. Use this to provide additional root-level spans specific to the payload
 * @returns The instrumented lambda
 */
export const wrapTelemetryLambda = <T, U>(
  handler: Handler<T, U>
  // wrapper: (handler: Handler<T, U | void>) => Handler<T, U | void>
) => {
  const wrappedHandlerTelGeneric = _wrapTelemetryLambda(handler);

  // const wrappedHandler = wrapper(wrappedHandlerTelGeneric);
  return wrappedHandlerTelGeneric;
};

const _wrapTelemetryLambda = <T, U>(handler: Handler<T, U>) => {
  return async function (event: T, context: Context, callback: Callback) {
    api.diag.debug("Calling generic lambda telemetry wrapper");
    const lambdaSpan = tracer.startSpan(
      context.functionName,
      {
        kind: SpanKind.SERVER,
        attributes: {
          [SemanticAttributes.FAAS_EXECUTION]: context.awsRequestId,
          [SemanticResourceAttributes.FAAS_ID]: context.invokedFunctionArn,
          [SemanticResourceAttributes.CLOUD_ACCOUNT_ID]:
            getAwsFromAccountFromArn(context.invokedFunctionArn),
        },
      },
      api.context.active()
    );

    try {
      const out = await api.context.with(
        api.trace.setSpan(api.context.active(), lambdaSpan),
        () => {
          return handler(event, context, callback);
        }
      );
      lambdaSpan.end();
      return out;
    } catch (e) {
      lambdaSpan.recordException(e);
      // Fail the span
      lambdaSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: typeof e == "object" ? e.message : e,
      });
      lambdaSpan.end();

      throw e;
    }
  };
};

export const contextPayloadGetter: TextMapGetter<any> = {
  keys: (carrier: any) => {
    return Object.keys(carrier);
  },

  get: (carrier: any, key: string) => {
    return carrier[key];
  },
};

export const flush = () => {
  let provider = api.trace.getTracerProvider();
  // @ts-ignore
  if (typeof provider.getDelegate === "function") {
    // @ts-ignore
    provider = provider.getDelegate();
  }

  // @ts-ignore
  if (provider.forceFlush) {
    // @ts-ignore
    provider.forceFlush();
  }
};
