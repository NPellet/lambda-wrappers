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
import { wrapTelemetrySNS } from './Telemetry/Wrapper';
import { flush } from '../utils/telemetry';
import { AwsSNSRecord } from '../../util/sns/record';
import { validateRecord } from '../../util/validateRecord';

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

  let innerLoop = async (record: SNSEventRecord, context: Context) => {
    log.debug(record);

    const _record = new AwsSNSRecord<V>(record);

    try {
      await validateRecord(_record, configuration.yupSchemaInput);
    } catch (e) {
      // Nothing more we can do !
      return;
    }

    try {
      return await wrappedHandler(_record, context, () => {});
    } catch (e) {
      return;
    }
  };

  if (configuration.opentelemetry) {
    innerLoop = wrapTelemetrySNS(innerLoop);
  }

  return async (event: SNSEvent, context: Context, callback: Callback) => {
    log.info(`Received SNS event with ${event.Records.length} records.`);

    const out = await Promise.all(
      event.Records.map((record) => innerLoop(record, context))
    );

    if (configuration.opentelemetry) {
      await flush();
    }

    return;
  };
};
