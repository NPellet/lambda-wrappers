import _ from 'lodash';
import { LambdaContext, memoryExporter } from '../../test_utils/utils';
import * as yup from 'yup';
import { SQSBatchResponse, SQSRecord } from 'aws-lambda';
import { createSQSHandler } from './sqs';

jest.mock('../../util/exceptions', function () {
  const { recordException } = jest.requireActual('../../util/exceptions');
  return {
    recordException: jest.fn(recordException),
  };
});

import { recordException } from '../../util/exceptions';
import { SpanStatusCode } from '@opentelemetry/api';
import { MessageType } from '../../util/types';

const testRecord: SQSRecord = {
  messageId: 'abc',
  receiptHandle: 'abc',
  body: JSON.stringify({ b: 'abc' }),
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

describe('Testing SQS Handler wrapper', function () {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('Basic functionality works', async () => {
    const handler = createSQSHandler(async (data, init, secrets) => {}, {

      messageType: MessageType.Object,
    });

    await expect(
      handler(
        {
          Records: [testRecord],
        },
        LambdaContext,
        () => {}
      )
    ).resolves.toMatchObject({ batchItemFailures: [] });
  });

  it('When body is not a JSON and a JSON is expected, fails', async () => {
    const handler = createSQSHandler(async (data, init, secrets) => {
      data.getData(); // <== Makes it fail
    }, {

      messageType: MessageType.Object,
    });

    await expect(
      handler(
        {
          Records: [{ ...testRecord, body: 'abc' }],
        },
        LambdaContext,
        () => {}
      )
    ).resolves.toMatchObject({
      batchItemFailures: [
        {
          itemIdentifier: testRecord.messageId,
        },
      ],
    });
  });

  it('Failed input schema outputs a batchItemFailure but does not record exception', async () => {
    const handler = createSQSHandler(async (data, init, secrets) => {}, {
      yupSchemaInput: yup.object({
        requiredInputString: yup.string().required(),
        aNumber: yup.number(),
      }),

      messageType: MessageType.Binary,
    });

    await expect(
      handler(
        {
          Records: [testRecord],
        },
        LambdaContext,
        () => {}
      )
    ).resolves.toMatchObject({
      batchItemFailures: [
        {
          itemIdentifier: testRecord.messageId,
        },
      ],
    });

    expect(recordException).not.toHaveBeenCalled();
  });

  it('Failed handler outputs a batchItemFailure', async () => {
    const handler = createSQSHandler(async (data, init, secrets) => {
      throw new Error("Couldn't process !");
    }, {

      messageType: MessageType.Object,
    });

    await expect(
      handler(
        {
          Records: [testRecord],
        },
        LambdaContext,
        () => {}
      )
    ).resolves.toMatchObject({
      batchItemFailures: [
        {
          itemIdentifier: testRecord.messageId,
        },
      ],
    });
    expect(recordException).toHaveBeenCalledTimes(1);
  });
});

describe('Testing SQS Opentelemetry', function () {
  it('Properly wraps open telemetry', async () => {
    const handler = createSQSHandler(async (data, init, secrets) => {}, {
      opentelemetry: true,

      messageType: MessageType.Object,
    });

    await expect(
      handler(
        {
          Records: [testRecord, testRecord],
        },
        LambdaContext,
        () => {}
      )
    ).resolves.toMatchObject({
      batchItemFailures: [],
    });

    const spans = memoryExporter.getFinishedSpans();
    expect(spans.length).toBe(4);
    expect(spans[0].parentSpanId).toBe(spans[2].spanContext().spanId);
    expect(spans[1].parentSpanId).toBe(spans[3].spanContext().spanId);
  });

  it('When handler throws, both spans fail', async () => {
    const handler = createSQSHandler(
      async (data, init, secrets) => {
        throw new Error();
      },
      {
        opentelemetry: true,

      messageType: MessageType.Object,
      }
    );

    await expect(
      handler(
        {
          Records: [testRecord],
        },
        LambdaContext,
        () => {}
      )
    ).resolves.toBeTruthy();

    const spans = memoryExporter.getFinishedSpans();
    expect(spans.length).toBe(2);
    expect(spans[1].status.code).toBe(SpanStatusCode.ERROR);
    expect(spans[0].status.code).toBe(SpanStatusCode.ERROR);
  });

  it('When the schema validation fails, only 1 span exists and it is failed', async () => {
    const handler = createSQSHandler(
      async (data, init, secrets) => {
        throw new Error();
      },
      {
        opentelemetry: true,
        yupSchemaInput: yup.object({
          requiredInputString: yup.string().required(),
          aNumber: yup.number(),
        }),

      messageType: MessageType.Object,
      }
    );

    await expect(
      handler(
        {
          Records: [testRecord],
        },
        LambdaContext,
        () => {}
      )
    ).resolves.toBeTruthy();

    const spans = memoryExporter.getFinishedSpans();
    expect(spans.length).toBe(1);
    expect(spans[0].status.code).toBe(SpanStatusCode.ERROR);
  });
});
