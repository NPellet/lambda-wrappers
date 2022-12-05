import {
  APIGatewayEvent,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Callback,
  Context,
  Handler,
} from "aws-lambda";
import { InferType, ObjectSchema } from "yup";
import { recordException } from "../../util/exceptions";
import {
  ApiGatewayLambdaHandler,
  BaseLambdaHandler,
  LambdaContext,
  LambdaHandler,
} from "../../util/LambdaHandler";
import { AwsApiGatewayRequest } from "../../util/apigateway";
import { HandlerConfiguration, LambdaType } from "../config";
import { log } from "../utils/logger";
import { wrapGenericHandler } from "../Wrapper";

/**
 * Make sure that the return format of the lambda matches what is expected from the API Gateway
 * @param handler
 * @returns
 */
export const createApiGatewayHandler = <
  T,
  TInit,
  U extends ObjectSchema<any> | undefined = undefined
>(
  handler: LambdaHandler<
    AwsApiGatewayRequest<U extends ObjectSchema<any> ? InferType<U> : T>,
    TInit,
    APIGatewayProxyResult
  >,
  configuration: Omit<HandlerConfiguration<TInit, U>, "type">
) => {
  type V = U extends ObjectSchema<any> ? InferType<U> : T;

  const wrappedHandler = wrapGenericHandler(handler, {
    type: LambdaType.API_GATEWAY,
    ...configuration,
  });

  return async function handleAPIGateway(
    event: APIGatewayEvent,
    context: Context,
    callback: Callback
  ) {
    let out: APIGatewayProxyResult | void;

    log.info(`Received event through APIGateway on path  ${event.path}.`);
    try {
      //  const legacyEvent = new Event(event.detail);
      const newCtx: LambdaContext<APIGatewayEvent> = Object.assign(
        {},
        context,
        {
          originalData: event,
        }
      );

      out = await wrappedHandler(
        new AwsApiGatewayRequest<V>(event, configuration.yupSchema),
        newCtx,
        callback
      );
      if (!out) {
        recordException(
          new Error("API Gateway lambda functions must return a Promise")
        );
        return {
          statusCode: 500,
          body: "Lambda function malformed. Expected a Promise",
        };
      }

      if (!out.statusCode || !out.body) {
        recordException(out);
        return {
          statusCode: 500,
          body:
            "Lambda has outputed a malformed API Gateway return object: \n " +
            JSON.stringify(out, undefined, "\t "),
        };
      }
    } catch (e) {
      // We do not rethrow the exception.
      // Exception should already be recorded by the rumtime wrapper
      // recordException(e);
      return {
        statusCode: 500,
        body:
          "The lambda execution for the API Gateway has failed with: \n " +
          (typeof e === "string" ? e : e.message),
      };
    }

    return out;
  };
};
