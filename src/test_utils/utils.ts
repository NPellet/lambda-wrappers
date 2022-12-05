import {
  BatchSpanProcessor,
  InMemorySpanExporter,
  ReadableSpan,
} from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

import {
  Context as OtelContext,
  context,
  propagation,
  trace,
  SpanContext,
  SpanKind,
  SpanStatusCode,
  TextMapPropagator,
  ROOT_CONTEXT,
} from "@opentelemetry/api";
import { AWSXRayPropagator } from "@opentelemetry/propagator-aws-xray";
import { APIGatewayEvent, Context, EventBridgeEvent } from "aws-lambda";

export const contextSetter = {
  set(carrier: any, key: string, value: string) {
    carrier[key] = value;
  },
};

const serializeSpanContext = (
  spanContext: SpanContext,
  propagator: TextMapPropagator
): string => {
  let serialized = "";
  propagator.inject(
    trace.setSpan(context.active(), trace.wrapSpanContext(spanContext)),
    {},
    {
      set(carrier: any, key: string, value: string) {
        serialized = value;
      },
    }
  );
  return serialized;
};

export const memoryExporter = new InMemorySpanExporter();
export const provider = new NodeTracerProvider();
provider.addSpanProcessor(new BatchSpanProcessor(memoryExporter));
provider.register({
  propagator: new AWSXRayPropagator(),
});

export const sampledAwsSpanContextHeader: SpanContext = {
  traceId: "8a3c60f7d188f8fa79d48a391a778fa6",
  spanId: "0000000000000456",
  traceFlags: 1,
  isRemote: true,
};

export const unsampledAwsSpanContextHeader: SpanContext = {
  traceId: "8a3c60f7d188f8fa79d48a391a778fa6",
  spanId: "0000000000000456",
  traceFlags: 0,
  isRemote: true,
};

export const sampledAwsHeader = serializeSpanContext(
  sampledAwsSpanContextHeader,
  new AWSXRayPropagator()
);
export const unsampledAwsHeader = serializeSpanContext(
  unsampledAwsSpanContextHeader,
  new AWSXRayPropagator()
);

export const sampledAwsSpanContextLambbda: SpanContext = {
  traceId: "9a3c60f7d188f8fa79d48a391a778fa6",
  spanId: "0000000000000457",
  traceFlags: 1,
  isRemote: true,
};

export const unsampledAwsSpanContextLambbda: SpanContext = {
  traceId: "9a3c60f7d188f8fa79d48a391a778fa6",
  spanId: "0000000000000457",
  traceFlags: 0,
  isRemote: true,
};

export const sampledAwsLambbda = serializeSpanContext(
  sampledAwsSpanContextLambbda,
  new AWSXRayPropagator()
);
export const unsampledAwsLambbda = serializeSpanContext(
  unsampledAwsSpanContextLambbda,
  new AWSXRayPropagator()
);

export const testEventBridgeEvent: EventBridgeEvent<string, any> = {
  "detail-type": "type",
  detail: {
    a: "b",
  },
  source: "source",
  id: "0",
  version: "1",
  account: "dsfh",
  time: "",
  region: "",
  resources: [],
};

export const testApiGatewayEvent: APIGatewayEvent = {
  body: "Request body",
  headers: {
    "Content-Type": "application/json",
  },
  httpMethod: "GET",
  multiValueHeaders: {
    "Content-Type": ["application/json"],
  },
  path: "/path/to/resource",
  pathParameters: { a: "b" },
  queryStringParameters: { query: "content" },
  isBase64Encoded: false,
  multiValueQueryStringParameters: {
    k: ["v"],
    k2: ["v1", "v2"],
  },
  stageVariables: { a: "b" },
  requestContext: {
    accountId: "123",
    apiId: "api",
    // This one is a bit confusing: it is not actually present in authorizer calls
    // and proxy calls without an authorizer. We model this by allowing undefined in the type,
    // since it ends up the same and avoids breaking users that are testing the property.
    // This lets us allow parameterizing the authorizer for proxy events that know what authorizer
    // context values they have.
    authorizer: {},
    protocol: "HTTP",
    httpMethod: "GET",
    identity: {
      accessKey: "",
      accountId: null,
      apiKey: null,
      apiKeyId: null,
      caller: null,
      clientCert: null,
      cognitoAuthenticationProvider: null,
      cognitoAuthenticationType: null,
      cognitoIdentityId: null,
      cognitoIdentityPoolId: null,
      principalOrgId: null,
      sourceIp: "sourceIp",
      user: null,
      userAgent: null,
      userArn: null,
    },
    messageDirection: undefined,
    path: "/path/to/resource",
    stage: "staging",
    requestId: "abc",
    requestTimeEpoch: 0,
    resourceId: "",
    resourcePath: "",
  },
  resource: "",
};

export const LambdaContext: Context = {
  awsRequestId: "abc",
  callbackWaitsForEmptyEventLoop: true,
  functionName: "funcName",
  functionVersion: "1",
  invokedFunctionArn: "arn:aws:abc:sdsd:12345678:some:other:data",
  logGroupName: "logGroup",
  logStreamName: "log",
  memoryLimitInMB: "128",
  getRemainingTimeInMillis: () => 1,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};
