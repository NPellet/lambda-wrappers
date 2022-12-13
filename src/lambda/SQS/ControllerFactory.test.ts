import _ from 'lodash';
import { LambdaContext } from '../../test_utils/utils';
import * as yup from 'yup';
import { SQSBatchResponse, SQSRecord } from 'aws-lambda';
import {
  SQSCtrlInterface,
  SQSHandlerWrapperFactory,
} from './ControllerFactory';
import { failSQSRecord } from '../../util/sqs/record';
import { controllerInterface } from '../../../examples/apigateway';
import { PayloadOf } from '../../util/types';

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
  it('Basic functionality works', async () => {
    const schema = yup.object({ a: yup.string() });

    const controllerFactory = new SQSHandlerWrapperFactory()
      .setInputSchema(schema)
      .setHandler('create');

    type IF = SQSCtrlInterface<typeof controllerFactory>;
    const handlerFactory = controllerFactory.makeHandlerFactory();

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

    const { handler, configuration } = handlerFactory(Ctrl);

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
    const controllerFactory = new SQSHandlerWrapperFactory()
      .setHandler('create')
      .needsSecret('key', 'Algolia-Products', 'adminApiKey', true);

    expect(controllerFactory._secrets).toStrictEqual({
      key: {
        required: true,
        secret: ['Algolia-Products', 'adminApiKey'],
      },
    });
    // Verifying attribute has been copied
    expect(controllerFactory._handler).toBe('create');
  });

  test('Testing TS Input', async () => {
    const controllerFactory = new SQSHandlerWrapperFactory()
      .setHandler('create')
      .setTsInputType<null>();

    expect(controllerFactory._handler).toBe('create');
  });
});
