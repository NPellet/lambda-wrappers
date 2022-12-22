import { LambdaContext } from '../test_utils/utils';
import { LambdaType } from './config';

jest.mock('./utils/secrets_manager', () => {
  const mod = jest.requireActual('./utils/secrets_manager');
  return {
    __esModule: true,
    ...mod,
    wrapHandlerSecretsManager: jest.fn((el) => el),
  };
});

jest.mock('./utils/sentry', () => {
  const mod = jest.requireActual('./utils/sentry');
  return {
    __esModule: true,
    ...mod,
    wrapSentry: jest.fn(),
  };
});

import {
  SecretConfig,
  wrapHandlerSecretsManager,
} from './utils/secrets_manager';
import { wrapSentry } from './utils/sentry';

import { wrapBaseLambdaHandler, wrapGenericHandler } from './Wrapper';

describe('Testing runtime wrapper', () => {
  it('Shims callback when not returning a promise', async () => {
    const wrapped = wrapBaseLambdaHandler(
      (event, init, secrets, context, callback) => {
        if (event === false) {
          return callback('Error !');
        }
        callback(null, 'Result !');
      }
    );

    await expect(wrapped(true, {}, LambdaContext)).resolves.toBe('Result !');
    await expect(wrapped(false, {}, LambdaContext)).rejects.toBe('Error !');
  });

  it('Calls the secrets manager', async () => {
    const secretInj: Record<string, SecretConfig> = {
      a: {
        "secret": "Algolia-Products",
        "secretKey": "adminApiKey",
        required: true
      }
    };

    wrapGenericHandler(async (event, init, secrets, context, callback) => {}, {
      secretInjection: secretInj,
      type: LambdaType.GENERIC,
    });

    expect(wrapHandlerSecretsManager).toHaveBeenCalledWith(
      expect.any(Function),
      secretInj
    );
  });

  it('Calls the secrets manager with empty object when not defined', async () => {
    wrapGenericHandler(async (event, init, secrets, context, callback) => {}, {
      type: LambdaType.GENERIC,
    });

    expect(wrapHandlerSecretsManager).toHaveBeenCalledWith(
      expect.any(Function),
      {}
    );
  });

  it('Calls the Sentry wrapper', async () => {
    wrapGenericHandler(
      async (event, init, secrets, context, callback) => {},

      {
        sentry: true,
        type: LambdaType.GENERIC,
      }
    );

    expect(wrapSentry).toHaveBeenCalledWith(expect.any(Function));
    expect(wrapSentry).toHaveBeenCalledTimes(1);
    wrapGenericHandler(async (event, init, secrets, context, callback) => {}, {
      sentry: false,
      type: LambdaType.GENERIC,
    });
    // No more invocations
    expect(wrapSentry).toHaveBeenCalledTimes(1);
  });

  /*
  let wrappedHandlerWithSecrets = wrapHandlerSecretsManager(
    wrappedHandler,
    configuration?.secretInjection ?? {}
  );

  if (configuration.sentry) {
    wrappedHandlerWithSecrets = wrapSentry(wrappedHandlerWithSecrets);
  }

  if (configuration.opentelemetry) {
    wrappedHandlerWithSecrets = wrapTelemetryLambda(wrappedHandlerWithSecrets);
  }*/
});
