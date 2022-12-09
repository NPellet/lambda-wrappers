import {
  Callback,
  Context,
  SQSBatchItemFailure,
  SQSBatchResponse,
  SQSEvent,
  SQSHandler,
  SQSRecord,
} from 'aws-lambda';
import { HandlerConfiguration, LambdaType } from '../config';
import { LambdaInitSecretHandler } from '../../util/LambdaHandler';
import { log } from '../utils/logger';
import { wrapGenericHandler } from '../Wrapper';
import { BaseSchema } from 'yup';
import { recordException } from '../../util/exceptions';
import { TOrSchema } from '../../util/types';
import {
  AwsSQSRecord,
  failSQSRecord,
  validateSQSRecord,
} from '../../util/sqs/record';
import { wrapTelemetrySQS } from './Telemetry/Wrapper';
import { flush } from '../utils/telemetry';

export const createSQSHandler = <
  TInput,
  TInit,
  TSecrets extends string,
  SInput extends BaseSchema | undefined = undefined
>(
  handler: LambdaInitSecretHandler<
    AwsSQSRecord<TOrSchema<TInput, SInput>>,
    TInit,
    TSecrets,
    void | SQSBatchItemFailure
  >,
  configuration: HandlerConfiguration<TInit, SInput>
): SQSHandler => {
  type V = TOrSchema<TInput, SInput>;
  const wrappedHandler = wrapGenericHandler(handler, {
    type: LambdaType.SQS,
    ...configuration,
  });

  let innerLoop = async (record: SQSRecord, context: Context) => {
    const _record = new AwsSQSRecord<V>(record);

    try {
      await validateSQSRecord(_record, configuration.yupSchemaInput);
    } catch (e) {
      return failSQSRecord(_record);
    }

    try {
      return await wrappedHandler(_record, context, () => {});
    } catch (e) {
      return failSQSRecord(_record);
    }
  };

  if (configuration.opentelemetry) {
    innerLoop = wrapTelemetrySQS(innerLoop);
  }

  return async (event: SQSEvent, context: Context, callback: Callback) => {
    log.info(`Received SQS event with  ${event.Records.length} records.`);

    const sqsErrors: SQSBatchResponse = {
      batchItemFailures: [],
    };

    const out = (await Promise.all(
      event.Records.map((record) => innerLoop(record, context))
    ).then((maybeItemFailures) =>
      maybeItemFailures.filter((o) => o !== undefined)
    )) as SQSBatchItemFailure[];

    if (configuration.opentelemetry) {
      await flush();
    }

    return {
      batchItemFailures: out,
    };
  };
};
