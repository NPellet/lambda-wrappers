import _ from 'lodash';
import { testApiGatewayEvent, LambdaContext } from '../../test_utils/utils';
import * as yup from 'yup';
import { APIHandlerControllerFactory } from './apiCtrlFactory';
import { HTTPError } from '../../util/apigateway/response';

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

    const { BaseController, handlerFactory } = new APIHandlerControllerFactory()
      .needsSecret('abc', 'Algolia-Products', 'adminApiKey', true)
      .setInputSchema(schema)
      .ready();

    class Ctrl extends BaseController {
      static async init(secrets) {
        expect(secrets.abc).toBe('algoliaApiKey');
        expect(process.env.abc).toBe('algoliaApiKey');
        return new Ctrl();
      }

      async handle(data, secrets) {
        expect(secrets.abc).toBe('algoliaApiKey');
        expect(process.env.abc).toBe('algoliaApiKey');

        return mockHandler(data, secrets);
      }
    }

    const { handler, configuration } = handlerFactory(Ctrl);

    expect(configuration.secretInjection!.abc).toStrictEqual({
      secret: ['Algolia-Products', 'adminApiKey'],
      required: true,
    });

    expect(configuration.yupSchemaInput).toStrictEqual(schema);

    const out = await handler(testApiGatewayEvent, LambdaContext, () => {});
    expect(out.statusCode).toBe(500);
    expect(out.body).toContain('Lambda input schema validation failed');

    expect(mockHandler).not.toHaveBeenCalled(); // Validation doesn't pass
    const apiGatewayEventClone = _.cloneDeep(testApiGatewayEvent);
    apiGatewayEventClone.body = JSON.stringify({ a: 'abc' });

    const out2 = await handler(apiGatewayEventClone, LambdaContext, () => {});

    expect(mockHandler).toHaveBeenCalled(); // Validation doesn't pass
    expect(out2.statusCode).toBe(HTTPError.BAD_REQUEST('').getStatusCode());
  });
});
