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
import { LambdaContext, LambdaHandler } from "../../util/LambdaHandler";
import { AwsApiGatewayRequest } from "../../util/apigateway";
import { HandlerConfiguration, LambdaType } from "../config";
import { log } from "../utils/logger";
import { wrapGenericHandler } from "../Wrapper";
import { config } from "process";

/**
 * Make sure that the return format of the lambda matches what is expected from the API Gateway
 * @param handler
 * @returns
 */
export const createApiGatewayHandler = <
  TInit = any,
  SInput extends ObjectSchema<any> | undefined = any,
  SOutput extends ObjectSchema<any> | undefined = any
>(
  handler: LambdaHandler<
    AwsApiGatewayRequest<
      SInput extends ObjectSchema<any> ? InferType<SInput> : SInput
    >,
    TInit,
    Omit<APIGatewayProxyResult, "body"> & {
      body: SOutput extends ObjectSchema<any>
        ? InferType<SOutput>
        : void | string;
    }
  >,
  configuration: Omit<HandlerConfiguration<TInit, SInput, SOutput>, "type">
) => {
  type TInput = SInput extends ObjectSchema<any> ? InferType<SInput> : SInput;
  type TOutput = Awaited<ReturnType<typeof handler>>;

  const wrappedHandler = wrapGenericHandler(handler, {
    type: LambdaType.API_GATEWAY,
    ...configuration,
  });

  return async function handleAPIGateway(
    event: APIGatewayEvent,
    context: Context,
    callback: Callback
  ) {
    let out: APIGatewayProxyEvent;
    let actualOut: TOutput | void;

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

      actualOut = await wrappedHandler(
        new AwsApiGatewayRequest<TInput>(event, configuration.yupSchemaInput),
        newCtx,
        callback
      );
      if (!actualOut) {
        recordException(
          new Error("API Gateway lambda functions must return a Promise")
        );
        return {
          statusCode: 500,
          body: "Lambda function malformed. Expected a Promise",
        };
      }

      if (!actualOut.statusCode) {
        recordException(out);
        return {
          statusCode: 500,
          body:
            "Lambda has outputed a malformed API Gateway return object: \n " +
            JSON.stringify(out, undefined, "\t "),
        };
      }

      if (!actualOut.body) {
        return { ...actualOut, body: "" };
      }

      if (typeof actualOut.body === "object") {
        try {
          if (configuration.yupSchemaOutput) {
            await configuration.yupSchemaOutput?.validate(actualOut.body);
          }

          return {
            ...actualOut,
            body: JSON.stringify(actualOut.body),
          };
        } catch (e) {
          return {
            statusCode: 500,
            body: "Output object not according to schema",
          };
        }
      }
      return actualOut;
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
  };
};
