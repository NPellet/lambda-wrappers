import _ from 'lodash';
import { testApiGatewayEvent, LambdaContext } from '../../test_utils/utils';
import * as yup from 'yup';
import {
  APIGatewayCtrlInterface,
  APIGatewayHandlerWrapperFactory,
} from './ControllerFactory';
import {
  HTTPError,
  HTTPResponse,
} from '../../util/records/apigateway/response';
import { IfHandler, MessageType, SecretsOf } from '../../util/types';
import { LambdaFactoryManager } from '../Manager';
import { Request } from '../../util/records/apigateway/request';
import { BaseWrapperFactory } from '../BaseWrapperFactory';

const spyOnExpandedConfiguration = jest.spyOn(
  BaseWrapperFactory.prototype,
  // @ts-ignore
  'expandConfiguration'
);

jest.mock('../utils/secrets_manager_aws', function () {
  return {
    __esModule: true,
    fetchAwsSecret: jest.fn(async (secretName: string) => {
      if (secretName == 'ThirdPartyAPI') {
        return {
          adminApiKey: 'algoliaApiKey',
          apiKey: 'algoliaApiKey',
        };
      } else if (secretName === 'Google') {
        return 'secretString';
      }
    }),
  };
});

describe('Testing API Controller factory', function () {
  it('Basic functionality works', async () => {
    const schema = yup.object({ a: yup.string().required() });

    const mockHandler = jest.fn(async (data, secrets) => {
      return HTTPError.BAD_REQUEST('Oups');
    });

    const fac = new APIGatewayHandlerWrapperFactory(new LambdaFactoryManager())
      .needsSecret(
        'aws',
        'abc',
        'ThirdPartyAPI',
        'adminApiKey',
        undefined,
        true
      )
      .setTsOutputType<{ b: number }>()
      .setTsInputType<{ a: string }>()
      .setInputSchema(schema)
      .setOutputSchema(yup.object({ b: yup.number() }))
      .setHandler('create');

    type IF = APIGatewayCtrlInterface<typeof fac>;
    class Ctrl implements IF {
      static async init(secrets: SecretsOf<IF, 'create'>) {
        expect(secrets.abc).toBe('algoliaApiKey');
        expect(process.env.abc).toBe('algoliaApiKey');
        return new Ctrl();
      }

      create: IfHandler<IF> = async (data, secrets) => {
        expect(secrets.abc).toBe('algoliaApiKey');
        expect(process.env.abc).toBe('algoliaApiKey');
        expect(data.getData().a).toBe('abc');
        return mockHandler(data, secrets);
      };
    }

    const { handler, configuration } = fac.createHandler(Ctrl);

    expect(configuration.secretInjection!.abc).toStrictEqual({
      source: 'aws',
      meta: undefined,
      secret: 'ThirdPartyAPI',
      secretKey: 'adminApiKey',
      required: true,
    });

    expect(configuration.yupSchemaInput).toStrictEqual(schema);
    expect(configuration.secretInjection!.abc.required).toBe(true);
    expect(configuration.secretInjection!.abc.secret).toStrictEqual(
      'ThirdPartyAPI'
    );
    expect(configuration.secretInjection!.abc.secretKey).toStrictEqual(
      'adminApiKey'
    );

    const clonedTest = _.cloneDeep(testApiGatewayEvent);
    clonedTest.body = JSON.stringify({ wrongInput: 'c' });

    const out = await handler(clonedTest, LambdaContext, () => {});
    expect(out.statusCode).toBe(500);
    expect(out.body).toContain('Lambda input schema validation failed');

    expect(mockHandler).not.toHaveBeenCalled(); // Validation doesn't pass
    const apiGatewayEventClone = _.cloneDeep(testApiGatewayEvent);
    apiGatewayEventClone.headers['Content-Type'] = 'application/json';
    apiGatewayEventClone.body = JSON.stringify({ a: 'abc' });

    const out2 = await handler(apiGatewayEventClone, LambdaContext, () => {});

    expect(mockHandler).toHaveBeenCalled(); // Validation doesn't pass
    expect(out2.statusCode).toBe(HTTPError.BAD_REQUEST('').getStatusCode());
  });

  it('needsSecret required param defaults to true', () => {
    const fac = new APIGatewayHandlerWrapperFactory(new LambdaFactoryManager())
      .needsSecret('aws', 'abc', 'ThirdPartyAPI', 'adminApiKey', {})
      .setHandler('create');

    class Ctrl {
      static async init() {
        return new Ctrl();
      }

      create = async (data, secrets) => {
        return HTTPError.BAD_REQUEST('');
      };
    }

    const { configuration } = fac.createHandler(Ctrl);
    expect(configuration.secretInjection?.abc.required).toBe(true);
  });

  it('By default, use the string message type', async () => {
    const handlerImpl = jest.fn(async (data: Request<any>, secrets) => {
      expect(data.getMessageType()).toBe(MessageType.String);
      return HTTPError.BAD_REQUEST('');
    });

    const { configuration, handler } = new LambdaFactoryManager()
      .apiGatewayWrapperFactory('handler')
      .createHandler(
        class Ctrl {
          static async init() {
            return new Ctrl();
          }

          handler = handlerImpl;
        }
      );

    expect(configuration.messageType).toBe(MessageType.String);

    await handler(testApiGatewayEvent, LambdaContext, () => {});

    expect(handlerImpl).toHaveBeenCalledTimes(1);
  });

  it('runtimeConfiguration works', function () {
    const wrapper = new LambdaFactoryManager()
      .apiGatewayWrapperFactory('handler')
      .configureRuntime({}, { recordExceptionOnLambdaFail: true });

    // @ts-ignore
    expect(wrapper._runtimeCfg).toMatchObject({
      _general: { recordExceptionOnLambdaFail: true },
    });

    const cfg = wrapper.createHandler(
      class Ctrl {
        static async init() {
          return new Ctrl();
        }
        async handler() {
          return HTTPResponse.OK_NO_CONTENT();
        }
      }
    );

    expect(spyOnExpandedConfiguration).toHaveBeenCalled();
  });

  describe('Message types', function () {
    const createConf = (
      factory: APIGatewayHandlerWrapperFactory<
        any,
        any,
        any,
        string,
        any,
        any,
        any
      >
    ) => {
      const { configuration, handler } = factory.setHandler('h').createHandler(
        class Ctrl {
          static async init() {
            return new Ctrl();
          }
          async h() {
            return HTTPError.BAD_REQUEST();
          }
        }
      );

      return configuration;
    };

    test('setStringInputType yields a message of type String in config', async () => {
      const fac1 = new APIGatewayHandlerWrapperFactory(
        new LambdaFactoryManager()
      ).setStringInputType();
      expect(createConf(fac1).messageType).toBe(MessageType.String);
    });

    test('setNumberInputType yields a message of type Number in config', async () => {
      const fac1 = new APIGatewayHandlerWrapperFactory(
        new LambdaFactoryManager()
      ).setNumberInputType();
      expect(createConf(fac1).messageType).toBe(MessageType.Number);
    });

    test('setObjectInputType yields a message of type Object in config', async () => {
      const fac1 = new APIGatewayHandlerWrapperFactory(
        new LambdaFactoryManager()
      ).setTsInputType<{ a: string }>();
      expect(createConf(fac1).messageType).toBe(MessageType.Object);
    });

    test('setBinaryInputType yields a message of type Binary in config', async () => {
      const fac1 = new APIGatewayHandlerWrapperFactory(
        new LambdaFactoryManager()
      ).setBinaryInputType();
      expect(createConf(fac1).messageType).toBe(MessageType.Binary);
    });

    test('Using setInputSchema with a string schema yields a message of type String in config', async () => {
      const fac1 = new APIGatewayHandlerWrapperFactory(
        new LambdaFactoryManager()
      ).setInputSchema(yup.string());
      expect(createConf(fac1).messageType).toBe(MessageType.String);
    });

    test('Using setInputSchema with a number schema yields a message of type String in config', async () => {
      const fac1 = new APIGatewayHandlerWrapperFactory(
        new LambdaFactoryManager()
      ).setInputSchema(yup.number());
      expect(createConf(fac1).messageType).toBe(MessageType.Number);
    });

    test('Using setInputSchema with a object schema yields a message of type String in config', async () => {
      const fac1 = new APIGatewayHandlerWrapperFactory(
        new LambdaFactoryManager()
      ).setInputSchema(yup.object());
      expect(createConf(fac1).messageType).toBe(MessageType.Object);
    });
  });
});
