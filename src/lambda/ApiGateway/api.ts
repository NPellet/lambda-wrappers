import {
  APIGatewayEvent,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Callback,
  Context,
} from 'aws-lambda';
import { BaseSchema, InferType } from 'yup';
import { recordException } from '../../util/exceptions';
import {
  Controller,
  LambdaContext,
  LambdaInitSecretHandler,
} from '../../util/LambdaHandler';
import { AwsApiGatewayRequest } from '../../util/apigateway/apigateway';
import { HandlerConfiguration, LambdaType, TInit } from '../config';
import { log } from '../utils/logger';
import { wrapGenericHandler } from '../Wrapper';
import { HTTPError, Response } from '../../util/apigateway/response';
import { Request } from '../../util/apigateway/request';
import { SecretConfig } from '../utils/secrets_manager';
import { createLogger } from 'winston';
import { wrapTelemetryApiGateway } from './telemetry/Wrapper';
import otelapi, { SpanStatusCode } from '@opentelemetry/api';
type ConstructorOf<T> = {
  init(secrets: Record<string, string>): T;
  yupSchemaInput?: BaseSchema;
  yupSchemaOutput?: BaseSchema;
  secrets?: Record<string, SecretConfig>;
};

export const apiGatewayHandlerFromController = <
  TIn,
  TOut,
  TSecrets extends string
>(
  controller: ConstructorOf<Controller>
) => {
  const configuration: HandlerConfiguration<
    Controller,
    typeof controller.yupSchemaInput,
    typeof controller.yupSchemaOutput,
    typeof controller.secrets extends undefined
      ? never
      : keyof typeof controller.secrets
  > = {
    yupSchemaInput: controller.yupSchemaInput,
    yupSchemaOutput: controller.yupSchemaOutput,
    initFunction: async (secrets) => {
      const ctrl = controller.init(secrets);
      return ctrl;
    },

    secretInjection: controller.secrets,
  };

  return {
    handler: createApiGatewayHandler(async (data, inited, secrets) => {
      return inited.handle(data, secrets);
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
    'type'
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
    'type'
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
        body: 'Lambda has outputed a malformed payload. Should be of Response type',
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
        body: responseData.toString('base64'),
        isBase64Encoded: true,
      };
    }

    if (!responseData) {
      return {
        headers,
        statusCode: response.getStatusCode(),
        body: '',
      };
    }
    if (configuration.yupSchemaOutput) {
      try {
        await configuration.yupSchemaOutput?.validate(responseData);
      } catch (e) {
        recordException(e);
        return {
          statusCode: 500,
          body: 'Validation error: Output object not validating given output schema',
        };
      }
    }

    if (typeof responseData === 'object') {
      return {
        headers,
        statusCode: response.getStatusCode(),
        body: JSON.stringify(responseData),
      };
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
      let data: TInput;

      try {
        data = request.getData();
      } catch (e) {
        // For example, can't parse the JSON
        recordException(e);
        return {
          statusCode: 500,
          body:
            'Lambda input data malformed. Raw input data was ' +
            request.getRawData(),
        };
      }

      if (configuration.yupSchemaInput) {
        try {
          await configuration.yupSchemaInput.validate(data);
        } catch (e) {
          // For example, can't parse the JSON
          recordException(e);
          return {
            statusCode: 500,
            body:
              'Lambda input schema validation failed. Error was: ' + e.message,
          };
        }
      }

      actualOut = await wrappedHandler(request, newCtx, callback);

      if (!actualOut) {
        recordException(
          new Error('API Gateway lambda functions must return a Promise')
        );
        return {
          statusCode: 500,
          body: 'Lambda function malformed. Expected a Promise',
        };
      }

      // We might have caught the error
      // But if the error is deemed "anormal", then we should want to
      if (
        actualOut instanceof HTTPError &&
        actualOut.isAnormal() &&
        configuration.opentelemetry
      ) {
        const data = actualOut.getData();
        otelapi.trace.getActiveSpan()?.setStatus({
          code: SpanStatusCode.ERROR,
          message: data instanceof Error ? data.message : data,
        });
      }

      return await buildResponse(actualOut);
    } catch (e) {
      // We do not rethrow the exception.
      // Exception should already be recorded by the rumtime wrapper
      // recordException(e);
      log.error('Lambda execution failed');

      if (e.stack) {
        log.error(e.stack);
      }

      // A lambda that throws should fail the outer span

      otelapi.trace.getActiveSpan()?.setStatus({
        code: SpanStatusCode.ERROR,
        message: e instanceof Error ? e.message : e,
      });

      return {
        statusCode: 500,
        body:
          'The lambda execution for the API Gateway has failed with: \n ' +
          (typeof e === 'string' ? e : e.message),
      };
    }
  };

  const wrapped = wrapTelemetryApiGateway(apiGatewayHandler);
  return wrapped;
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
