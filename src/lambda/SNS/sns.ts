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

  let innerLoop = async (record: SNSEventRecord, context: Context) => {
    log.debug(record);

    const _record = new AwsSNSRecord<V>(record, configuration.messageType );

    try {
      await validateRecord(_record, configuration.yupSchemaInput);
    } catch (e) {
      // Nothing more we can do !
      return;
    }

    return wrappedHandler(_record, context, () => {});
  };

  if (configuration.opentelemetry) {
    innerLoop = wrapTelemetrySNS(innerLoop);
  }

  const _innerLoop = async ( record, context ) => {
    try {
      const out = await innerLoop( record, context )
      return out;
    } catch( e ) {
      recordException( e );
      return;
    }
  }

  return async (event: SNSEvent, context: Context, callback: Callback) => {
    log.info(`Received SNS event with ${event.Records.length} records.`);

    await Promise.allSettled(
      event.Records.map((record) => _innerLoop(record, context))
    ).then((settled) => {
      if (settled.filter((e) => e.status == 'rejected').length > 0) {
        const error = 'Some SNS handlers have failed. This should not happen and point to a bug in the instrumentation library.'
        log.error( error );
        throw new Error( error );
      }
    });

    if (configuration.opentelemetry) {
      await flush();
    }

    return;
  };
};
