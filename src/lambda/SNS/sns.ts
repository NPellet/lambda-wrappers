import {
  Callback,
  Context,
  SNSEvent,
  SNSHandler,
} from 'aws-lambda';
import { HandlerConfiguration, LambdaType } from '../config';
import { LambdaInitSecretHandler } from '../../util/LambdaHandler';
import { log } from '../utils/logger';
import { wrapGenericHandler } from '../Wrapper';
import {
  getSNSTelemetryAttributes,
  wrapTelemetrySNS,
} from './telemetry/Wrapper';
import { wrapLatencyMetering } from '../utils/telemetry';
import { AwsSNSRecord } from '../../util/records/sns/record';
import { validateRecord } from '../../util/validateRecord';
import { recordException } from '../../util/exceptions';

export const createSNSHandler = <
  TInput,
  TInit,
  TSecrets extends string>(
  handler: LambdaInitSecretHandler<
    AwsSNSRecord<TInput>,
    TInit,
    TSecrets,
    void
  >,
  configuration: HandlerConfiguration<TInit>
): SNSHandler => {
  
  const wrappedHandler = wrapGenericHandler(handler, {
    type: LambdaType.SNS,
    ...configuration,
  });

  let SNSWrappedHandler = async (
    event: SNSEvent,
    context: Context,
    callback: Callback
  ) => {
    log.info(`Received SNS event`, { topic: event.Records[0].Sns.TopicArn });
    // Only one event per SNS message
    const record = event.Records[0];
    log.debug(record);
    const _record = new AwsSNSRecord<TInput>(record, configuration.messageType);

    try {
      await validateRecord(_record, configuration.validateInputFn);
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
      throw e;
    }
  };

  SNSWrappedHandler = wrapLatencyMetering(
    SNSWrappedHandler,
    getSNSTelemetryAttributes,
    configuration.sources?._general
  );

  if (configuration.opentelemetry) {
    return wrapTelemetrySNS(SNSWrappedHandler, configuration.sources?._general);
  } else {
    return SNSWrappedHandler;
  }
};
