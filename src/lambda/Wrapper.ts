import { Callback, Context, Handler } from 'aws-lambda';
import { recordException } from '../util/exceptions';
import {
  LambdaInitSecretHandler,
  LambdaSecretsHandler,
} from '../util/LambdaHandler';
import {
  HandlerConfiguration,
  HandlerConfigurationWithType,
  LambdaTypeConfiguration,
} from './config';
import { log } from './utils/logger';
import { wrapHandlerSecretsManager } from './utils/secrets_manager';
import { wrapSentry } from './utils/sentry';
import { wrapTelemetryLambda } from './utils/telemetry';
import yup, { ObjectSchema } from 'yup';
import { TypedSchema } from 'yup/lib/util/types';
import { createNoopMeter } from '@opentelemetry/api';
import { reject } from 'lodash';
import { resolve } from 'path';
import { SdkInfo } from '@sentry/serverless';
import { ErrorBag } from '@lendis-tech/sdk';
import { AsyncLocalStorage } from 'async_hooks';

export const wrapBaseLambdaHandler = <U, TInit, TSecrets extends string, V>(
  handler: LambdaInitSecretHandler<U, TInit, TSecrets, V>,
  init?: (secrets: Record<TSecrets, string>) => Promise<TInit>
): LambdaSecretsHandler<U, TSecrets, V | void> => {
  let isInit: boolean = false;
  let initValue: TInit;

  return async function wrappedInitableHandler(
    event: U,
    secrets: Record<TSecrets, string>,
    context: Context,
    callback: Callback
  ) {
    if (!isInit) {
      if (init) initValue = await init(secrets);
      isInit = true;
    }

    // const errorBag = localAsyncStorage.getStore()!.errorBag;

    return new Promise<V | void>((resolve, reject) => {
      const shimmedCb = function (err, out: V | void) {
        if (err) {
          return reject(err);
        } else {
          return resolve(out);
        }
      };

      const out = handler(event, initValue, secrets, context, shimmedCb);

      if (typeof out.then === 'function') {
        out.then(resolve).catch(reject);
      }
    });
  };
};

export const wrapGenericHandler = <
  T,
  TInit,
  U,
  SInput extends ObjectSchema<any> | any,
  SOutput extends ObjectSchema<any> | any,
  TSecrets extends string
>(
  handler: LambdaInitSecretHandler<T, TInit, TSecrets, U>,
  configuration: HandlerConfigurationWithType<TInit, SInput, SOutput, TSecrets>
) => {
  // Needs to wrap before the secrets manager, because secrets should be available in the init phase
  let wrappedHandler = wrapBaseLambdaHandler(
    handler,
    configuration.initFunction
  );

  let wrappedHandlerWithSecrets = wrapHandlerSecretsManager(
    wrappedHandler,
    configuration?.secretInjection ?? {}
  );

  wrappedHandlerWithSecrets = wrapRuntime(wrappedHandlerWithSecrets);

  if (configuration.sentry) {
    wrappedHandlerWithSecrets = wrapSentry(wrappedHandlerWithSecrets);
  }

  if (configuration.opentelemetry) {
    wrappedHandlerWithSecrets = wrapTelemetryLambda(wrappedHandlerWithSecrets);
  }

  return wrappedHandlerWithSecrets;
};

const wrapRuntime = <T, U>(handler: Handler<T, U>) => {
  return async function (event, context, callback) {
    try {
      log.debug('Executing innermost handler');
      return await handler(event, context, callback);
    } catch (e) {
      log.error('Innermost lambda handler function has failed');
      log.error(e);

      log.debug('Recording diagnostic information and rethrowing');
      recordException(e);
      throw e;
    }
  };
};
/*
export const localAsyncStorage = new AsyncLocalStorage<{
  errorBag: ErrorBag;
}>();

export const wrapAsyncStorage = <T, U>(handler: (...args: T[]) => U) => {
  return function (...args: T[]) {
    return localAsyncStorage.run(
      {
        errorBag: new ErrorBag(),
      },
      () => {
        return handler(...args);
      }
    );
  };
};
*/
