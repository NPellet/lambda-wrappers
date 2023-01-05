import { LambdaContext, testApiGatewayEvent } from '../test_utils/utils';
import { MessageType } from '../util/types';
import { LambdaType } from './config';


jest.mock('../util/exceptions', function () {
  return {
    recordException: jest.fn(),
  };
});
import { recordException } from '../util/exceptions';


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
  fetchSecretsFromAWS,
  SecretConfig,
  wrapHandlerSecretsManager,
} from './utils/secrets_manager';
import { wrapSentry } from './utils/sentry';

import { wrapBaseLambdaHandler, wrapGenericHandler } from './Wrapper';

describe('Testing runtime wrapper', () => {

  afterEach( () => {
    jest.clearAllMocks();
  });

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
        "secret": "ThirdPartyAPI",
        "secretKey": "adminApiKey",
        required: true
      }
    };

    wrapGenericHandler(async (event, init, secrets, context, callback) => {}, {
      secretInjection: secretInj,
      secretFetchers: { aws: fetchSecretsFromAWS },
      type: LambdaType.GENERIC,
      messageType: MessageType.Object
    });

    expect(wrapHandlerSecretsManager).toHaveBeenCalledWith(
      expect.any(Function),
      secretInj,
      { aws: fetchSecretsFromAWS }
    );
  });

  it('Calls the secrets manager with empty object when not defined', async () => {
    wrapGenericHandler(async (event, init, secrets, context, callback) => {}, {
      type: LambdaType.GENERIC,
      messageType: MessageType.Binary,
    });

    expect(wrapHandlerSecretsManager).toHaveBeenCalledWith(
      expect.any(Function),
      {},
      {}
    );
  });

  it('Calls the Sentry wrapper', async () => {
    wrapGenericHandler(
      async (event, init, secrets, context, callback) => {},

      {
        sentry: true,
        type: LambdaType.GENERIC,
        messageType: MessageType.Binary,
      }
    );

    expect(wrapSentry).toHaveBeenCalledWith(expect.any(Function));
    expect(wrapSentry).toHaveBeenCalledTimes(1);
    wrapGenericHandler(async (event, init, secrets, context, callback) => {}, {
      sentry: false,
      type: LambdaType.GENERIC,
      messageType: MessageType.Binary,
    });
    // No more invocations
    expect(wrapSentry).toHaveBeenCalledTimes(1);
  });


  it("Configuration recordExceptionOnLambdaFail controls the exception", async () => {
    const _handler = async (event, init, secrets, context, callback) => {
      throw new Error();
    };
    const handler = wrapGenericHandler(
      _handler,
      {
        sources: {
          _general: {
            "recordExceptionOnLambdaFail": true
          }
        },
        type: LambdaType.GENERIC,
        messageType: MessageType.Binary,
      }
    );

    try {
      await handler( testApiGatewayEvent, LambdaContext, () => {});
    } catch( e ) {

    }

    expect( recordException ).toHaveBeenCalled();

    jest.clearAllMocks()

    const handler2 = wrapGenericHandler(
      _handler,
      {
        sources: {
          _general: {
            "recordExceptionOnLambdaFail": false
          }
        },
        type: LambdaType.GENERIC,
        messageType: MessageType.Binary,
      }
    );

    try {
      await handler2( testApiGatewayEvent, LambdaContext, () => {});
    } catch( e ) {

    }

    expect( recordException ).not.toHaveBeenCalled();
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
