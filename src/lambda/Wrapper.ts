import { Context } from 'aws-lambda';
import { recordException } from '../util/exceptions';
import {
  LambdaInitSecretHandler,
  LambdaSecretsHandler,
} from '../util/LambdaHandler';
import { HandlerConfigurationWithType, METER_NAME } from './config';
import { log } from './utils/logger';
import { wrapHandlerSecretsManager } from './utils/secrets_manager';
import { wrapSentry } from './utils/sentry';
import {
  getFaasTelemetryAttributes,
  wrapTelemetryLambda,
} from './utils/telemetry';
import { ObjectSchema } from 'yup';
import * as api from '@opentelemetry/api';
export const wrapBaseLambdaHandler = <U, TInit, TSecrets extends string, V>(
  handler: LambdaInitSecretHandler<U, TInit, TSecrets, V>,
  init?: (secrets: Record<TSecrets, string>) => Promise<TInit>
): LambdaSecretsHandler<U, TSecrets, V | void> => {
  let isInit: boolean = false;
  let initValue: TInit;

  return async function wrappedInitableHandler(
    event: U,
    secrets: Record<TSecrets, string>,
    context: Context
  ) {
    if (!isInit) {
      log.info('Running initialization of lambda');
      if (init) initValue = await init(secrets);
      isInit = true;
    }

    // const errorBag = localAsyncStorage.getStore()!.errorBag;
    return new Promise<V | void>((resolve, reject) => {
      const shimmedCb = function (err, out: V | void) {
        log.debug('Running shim callback of lambda');

        if (err) {
          return reject(err);
        } else {
          return resolve(out);
        }
      };

      const out = handler(event, initValue, secrets, context, shimmedCb);

      if (out && out.then) {
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

  wrappedHandler = wrapRuntime(
    wrappedHandler,
    configuration.sources?._general?.recordExceptionOnLambdaFail
  );
  let wrappedHandlerWithSecrets = wrapHandlerSecretsManager(
    wrappedHandler,
    configuration.secretInjection ?? {},
    configuration.secretFetchers ?? {}
  );
  if (configuration.sentry) {
    wrappedHandlerWithSecrets = wrapSentry(wrappedHandlerWithSecrets);
  }

  if (configuration.opentelemetry) {
    wrappedHandlerWithSecrets = wrapTelemetryLambda(wrappedHandlerWithSecrets);
  }

  return wrappedHandlerWithSecrets;
};

const wrapRuntime = <T, TSecrets extends string, U>(
  handler: LambdaSecretsHandler<T, TSecrets, U>,
  recordExceptionOnFailure: boolean = true
) => {
  const lambda_exec_counter = api.metrics
    .getMeter(METER_NAME)
    .createCounter('lambda_executions', {
      valueType: api.ValueType.INT,
    });
  const lambda_error_counter = api.metrics
    .getMeter(METER_NAME)
    .createCounter('lambda_errors', {
      valueType: api.ValueType.INT,
    });

  return async function (event, secrets, context) {
    const attributes = getFaasTelemetryAttributes(context);

    try {
      log.debug('Executing innermost handler');
      lambda_exec_counter.add(1, attributes);
      return await handler(event, secrets, context);
    } catch (e) {
      log.error('Innermost lambda handler function has failed');
      log.error(e);
      lambda_error_counter.add(1, attributes);
      log.debug('Recording diagnostic information and rethrowing');
      if (recordExceptionOnFailure) {
        recordException(e);
      }
      throw e;
    }
  };
};
