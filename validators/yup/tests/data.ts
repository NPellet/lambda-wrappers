
export const testApiGatewayEvent = function( data ) {

    return {
    body: typeof data === "object" ? JSON.stringify( data ) : data,
    headers: {
      'Content-Type': 'test/plain',
    },
    httpMethod: 'GET',
    multiValueHeaders: {
      'Content-Type': ['test/plain'],
    },
    path: '/path/to/resource',
    pathParameters: { a: 'b' },
    queryStringParameters: { query: 'content' },
    isBase64Encoded: false,
    multiValueQueryStringParameters: {
      k: ['v'],
      k2: ['v1', 'v2'],
    },
    stageVariables: { a: 'b' },
    requestContext: {
      accountId: '123',
      apiId: 'api',
      // This one is a bit confusing: it is not actually present in authorizer calls
      // and proxy calls without an authorizer. We model this by allowing undefined in the type,
      // since it ends up the same and avoids breaking users that are testing the property.
      // This lets us allow parameterizing the authorizer for proxy events that know what authorizer
      // context values they have.
      authorizer: {},
      protocol: 'HTTP',
      httpMethod: 'GET',
      identity: {
        accessKey: '',
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
        sourceIp: 'sourceIp',
        user: null,
        userAgent: null,
        userArn: null,
      },
      messageDirection: undefined,
      path: '/path/to/resource',
      stage: 'staging',
      requestId: 'abc',
      requestTimeEpoch: 0,
      resourceId: '',
      resourcePath: '',
    },
    resource: '',
  };
}

export const LambdaContext = {
  awsRequestId: 'abc',
  callbackWaitsForEmptyEventLoop: true,
  functionName: 'funcName',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:abc:sdsd:12345678:some:other:data',
  logGroupName: 'logGroup',
  logStreamName: 'log',
  memoryLimitInMB: '128',
  getRemainingTimeInMillis: () => 1,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};
