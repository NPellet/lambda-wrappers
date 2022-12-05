import { AWSXRAY_TRACE_ID_HEADER } from "@opentelemetry/propagator-aws-xray";
import { APIGatewayEvent, APIGatewayProxyResult, Handler } from "aws-lambda";
import _ from "lodash";
import { AwsApiGatewayRequest } from "../util/apigateway";
import { LambdaInitSecretHandler } from "../util/LambdaHandler";
import { sampledAwsHeader, testApiGatewayEvent } from "./utils";

const event = _.cloneDeep(testApiGatewayEvent);
event.headers[AWSXRAY_TRACE_ID_HEADER] = sampledAwsHeader;

export { event };

export const successHandler: Handler<
  AwsApiGatewayRequest<any>,
  APIGatewayProxyResult
> = async (event, context, callback) => {
  return {
    statusCode: 200,
    body: "Ok",
  };
};

export const errorHandler: Handler<
  AwsApiGatewayRequest<any>,
  APIGatewayProxyResult
> = async (event, context, callback) => {
  return {
    statusCode: 500,
    body: "Internal Server Error",
  };
};

export const exceptionHandler: Handler<
  AwsApiGatewayRequest<any>,
  APIGatewayProxyResult
> = async (event, context, callback) => {
  throw new Error("Some exception");
};

// @ts-ignore On purpose wrong type output
export const malformedHandler: Handler<
  AwsApiGatewayRequest<any>,
  APIGatewayProxyResult
> = async (event, context, callback) => {
  return "Some wrong string";
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
  APIGatewayProxyResult
> = async (event, init, secrets, context, callback) => {
  return {
    statusCode: 200,
    body: "Ok",
  };
};

export const errorLHandler: LambdaInitSecretHandler<
  AwsApiGatewayRequest<any>,
  void,
  string,
  APIGatewayProxyResult
> = async (event, init, secrets, context, callback) => {
  return {
    statusCode: 500,
    body: "Internal Server Error",
  };
};

export const exceptionLHandler: LambdaInitSecretHandler<
  AwsApiGatewayRequest<any>,
  void,
  string,
  APIGatewayProxyResult
> = async (event, init, secrets, context, callback) => {
  throw new Error("Some exception");
};

// @ts-ignore On purpose wrong type output
export const malformedLHandler: LambdaInitSecretHandler<
  AwsApiGatewayRequest<any>,
  void,
  APIGatewayProxyResult
> = async (event, init, context, callback) => {
  return "Some wrong string";
};

// @ts-ignore
export const syncLHandler: LambdaInitSecretHandler<
  AwsApiGatewayRequest<any>,
  void,
  APIGatewayProxyResult
> = (event, init, context, callback) => {};
