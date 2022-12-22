import _ from 'lodash';
import { LambdaContext } from '../../test_utils/utils';
import * as yup from 'yup';
import { SQSBatchResponse, SQSRecord } from 'aws-lambda';
import { failSQSRecord } from '../../util/sqs/record';
import {
  SQSCtrlInterface,
  SQSHandlerWrapperFactory,
} from '../SQS/ControllerFactory';
import { IfHandler, LambdaFactoryManager } from '..';

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

describe('Testing API Controller factory', function () {
  it('Basic functionality works', async () => {
    const schema = yup.object({ a: yup.string() });
    const controllerFactory = new SQSHandlerWrapperFactory( new LambdaFactoryManager() )
      .setInputSchema(schema)
      .setHandler('create');

    const handlerFactory = controllerFactory.makeHandlerFactory();

    const mockHandler = jest.fn(async (data, secrets) => {
      if (data.getData().a === '1') {
        throw new Error("Didn't work");
      }

      if (data.getData().a === '2') {
        return failSQSRecord(data);
      }

      if (data.getData().a === '3') {
        return;
      }
    }) as IfHandler<SQSCtrlInterface<typeof controllerFactory>>;

    class Ctrl implements SQSCtrlInterface<typeof controllerFactory> {
      static async init(secrets) {
        return new Ctrl();
      }

      create: IfHandler<SQSCtrlInterface<typeof controllerFactory>> = async (
        data,
        secrets
      ) => {
        return mockHandler(data, secrets);
      };
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
});
