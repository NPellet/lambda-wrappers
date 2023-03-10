import { Callback, Context, EventBridgeEvent, Handler } from 'aws-lambda';
import { HandlerConfiguration, LambdaType } from '../config';
import { LambdaInitSecretHandler } from '../../util/LambdaHandler';
import { log } from '../utils/logger';
import { wrapGenericHandler } from '../Wrapper';
import { BaseSchema, InferType, ObjectSchema } from 'yup';
import { AwsEventBridgeEvent } from '../../util/records/eventbridge/eventbridge';
import { recordException } from '../../util/exceptions';
import {
  getEBTelemetryAttributes,
  wrapTelemetryEventBridge,
} from './telemetry/Wrapper';
import { wrapLatencyMetering } from '../utils/telemetry';
import { validateRecord } from '../../util/validateRecord';

export const createEventBridgeHandler = <
  T,
  I,
  TSecrets extends string>(
  listener: LambdaInitSecretHandler<
    AwsEventBridgeEvent<T>,
    I,
    TSecrets,
    void
  >,
  configuration: HandlerConfiguration<I>
): Handler<
  EventBridgeEvent<
    string,
     T
  >
> => {
  type V =  T;
  const wrappedHandler = wrapGenericHandler(listener, {
    type: LambdaType.EVENT_BRIDGE,
    ...configuration,
  });

  let EBWrappedHandler = async (
    event: EventBridgeEvent<string, V>,
    context: Context,
    callback: Callback
  ) => {
    log.info(
      `Received event through EventBridge from source ${event.source} and detail-type ${event['detail-type']}.`
    );
    if( configuration.sources?._general?.logInput ) {
      log.info(event);
    }
    
    const _event = new AwsEventBridgeEvent<V>(event);

    if (configuration.validateInputFn) {
      try {
        await validateRecord( _event, configuration.validateInputFn );
      } catch (e) {
        log.warn(`Lambda's input schema failed to validate.`);
        log.debug(e);

        if (
          configuration.sources?.eventBridge?.recordExceptionOnValidationFail
        ) {
          recordException(e);
        }

        if (
          configuration.sources?.eventBridge?.failLambdaOnValidationFail ??
          true
        ) {
          throw e;
        }

        return;
      }
    }

    return wrappedHandler(_event, context, callback);
  };

  EBWrappedHandler = wrapLatencyMetering(
    EBWrappedHandler,
    getEBTelemetryAttributes,
    configuration.sources?._general
  );

  if (configuration.opentelemetry) {
    const wrapped = wrapTelemetryEventBridge(EBWrappedHandler);
    return wrapped;
  } else {
    return EBWrappedHandler;
  }
};
