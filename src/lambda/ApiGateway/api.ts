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
  LambdaContext,
  LambdaInitSecretHandler,
} from '../../util/LambdaHandler';
import { HandlerConfiguration, LambdaType } from '../config';
import { log } from '../utils/logger';
import { wrapGenericHandler } from '../Wrapper';
import { HTTPError, HTTPResponse } from '../../util/records/apigateway/response';
import { wrapTelemetryApiGateway } from './telemetry/Wrapper';
import otelapi, { SpanStatusCode } from '@opentelemetry/api';
import { Request } from '../../util/records/apigateway/request';
import { config } from 'process';

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
    Request<SInput extends BaseSchema ? InferType<SInput> : T>,
    TInit,
    TSecrets,
    HTTPResponse<O> | HTTPError
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
    if (
      !(response instanceof HTTPResponse) &&
      !(response instanceof HTTPError)
    ) {
      const errorMessage =
        'Lambda output not HTTPError nor Response. It should be either';
      log.error(errorMessage);
      log.debug(response);
      recordException(new Error(errorMessage));

      return {
        statusCode: 500,
        isBase64Encoded: false,
        headers: {},
        body: 'Internal Server Error',
      };
    }

    const responseData = response.getData();
    const headers = response.getHeaders();

    if (response instanceof HTTPError) {
      log.debug('Lambda response is of type HTTPError.');

      let outData: string;
      if (responseData instanceof Error) {
        if (responseData.stack) {
          outData = responseData.stack;
        } else {
          outData = responseData.message;
        }
      } else {
        outData = String(responseData);
      }

      return {
        headers,
        isBase64Encoded: false,
        statusCode: response.getStatusCode(),
        body: outData,
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
        isBase64Encoded: false,
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
          headers,
          isBase64Encoded: false,
          statusCode: 500,
          body: 'Validation error: Output object not validating given output schema',
        };
      }
    }

    if (typeof responseData === 'object') {
      return {
        headers,
        isBase64Encoded: false,
        statusCode: response.getStatusCode(),
        body: JSON.stringify(responseData),
      };
    }

    return {
      headers,
      isBase64Encoded: false,
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
    let actualOut: TOutput | void;

    log.info(`Received event through APIGateway on path  ${event.path}.`);
    log.debug(event);
    try {
      //  const legacyEvent = new Event(event.detail);
      const newCtx: LambdaContext<APIGatewayEvent> = Object.assign(
        {},
        context,
        {
          originalData: event,
        }
      );

      const request = new Request<TInput>(event, configuration.messageType);
      let data: TInput;

      try {
        data = request.getData();
      } catch (e) {
        // For example, can't parse the JSON
        recordException(e);
        return {
          statusCode: 500,
          headers: {},
          body:
            `Lambda input data malformed. Raw input data was "${request.getBody()}. Error was: ${e}`
        };
      }
console.log( configuration.yupSchemaInput );
      if (configuration.yupSchemaInput) {
        try {
          await configuration.yupSchemaInput.validate(data);
          console.log("Valid !");
        } catch (e) {
          log.warn(
            `Lambda's input schema failed to validate. Returning statusCode 500 to the API Gateway`
          );
          log.debug(e);
          recordException(e);
          return {
            statusCode: 500,
            headers: {},
            body:
              'Lambda input schema validation failed. Error was: ' + e.message,
          };
        }
      }

      actualOut = await wrappedHandler(request, newCtx, callback);

      log.debug('Lambda has successfully executed without thrown exception.');

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

      log.debug('Building HTTP Reponse from actual output:');
      log.debug(actualOut);
      const out = await buildResponse(actualOut);
      log.debug(out);

      return out;
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
        isBase64Encoded: false,
        headers: {},
        body:
          'The lambda execution for the API Gateway has failed with: \n ' +
          (typeof e === 'string' ? e : e.message),
      };
    }
  };

  if (configuration.opentelemetry) {
    const wrapped = wrapTelemetryApiGateway(apiGatewayHandler);
    return wrapped;
  } else {
    return apiGatewayHandler;
  }
  // return wrapAsyncStorage(apiGatewayHandler);
};

