# AWS Lambda Handlers

<!-- vscode-markdown-toc -->

- [Installation](#Installation)
- [Usage](#Usage)
  - [Background](#Background)
  - [Example](#Example)
  - [Notes on the Wrapper Factory](#NotesontheWrapperFactory)
  - [Other notes](#Othernotes)
- [Implementing multiple routes in a controller](#Implementingmultipleroutesinacontroller)
- [Type system](#Typesystem)
- [Secret injection](#Secretinjection)
- [API Gateway output](#APIGatewayoutput)
- [Enhancing CDK code](#EnhancingCDKcode)
- [A note on error handling in controllers](#Anoteonerrorhandlingincontrollers)

<!-- vscode-markdown-toc-config
	numbering=false
	autoSave=true
	/vscode-markdown-toc-config -->
<!-- /vscode-markdown-toc -->

This is a collection of wrapper functions that you should use to wrap your handlers, whether you are implementing an API Gateway hander or an Event Bridge handler.
Other handlers will be supported in the future

## <a name='Installation'></a>Installation

```bash
npm i @lendis-tech/lambda-handlers
```

## <a name='Usage'></a>Usage

### <a name='Background'></a>Background

We would like the API contract to be defined by the route and enforced at the Controller level, as opposed to letting the controller define the contract itself, which can too easily lead to API changes that are not backwards compatible. In addition, we wish for the contract to be retrievable by utility tools (and not just expressed at runtime)

This project exposes "handler wrapper factories", which are strongly typed classes that can be used to create wrapping function that interface a controller into a Lambda handler.

Those factories are available for

- The API Gateway: `APIGatewayHandlerWrapperFactory`
- The Event Bridge: `EventBridgeHandlerWrapperFactory`
- SQS: `SQSHandlerWrapperFactory`
- SNS: `SNSHandlerWrapperFactory`

### <a name='Example'></a>Example

```typescript
//====================================================================
// route.ts

import { MyController } from 'path/to/controller';
import {
  APIGatewayHandlerWrapperFactory,
  APIGatewayCtrlInterface,
} from '@lendis-tech/lambda-handlers';

// API Route definition file
const handlerWrapperFactory = new APIGatewayHandlerWrapperFactory()
  .setHandler('handle') // REQUIRED method: defined what is the name of the controller handler
  .setTsInputType<INPUT_TYPE>() // Injects type safety, overrides yup schema
  .setTsOutputType<OUTPUT_TYPE>() // Injects type safety, overrides yup schema
  .setInputSchema(yupSchema) // Of type yup
  .setOutputSchema(yupSchema) // Of type yup
  .needsSecret('process_env_key', 'Algolia-Products', 'adminApiKey', true) // Fetches the secrets during a cold start
  .needsSecret('process_env_other_key', 'Algolia-Products', 'apiKey', true);

type controllerInterface = APIGatewayCtrlInterface<
  typeof handlerWrapperFactory
>;

const handlerWrapper = handlerWrapperFactory.makeHandlerFactory();

export const { handler, configuration } = handlerWrapper(MyController);
export { controllerInterface }; // Export the type to be reimported by the route implementation

//====================================================================
// controller.ts
import type { controllerInterface } from 'path/to/route';

export class MyController implements controllerInterface {
  static async init() {
    return new MyController();
  }

  // Method name Has to match the .setHandler() call
  handle: IfHandler<controllerInterface> = // Without this type, req, secrets and the return value default to any
    async (req, secrets) => {
      return Response.OK_NO_CONTENT();
    };
}
```

### <a name='NotesontheWrapperFactory'></a>Notes on the Wrapper Factory

- `new APIGatewayHandlerWrapperFactory()` means you want to create a new factory for a new API Gateway route. Do this for each route you want in your service
- `.setHandler( handlerName )` specifies the name of the handler function to be implemented in the controller. Use this to reuse a single controller for many routes
- `.setTsInputType<T>()` informs the interface on the input type you're expected to receive. We're not talking about the raw type (e.g. `APIGatewayEvent`), but rather
  - The `body` field for the API gateway (will be JSON.parse'd if the Content-Type is application/json)
  - The `detail` field for the Event Bridge
  - The `message` content for SQS and SNS
- similarly, `.setTsOutputType<T>()` informs the type of response the controller is supposed to return (or an instance of `HTTPError` if the controller failed). Only applies to API Gateway
- `setInputSchema<SCHEMA_TYPE>( schema )` and `setOutputSchema<SCHEMA_TYPE>( schema )` add a runtime verification of a `yup` schema. When `setTsInputType` is not defined but `setInputSchema` is, then the controller is expected to received the result of `InferType< SCHEMA_TYPE >` instead of `T`
- `needsSecret( key, secretName, secretKey, required )` is used for ahead-of-execution secret injection: when a cold start occurs, the Lambda wrapper will detect if the secret has been injected into `process.env[ key ]`. If not, it will fetch it from AWS and inject it into `process.env`. It will also be made available in the handler method with strong typing.
  The `required` field can be used to outrightly fail the lambda when the secret is not found. Note that `secretName` and `secretKey` have auto-completion and will throw a TS error if you try to provide a secret that's not stored in the package `@lendis-tech/secret-manager-utilities`

### <a name='Othernotes'></a>Other notes

Once the wrapper factory has been created, you can extract its interface type using:

```typescript
type controllerInterface = APIGatewayCtrlInterface<
  typeof handlerWrapperFactory
>;
```

The type `controllerInterface` needs to be implemented by the controller. Note that you may decide not to directly implement the interface, as long as you respect its contract.

Talking about the contract, what is it ? There are only two restrictions:

```typescript
static async init() {
  return new MyController()
}
```

This part is needed and super-important for the system to run. Unfortunately it is not checked by typescript. If you omit this piece of code, the lambda will fail at runtime.

You may wonder why not simply use a constructor? Because with the static initalization, you may run something like

```typescript
class MyController interface IfController {

  constructor( private MyResource resource, private MyOtherResource otherResource ) {}

  static async init() {
    return new MyController( new MyResource(), new MyOtherResource() )
  }
}
```

which means that both `resource` and `otherResource` have types `MyResource` and `MyOtherResource` and not `MyResource | undefined` and `MyOtherResource | undefined`. Indeed, the controller is the one place for dependency injection which allows the dependency to have a strictly defined type. It avoids having to check for the resource in the handler itself.

Note also that the `init` function **MUST** be async. It allows to run async jobs before moving with the controller.

Also note that the `init` method is **ONLY** called during a Lambda cold start. When the runtime is already warm, only the handler is called.

## <a name='Implementingmultipleroutesinacontroller'></a>Implementing multiple routes in a controller

Depending on your design choices, you may decide to create a single controller for multiple routes, for example when handling CRUD operations. This can be achieved like that:

Routes definitions (1 file per handler)

```typescript
// Create.ts
import { CreateController } from 'path/to/controller';

const createHandlerWrapperFactory =
  new APIGatewayHandlerWrapperFactory().setHandler('create'); // <= Note here handler name

type controllerInterface = APIGatewayCtrlInterface<
  typeof createHandlerWrapperFactory
>;

const handlerWrapper = createHandlerWrapperFactory.makeHandlerFactory();
export const { handler, configuration } = handlerWrapper(CreateController);
export { controllerInterface };
```

```typescript
// Read.ts
import { ReadController } from 'path/to/controller';

const readHandlerWrapperFactory =
  new APIGatewayHandlerWrapperFactory().setHandler('read'); // <= Note here handler name

type controllerInterface = APIGatewayCtrlInterface<
  typeof readHandlerWrapperFactory
>;

const handlerWrapper = readHandlerWrapperFactory.makeHandlerFactory();
export const { handler, configuration } = handlerWrapper(ReadController);
export { controllerInterface };

// Update.ts...
// Delete.ts...
```

Controller implementation

```typescript
// Controller.ts
import type { controllerInterface as createInterface } from 'path/to/create_route';
import type { controllerInterface as readInterface } from 'path/to/read_route';
import type { controllerInterface as updateInterface } from 'path/to/update_route';
import type { controllerInterface as deleteInterface } from 'path/to/delete_route';

export class MyController // The controller must now implement 4 interfaces, 1 for each route
  implements createInterface, readInterface, updateInterface, deleteInterface
{
  static async init() {
    return new MyController();
  }

  create: IfHandler<createInterface> = async (payload, secrets) => {};
  read: IfHandler<readInterface> = async (payload, secrets) => {};
  update: IfHandler<updateInterface> = async (payload, secrets) => {};
  delete: IfHandler<deleteInterface> = async (payload, secrets) => {};
}
```

## <a name='Typesystem'></a>Type system

When specifying a yup schema using `setInputSchema` and `setOutputSchema`, but when the corresponding `setTsInputType` and `setTsOutputType` are not set, the type of the input and output is dictated by yup's `InferType< typeof schema >`. The only way to overwrite that if - for example - yup's inferred type isn't good enough, is to override it with `setTsInputType`. This doesn't change the runtime validation, which solely depends on the presence of the schema or not.

On another note, the schema validation can be asynchronous. It is verified before your handler is called.

## <a name='Secretinjection'></a>Secret injection

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
handle: IfHandler<controllerInterface> = async (req, secrets) => {
  // Secrets is of type { process_env_key: string }
  console.log(secrets.process_env_key);
};
```

When the last parameter of the `needsSecret` method is true, the secret is required and the lambda will fail if it can't be found. When false, the method will be called, but the secret may be undefined.

## <a name='APIGatewayoutput'></a>API Gateway output

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

## <a name='EnhancingCDKcode'></a>Enhancing CDK code

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

## <a name='Anoteonerrorhandlingincontrollers'></a>A note on error handling in controllers

Error handling is an important part of the Lambda handler logic. Here is a list of good practices

- **Let the handler fail in case of unexpected errors**: We'll catch it for you and reply with an error 500 (for the API gateway at least). Same for SQS, we'll handle notifying the entry-point handler that the message processing has failed. We'll also notify Sentry and fail the span in Opentelemetry. Finally, we'll log appropriate messages.
- **When returning error, use the class HTTPError:** It allows us to implement some extra logic when the request fails. Also, it allows you to not respect to type `T` in `Request<T>`.
- **For errors that should be recorded, return an error like this: `return HTTPError.BAD_REQUEST( error ).anormal()`:** Any error set as "anormal" will trigger a Sentry error, register the exception in Opentelemetry and fail the tracing span.
- **`HTTPResponse.INTERNAL_ERROR` is always `anormal` and will always register**: You do not need to call `.anormal()`
