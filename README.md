# AWS Lambda Wrappers

Enhance your AWS Lambdas with wrappers to bring strong typings and runtime logic to your lambdas. Now with Sentry, Opentelemetry and Yup


<!-- vscode-markdown-toc -->

- [AWS Lambda Wrappers](#aws-lambda-wrappers)
  - [Installation](#installation)
  - [Installation](#installation-1)
  - [Usage](#usage)
    - [Create a project (or organisation-wide) manager](#create-a-project-or-organisation-wide-manager)
  - [Implementing a controller](#implementing-a-controller)
  - [Usage](#usage-1)
    - [Background](#background)
    - [Example](#example)
    - [Notes on the Wrapper Factory](#notes-on-the-wrapper-factory)
    - [Other notes](#other-notes)
  - [Implementing multiple routes / events in a controller](#implementing-multiple-routes--events-in-a-controller)
  - [Type system](#type-system)
  - [Secret injection](#secret-injection)
    - [Dealing with Key-Value Secrets](#dealing-with-key-value-secrets)
    - [Dealing with String Secrets](#dealing-with-string-secrets)
    - [Providing a secret list to the manager](#providing-a-secret-list-to-the-manager)
  - [API Gateway output](#api-gateway-output)
  - [A note on error handling in controllers](#a-note-on-error-handling-in-controllers)

<!-- vscode-markdown-toc-config
	numbering=false
	autoSave=true
	/vscode-markdown-toc-config -->
<!-- /vscode-markdown-toc -->

Features:

- Provides a controller interface to be implemented by a controller
- Strong type checking
- Input and output schema validation (leveraging yup)
- Sentry wrappers
- Opentelementry wrappers
- AWS Secrets manager injection
- Cold start initialisation method

## <a name='Installation'></a>Installation

```bash
npm i aws-lambda-wrappers
```


## <a name='Installation'></a>Installation


## Usage

### Create a project (or organisation-wide) manager

Start by sharing a wrapper manager across all your lambda functions. This is useful to share configuration across your organisation.

Currently, this is only useful for the list of usable secrets, but it may be extended in the future.

```typescript
import { LambdaFactoryManager } from 'aws-lambda-wrappers'
const mgr = new LambdaFactoryManager();

// We'll import the manager later on !
export default mgr;
```


To use the manager in a handler file, import the manager you just exported into a new file (the one that will use by AWS to handle your function):

```typescript

import manager from './path/to/manager'

const wrapperFactory = manager.apiGatewayWrapperFactory( "handler_name" );

```

Wrapper factory constructors are available for

- API Gateway
- Event Bridge
- SNS
- SQS

The string parameter passed to the constructor function defines which method must be implemented by the constructor:

```typescript
type HandlerIf = APIGatewayCtrlInterface<wrapperFactory>

/* HandlerIf is of type
{
  handler_name: ( data: APIGatewayData<unknown>, secrets: Record<string, string> ): Promise<HTTPResponse<unknown> | HTTPError>
}
*/
```

The handler can be further composed to enhance the type safety and runtime safety of the controller:

```typescript

const wrapperFactory = manager
  .apiGatewayWrapperFactory( "handler_name" )
  .setTsInputType<Animal>()
  .setOutputSchema( yup.object( {
    handled: yup.boolean()
  }));

export type InterfaceHandler = APIGatewayCtrlInterface< typeof wrapperFactory >

// Creating the handler and the configuration

import Controller from './path/to/controller'
export const { handler, configuration } = wrapperFactory.createWrapper( Controller )
```

## Implementing a controller

Based on the interface provided by the route, we can now implement our controller, which has two requirements:

- Provide a static async initializer, called `static async init`
- Provide the method mandated by the route

```typescript

import { InterfaceHandler } from './path/to/interface'

export class Controller implements InterfaceHandler {

  constructor( private myResource: MyResource) {

  }

  static async init() {
    // Acquires MyResource only during a cold start
    return new Controller( new MyResource() );
  }

  // Inherits the method parameter types and return type from the interface. See for details
  handler_name: IfHandler<InterfaceHandler> = async ( data, secrets ) => {
    return HTTPResponse.OK_NOT_CONTENT();
  }
}
```

Note on the following:

- The static initialisation is only called during an initial cold start. During the subsequent lambda invocations, the same controller instance will be reused without re-initialisation. The constructor is not used directly by the wrapper. The static init is used because of the following benefits:
  - Asynchronous initialisation
  - Type safety in the controller (`myResource` is of type `MyResource`, and not of type `MyResource | undefined`)
- You may therefore use the static init method to perform any required initialisation you may desire, for which state should per persisted across invocation
- The IfHandler<> utility is provided because by default, implemented methods to do infer their parameter types from the implemented interface.
- Several routes can be implemented using `implements IfOfRouteA, IfOfRouteB, ...``



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
import{ manager}from 'path/to/manager'
import {
  APIGatewayCtrlInterface,
} from '@lendis-tech/lambda-handlers';

// API Route definition file
const handlerWrapperFactory = manager.apiGatewayWrapperFactory('handle')
  .setTsInputType<INPUT_TYPE>() // Injects type safety, overrides yup schema
  .setTsOutputType<OUTPUT_TYPE>() // Injects type safety, overrides yup schema
  .setInputSchema(yupSchema) // Of type yup
  .setOutputSchema(yupSchema) // Of type yup
  .needsSecret('process_env_key', 'SecretName', 'adminApiKey', true) // Fetches the secrets during a cold start
  .needsSecret('process_env_other_key', 'SecretName', 'apiKey', true);

type controllerInterface = APIGatewayCtrlInterface<
  typeof handlerWrapperFactory
>;

export const { handler, configuration } = handlerWrapperFactory.wrapHandler(MyController);
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

- `manager.apiGatewayWrapperFactory()` (and similarly for all other event sources) is to be done for every lambda that you wish to create
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
// API Gateway handler
type controllerInterface = APIGatewayCtrlInterface<
  typeof handlerWrapperFactory
>;

// Event bridge handler
type controllerInterface = EventBridgeCtrlInterface<
  typeof handlerWrapperFactory
>;

// SNS handler
type controllerInterface = SNSCtrlInterface<
  typeof handlerWrapperFactory
>;

// SQS handler
type controllerInterface = SQSCtrlInterface<
  typeof handlerWrapperFactory
>;

```


## <a name='Implementingmultipleroutesinacontroller'></a>Implementing multiple routes / events in a controller

Depending on your design choices, you may decide to create a single controller for multiple routes, for example when handling CRUD operations. This can be achieved like that:

Routes definitions (1 file per handler)

```typescript
// Create.ts
import { CreateController } from 'path/to/controller';

const createHandlerWrapperFactory = manager.apiGatewayWrapperFactory('create');
  
type controllerInterface = APIGatewayCtrlInterface<
  typeof createHandlerWrapperFactory
>;

export const { handler, configuration } = createHandlerWrapperFactory.wrapHandler(CreateController);
export { controllerInterface };
```

```typescript
// Read.ts
import { ReadController } from 'path/to/controller';

const readHandlerWrapperFactory = manager.apiGatewayWrapperFactory('read');

type controllerInterface = APIGatewayCtrlInterface<
  typeof readHandlerWrapperFactory
>;

export const { handler, configuration } = readHandlerWrapperFactory.wrapHandler(ReadController);
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

Secrets are exposed in 2 ways

- Injected into process.env
- Available in the controller method (the 2nd argument)

```typescript
controllerFactory.needsSecret(
  'key',
  'SecretName',
  'SecretKey',
  true
);

class Controller implements RouteHandler {

  handler: IfHandler<RouteHandler> = async ( data, secrets ) => {

    // secrets.key is available as "string"
    // process.env.key is also available for use
  }
}
```

### Dealing with Key-Value Secrets

AWS Secrets can be of JSON type. It is pretty common to store a simple key-value structure in AWS, which we support for retrieval:
```typescript
controllerFactory.needsSecret(
  'process_env_key',
  'SecretName',
  'SecretKey',
  true
);
```

Note that the lambda will fail if the provided secret is NOT JSON-valid.

### Dealing with String Secrets

By setting `undefined` as the second parameter, the string version of the JSON:

```typescript
controllerFactory.needsSecret(
  'process_env_key',
  'SecretName',
  undefined,
  true
);
```



When the last parameter of the `needsSecret` method is true, the secret is required and the lambda will fail if it can't be found. When false, the method will be called, but the secret may be undefined.

### Providing a secret list to the manager

Imagine an object `aws_secrets` contains the list of all available secrets in the format

```typescript

enum ENUM_OF_SECRET_NAME {
  "SecretKey",
  "SecretOtherKey"
}

export const aws_secrets = {
  secretName: ENUM_OF_SECRET_NAME,
  otherSecretName: ENUM_OF_OTHER_SECRET_NAME
}
```
(This format can automatically be generated using the package `aws-secrets-manager-aot`)

By setting the secret list into the manager, they can provide type safety when calling `needsSecret`:

```typescript
import { LambdaFactoryManager } from 'aws-lambda-wrappers'
const mgr = new LambdaFactoryManager().setSecrets( aws_secrets );
// Imagine a list of secrets, indexed by secret name on the first level, and secret key (for key-value secrets) on the second level

export default mgr

///

mgr.apiGatewayWrapperFactory('read').needsSecret("key", "secretName", "SecretKey");
```

Autocompletion of the secret name:
![Autocompletion](./doc/secret_autocompletion.png)

Autocompletion of the secret key:
![Autocompletion](./doc/secret_key_autocompletion.png)


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


## <a name='Anoteonerrorhandlingincontrollers'></a>A note on error handling in controllers

Error handling is an important part of the Lambda handler logic. Here is a list of good practices

- **Let the handler fail in case of unexpected errors**: We'll catch it for you and reply with an error 500 (for the API gateway at least). Same for SQS, we'll handle notifying the entry-point handler that the message processing has failed. We'll also notify Sentry and fail the span in Opentelemetry. Finally, we'll log appropriate messages.
- **When returning error, use the class HTTPError:** It allows us to implement some extra logic when the request fails. Also, it allows you to not respect to type `T` in `Request<T>`.
- **For errors that should be recorded, return an error like this: `return HTTPError.BAD_REQUEST( error ).anormal()`:** Any error set as "anormal" will trigger a Sentry error, register the exception in Opentelemetry and fail the tracing span.
- **`HTTPResponse.INTERNAL_ERROR` is always `anormal` and will always register**: You do not need to call `.anormal()`
