import {
  LambdaContext,
  testSNSEvent,
  testSNSRecord,
  yupValidation,
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
    createSNSHandler(async (data) => { }, {
      opentelemetry: true,
      messageType: MessageType.String,
    });

    expect(wrapTelemetrySNS).toHaveBeenCalledTimes(1);
    jest.clearAllMocks();

    createSNSHandler(async (data) => { }, {
      opentelemetry: false,
      messageType: MessageType.String,
    });

    expect(wrapTelemetrySNS).not.toHaveBeenCalled();
  });
});

describe('SNS: Runtime config', function () {
  it('Basic behaviour resolves the handler without exception', async () => {
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
      handler(testSNSEvent, LambdaContext, () => { })
    ).resolves.toBeUndefined();

    expect(called).toBe(true);
  });

  it("Throwing from within the SNS handler throws the lambda and records exception", async() => {

    const handler = createSNSHandler( async() => {
      throw new Error("Whoops");
    }, { messageType: MessageType.String });

    await expect( handler( testSNSEvent, LambdaContext, () => {} ) ).rejects.toBeDefined();
    expect( recordException ).toHaveBeenCalled();
  })

  it('Validation failure silences the lambda', async () => {
    const handler = createSNSHandler(async () => { }, {
      sources: {
        sns: {
          silenceRecordOnValidationFail: true,
        },
      },
      messageType: MessageType.String,
      validateInputFn: [yupValidation(yup.object({
        field: yup.number().required(),
      }))],
    });

    await expect(
      handler(testSNSEvent, LambdaContext, () => { })
    ).resolves.toBeUndefined();

    const handler2 = createSNSHandler(async () => { }, {
      sources: {
        sns: {
          silenceRecordOnValidationFail: false,
        },
      },
      messageType: MessageType.String,
      validateInputFn: [yupValidation(yup.object({
        field: yup.number().required(),
      }))]
    });

    await expect(
      handler2(testSNSEvent, LambdaContext, () => { })
    ).rejects.toBeDefined();
  });

  it('Validation failure records exception', async () => {
    const handler = createSNSHandler(async (request) => { }, {
      sources: {
        sns: {
          recordExceptionOnValidationFail: true,
          silenceRecordOnValidationFail: true,
        },
      },
      validateInputFn: [yupValidation(yup.object({
        field: yup.number().required(),
      }))],
      messageType: MessageType.String,
    });
    await handler(testSNSEvent, LambdaContext, () => { });
    expect(recordException).toHaveBeenCalled();

    jest.clearAllMocks();

    const handler2 = createSNSHandler(async (request) => { }, {
      sources: {
        sns: {
          recordExceptionOnValidationFail: false,
          silenceRecordOnValidationFail: true,
        },
      },

      validateInputFn: [yupValidation(yup.object({
        field: yup.number().required(),
      }))],
      messageType: MessageType.String,
    });

    await handler2(testSNSEvent, LambdaContext, () => { });

    expect(recordException).not.toHaveBeenCalled();
  });
});
