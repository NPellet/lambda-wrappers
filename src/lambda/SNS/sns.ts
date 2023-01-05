import {
  Callback,
  Context,
  SNSEvent,
  SNSEventRecord,
  SNSHandler,
} from 'aws-lambda';
import { HandlerConfiguration, LambdaType } from '../config';
import { LambdaInitSecretHandler } from '../../util/LambdaHandler';
import { log } from '../utils/logger';
import { wrapGenericHandler } from '../Wrapper';
import { BaseSchema } from 'yup';
import { TOrSchema } from '../../util/types';
import { wrapTelemetrySNS } from './telemetry/Wrapper';
import { flush } from '../utils/telemetry';
import { AwsSNSRecord } from '../../util/records/sns/record';
import { validateRecord } from '../../util/validateRecord';
import { recordException } from '../../util/exceptions';

export const createSNSHandler = <
  TInput,
  TInit,
  TSecrets extends string,
  SInput extends BaseSchema | undefined = undefined
>(
  handler: LambdaInitSecretHandler<
    AwsSNSRecord<TOrSchema<TInput, SInput>>,
    TInit,
    TSecrets,
    void
  >,
  configuration: HandlerConfiguration<TInit, SInput>
): SNSHandler => {
  type V = TOrSchema<TInput, SInput>;
  const wrappedHandler = wrapGenericHandler(handler, {
    type: LambdaType.SNS,
    ...configuration,
  });

  const SNSWrappedHandler = async (
    event: SNSEvent,
    context: Context,
    callback: Callback
  ) => {
    log.info(`Received SNS event with ${event.Records.length} records.`);

    const record = event.Records[0];
    log.debug(record);
    const _record = new AwsSNSRecord<V>(record, configuration.messageType);

    try {
      await validateRecord(_record, configuration.yupSchemaInput);
    } catch (e) {
      if (configuration.sources?.sns?.recordExceptionOnValidationFail) {
        recordException(e);
      }

      if (configuration.sources?.sns?.silenceRecordOnValidationFail) {
        return; // Do not process the handler, but also do not notify AWS that the SNS subscriber has failed
      } else {
        throw e; // Will enter a retry and then a DLQ
      }
    }

    try {
      return await wrappedHandler(_record, context, callback);
    } catch (e) {
      recordException(e);
      return;
    }
  };

  if (configuration.opentelemetry) {
    return wrapTelemetrySNS(SNSWrappedHandler);
  } else {
    return SNSWrappedHandler;
  }
};
