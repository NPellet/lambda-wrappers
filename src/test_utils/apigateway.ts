import { AWSXRAY_TRACE_ID_HEADER } from '@opentelemetry/propagator-aws-xray';
import { APIGatewayEvent, APIGatewayProxyResult, Handler } from 'aws-lambda';
import _ from 'lodash';
import { AwsApiGatewayRequest } from '../util/apigateway/apigateway';
import { HTTPError, Response } from '../util/apigateway/response';
import { LambdaInitSecretHandler } from '../util/LambdaHandler';
import { sampledAwsHeader, testApiGatewayEvent } from './utils';

const event = _.cloneDeep(testApiGatewayEvent);
event.headers[AWSXRAY_TRACE_ID_HEADER] = sampledAwsHeader;

export { event };

export const successHandler: Handler<
  APIGatewayEvent,
  APIGatewayProxyResult
> = async (event, context, callback) => {
  return {
    body: 'Ok',
    statusCode: 200,
  };
};

export const errorHandler: Handler<
  APIGatewayEvent,
  APIGatewayProxyResult
> = async (event, context, callback) => {
  return {
    body: 'Internal Server Error',
    statusCode: 500,
  };
};

export const exceptionHandler: Handler<
  APIGatewayEvent,
  APIGatewayProxyResult
> = async (event, context, callback) => {
  throw new Error('Some exception');
};

// @ts-ignore On purpose wrong type output
export const malformedHandler: Handler<
  APIGatewayEvent,
  APIGatewayProxyResult
> = async (event, context, callback) => {
  return 'Some wrong string';
};

// @ts-ignore
export const syncHandler: Handler<APIGatewayEvent, APIGatewayProxyResult> = (
  event,
  context,
  callback
) => {};

export const successLHandler: LambdaInitSecretHandler<
  AwsApiGatewayRequest<any>,
  void,
  string,
  Response<string>
> = async (event, init, secrets, context, callback) => {
  return Response.OK('Ok');
};

export const errorLHandler: LambdaInitSecretHandler<
  AwsApiGatewayRequest<any>,
  void,
  string,
  HTTPError
> = async (event, init, secrets, context, callback) => {
  return HTTPError.SERVER_ERROR('Internal Server Error');
  // return "ash";//Response.SERVER_ERROR("Internal Server Error");
};

export const unauthorizedLHandler: LambdaInitSecretHandler<
  AwsApiGatewayRequest<any>,
  void,
  string,
  HTTPError
> = async (event, init, secrets, context, callback) => {
  return HTTPError.UNAUTHORIZED('Unauthorized');
  // return "ash";//Response.SERVER_ERROR("Internal Server Error");
};

export const unauthorizedWithErrorLHandler: LambdaInitSecretHandler<
  AwsApiGatewayRequest<any>,
  void,
  string,
  HTTPError
> = async (event, init, secrets, context, callback) => {
  try {
    throw new Error('You do not have access to this resource', {
      cause: 'Some cause',
    });
  } catch (e) {
    return HTTPError.UNAUTHORIZED(e);
  }

  // return "ash";//Response.SERVER_ERROR("Internal Server Error");
};

export const bufferLHandler: LambdaInitSecretHandler<
  AwsApiGatewayRequest<any>,
  void,
  string,
  Response<Buffer>
> = async (event, init, secrets, context, callback) => {
  return Response.OK(Buffer.from('abc'));
};

export const emptyLHandler: LambdaInitSecretHandler<
  AwsApiGatewayRequest<any>,
  void,
  string,
  Response<void>
> = async (event, init, secrets, context, callback) => {
  return Response.OK_NO_CONTENT();
};
export const objectLHandler: LambdaInitSecretHandler<
  AwsApiGatewayRequest<any>,
  void,
  string,
  Response<object>
> = async (event, init, secrets, context, callback) => {
  return Response.OK({
    key: 'value',
  });
};

export const exceptionLHandler: LambdaInitSecretHandler<
  AwsApiGatewayRequest<any>,
  void,
  string,
  Response<string>
> = async (event, init, secrets, context, callback) => {
  throw new Error('Some exception');
};

// @ts-ignore On purpose wrong type output
export const malformedLHandler: LambdaInitSecretHandler<
  AwsApiGatewayRequest<any>,
  void,
  Response<string>
> = async (event, init, context, callback) => {
  return 'Some wrong string';
};

// @ts-ignore
export const syncLHandler: LambdaInitSecretHandler<
  AwsApiGatewayRequest<any>,
  void,
  Response<string>
> = (event, init, context, callback) => {};
