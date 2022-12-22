import { AWSXRAY_TRACE_ID_HEADER } from '@opentelemetry/propagator-aws-xray';
import { APIGatewayEvent, APIGatewayProxyResult, Handler } from 'aws-lambda';
import _ from 'lodash';
import { HTTPError, HTTPResponse } from '../util/records/apigateway/response';
import { LambdaInitSecretHandler } from '../util/LambdaHandler';
import { sampledAwsHeader, testApiGatewayEvent } from './utils';
import { Request } from '../lambda';

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
Request<any>,
  void,
  string,
  HTTPResponse<string>
> = async (event, init, secrets, context, callback) => {
  return HTTPResponse.OK('Ok');
};

export const errorLHandler: LambdaInitSecretHandler<
Request<any>,
  void,
  string,
  HTTPError
> = async (event, init, secrets, context, callback) => {
  return HTTPError.SERVER_ERROR('Internal Server Error');
  // return "ash";//Response.SERVER_ERROR("Internal Server Error");
};

export const unauthorizedLHandler: LambdaInitSecretHandler<
Request<any>,
  void,
  string,
  HTTPError
> = async (event, init, secrets, context, callback) => {
  return HTTPError.UNAUTHORIZED('Unauthorized');
  // return "ash";//Response.SERVER_ERROR("Internal Server Error");
};

export const unauthorizedWithErrorLHandler: LambdaInitSecretHandler<
Request<any>,
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
Request<any>,
  void,
  string,
  HTTPResponse<Buffer>
> = async (event, init, secrets, context, callback) => {
  return HTTPResponse.OK(Buffer.from('abc'));
};

export const emptyLHandler: LambdaInitSecretHandler<
Request<any>,
  void,
  string,
  HTTPResponse<void>
> = async (event, init, secrets, context, callback) => {
  return HTTPResponse.OK_NO_CONTENT();
};
export const objectLHandler: LambdaInitSecretHandler<
Request<any>,
  void,
  string,
  HTTPResponse<object>
> = async (event, init, secrets, context, callback) => {
  return HTTPResponse.OK({
    key: 'value',
  });
};

export const exceptionLHandler: LambdaInitSecretHandler<
  Request<any>,
  void,
  string,
  HTTPResponse<string>
> = async (event, init, secrets, context, callback) => {
  throw new Error('Some exception');
};

// @ts-ignore On purpose wrong type output
export const malformedLHandler: LambdaInitSecretHandler<
Request<any>,
  void,
  HTTPResponse<string>
> = async (event, init, context, callback) => {
  return 'Some wrong string';
};

// @ts-ignore
export const syncLHandler: LambdaInitSecretHandler<
Request<any>,
  void,
  HTTPResponse<string>
> = (event, init, context, callback) => {};
