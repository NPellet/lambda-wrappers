# AWS Lambda Handlers

This is a collection of wrapper functions that you should use to wrap your handlers, whether you are implementing an API Gateway hander or an Event Bridge handler.
Other handlers will be supported in the future

## Installation

```bash
npm i @lendis-tech/lambda-handlers
```

## Usage

As long as https://github.com/microsoft/TypeScript/issues/23911 is not solved, we need to make a decision: who defines the API contract. There are two ways to proceed, and the first is the de-facto method of choice (not necessarily the best).

For context, the issue is to define who mandates a contract. Normally, it should be at the API level. The controller is then mandated to implement the contract. Because of the aformentionned typescript issue, a derived class (or an implementing class) does not see his member function arguments coerced to the base class. That means an implementation can break the interface contract. This means the API handler cannot issue a base class that must be implemented by the controller. Therefore, we have two ways to proceed.

### TL;DR; Controller defines contract, screw the API

Define your controller as such:

```typescript
export class MyControllerImplementation extends Controller {
  static secrets = {
    apiKey: getAwsSecretDef('Algolia-Products', 'adminApiKey', true),
  }; // Optional

  static yupSchemaInput = validationSchemaIn; // validationSchema coming from somewhere else, optional
  static yupSchemaOutput = validationSchemaOut; // validationSchema coming from somewhere else, optional

  static init(
    secrets: Record<keyof typeof MyControllerImplementation.secrets, string>
  ) {
    // Required method, taking one optional argument, and which MUST return an instance of the controller
    return new MyControllerImplementation();
  }

  async handle(
    // Required, taking 2 arguments: the request data and the fetched secrets
    req: Request<ChangeAssetRequestData>,
    secrets: Record<keyof typeof MyControllerImplementation.secrets, string>
  ) {
    const data = req.getData(); // Gets the data

    try {
      // Do something with it
      return Response.OK_NO_CONTENT();
    } catch (e) {
      if (e instanceof SomeCustomError) {
        return HTTPError.BAD_REQUEST(e); // Here we do not rethrow. This is "recoverable error"
      }
      throw e; // All other errors are rethrown, notifying Sentry and Opentelemetry
    }
  }
}
```

### TL;DR: Handler specificies contract, controller must implement it

A more functional approach would The handler definition file may look something like:

```typescript
// Ran only once on a cold start. Use this method to cache data, initiate DB connection, etc...
const init = async () => {
  return {
    resourceKey: 'value',
  };
};

const { configuration, handlerFactory } = apiGatewayHandlerFactory({
  yupSchemaInput: yup.object({
    name: yup.string().required(),
  }),
  yupSchemaOutput: yup.object({
    // Currently only applies to the API Gateway body output
    age: yup.number().required(),
  }),
  secretInjection: {
    // The secret Algolia-Products with key lwaAdminApiKey will be injected into process.env.key
    // It will only happen at cold start of after a two hour cache expiracy
    secretKeyInProcessEnv: getAwsSecretDef(
      'Algolia-Products',
      'lwaAdminApiKey',
      false
    ),
  },
  initFunction: init,
  useSentry: true,
  useOpentelemetry: true,
});

export const handler = handlerFactory(async (request, init) => {
  // Data if of instance AwsApiGatewayRequest<T>, where T is the typed schema
  // Init has the form of the result of the init method

  // This will validate the event data against the yup schema
  // The lambda will fail if the schema is not respected
  const data = await request.getData();

  data.name; // Ok
  //data.inexistingProperty; // <== TS Error

  init.resourceKey;
  //init.otherResourceKey; // <== TS Error

  process.env.secretKeyInProcessEnv; // The injected secret
});

export { configuration }; // Can be picked up by other tools, for example for OpenAPI or for CDK
```

### HandlerFactoryFactory

To satisfy a strict type system, we use the pattern of factory-of-factory, where a configuration is fed into the factory-of-factory to output a strongly typed factory function called `handlerFactory`.

The `handlerFactory` function is then used to wrap the application handler.

One of the reason for this seemingly complex pattern is linked to the user of either yup to defined the input types, or to be able to feed your own.

### API Gateway

The wrapper function to call is:

```typescript
const { handlerFactory, configuration } =
  apiGatewayHandlerFactory(_configuration);

export const handler = handlerFactory(/* Your handler here */);
export { configuration }; // Used for CDK, OpenAPI, etc.
```

The handler's first argument is an instance of `AwsApiGatewayRequest<T>` and exposes `public async getData(): Promise<T>` to fetch the data with optional validation.

### Event bridge

The wrapper function to call is:

```typescript
const { handlerFactory, configuration } =
  eventBridgeHandlerFactory(_configuration);

export const handler = handlerFactory(/* Your handler here */);
export { configuration }; // Used for CDK, OpenAPI, etc.
```

The handler's first argument is an instance of `AwsEventBridgeEvent<T>` and exposes `public async getData(): Promise<T>` to fetch the data with optional validation.

