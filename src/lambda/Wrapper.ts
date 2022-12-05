import { Callback, Context, Handler } from "aws-lambda";
import { recordException } from "../util/exceptions";
import { LambdaHandler } from "../util/LambdaHandler";
import {
  HandlerConfiguration,
  HandlerConfigurationWithType,
  LambdaTypeConfiguration,
} from "./config";
import { log } from "./utils/logger";
import { wrapHandlerSecretsManager } from "./utils/secrets_manager";
import { wrapSentry } from "./utils/sentry";
import { wrapTelemetryLambda } from "./utils/telemetry";
import yup, { ObjectSchema } from "yup";
import { TypedSchema } from "yup/lib/util/types";
import { createNoopMeter } from "@opentelemetry/api";
import { reject } from "lodash";
import { resolve } from "path";

export const wrapBaseLambdaHandler = <U, I, V>(
  handler: LambdaHandler<U, I, V>,
  init: () => Promise<I>
): Handler<U, V | void> => {
  let isInit: boolean = false;
  let initValue: I;

  return async function wrappedInitableHandler(
    event: U,
    context: Context,
    callback: Callback
  ) {
    if (!isInit) {
      initValue = await init();

      isInit = true;
    }

    return new Promise<V | void>((resolve, reject) => {
      const shimmedCb = function (err, out: V | void) {
        if (err) {
          return reject(err);
        } else {
          return resolve(out);
        }
      };

      const out = handler(event, initValue, context, shimmedCb);

      if (typeof out.then === "function") {
        out.then(resolve).catch(reject);
      }
    });
  };
};

export const wrapGenericHandler = <T, I, U, Y extends ObjectSchema<any>>(
  handler: LambdaHandler<T, I, U>,
  init: () => Promise<I>,
  configuration: HandlerConfigurationWithType<Y>
) => {
  handler = wrapRuntime(handler);

  // Needs to wrap before the secrets manager, because secrets should be available in the init phase
  let wrappedHandler = wrapBaseLambdaHandler(handler, init);

  wrappedHandler = wrapHandlerSecretsManager(
    wrappedHandler,
    configuration?.secretInjection ?? {}
  );
  /*
  if (configuration.yupSchema) {
    wrappedHandler = wrapYup(wrappedHandler, configuration.yupSchema);
  }
*/
  if (configuration.sentry) {
    wrappedHandler = wrapSentry(wrappedHandler);
  }

  if (configuration.opentelemetry) {
    wrappedHandler = wrapTelemetryLambda(
      wrappedHandler,
      LambdaTypeConfiguration[configuration.type]?.opentelemetryWrapper ||
        ((handler) => handler)
    );
  }

  return wrappedHandler;
};

const wrapRuntime = <T, I, U>(handler: LambdaHandler<T, I, U>) => {
  return async function (event, init, context, callback) {
    try {
      log.debug("Executing innermost handler");
      return await handler(event, init, context, callback);
    } catch (e) {
      log.error("Innermost lambda handler function has failed");
      log.error(e);

      log.debug("Recording diagnostic information and rethrowing");
      recordException(e);
      throw e;
    }
  };
};
/*
const wrapYup = <T, U>(handler: Handler<T, U>, schema: ObjectSchema<any>) => {
  const yupHandler: Handler<T, U> = (event, context, callback) => {
    schema.validate(event);

    return handler(event, context, callback);
  };

  return yupHandler;
};
*/
