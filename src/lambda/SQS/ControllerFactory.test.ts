import _ from 'lodash';
import { LambdaContext, testSQSEvent } from '../../test_utils/utils';
import * as yup from 'yup';
import { SQSBatchResponse, SQSRecord } from 'aws-lambda';
import {
  SQSCtrlInterface,
  SQSHandlerWrapperFactory,
} from './ControllerFactory';
import { MessageType, PayloadOf } from '../../util/types';
import { LambdaFactoryManager } from '../Manager';
import { failSQSRecord } from '../../util/records/sqs/record';
import { CtrlInterfaceOf } from '../CtrlInterface';
import { BaseWrapperFactory } from '../BaseWrapperFactory';

const spyOnExpandedConfiguration = jest.spyOn(
  BaseWrapperFactory.prototype,
  // @ts-ignore
  'expandConfiguration'
);

const testRecord: SQSRecord = {
  messageId: 'abc',
  receiptHandle: 'abc',
  body: 'abc',
  attributes: {
    AWSTraceHeader: 'abc',
    ApproximateReceiveCount: 'abc',
    SentTimestamp: 'abc',
    SenderId: 'abc',
    ApproximateFirstReceiveTimestamp: 'abc',
  },
  messageAttributes: {},
  md5OfBody: 'abc',
  eventSource: 'abc',
  eventSourceARN: 'abc',
  awsRegion: 'abc',
};

describe('Testing SQS Wrapper factory', function () {
  it('All properties get copied', function () {
    const fac = new LambdaFactoryManager().sqsWrapperFactory('ahandler');
    expect(fac).toBeInstanceOf(SQSHandlerWrapperFactory);
    expect(fac._handler).toBe('ahandler');

    const fac2 = fac
      .setTsInputType<{ a: string }>()
      .needsSecret('aws', 'key', 'a', 'b', undefined, true)
      .sentryDisable();

    expect(fac2._handler).toBe('ahandler');
    //expect(fac2._inputSchema).toBeInstanceOf(yup.ObjectSchema);
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

    const controllerFactory = new SQSHandlerWrapperFactory(
      new LambdaFactoryManager()
    )
      .setTsInputType<{ a: string}>()
      .setHandler('create');

    type IF = CtrlInterfaceOf<typeof controllerFactory>;

    const mockHandler = jest.fn(
      async (data: PayloadOf<IF, 'create'>, secrets) => {
        if (data.getData().a === '1') {
          throw new Error("Didn't work");
        }

        if (data.getData().a === '2') {
          return failSQSRecord(data);
        }

        if (data.getData().a === '3') {
          return;
        }
      }
    );

    class Ctrl implements SQSCtrlInterface<typeof controllerFactory> {
      static async init(secrets) {
        return new Ctrl();
      }

      async create(data: PayloadOf<IF, 'create'>, secrets) {
        return mockHandler(data, secrets);
      }
    }

    const { handler, configuration } = controllerFactory.createHandler(Ctrl);

    const out = await handler(
      {
        Records: [
          { ...testRecord, body: JSON.stringify({ a: '1' }), messageId: '1' },
          { ...testRecord, body: JSON.stringify({ a: '2' }), messageId: '2' },
          { ...testRecord, body: JSON.stringify({ a: '3' }), messageId: '3' },
        ],
      },
      LambdaContext,
      () => {}
    );

    expect(out).not.toBeFalsy();

    const _out = out as SQSBatchResponse;
    expect(_out.batchItemFailures).toBeDefined();
    expect(
      _out.batchItemFailures.find((e) => e.itemIdentifier == '1')
    ).toBeDefined();

    expect(
      _out.batchItemFailures.find((e) => e.itemIdentifier == '2')
    ).toBeDefined();

    expect(
      _out.batchItemFailures.find((e) => e.itemIdentifier == '3')
    ).toBeUndefined();
  });

  test('Testing needsSecret', async () => {
    const controllerFactory = new SQSHandlerWrapperFactory(
      new LambdaFactoryManager()
    )
      .setHandler('create')
      .needsSecret(
        'aws',
        'key',
        'ThirdPartyAPI',
        'adminApiKey',
        undefined,
        true
      );

    expect(controllerFactory._secrets).toStrictEqual({
      key: {
        meta: undefined,
        source: 'aws',
        required: true,
        secret: 'ThirdPartyAPI',
        secretKey: 'adminApiKey',
      },
    });
    // Verifying attribute has been copied
    // @ts-ignore
    expect(controllerFactory._handler).toBe('create');
  });

  test('Testing TS Input', async () => {
    const controllerFactory = new SQSHandlerWrapperFactory(
      new LambdaFactoryManager()
    )
      .setHandler('create')
      .setTsInputType<null>();

    // @ts-ignore
    expect(controllerFactory._handler).toBe('create');
  });

  test('Runtime Configuration works', function () {
    const wrapper = new LambdaFactoryManager()
      .sqsWrapperFactory('handler')
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

  describe('Message types', function () {
    const createConf = (
      factory: SQSHandlerWrapperFactory<any, any, string, any, any>
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

    test('setStringInputType yields a message of type String in config', async () => {
      const fac1 = new SQSHandlerWrapperFactory(
        new LambdaFactoryManager()
      ).setStringInputType();
      expect(createConf(fac1).messageType).toBe(MessageType.String);
    });

    test('setNumberInputType yields a message of type Number in config', async () => {
      const fac1 = new SQSHandlerWrapperFactory(
        new LambdaFactoryManager()
      ).setNumberInputType();
      expect(createConf(fac1).messageType).toBe(MessageType.Number);
    });

    test('setObjectInputType yields a message of type Object in config', async () => {
      const fac1 = new SQSHandlerWrapperFactory(
        new LambdaFactoryManager()
      ).setTsInputType<{ a: string }>();
      expect(createConf(fac1).messageType).toBe(MessageType.Object);
    });

    test('setBinaryInputType yields a message of type Binary in config', async () => {
      const fac1 = new SQSHandlerWrapperFactory(
        new LambdaFactoryManager()
      ).setBinaryInputType();
      expect(createConf(fac1).messageType).toBe(MessageType.Binary);
    });

   
  });
});

describe('SQS wrapFunc', function () {
  test('Basic functionality', async () => {
    const fn = jest.fn();

    const out = new LambdaFactoryManager()
      .sqsWrapperFactory('my_handler')
      .setTsInputType<{ a: number }>()
      .wrapFunc(async function (payload, init, secrets) {
        // All good
        fn();
      });

    await expect(
      out.my_handler(testSQSEvent, LambdaContext, () => {})
    ).resolves.toStrictEqual({ batchItemFailures: [] });

    expect(fn).toHaveBeenCalled();
  });
});
