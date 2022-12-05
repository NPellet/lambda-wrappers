import { Callback, Context, EventBridgeEvent, Handler } from "aws-lambda";
import { HandlerConfiguration, LambdaType } from "../config";
import {
  LambdaContext,
  LambdaInitSecretHandler,
} from "../../util/LambdaHandler";
import { log } from "../utils/logger";
import { wrapGenericHandler } from "../Wrapper";

import { InferType, ObjectSchema } from "yup";
import { AwsEventBridgeEvent } from "../../util/eventbridge";

export const createEventBridgeHandler = <
  T,
  I,
  TSecrets extends string,
  U extends ObjectSchema<any> | undefined = undefined
>(
  listener: LambdaInitSecretHandler<
    AwsEventBridgeEvent<U extends ObjectSchema<any> ? InferType<U> : T>,
    I & {
      originalData: EventBridgeEvent<
        string,
        U extends ObjectSchema<any> ? InferType<U> : T
      >;
    },
    TSecrets,
    void
  >,
  configuration: HandlerConfiguration<I, U>
): Handler<
  EventBridgeEvent<string, U extends ObjectSchema<any> ? InferType<U> : T>
> => {
  type V = U extends ObjectSchema<any> ? InferType<U> : T;
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
      `Received event through EventBridge from source ${event.source} and detail-type ${event["detail-type"]}. Event content:`
    );
    log.info(event.detail);

    return wrappedHandler(
      new AwsEventBridgeEvent<V>(event, configuration.yupSchemaInput),
      context,
      callback
    );
  };

  return handler;
};
