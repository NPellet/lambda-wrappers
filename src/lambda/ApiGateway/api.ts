import {
  APIGatewayEvent,
  APIGatewayProxyResult,
  Callback,
  Context,
} from 'aws-lambda';
import { recordException } from '../../util/exceptions';
import {
  LambdaContext,
  LambdaInitSecretHandler,
} from '../../util/LambdaHandler';
import { HandlerConfiguration, LambdaType } from '../config';
import { log } from '../utils/logger';
import { wrapGenericHandler } from '../Wrapper';
import {
  HTTPError,
  HTTPResponse,
} from '../../util/records/apigateway/response';
import { wrapTelemetryApiGateway } from './telemetry/Wrapper';
import otelapi, { SpanStatusCode } from '@opentelemetry/api';
import { Request } from '../../util/records/apigateway/request';
import { wrapLatencyMetering } from '../utils/telemetry';
import { getApiGatewayTelemetryAttributes } from './telemetry/Meter';
import { MessageType } from '../../util/types';
import { validateRecord } from '../../util/validateRecord';
/**
 * Make sure that the return format of the lambda matches what is expected from the API Gateway
 * @param handler
 * @returns
 */
export const createApiGatewayHandler = <
  T,
  O,
  TInit = any,
  TSecrets extends string = any
>(
  handler: LambdaInitSecretHandler<
    Request<T>,
    TInit,
    TSecrets,
    HTTPResponse<O> | HTTPError
  >,
  configuration: Omit<
    HandlerConfiguration<TInit, TSecrets>,
    'type'
  >
) => {
  type TInput = T;
  type TOutput = Awaited<ReturnType<typeof handler>>;

  const buildResponse = async (
    response: TOutput
  ): Promise<APIGatewayProxyResult> => {
    if (
      !(response instanceof HTTPResponse) &&
      !(response instanceof HTTPError)
    ) {
      const errorMessage = 'Lambda output not HTTPError nor Response. It should be either';
      
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
        } else if (responseData.message) {
          outData = responseData.message;
        } else {
          outData = String(responseData);
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

    
    if (configuration.validateOutputFn) {
      try {
        await validateRecord(response, configuration.validateOutputFn);

      } catch (e) {

        recordException(e);

        if( e instanceof HTTPError ) {
          const eData = e.getData();
          return {
            headers,
            statusCode: e.getStatusCode(),
            body: eData instanceof Error ? eData.toString() : eData
          };
        }
        
        return {
          headers,
          isBase64Encoded: false,
          statusCode: 500,
          body: 'Validation error: Output object not validating given output schema',
        };
      }
    }

    if (!responseData) {
      return {
        headers,
        isBase64Encoded: false,
        statusCode: response.getStatusCode(),
        body: '',
      };
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

  let apiGatewayHandler = async function handleAPIGateway(
    event: APIGatewayEvent,
    context: Context,
    callback: Callback
  ) {
    let actualOut: TOutput | void;

    log.info(`Received event through APIGateway on path  ${event.path}.`);

    if( configuration.sources?._general?.logInput ) {
      log.debug(event);
    }
    
    try {
      //  const legacyEvent = new Event(event.detail);
      const newCtx: LambdaContext<APIGatewayEvent> = Object.assign(
        {},
        context,
        {
          originalData: event,
        }
      );

      if (event.headers['Content-Type'] === 'application/json') {
        configuration.messageType = MessageType.Object;
      }
      const request = new Request<TInput>(event, configuration.messageType);
      let data: TInput;

      try {
        data = request.getData();
      } catch (e: any) {
        // For example, can't parse the JSON
        recordException(e);
        return {
          statusCode: 500,
          headers: {},
          body: `Lambda input data malformed. Raw input data was "${request.getBody()}. Error was: ${e}`,
        };
      }

      if (configuration.validateInputFn) {
        try {
          await validateRecord( request, configuration.validateInputFn );
        } catch (e: any) {
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
    } catch (e: any ) {
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

  apiGatewayHandler = wrapLatencyMetering(
    apiGatewayHandler,
    getApiGatewayTelemetryAttributes,
    configuration.sources?._general
  );

  if (configuration.opentelemetry) {
    const wrapped = wrapTelemetryApiGateway(
      apiGatewayHandler,
      configuration.sources?._general
    );
    return wrapped;
  } else {
    return apiGatewayHandler;
  }
  // return wrapAsyncStorage(apiGatewayHandler);
};
