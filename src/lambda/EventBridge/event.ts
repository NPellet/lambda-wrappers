import { Callback, Context, EventBridgeEvent, Handler } from 'aws-lambda';
import { HandlerConfiguration, LambdaType } from '../config';
import { LambdaInitSecretHandler } from '../../util/LambdaHandler';
import { log } from '../utils/logger';
import { wrapGenericHandler } from '../Wrapper';
import { BaseSchema, InferType, ObjectSchema } from 'yup';
import { AwsEventBridgeEvent } from '../../util/records/eventbridge/eventbridge';
import { recordException } from '../../util/exceptions';
import { wrapTelemetryEventBridge } from './telemetry/Wrapper';

export const createEventBridgeHandler = <
  T,
  I,
  TSecrets extends string,
  SInput extends BaseSchema | undefined = undefined
>(
  listener: LambdaInitSecretHandler<
    AwsEventBridgeEvent<
      SInput extends ObjectSchema<any> ? InferType<SInput> : T
    >,
    I,
    TSecrets,
    void
  >,
  configuration: HandlerConfiguration<I, SInput>
): Handler<
  EventBridgeEvent<
    string,
    SInput extends ObjectSchema<any> ? InferType<SInput> : T
  >
> => {
  type V = SInput extends ObjectSchema<any> ? InferType<SInput> : T;
  const wrappedHandler = wrapGenericHandler(listener, {
    type: LambdaType.EVENT_BRIDGE,
    ...configuration,
  });

  const handler: Handler<EventBridgeEvent<string, V>> = async (
    event: EventBridgeEvent<string, V>,
    context: Context,
    callback: Callback
  ) => {
    log.info(
      `Received event through EventBridge from source ${event.source} and detail-type ${event['detail-type']}.`
    );
    log.debug(event.detail);

    const _event = new AwsEventBridgeEvent<V>(event);

    if (configuration.yupSchemaInput) {
      try {
        await configuration.yupSchemaInput.validate(_event.getData());
      } catch (e) {
        log.warn(
          `Lambda's input schema failed to validate. Rethrowing to fail lambda`
        );
        log.debug(e);
        recordException(e);
        throw e;
      }
    }

    return wrappedHandler(_event, context, callback);
  };


  if (configuration.opentelemetry) {
    const wrapped = wrapTelemetryEventBridge(handler);
    return wrapped;
  } else {
    return handler;
  }

};
