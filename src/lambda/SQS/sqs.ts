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
import { AwsSQSRecord, failSQSRecord } from '../../util/sqs/record';
import { wrapTelemetrySQS } from './Telemetry/Wrapper';
import { flush } from '../utils/telemetry';
import { validateRecord } from '../../util/validateRecord';

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
    log.debug(record);
    const _record = new AwsSQSRecord<V>(record);

    try {
      await validateRecord(_record, configuration.yupSchemaInput);
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

    const out = (await Promise.allSettled(
      event.Records.map((record) => innerLoop(record, context))
    ).then((maybeItemFailures) =>
      maybeItemFailures
        .map((o) => {
          if (o.status === 'fulfilled') {
            return o.value;
          }
          // This is critical, as we cannot determine if the record has been processed or not
          // But really, there should be no reason for this happening
          log.error(
            'Some wrapped SQS handlers have failed. This should not happen and point to a bug in the instrumentation library.'
          );
          log.error(o.reason);
          throw new Error('SQS wrapped handler as failed', { cause: o.reason });
        })
        .filter((el) => el !== undefined)
    )) as SQSBatchItemFailure[];

    if (configuration.opentelemetry) {
      await flush();
    }

    return {
      batchItemFailures: out,
    };
  };
};
