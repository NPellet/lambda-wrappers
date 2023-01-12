import _ from 'lodash';

import {
  LambdaContext,
  testSNSEvent,
  testSNSRecord,
} from '../../test_utils/utils';
import * as yup from 'yup';
import {
  SNSCtrlInterface,
  SNSHandlerWrapperFactory,
} from './ControllerFactory';
import { IfHandler, LambdaFactoryManager } from '..';
import { MessageType } from '../../util/types';
import { BaseWrapperFactory } from '../BaseWrapperFactory';
import { _makeCompatibilityCheck } from '@opentelemetry/api/build/src/internal/semver';

const spyOnExpandedConfiguration = jest.spyOn(
  BaseWrapperFactory.prototype,
  // @ts-ignore
  'expandConfiguration'
);

describe('Testing API Controller factory', function () {
  it('All properties get copied', function () {
    const fac = new LambdaFactoryManager().snsWrapperFactory('ahandler');
    expect(fac).toBeInstanceOf(SNSHandlerWrapperFactory);
    // @ts-ignore
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
    // @ts-ignore
    expect(fac2._handler).toBe('ahandler');
    expect(fac2._inputSchema).toBeInstanceOf(yup.ObjectSchema);
    expect(fac2._secrets.key).toStrictEqual({
      meta: undefined,
      source: 'aws',
      secret: 'a',
      secretKey: 'b',
      required: true,
    });
  });

  it('Basic functionality works', async () => {
    const schema = yup.object({ a: yup.string() });
    const controllerFactory = new SNSHandlerWrapperFactory(
      new LambdaFactoryManager()
    )
      .setInputSchema(schema)
      .setHandler('create');

    const mockHandler = jest.fn(async (data, secrets) => {
      if (data.getData().a === '1') {
        throw new Error("Didn't work");
      }

      if (data.getData().a === '2') {
        return;
      }
    });

    class Ctrl implements SNSCtrlInterface<typeof controllerFactory> {
      static async init(secrets) {
        return new Ctrl();
      }

      create: IfHandler<SNSCtrlInterface<typeof controllerFactory>> = async (
        data,
        secrets
      ) => {
        return mockHandler(data, secrets);
      };
    }

    const { handler, configuration } = controllerFactory.createHandler(Ctrl);

    await expect(
      handler(
        {
          Records: [
            {
              ...testSNSRecord,
              Sns: { ...testSNSRecord.Sns, Message: 'BAD_JSON' },
            }, // We put it first to make sure the rest still runs
          ],
        },
        LambdaContext,
        () => {}
      )
    ).rejects.toBeDefined();

    expect(mockHandler).toHaveBeenCalledTimes(0);

    const out2 = await handler(
      {
        Records: [
          {
            ...testSNSRecord,
            Sns: { ...testSNSRecord.Sns, Message: JSON.stringify({ a: '1' }) },
          },
          //{ ...testSNSRecord, Sns: { ...testSNSRecord.Sns, Message: JSON.stringify({ a: '2' }) } },
        ],
      },
      LambdaContext,
      () => {}
    );

    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  test('Runtime Configuration works', function () {
    const wrapper = new LambdaFactoryManager()
      .snsWrapperFactory('handler')
      .configureRuntime({}, { recordExceptionOnLambdaFail: true });

    // @ts-ignore
    expect(wrapper._runtimeCfg).toMatchObject({
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

  const createConf = (
    factory: SNSHandlerWrapperFactory<any, any, string, any, any>
  ) => {
    const { configuration, handler } = factory.setHandler('h').createHandler(
      class Ctrl {
        static async init() {
          return new Ctrl();
        }
        async h() {}
      }
    );

    return configuration;
  };

  describe('Message types', function () {
    test('setStringInputType yields a message of type String in config', async () => {
      const fac1 = new SNSHandlerWrapperFactory(
        new LambdaFactoryManager()
      ).setStringInputType();
      expect(createConf(fac1).messageType).toBe(MessageType.String);
    });

    test('setNumberInputType yields a message of type Number in config', async () => {
      const fac1 = new SNSHandlerWrapperFactory(
        new LambdaFactoryManager()
      ).setNumberInputType();
      expect(createConf(fac1).messageType).toBe(MessageType.Number);
    });

    test('setObjectInputType yields a message of type Object in config', async () => {
      const fac1 = new SNSHandlerWrapperFactory(
        new LambdaFactoryManager()
      ).setTsInputType<{ a: string }>();
      expect(createConf(fac1).messageType).toBe(MessageType.Object);
    });

    test('setBinaryInputType yields a message of type Binary in config', async () => {
      const fac1 = new SNSHandlerWrapperFactory(
        new LambdaFactoryManager()
      ).setBinaryInputType();
      expect(createConf(fac1).messageType).toBe(MessageType.Binary);
    });

    test('Using setInputSchema with a string schema yields a message of type String in config', async () => {
      const fac1 = new SNSHandlerWrapperFactory(
        new LambdaFactoryManager()
      ).setInputSchema(yup.string());
      expect(createConf(fac1).messageType).toBe(MessageType.String);
    });

    test('Using setInputSchema with a number schema yields a message of type String in config', async () => {
      const fac1 = new SNSHandlerWrapperFactory(
        new LambdaFactoryManager()
      ).setInputSchema(yup.number());
      expect(createConf(fac1).messageType).toBe(MessageType.Number);
    });

    test('Using setInputSchema with a object schema yields a message of type String in config', async () => {
      const fac1 = new SNSHandlerWrapperFactory(
        new LambdaFactoryManager()
      ).setInputSchema(yup.object());
      expect(createConf(fac1).messageType).toBe(MessageType.Object);
    });
  });
});

describe('SNS wrapFunc', function () {
  test('Basic functionality', async () => {
    const fn = jest.fn();

    const out = new LambdaFactoryManager()
      .snsWrapperFactory('my_handler')
      .setTsInputType<{ a: number }>()
      .wrapFunc(async function (payload, init, secrets) {
        // All good
        fn();
      });

    await expect(
      out.my_handler(testSNSEvent, LambdaContext, () => {})
    ).resolves.toBeUndefined();

    expect(fn).toHaveBeenCalled();
  });
});
