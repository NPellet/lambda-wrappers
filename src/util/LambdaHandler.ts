import { init } from "@sentry/serverless/types/awslambda";
import {
  APIGatewayEvent,
  APIGatewayProxyResult,
  Callback,
  Context,
  EventBridgeEvent,
} from "aws-lambda";
import { Event } from "../lambda/EventBridge/types/Event";

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
export type LambdaHandler<T, I, V> = (
  data: T,
  init: I,
  context: Context,
  callback: Callback<any>
) => Promise<V>;

export type LambdaContext<T> = Context & { originalData: T };
