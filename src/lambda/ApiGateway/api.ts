import {
  APIGatewayEvent,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Callback,
  Context,
} from "aws-lambda";
import { BaseSchema, InferType } from "yup";
import { recordException } from "../../util/exceptions";
import {
  Controller,
  LambdaContext,
  LambdaInitSecretHandler,
} from "../../util/LambdaHandler";
import { AwsApiGatewayRequest } from "../../util/apigateway/apigateway";
import { HandlerConfiguration, LambdaType, TInit } from "../config";
import { log } from "../utils/logger";
import { wrapGenericHandler } from "../Wrapper";
import { HTTPError, Response } from "../../util/apigateway/response";
import { Request } from "../../util/apigateway/request";
import { SecretConfig } from "../utils/secrets_manager";

export const apiGatewayHandlerFromController = <
  TIn,
  TOut,
  TSecrets extends string
>(
  controller: Controller
) => {
  const configuration: HandlerConfiguration<
    void,
    typeof controller.yupSchemaInput,
    typeof controller.yupSchemaOutput,
    typeof controller.secrets extends undefined
      ? never
      : keyof typeof controller.secrets
  > = {
    yupSchemaInput: controller.yupSchemaInput,
    yupSchemaOutput: controller.yupSchemaOutput,
    initFunction: async (secrets) => controller.init(secrets),
    secretInjection: controller.secrets,
  };

  return {
    handler: createApiGatewayHandler(async (data, _, secrets) => {
      return controller.handle(data, secrets);
    }, configuration),
    configuration,
  };
};

export const apiGatewayHandlerFactory = <
  TInit = any,
  TSecrets extends string = any,
  SInput extends BaseSchema | undefined = undefined,
  SOutput extends BaseSchema | undefined = undefined
>(
  configuration: Omit<
    HandlerConfiguration<TInit, SInput, SOutput, TSecrets>,
    "type"
  >
) => {
  return {
    configuration,
    handlerFactory: function <
      T = SInput extends BaseSchema ? InferType<SInput> : any,
      O = SOutput extends BaseSchema ? InferType<SOutput> : any
    >(
      handler: LambdaInitSecretHandler<
        AwsApiGatewayRequest<T>,
        TInit,
        TSecrets,
        Response<O> | HTTPError
      >
    ) {
      return createApiGatewayHandler<T, O, TInit, TSecrets, SInput, SOutput>(
        handler,
        configuration
      );
    },
  };
};

/**
 * Make sure that the return format of the lambda matches what is expected from the API Gateway
 * @param handler
 * @returns
 */
export const createApiGatewayHandler = <
  T,
  O,
  TInit = any,
  TSecrets extends string = any,
  SInput extends BaseSchema | undefined = undefined,
  SOutput extends BaseSchema | undefined = undefined
>(
  handler: LambdaInitSecretHandler<
    AwsApiGatewayRequest<SInput extends BaseSchema ? InferType<SInput> : T>,
    TInit,
    TSecrets,
    Response<O> | HTTPError
  >,
  configuration: Omit<
    HandlerConfiguration<TInit, SInput, SOutput, TSecrets>,
    "type"
  >
) => {
  type TInput = SInput extends BaseSchema ? InferType<SInput> : T;
  type TOutput = Awaited<ReturnType<typeof handler>>;

  const buildResponse = async (
    response: TOutput
  ): Promise<APIGatewayProxyResult> => {
    if (!(response instanceof Response) && !(response instanceof HTTPError)) {
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

    if (response instanceof HTTPError) {
      return {
        headers,
        statusCode: response.getStatusCode(),
        body: responseData as string,
      };
    }

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
      body: responseData as string,
    };
  };
  const wrappedHandler = wrapGenericHandler(handler, {
    type: LambdaType.API_GATEWAY,
    ...configuration,
  });

  const apiGatewayHandler = async function handleAPIGateway(
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

      const request = new AwsApiGatewayRequest<TInput>(event);
      const data = request.getData();

      if (configuration.yupSchemaInput) {
        await configuration.yupSchemaInput.validate(data);
      }

      actualOut = await wrappedHandler(request, newCtx, callback);

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

  return apiGatewayHandler;
  // return wrapAsyncStorage(apiGatewayHandler);
}; /*

const { handlerFactory } = apiGatewayHandlerFactory({
  secretInjection: {
    k: getAwsSecretDef("Algolia-Products", "adminApiKey", true),
  },
  yupSchemaInput: yup.object({
    b: yup.string(),
  }),
  initFunction: async () => {
    return { k: "ugf" };
  },
});

handlerFactory<any, { a: string }>(async (event, init, secrets, context) => {
  const d = await event.getData();
  d.b;
  return Response.OK({ a: "b"});
});
*/

/*
class MyController
  implements Controller<{ a: string }, { b: number }, "myKey">
{
  async init(secrets) {}

  async handle(data, secrets) {
    return Response.OK({ b: 12 });
  }
}

const o = apiGatewayHandlerFromController(new MyController());


*/
