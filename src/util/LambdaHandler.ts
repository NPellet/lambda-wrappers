import { init } from "@sentry/serverless/types/awslambda";
import {
  APIGatewayEvent,
  APIGatewayProxyResult,
  Callback,
  Context,
  EventBridgeEvent,
} from "aws-lambda";
import { Event } from "../lambda/EventBridge/types/Event";
import { SecretsRecord } from "../lambda/utils/secrets_manager";

export abstract class BaseLambdaHandler<T, U> {
  public isInit: boolean = false;

  abstract init(): Promise<void>;
  abstract handler(event: T, context: Context): Promise<U>;
}

export abstract class ApiGatewayLambdaHandler extends BaseLambdaHandler<
  APIGatewayEvent,
  APIGatewayProxyResult | void
> {
  async init() {}
}

export abstract class EventBridgeLambdaHandler<T> extends BaseLambdaHandler<
  T,
  void
> {
  async init() {}
}
export type LambdaInitSecretHandler<T, TInit, TSecrets extends string, V> = (
  data: T,
  init: TInit,
  secrets: SecretsRecord<TSecrets>,
  context: Context,
  callback: Callback<any>
) => Promise<V>;

export type LambdaSecretsHandler<T, TSecrets extends string, V> = (
  data: T,
  secrets: SecretsRecord<TSecrets>,
  context: Context,
  callback: Callback<any>
) => Promise<V>;

export type LambdaContext<T> = Context & { originalData: T };