## Without yup validation

You can opt out of the yup schema validation by omitting the entry in the configuration object. In this case, by default the underlying type (for the API Gateway `body` and for the Event Bridge `detail`) becomes any. You can still force the type using

```typescript
// Define your type as you see fit
type T = {
  a: string;
  b?: number;
};
handlerFactory<T>(handler);
```

Obviously, in this case, no payload validation will be performed.

One use case for this feature is to accept `null` as a body type. Yup does not support `null` schemas (see https://github.com/jquense/yup/issues/1851) and therefore for now cannot be validated.

Example:

```typescript
handlerFactory<{ hello: string }>(async (request, init) => {
  const data = await request.getData();

  // Data is of type { hello: string }
  // But only if the yupSchemaInput was not set
  data.hello;

  return {
    statusCode: 200,
    body: 'ok',
  };
}, {});
```

## Init method

After not being triggered for a while, or after a change of configuration, the lambda runtime shuts down. At the next invocation, a "cold start" takes place, which is basically the setting up of the runtime and the acquisition of resources.

Following the cold start, on subsequent invocations of the lambdas, some of its state is persisted, for example any resource set on the `global` object.

You can use the `initMethod` in the configuration to perform tasks which should pre-run the lambda handler itself. In other words, tasks that would benefit from being executed only once. An example would be to open up a connection to a database and keep that connection between lambda handlers:

```typescript
declare const configuration = {
  initFunction: async function( ) {
    const client = // await database connection
    return {
      client;
    }
  }
}

handlerFactory(async (request, init) => {
  // Main handler

  const dbClient = init.client;
  // Do something with dbClient
});
```

### Secret injection

Secrets are by default injected into environment variables, e.g. if the secret definition is

```
{
  key1: getAwsSecretDef('MySecretName', 'SecretKey'),
  key2: getAwsSecretDef('MyOtherSecretName', 'OtherSecretKey'),
}
```

Will populate the environment variables

```typescript
process.env.key1;
// and
process.env.key2;
```

The secrets are injected during the cold start of the runtime and renewed every 2h

Note that the injection in `process.env` occurs before the init function is called, so the secrets may be freely used.

The record of secrets is also passed as the first argument of the `init` function:

```typescript
const { configuration, handlerFactory } = XXXHandlerFactory({
  type: LambdaType.GENERIC,
  initFunction: async (secrets) => {
    //secrets.secretKey is defined
  },
  secretInjection: {
    secretKey: getAwsSecretDef('Algolia-Products', 'adminApiKey', false),
  },
});

const wrappedHandler = handlerFactory(async (event, init, secrets) => {
  // secrets.secretKey is defined
});
```

## Enhancing CDK code

We provide the ability to automatically parse the secrets manager configuration in the configuration object and use it in the CDK code. For example:

```typescript
// Trigger handler example
const trigger = {
  handler: '../src/path/to/file/main.handler',
};

const lastIndexOfSlash = trigger.handler.lastIndexOf('/');

const fn = new Function(this, 'func', {
  functionName: 'func_test',
  runtime: cdk.aws_lambda.Runtime.NODEJS_14_X,
  code: cdk.aws_lambda.Code.fromAsset(
    trigger.handler.substring(0, lastIndexOfSlash)
  ),
  handler: trigger.handler.substr(lastIndexOfSlash + 1),
  timeout: cdk.Duration.minutes(1),
  memorySize: 512,
  environment: {},
});

// Use path.resolve to get an absolute path to the file
enhanceCDKLambda(fn, resolve(trigger.handler));
```

The function `fn` will automatically receive the IAM grants to fetch the secrets at runtime.

Note that we expect the configuration object to be exported with the name `configuration`, otherwise this will not work.

The function `enhanceCDKLambda` is available in package `@lendis-tech/lambda-handlers-cdk`

via

```typescript
// Use v2 for CDK V2
import { enhanceCDKLambda } from '@lendis-tech/cdk-lambda-handler-utils/dist/v1/enhanceCDKLambda';
```

# A note on error handling in controllers

Error handling is an important part of the Lambda handler logic. Here is a list of good practices

- **Let the handler fail in case of unexpected errors**: We'll catch it for you and reply with an error 500 (for the API gateway at least). Same for SQS, we'll handle notifying the entry-point handler that the message processing has failed. We'll also notify Sentry and fail the span in Opentelemetry. Finally, we'll log appropriate messages.
- **When returning error, use the class HTTPError:** It allows us to implement some extra logic when the request fails. Also, it allows you to not respect to type `T` in `Request<T>`.
- **For errors that should be recorded, return an error like this: `return HTTPError.BAD_REQUEST( error ).anormal()`:** Any error set as "anormal" will trigger a Sentry error, register the exception in Opentelemetry and fail the tracing span.
- **`HTTPResponse.INTERNAL_ERROR` is always `anormal` and will always register**: You do not need to call `.anormal()`
