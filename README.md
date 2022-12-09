# AWS Lambda Handlers

This is a collection of wrapper functions that you should use to wrap your handlers, whether you are implementing an API Gateway hander or an Event Bridge handler.
Other handlers will be supported in the future

## Installation

```bash
npm i @lendis-tech/lambda-handlers
```

## Usage

### Background

We would like the API contract to be defined by the route, and enforced at the Controller level. As opposed to letting the controller define the contract itself, which can lead to API changes that are not backwards compatible.

In this spirit, we propose a utility that can create an abstract base controller class that should be inherited from by the controller implementation. This base class brings strong type safety to the controller implementation. It is created on the fly (you can't just reference it) by the Controller Factory:

### TL;DR;

API contract

```typescript
import { APIHandlerControllerFactory } from '@lendis-tech/lambda-handlers';

// API Route definition file
const { BaseController, handlerFactory } = new APIHandlerControllerFactory()
  .setTsInputType<INPUT_TYPE>() // Injects type safety, overrides yup schema
  .setTsOutputType<OUTPUT_TYPE>() // Injects type safety, overrides yup schema
  .setInputSchema(yupSchema) // Of type yup
  .needsSecret('process_env_key', 'Algolia-Products', 'adminApiKey', true) // Fetches the secrets during a cold start
  .needsSecret('process_env_other_key', 'Algolia-Products', 'apiKey', true)
  .ready(); // Call this when you're finished setting up the controller

export { BaseController, handlerFactory };
```

Lambda handler

```typescript
// API Route definition file
const { handler, configuration } = handlerFactory(ChangeAssetsStatus);
export { handler, configuration };
```

Controller implementation

```typescript
export class ChangeAssetsStatus extends BaseController {
  // Alternatively:
  // static async init( secrets: SecretsOf<typeof BaseController> )
  static async init() {
    // Use where the static initializer to acquire any resource you may want cached across lambda invocation
    return new ChangeAssetsStatus();
  }

  // A bit of a vodoo syntax, see https://github.com/Microsoft/TypeScript/issues/23911 for the reason why this has to be
  async handle(
    req: RequestOf<typeof BaseController>,
    secrets: SecretsOf<typeof BaseController>
  ) {
    const data = req.getData(); // Data has type INPUT_TYPE
    // It has already been checked against the input schema.
    try {
      // Implement your business logic here

      return Response.OK_NO_CONTENT(); // TS Error is OUTPUT_TYPE is not void
    } catch (e) {
      if (e instanceof SomeCustomError) {
        // Maybe your logic throws an error that can be considered "known", e.g. an issue in the incoming payload that is the producer's responsibility.
        return HTTPError.BAD_REQUEST(e);
      }
      // Another internal server error
      // Do not return, let it throw.
      throw e;
    }
  }
}
```

## Type system

When specifying a yup schema using `setInputSchema` and `setOutputSchema`, but when the corresponding `setTsInputType` and `setTsOutputType` are not set, the type of the input and output is dictated by yup's `InferType< typeof schema >`. The only way to overwrite that if - for example - yup's inferred type isn't good enough, is to override it with `setTsInputType`. This doesn't change the runtime validation, which solely depends on the presence of the schema or not.

On another note, the schema validation can be asynchronous. It is verified before your handler is called.

## API Gateway Requests and Responses

The only major changes here compare to the current systems is that:

- Error HTTP Codes should use the static constructor methods on `HTTPError`, which supports an Error or a string. This allows us to retain a stricly typed return. Therefore, the response type should be `Promise<HTTPError | Response<T>>`:

```typescript
return HTTPError.BAD_REQUEST(error);

// or
return HTTPError.BAD_REQUEST('Failure !');
```

- Errors can be "acceptable" or "anormal". An anormal error will be registered with Sentry and Opentelemetry, and should indicate a condition that your service shouldn't enter. If this condition is a consequence of an invalid payload, do not set the error to anormal. This is a problem with the sender of the request. To make an error anormal, just to do following

```typescript
return HTTPError.BAD_REQUEST(error).anormal();
```

- `HTTPError.INTERNAL_ERROR()` is by default internal.

### Secret injection

Another cool feature of those lambda wrappers is that secrets can be inject before the handler is called.
Secrets are fetched during a cold start, of after the cache has expired.

_NB: The implementation is currently sub-optimal. Refetching the secret could be done in the lambda extension to reduce lambda latency. But this would only make a difference after the 2h cache expiracy. The cold start performance would be the same, and the warm invocation would not make a call to AWS anyways_

Secrets are exposed in 2 ways

- Injected into process.env
- Available in the handler function

For example, calling

```typescript
controllerFactory.needsSecret(
  'process_env_key',
  'Algolia-Products',
  'adminApiKey',
  true
);
```

will populate `process.env.process_env_key` with the content of the Algolia's admin API key.

In addition, when implementing

```typescript
async handle(
    req: RequestOf<typeof BaseController>,
    secrets: SecretsOf<typeof BaseController>
  ) {

    // Secrets is of type { process_env_key: string }
    console.log( secrets.process_env_key )
}
```

When the last parameter of the `needsSecret` method is true, the secret is required and the lambda will fail if it can't be found. When false, the method will be called, but the secret may be undefined.

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
