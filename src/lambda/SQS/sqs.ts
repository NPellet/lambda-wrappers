import {
  Callback,
  Context,
  SQSBatchItemFailure,
  SQSEvent,
  SQSHandler,
  SQSRecord,
} from 'aws-lambda';
import { HandlerConfiguration, LambdaType } from '../config';
import { LambdaInitSecretHandler } from '../../util/LambdaHandler';
import { log } from '../utils/logger';
import { wrapGenericHandler } from '../Wrapper';
import {
  getSQSTelemetryAttributes,
  wrapTelemetrySQS,
} from './Telemetry/Wrapper';
import { flush, wrapLatencyMetering } from '../utils/telemetry';
import { validateRecord } from '../../util/validateRecord';
import { AwsSQSRecord, failSQSRecord } from '../../util/records/sqs/record';
import { recordException } from '../../util/exceptions';

export const createSQSHandler = <
  TInput,
  TInit,
  TSecrets extends string
  >(
  handler: LambdaInitSecretHandler<
    AwsSQSRecord<TInput>,
    TInit,
    TSecrets,
    void | SQSBatchItemFailure
  >,
  configuration: HandlerConfiguration<TInit>
): SQSHandler => {
  const wrappedHandler = wrapGenericHandler(handler, {
    type: LambdaType.SQS,
    ...configuration,
  });

  let innerLoop = async (record: SQSRecord, context: Context) => {
    if( configuration.sources?._general?.logInput ) {
      log.info(record);
    }
    
    
    const _record = new AwsSQSRecord<TInput>(record, configuration.messageType);

    try {
      await validateRecord(_record, configuration.validateInputFn);
    } catch (e) {
      if (configuration.sources?.sqs?.recordExceptionOnValidationFail) {
        recordException(e);
      }

      if (configuration.sources?.sqs?.silenceRecordOnValidationFail) {
        return;
      } else {
        throw e;
      }
    }

    return wrappedHandler(_record, context, () => {});
  };

  if (configuration.opentelemetry) {
    innerLoop = wrapTelemetrySQS(innerLoop, configuration.sources?._general);
  }

  const _innerLoop = async (record, context) => {
    try {
      const out = await innerLoop(record, context);
      return out;
    } catch (e) {
      // Do notrecord. Automatically recorded
      const _record = new AwsSQSRecord<TInput>(record, configuration.messageType);
      return failSQSRecord(_record);
    }
  };

  let SQSWrappedHandler = async (
    event: SQSEvent,
    context: Context,
    callback: Callback
  ) => {
    log.info(`Received SQS event with  ${event.Records.length} records.`);

    const out = (await Promise.allSettled(
      event.Records.map((record) => _innerLoop(record, context))
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

  SQSWrappedHandler = wrapLatencyMetering(
    SQSWrappedHandler,
    getSQSTelemetryAttributes,
    configuration.sources?._general
  );

  return SQSWrappedHandler;
};
