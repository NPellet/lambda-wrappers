import _ from 'lodash';
import { testApiGatewayEvent, LambdaContext } from '../../test_utils/utils';
import * as yup from 'yup';
import {
  APIGatewayCtrlInterface,
  APIGatewayHandlerWrapperFactory,
} from './ControllerFactory';
import { HTTPError } from '../../util/apigateway/response';
import { SecretsOf } from '../../util/types';
import { IfHandler } from '../../../dist/lambda';

jest.mock('../utils/secrets_manager_aws', function () {
  return {
    __esModule: true,
    fetchAwsSecret: jest.fn(async (secretName: string) => {
      if (secretName == 'Algolia-Products') {
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
    const schema = yup.object({ a: yup.string() });

    const mockHandler = jest.fn(async (data, secrets) => {
      return HTTPError.BAD_REQUEST('Oups');
    });

    const fac = new APIGatewayHandlerWrapperFactory()
      .needsSecret('abc', 'Algolia-Products', 'adminApiKey', true)
      .setTsOutputType<{ b: number }>()
      .setTsInputType<{ a: string }>()
      .setInputSchema(schema)
      .setOutputSchema(yup.object({ b: yup.number() }))
      .setHandler('create');

    const handlerFactory = fac.makeHandlerFactory();

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

    const { handler, configuration } = handlerFactory(Ctrl);

    expect(configuration.secretInjection!.abc).toStrictEqual({
      secret: ['Algolia-Products', 'adminApiKey'],
      required: true,
    });

    expect(configuration.yupSchemaInput).toStrictEqual(schema);
    expect(configuration.secretInjection!.abc.required).toBe(true);
    expect(configuration.secretInjection!.abc.secret).toStrictEqual([
      'Algolia-Products',
      'adminApiKey',
    ]);
    const out = await handler(testApiGatewayEvent, LambdaContext, () => {});
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
    const fac = new APIGatewayHandlerWrapperFactory()
      .needsSecret('abc', 'Algolia-Products', 'adminApiKey')
      .setHandler('create');

    const handlerFactory = fac.makeHandlerFactory();

    class Ctrl {
      static async init() {
        return new Ctrl();
      }

      create = async (data, secrets) => {
        return HTTPError.BAD_REQUEST('');
      };
    }

    const { configuration } = handlerFactory(Ctrl);
    expect(configuration.secretInjection?.abc.required).toBe(true);
  });
});
