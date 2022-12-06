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
  LambdaContext,
  LambdaInitSecretHandler,
} from "../../util/LambdaHandler";
import { AwsApiGatewayRequest } from "../../util/apigateway/apigateway";
import { HandlerConfiguration, LambdaType } from "../config";
import { log } from "../utils/logger";
import { wrapGenericHandler } from "../Wrapper";
import { config } from "process";
import { create } from "lodash";
import { Response } from "../../util/apigateway/response";
import { Request } from "../../util/apigateway/request";

/**
 * Make sure that the return format of the lambda matches what is expected from the API Gateway
 * @param handler
 * @returns
 */
export const createApiGatewayHandler = <
  T,
  TInit = any,
  TSecrets extends string = any,
  SInput extends ObjectSchema<any> | undefined = undefined,
  SOutput extends ObjectSchema<any> | undefined = undefined
>(
  handler: LambdaInitSecretHandler<
    AwsApiGatewayRequest<SInput extends undefined ? T : InferType<SInput>>,
    TInit,
    TSecrets,
    Response<
      SOutput extends ObjectSchema<any> ? InferType<SOutput> : void | string
    >
  >,
  configuration: Omit<
    HandlerConfiguration<TInit, SInput, SOutput, TSecrets>,
    "type"
  >
) => {
  type TInput = SInput extends undefined ? T : InferType<SInput>;
  type TOutput = Awaited<ReturnType<typeof handler>>;

  const buildResponse = async (
    response: TOutput
  ): Promise<APIGatewayProxyResult> => {
    if (!(response instanceof Response)) {
      recordException(
        new Error(
          "Lambda's output is malformed. Output was: " +
            JSON.stringify(response)
        )
      );
      return {
        statusCode: 500,
        body: "Lambda has outputed a malformed payload. Should be of Response type",
      };
    }

    const responseData = response.getData();
    const headers = response.getHeaders();

    if (Buffer.isBuffer(responseData)) {
      return {
        headers,
        statusCode: response.getStatusCode(),
        body: responseData.toString("base64"),
        isBase64Encoded: true,
      };
    }

    if (!responseData) {
      return {
        headers,
        statusCode: response.getStatusCode(),
        body: "",
      };
    }

    if (typeof responseData === "object") {
      try {
        if (configuration.yupSchemaOutput) {
          await configuration.yupSchemaOutput?.validate(responseData);
        }

        return {
          headers,
          statusCode: response.getStatusCode(),
          body: JSON.stringify(responseData),
        };
      } catch (e) {
        recordException(e);
        return {
          statusCode: 500,
          body: "Output object not according to schema",
        };
      }
    }

    return {
      headers,
      statusCode: response.getStatusCode(),
      body: responseData,
    };
  };
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

      return await buildResponse(actualOut);
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
