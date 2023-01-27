import _ from 'lodash';
import {
  LambdaContext,
  memoryExporter,
  testSQSRecord,
  yupValidation,
} from '../../test_utils/utils';
import * as yup from 'yup';
import { SQSRecord } from 'aws-lambda';
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
          Records: [testSQSRecord],
        },
        LambdaContext,
        () => {}
      )
    ).resolves.toMatchObject({ batchItemFailures: [] });
  });

  it('When body is not a JSON and a JSON is expected, fails', async () => {
    const handler = createSQSHandler(
      async (data, init, secrets) => {
        data.getData(); // <== Makes it fail
      },
      {
        messageType: MessageType.Object,
      }
    );

    await expect(
      handler(
        {
          Records: [{ ...testSQSRecord, body: 'abc' }],
        },
        LambdaContext,
        () => {}
      )
    ).resolves.toMatchObject({
      batchItemFailures: [
        {
          itemIdentifier: testSQSRecord.messageId,
        },
      ],
    });
  });

  it('Failed input schema outputs a batchItemFailure but does not record exception', async () => {
    const handler = createSQSHandler(async (data, init, secrets) => {}, {
      validateInputFn: [yupValidation(yup.object({
        requiredInputString: yup.string().required(),
        aNumber: yup.number(),
      }))],

      messageType: MessageType.Binary,
    });

    await expect(
      handler(
        {
          Records: [testSQSRecord],
        },
        LambdaContext,
        () => {}
      )
    ).resolves.toMatchObject({
      batchItemFailures: [
        {
          itemIdentifier: testSQSRecord.messageId,
        },
      ],
    });

    expect(recordException).not.toHaveBeenCalled();
  });

  it('Failed handler outputs a batchItemFailure', async () => {
    const handler = createSQSHandler(
      async (data, init, secrets) => {
        throw new Error("Couldn't process !");
      },
      {
        sources: {
          _general: {
            recordExceptionOnLambdaFail: true,
          },
        },
        messageType: MessageType.Object,
      }
    );

    await expect(
      handler(
        {
          Records: [testSQSRecord],
        },
        LambdaContext,
        () => {}
      )
    ).resolves.toMatchObject({
      batchItemFailures: [
        {
          itemIdentifier: testSQSRecord.messageId,
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
          Records: [testSQSRecord, testSQSRecord],
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
          Records: [testSQSRecord],
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
        validateInputFn: [yupValidation(yup.object({
          requiredInputString: yup.string().required(),
          aNumber: yup.number(),
        }))],

        messageType: MessageType.Object,
      }
    );

    await expect(
      handler(
        {
          Records: [testSQSRecord],
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

describe('SQS: Runtime config', function () {
  it('Validation failure silences the lambda', async () => {
    const handler = createSQSHandler(async () => {}, {
      sources: {
        sqs: {
          silenceRecordOnValidationFail: true,
        },
      },
      messageType: MessageType.String,
      validateInputFn: [yupValidation(yup.object({
        field: yup.number().required(),
      }))],
    });

    await expect(
      handler({ Records: [testSQSRecord] }, LambdaContext, () => {})
    ).resolves.toStrictEqual({ batchItemFailures: [] });

    const handler2 = createSQSHandler(async () => {}, {
      sources: {
        sqs: {
          silenceRecordOnValidationFail: false,
        },
      },
      messageType: MessageType.String,
      
      validateInputFn: [yupValidation(yup.object({
        field: yup.number().required(),
      }))],
    });

    await expect(
      handler2({ Records: [testSQSRecord] }, LambdaContext, () => {})
    ).resolves.toStrictEqual({
      batchItemFailures: [{ itemIdentifier: 'abc' }],
    });
  });

  it('Validation failure records exception', async () => {
    const handler = createSQSHandler(async (request) => {}, {
      sources: {
        sqs: {
          recordExceptionOnValidationFail: true,
          silenceRecordOnValidationFail: true,
        },
      },
      validateInputFn: [yupValidation(yup.object({
        field: yup.number().required(),
      }))],
      messageType: MessageType.String,
    });
    await handler({ Records: [testSQSRecord] }, LambdaContext, () => {});
    expect(recordException).toHaveBeenCalled();

    jest.clearAllMocks();

    const handler2 = createSQSHandler(async (request) => {}, {
      sources: {
        sqs: {
          recordExceptionOnValidationFail: false,
          silenceRecordOnValidationFail: true,
        },
      },

      validateInputFn: [yupValidation(yup.object({
        field: yup.number().required(),
      }))],
      messageType: MessageType.String,
    });

    await handler2({ Records: [testSQSRecord] }, LambdaContext, () => {});

    expect(recordException).not.toHaveBeenCalled();
  });
});
