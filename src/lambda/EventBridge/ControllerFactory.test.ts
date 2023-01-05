import _ from 'lodash';
import * as yup from 'yup';
import { EventBridgeHandlerWrapperFactory } from './ControllerFactory';
import { LambdaFactoryManager } from '../Manager';
import { LambdaContext, testEventBridgeEvent } from '../../test_utils/utils';
import { MessageType } from '../../util/types';
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
      if (secretName == 'a') {
        return {
          b: 'c',
          apiKey: 'algoliaApiKey',
        };
      } else if (secretName === 'Google') {
        return 'secretString';
      }
    }),
  };
});

describe('Testing EventBridge wrapper factory', function () {
  it('All properties get copied', async function () {
    const fac = new LambdaFactoryManager().eventBridgeWrapperFactory(
      'ahandler'
    );
    expect(fac).toBeInstanceOf(EventBridgeHandlerWrapperFactory);
    expect(fac._handler).toBe('ahandler');

    const fac2 = fac
      .setTsInputType<{ a: string }>()
      .needsSecret('aws', 'key', 'a', 'b', undefined, true)
      .sentryDisable()
      .setInputSchema(
        yup.object({
          a: yup.number(),
        })
      );

    expect(fac2._handler).toBe('ahandler');
    expect(fac2._inputSchema).toBeInstanceOf(yup.ObjectSchema);
    expect(fac2._secrets.key).toStrictEqual({
      source: 'aws',
      meta: undefined,
      secret: 'a',
      secretKey: 'b',
      required: true,
    });

    const ahandler = jest.fn(async (data, secrets) => {});

    const { handler, configuration } = fac2.createHandler(
      class Ctrl {
        static async init() {
          return new Ctrl();
        }
        ahandler = ahandler;
      }
    );

    await handler(
      Object.assign(testEventBridgeEvent, { detail: { a: 2 } }),
      LambdaContext,
      () => {}
    );

    expect(ahandler).toHaveBeenCalled();
    expect(ahandler.mock.calls[0][1]!.key).toBe('c');

    expect(configuration.secretInjection!.key).toBeDefined();
    expect(configuration.messageType).toBe(MessageType.Object);
  });

  test('Runtime Configuration works', function () {
    const wrapper = new LambdaFactoryManager()
      .eventBridgeWrapperFactory('handler')
      .configureRuntime({}, { recordExceptionOnLambdaFail: true });

    expect(wrapper.runtimeCfg).toMatchObject({
      _general: { recordExceptionOnLambdaFail: true },
    });

    const { configuration } = wrapper.createHandler(
      class Ctrl {
        static async init() {
          return new Ctrl();
        }
        async handler() {
          return;
        }
      }
    );

    expect(spyOnExpandedConfiguration).toHaveBeenCalled();
  });
});
