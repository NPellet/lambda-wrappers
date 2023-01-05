import {
  LambdaContext,
  testSNSEvent,
  testSNSRecord,
} from '../../test_utils/utils';
import { MessageType } from '../../util/types';
import { createSNSHandler } from './sns';
import * as yup from 'yup';

jest.mock('../../util/exceptions', function () {
  return {
    recordException: jest.fn(),
  };
});
import { recordException } from '../../util/exceptions';

jest.mock('./telemetry/Wrapper', function () {
  const moduleContent = jest.requireActual('./telemetry/Wrapper');
  return {
    ...moduleContent,
    wrapTelemetrySNS: jest.fn(moduleContent.wrapTelemetrySNS),
  };
});

import { wrapTelemetrySNS } from './telemetry/Wrapper';

describe('SNS: Telemetry', function () {
  it('Calls OTEL wrapper following opentelemetry flag', async () => {
    createSNSHandler(async (data) => {}, {
      opentelemetry: true,
      messageType: MessageType.String,
    });

    expect(wrapTelemetrySNS).toHaveBeenCalledTimes(1);
    jest.clearAllMocks();

    createSNSHandler(async (data) => {}, {
      opentelemetry: false,
      messageType: MessageType.String,
    });

    expect(wrapTelemetrySNS).not.toHaveBeenCalled();
  });
});

describe('SNS: Runtime config', function () {
  it('Basic behaviour resolved the handler without exception', async () => {
    let called: boolean = false;
    const handler = createSNSHandler(
      async () => {
        called = true;
      },
      {
        messageType: MessageType.String,
      }
    );

    await expect(
      handler(testSNSEvent, LambdaContext, () => {})
    ).resolves.toBeUndefined();

    expect(called).toBe(true);
  });

  it('Validation failure silences the lambda', async () => {
    const handler = createSNSHandler(async () => {}, {
      sources: {
        sns: {
          silenceRecordOnValidationFail: true,
        },
      },
      messageType: MessageType.String,
      yupSchemaInput: yup.object({
        field: yup.number().required(),
      }),
    });

    await expect(
      handler(testSNSEvent, LambdaContext, () => {})
    ).resolves.toBeUndefined();

    const handler2 = createSNSHandler(async () => {}, {
      sources: {
        sns: {
          silenceRecordOnValidationFail: false,
        },
      },
      messageType: MessageType.String,
      yupSchemaInput: yup.object({
        field: yup.number().required(),
      }),
    });

    await expect(
      handler2(testSNSEvent, LambdaContext, () => {})
    ).rejects.toBeDefined();
  });

  it('Validation failure records exception', async () => {
    const handler = createSNSHandler(async (request) => {}, {
      sources: {
        sns: {
          recordExceptionOnValidationFail: true,
          silenceRecordOnValidationFail: true,
        },
      },
      yupSchemaInput: yup.object({
        field: yup.number().required(),
      }),
      messageType: MessageType.String,
    });
    await handler(testSNSEvent, LambdaContext, () => {});
    expect(recordException).toHaveBeenCalled();

    jest.clearAllMocks();

    const handler2 = createSNSHandler(async (request) => {}, {
      sources: {
        sns: {
          recordExceptionOnValidationFail: false,
          silenceRecordOnValidationFail: true,
        },
      },

      yupSchemaInput: yup.object({
        field: yup.number().required(),
      }),
      messageType: MessageType.String,
    });

    await handler2(testSNSEvent, LambdaContext, () => {});

    expect(recordException).not.toHaveBeenCalled();
  });
});
