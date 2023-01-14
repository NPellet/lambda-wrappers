import { config } from 'process';
import { LambdaContext, testApiGatewayEvent } from '../../test_utils/utils';
import {
  HTTPError,
  HTTPResponse,
} from '../../util/records/apigateway/response';
import { LambdaFactoryManager, SecretFetcher } from '../Manager';
import { clearCache } from './secrets_manager';

jest.mock('./secrets_manager_aws', function () {
  return {
    __esModule: true,
    fetchAwsSecret: jest.fn(async (secretName: string) => {
      return {
        D: 'D',
        F: 'F',
        K: 'K',
        K2: 'K2',
      };
    }),
  };
});

describe('Testing alternate sources in secrets manager', function () {
  afterEach(() => {
    jest.clearAllMocks();
    clearCache();
  });

  const awsSecrets = {
    ABC: {
      D: 'E',
      F: 'G',
    },

    DEP: {
      K: 'V',
    },

    DEP2: {
      K2: 'V2',
    },
  };

  const otherSecrets = {
    DEF: {
      G: 'H',
      I: 'J',
    },
  };

  let mockFetcher = jest.fn(async (toFetch, awsSecrets) => {
    let out: Record<string, string> = {};
    for (let [k, secret] of Object.entries(toFetch)) {
      out[k] = 'secretVal';
    }
    return out;
  });

  const mgr = new LambdaFactoryManager()
    .setAWSSecrets(awsSecrets)
    .addSecretSource<{}>()(
    'GCP',
    otherSecrets,
    (needsAws) => {
      return {
        preSecretKey: needsAws('DEP2', 'K2', true),
        otherSecretKey: needsAws('DEP', 'K'),
      };
    },
    mockFetcher
  );

  test('Secret from outside source is properly requested', async () => {
    const api = mgr
      .apiGatewayWrapperFactory('handler')
      .needsSecret('GCP', 'key', 'DEF', 'G', {}, true);

    const out = api.createHandler(
      class Ctrl {
        static async init() {
          return new Ctrl();
        }
        async handler(data, secrets) {
          expect(secrets.key).toBe('secretVal');
          expect(process.env.key).toBe('secretVal');
          return HTTPError.BAD_REQUEST();
        }
      }
    );

    const { configuration, handler } = out;

    expect(configuration.secretFetchers?.GCP).toBe(mockFetcher);

    expect(configuration.secretInjection?.['key']).toStrictEqual({
      meta: {},
      secret: 'DEF',
      secretKey: 'G',
      required: true,
      source: 'GCP',
    });

    await handler(testApiGatewayEvent, LambdaContext, () => {});
    expect(mockFetcher).toHaveBeenCalled();
  });

  test('Pre-secrets are fetched when using an external secret source', async () => {
    const api = mgr
      .apiGatewayWrapperFactory('handler')
      .needsSecret('GCP', 'key', 'DEF', 'G', {}, true);
    const { configuration, handler } = api.createHandler(
      class Ctrl {
        static async init() {
          return new Ctrl();
        }
        async handler(data, secrets) {
          return HTTPError.BAD_REQUEST();
        }
      }
    );

    // @ts-ignore(2339)
    expect(configuration.secretInjection?.preSecretKey).toStrictEqual({
      //meta: undefined,
      secret: 'DEP2',
      secretKey: 'K2',
      required: true,
      //source: "aws"
    });

    // @ts-ignore(2339)
    expect(configuration.secretInjection?.otherSecretKey.required).toBe(true);

    await handler(testApiGatewayEvent, LambdaContext, () => {});

    expect(mockFetcher).toHaveBeenCalled();
    expect(mockFetcher.mock.calls[0][1]).toStrictEqual({
      preSecretKey: 'K2',
      otherSecretKey: 'K',
    });
  });

  test('Pre-secrets are NOT fetched when using an external secret source but dependent source is not required', async () => {
    const api = mgr
      .apiGatewayWrapperFactory('handler')
      .needsSecret('aws', 'key', 'ABC', 'D', undefined, true);
    const { configuration, handler } = api.createHandler(
      class Ctrl {
        static async init() {
          return new Ctrl();
        }
        async handler(data, secrets) {
          expect(secrets.preSecretKey).toBeUndefined();
          return HTTPError.BAD_REQUEST();
        }
      }
    );

    await handler(testApiGatewayEvent, LambdaContext, () => {});

    expect(mockFetcher).not.toHaveBeenCalled();
  });
});
