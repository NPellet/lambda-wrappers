# AWS Lambda Handlers

<a href="https://codecov.io/gh/NPellet/lambda-wrappers/branch/main/">
  <img alt="Codecov Status" src="https://img.shields.io/codecov/c/github/NPellet/lambda-wrappers">
</a>

  <a href="https://github.com/NPellet/lambda-wrappers/actions/workflows/test.yaml">
  <img src="https://github.com/NPellet/lambda-wrappers/actions/workflows/test.yaml/badge.svg">
</a>



[==> Visit examples <==](https://github.com/NPellet/lambda-wrappers/tree/main/examples)

Enhance your AWS Lambdas with wrappers to bring strong typings and runtime logic to your lambdas. Now with Sentry, Opentelemetry and Yup and Secret prefetching

## <a name='Breakingchangesinv3.x'></a>Breaking changes in v3.x

From v3.x, the validation system has been reworked, and we're dropping native support of yup in favor of a more global approach. Validators can now be registered at the manager level and consumed by the implementation of the AWS Lambda.

One major side-effect - and downside, really - is that we no longer infer the input and output types from the schemas. This must now be explicitely written by the implementation (e.g. `.setTsInputType<InferType<typeof schema>>()` for yup).

The major upside is that you can write validators not only for the payload, but also for any additional information provided to the lambda, via for example the headers for the API Gateway, or via the Message Attributes for SQS. Lambdas can also chain validators, to not only enforce schema validation, but any other type of validator you may decide to write at the manager level.

Check out [Runtime Validation](#runtime-validation) for explanations and examples.

## <a name='Breakingchangesinv2.x'></a>Breaking changes in v2.x

The only changes between v2.x and v1.x are in the handling of the secrets.
For the documentation of v1.x, see [documentation](https://www.npmjs.com/package/aws-lambda-handlers/v/1.0.31)

Version 2 introduces a small breaking change when working with AWS secrets. In v2, it is possible to define custom secret fetchers other than target other sources than the AWS Secret manager.
Therefore, we had to introduce a change in the following signatures:

```typescript
// 1.x:
new LambdaFactoryManager().setSecrets(/*...*/);
// 2.x:
new LambdaFactoryManager().setAWSSecrets(/*...*/);
////////////////////////////
// 1.x:
factory.needsSecret('key', 'secretName', 'secretKey', required); // required is bool
// 2.x:
factory.needsSecret(
  'aws',
  'key',
  'secretName',
  'secretKey',
  undefined,
  required
);
```

The reason behind those changes in reflected in the following documentation (under [Secret injection](#secret-injection))

## <a name='Why'></a>Why ?

AWS Lambda's are a great piece of engineering and makes our life easier, but they're pretty "raw". For example, it would be pretty useful to:

- Wrap the handlers with Sentry (you could also use a lambda layer for that)
- Automatically parse and validate the inputs based on schemas
- Sanitize the outputs: API Gateway's responses and SQS failed batch items
- Pre-fetch a bunch of secrets from the secret manager (you should not have them defined in environment variables !)
- Have static type safety
- Overcome the shortcomings of Opentelemetry's Lambda auto-instrumentation

This package provides an opiniated stack to insert additional logic in handling lambdas triggered from the API Gateway, the Event Bridge, SQS and SNS (and we will be adding more sources later !).

<!-- vscode-markdown-toc -->
- [AWS Lambda Handlers](#aws-lambda-handlers)
  - [Breaking changes in v3.x](#breaking-changes-in-v3x)
  - [Breaking changes in v2.x](#breaking-changes-in-v2x)
  - [Why ?](#why-)
  - [How it works](#how-it-works)
  - [Installation](#installation)
  - [Features](#features)
  - [Demo Usage](#demo-usage)
    - [1. Create a service-wide (or cross-service) manager](#1-create-a-service-wide-or-cross-service-manager)
    - [Go down the simpler functional route](#go-down-the-simpler-functional-route)
      - [2. Implement your business logic directly](#2-implement-your-business-logic-directly)
    - [Go down the more complex OOP route:](#go-down-the-more-complex-oop-route)
      - [2. Create a route / event handler using the manager](#2-create-a-route--event-handler-using-the-manager)
      - [3. Create a controller](#3-create-a-controller)
  - [Details](#details)
    - [Triggering from different AWS sources](#triggering-from-different-aws-sources)
    - [Notes on immutability](#notes-on-immutability)
    - [Handler method name](#handler-method-name)
  - [Detailed Usage](#detailed-usage)
    - [Main exports](#main-exports)
    - [Complete example](#complete-example)
    - [Notes on the Wrapper Factory](#notes-on-the-wrapper-factory)
    - [Other notes](#other-notes)
    - [Implementing a controller](#implementing-a-controller)
    - [Implementing multiple routes / events in a controller](#implementing-multiple-routes--events-in-a-controller)
  - [Type system](#type-system)
  - [Runtime validation](#runtime-validation)
    - [Using pre-baked validators](#using-pre-baked-validators)
    - [API Gateway](#api-gateway)
  - [JSON, String, Number or Buffer ?](#json-string-number-or-buffer-)
  - [Metering](#metering)
    - [General metrics](#general-metrics)
    - [API Gateway](#api-gateway-1)
    - [SNS](#sns)
    - [SQS](#sqs)
  - [Using Sentry](#using-sentry)
    - [Disabling Sentry](#disabling-sentry)
  - [Secret injection](#secret-injection)
    - [Dealing with Key-Value Secrets](#dealing-with-key-value-secrets)
    - [Dealing with String Secrets](#dealing-with-string-secrets)
    - [Providing a secret list to the manager](#providing-a-secret-list-to-the-manager)
    - [Providing alternative secret sources](#providing-alternative-secret-sources)
  - [Configuring runtime](#configuring-runtime)
    - [Manager level](#manager-level)
    - [Wrapper handler level](#wrapper-handler-level)
  - [Specificifities](#specificifities)
    - [API Gateway](#api-gateway-2)
      - [Input](#input)
      - [Output](#output)
      - [Error handling](#error-handling)
    - [Event Bridge](#event-bridge)
      - [Input](#input-1)
      - [Output](#output-1)
  - [A note on error handling in controllers](#a-note-on-error-handling-in-controllers)

<!-- vscode-markdown-toc-config
	numbering=false
	autoSave=true
	/vscode-markdown-toc-config -->
<!-- /vscode-markdown-toc -->

## <a name='Howitworks'></a>How it works

With this framework, you start by declaring a **Lambda Manager**, which may be common across all your microservices. It allows to define which secrets are generally available (thereby getting autocompletion), configure secret sources for secret managers other than AWS and configure a base Sentry configuration for all your lambdas in all your services. The lambda manager is a common source of **Handler Wrappers**, for the API Gateway, SQS, SNS or for the EventBridge.

Then, in each service, use the **Lambda Manager** to define a **Handler Wrapper**, which can be further configured (this time on a per-lambda basis) with secrets, static typings and schema validation. 

From there, you can go down two routes, depending on the level of complexity / project management you wish to follow:

- **The simple route** uses functional programming. Directly wrap the function handler using the `wrapFunc` method and be done.
- **The "better" route** uses OOP. Produce a controller which implements a defined interface (2 method required), allowing you to handle many routes per controller, and feed this controller to the **Handler Wrapper**.

Finally, export the handler and expose it to AWS.


It may sound a bit overly complex, but after using it a bit, it will all make sense.

## <a name='Installation'></a>Installation

```bash
npm i aws-lambda-handlers
```

## <a name='Features'></a>Features

- Strongly typed TS Interfaces to be implemented by Controllers
- Optional payload input (and output) validation against a schema (or any other validation function)
- Wrapping with Sentry (with cross-oranisation configuration sharing)
- Tracing with Opentelemetry, separating Lambda spans with source spans (no need for the auto-instrumentation)
- Before executing a controller, secrets may be pre-fetched and provided to you
- State can easily be persisted across invocations, and cold-start initialisation can be easily used for resource acquisition

## <a name='DemoUsage'></a>Demo Usage

### <a name='Createaservice-wideorcross-servicemanager'></a>1. Create a service-wide (or cross-service) manager

Start by sharing a wrapper manager across all your lambda functions. This is useful to share configuration across your organisation.

Currently the manager is used for:

- Setting a global Sentry configuration
- Setting the list of available AWS secrets
- Setting another source of secrets as well as how to retrieve them

```typescript
// path/to/manager.ts
import { LambdaFactoryManager } from 'aws-lambda-handlers';
const mgr = new LambdaFactoryManager();
// We'll import the manager later on !
export default mgr;
```
### <a name='Godownthesimplerfunctionalroute'></a>Go down the simpler functional route

#### <a name='Implementyourbusinesslogicdirectly'></a>2. Implement your business logic directly
You can now create the route / event handler and specify its implementation as such:

```typescript
import manager from './path/to/manager'; 
export const { handler_name, configuration } = manager
  .apiGatewayWrapperFactory('handler_name')
  .setTsInputType<string>()
  .wrapFunc( async ( data, init, secrets ) => {
    // Business logic here
    return HTTPResponse.OK_NO_CONTENT();
  });

```

Note here how the name of the function in the output object (here: `handler_name`) is the one you set in the `apiGatewayWrapperFactory` method. It's also the handler you must configure in AWS:  `path/to/route.handler_name`

You can use this to implement multiple functions in a single file (though we do not recommend it)

If you implement multiple handlers per file and you need to access the `configuration` object, you will need to rename the `configuration` object during destructuring.


### <a name='GodownthemorecomplexOOProute:'></a>Go down the more complex OOP route:
#### <a name='Createarouteeventhandlerusingthemanager'></a>2. Create a route / event handler using the manager

It is good practice to separate the logic (a controller) from the handler itself (the entrypoint exposed to AWS), which allows you to swap controllers or implement multiple lambdas with a single controller. <br>
Ideally, the controller route should be `require`-able without it executing any service logic. This allows you to expose "meta-information" that can be used by other tools (for example, automatically add IAM permissions in a CDK code by loading the `configuration` object, or building an OpenAPI v3 spec, etc.)

Start by the handler file: import the manager you just exported into a new file (the one that will use by AWS to handle your function) and either start an API Gateway wrapper, and Event Bridge wrapper, an SNS wrapper or an SQS wrapper

```typescript
// path/to/route.ts
import manager from './path/to/manager'; // You can also use an npm module to share the mgr across your org
const wrapperFactory = manager
  .apiGatewayWrapperFactory('handler_name')
  .setTsInputType<string>();

import { Controller } from './path/to/controller';
export const { handler, configuration } =
  wrapperFactory.createHandler(Controller);
export type Interface = CtrlInterfaceOf<typeof wrapperFactory>;
```

#### <a name='Createacontroller'></a>3. Create a controller

You may now write the controller, which must implement the interface exported by the Lambda wrapper (we called it `Interface`, see above)

```typescript
// path/to/controller.ts
import { Interface } from './path/to/route';

class Controller implements Interface {
  static async init() {
    return new Controller();
  }
  handler_name: IfHandler<Interface> = async (data, secrets) => {
    // Write your logic here
  };
}
```

And that's it for the most basic implementation ! You may now use `path/to/route.handler` as a Lambda entry-point.

The syntax `handler_name: IfHandler<Interface> = ` allows to automatically infer the types of the method arguments without needing to be explicit. This is because in typescript (in 4.9 at least), arguments in methods that implement an interface are not inferred and default to `any`. So rather than setting the type of the arguments explicitely, it's easier to just explicitely type the whole method.

## <a name='Details'></a>Details

In this section we explore the benefits that our approach brings.

### <a name='TriggeringfromdifferentAWSsources'></a>Triggering from different AWS sources

Wrapper factory constructors are available for

- API Gateway:
  ```typescript
    manager.apiGatewayWrapperFactory( handler: string );
  ```
- Event Bridge
  ```typescript
    manager.eventBridgeWrapperFactory( handler: string );
  ```
- SNS
  ```typescript
    manager.sqsWrapperFactory( handler: string );
  ```
- SQS
  ```typescript
    manager.snsWrapperFactory( handler: string );
  ```

The differences exist because the input types and output types are not the same whether the lambda is triggered by either of those event sources, and because the error handling is different (for example, the lambda triggered by the API Gateway should never fail, but the EventBridge lambda may be allowed fail). In addition, the SQS loop is unrolled (you implement only the method for the record, not for the whole event, which contains many records) for error management purposes.

### <a name='Notesonimmutability'></a>Notes on immutability

Both the `LambdaFactoryManager` and the derived `APIGatewayWrapperFactory` and others are **mostly** immutable (understand by it that you cannot safely rely on their immutability either). It is important to understand that most of the methods return a new instance:

```typescript
const apiWrapperFactory = new LambdaFactoryManager().apiGatewayWrapperFactory();

const apiWrapperFactory2 = api.needsSecret(/*...*/);

// apiWrapperFactory2 is of "similar" type as apiWrapperFactorty, and will require the secret
// apiWrapperFactory will NOT require the secret

// BAD !
api.needsSecret(); // Not assigned to a variable
```

### <a name='Handlermethodname'></a>Handler method name

The string parameter passed to the constructor function defines which method must be implemented by the constructor:

```typescript
type HandlerIf = CtrlInterfaceOf<wrapperFactory>;

/* HandlerIf is of type
{
  handler_name: ( data: APIGatewayData<unknown>, secrets: Record<string, string> ): Promise<HTTPResponse<unknown> | HTTPError>
}
*/
```



## <a name='DetailedUsage'></a>Detailed Usage

### <a name='Mainexports'></a>Main exports

This package exposes 3 main objects you may want to import:

- `class LambdaFactoryManager`, which is used to create a WrapperFactory (1 type per event source), used to then create the AWS Lambda handler
- `type CtrlInterfaceOf`, which derives the WrapperFactory into a TS interface to be implemented by the controller
- `type IfHandler`, which stands for "interface handler", and informs the controller handler about the parameter type (see examples).

### <a name='Completeexample'></a>Complete example

```typescript
//====================================================================
// route.ts
import manager from 'path/to/manager';
import { MyController } from 'path/to/controller';
import { CtrlInterfaceOf } from 'aws-lambda-handlers';

// API Route definition file
const handlerWrapperFactory = manager
  .apiGatewayWrapperFactory('handle')
  .setTsInputType<INPUT_TYPE>() // Injects type safety, overrides yup schema
  .setTsOutputType<OUTPUT_TYPE>() // Injects type safety, overrides yup schema
  .validateInput("yup", yupSchema) // Of type yup.BaseSchema // ! The yup validator must be defined first
  .validateOutput("yup", yupSchema) // Of type yup.BaseSchema // ! The yup validator must be defined first
  .needsSecret(
    'aws',
    'process_env_key',
    'SecretName',
    'adminApiKey',
    undefined,
    true
  ) // Fetches the secrets during a cold start
  .needsSecret(
    'aws',
    'process_env_other_key',
    'SecretName',
    'apiKey',
    undefined,
    true
  );

type controllerInterface = CtrlInterfaceOf<typeof handlerWrapperFactory>;

export const { handler, configuration } =
  handlerWrapperFactory.createHandler(MyController);
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

- `manager.apiGatewayWrapperFactory()` (and similarly for all other event sources) must be called for every lambda that must be created. It takes a single argument: the name of the handler function to be implemented in the controller
- `.setTsInputType<T>()` informs the interface on the input type you're expected to receive. We're not talking about the raw type (e.g. `APIGatewayEvent`), but rather
  - The `body` field for the API gateway (will be JSON.parse'd if the Content-Type is application/json)
  - The `detail` field for the Event Bridge
  - The `message` content for SQS and SNS
- similarly, `.setTsOutputType<T>()` informs the type of response the controller is supposed to return (or an instance of `HTTPError` if the controller failed). Only applies to API Gateway
- `setInputSchema<SCHEMA_TYPE>( schema )` and `setOutputSchema<SCHEMA_TYPE>( schema )` add a runtime verification of a `yup` schema. When `setTsInputType` is not defined but `setInputSchema` is, then the controller is expected to received the result of `InferType< SCHEMA_TYPE >` instead of `T`
- `needsSecret( source, key, secretName, secretKey, meta, required )` is used for ahead-of-execution secret injection: when a cold start occurs, the Lambda wrapper will detect if the secret has been injected into `process.env[ key ]`. If not, it will fetch it from AWS and inject it into `process.env`. It will also be made available in the handler method with strong typing.
  The `required` field can be used to outrightly fail the lambda when the secret is not found. Note that `secretName` and `secretKey` have auto-completion and will report a TS error if you have provided a secret list in the manager.

### <a name='Othernotes'></a>Other notes

Once the wrapper factory has been created, you can extract its interface type using:

```typescript
// API Gateway handler
type controllerInterface = CtrlInterfaceOf<typeof APIHandlerWrapperFactory>;

// Event bridge handler
type controllerInterface = CtrlInterfaceOf<
  typeof EventBridgeHandlerWrapperFactory
>;

// SNS handler
type controllerInterface = CtrlInterfaceOf<typeof snsHandlerWrapperFactory>;

// SQS handler
type controllerInterface = CtrlInterfaceOf<typeof sqsHandlerWrapperFactory>;
```

### <a name='Implementingacontroller'></a>Implementing a controller

Implementing a Controller has 2 requirements:

- Provide a static async initializer, called `static async init`
- Provide the method mandated by the route

```typescript
import { InterfaceHandler } from './path/to/interface';

export class Controller implements InterfaceHandler {
  constructor(private myResource: MyResource) {}

  static async init() {
    // Acquires MyResource only during a cold start
    return new Controller(new MyResource());
  }

  // Inherits the method parameter types and return type from the interface. See for details
  handler_name: IfHandler<InterfaceHandler> = async (data, secrets) => {
    return HTTPResponse.OK_NOT_CONTENT();
  };
}
```

Note on the following:

- The static initialisation is only called during an initial cold start. During the subsequent lambda invocations, the same controller instance will be reused without re-initialisation.
- The wrapper doesn't use the controller constructor directly. Instead, the async static init is used and brings the following benefits:
  - Asynchronous initialisation
  - Type safety in the controller (`myResource` is of type `MyResource`, and not of type `MyResource | undefined`)
- You may therefore use the static init method to perform any required initialisation you may desire and persist the state across invocations
- The IfHandler<> utility is provided because by default, implemented methods to do infer their parameter types from the implemented interface. See [this issue](https://github.com/Microsoft/TypeScript/issues/23911) for reference
- Several routes can be implemented using `implements IfOfRouteA, IfOfRouteB, ...``

### <a name='Implementingmultiplerouteseventsinacontroller'></a>Implementing multiple routes / events in a controller

Depending on your design choices, you may decide to create a single controller for multiple routes, for example when handling CRUD operations. This can be achieved like that:

Routes definitions (1 file per handler, or more, but then you'd have to rename all symbols)

```typescript
// Create.ts
import Controller from 'path/to/controller';
import manager from 'path/to/manager';
const createHandlerWrapperFactory = manager.apiGatewayWrapperFactory('create');
export type controllerInterface = CtrlInterfaceOf<
  typeof createHandlerWrapperFactory
>;
export const { handler, configuration } =
  createHandlerWrapperFactory.createHandler(Controller);
```

```typescript
// Read.ts
import Controller from 'path/to/controller';
import manager from 'path/to/manager';
const readHandlerWrapperFactory = manager.apiGatewayWrapperFactory('read');
export type controllerInterface = CtrlInterfaceOf<
  typeof readHandlerWrapperFactory
>;
export const { handler, configuration } =
  readHandlerWrapperFactory.createHandler(Controller);

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

export class Controller // The controller must now implement 4 interfaces, 1 for each route
  implements createInterface, readInterface, updateInterface, deleteInterface
{
  static async init() {
    return new Controller();
  }

  // Implement your business logic below
  create: IfHandler<createInterface> = async (payload, secrets) => {};
  read: IfHandler<readInterface> = async (payload, secrets) => {};
  update: IfHandler<updateInterface> = async (payload, secrets) => {};
  delete: IfHandler<deleteInterface> = async (payload, secrets) => {};
}
```

## <a name='Typesystem'></a>Type system

When specifying `setTsInputType` (and `setTsOutputType` for the API Gateway), the input data will reference those types (even when a schema is set) but do nothing at the runtime (you need to set a schema for that)

If you are validating against a schema, most libraries provide with a way to infer a typescript type from the schema type. You may leverage the use of static type inference to avoid typing your TS typings twice:

- For yup, use `.setTsInputType<InferType<typeof schema>>()`
- For zod, use `.setTsInputType<z.infer<typeof schema>>()`
- For a JSON schema, use the package [json-schema-to-ts](https://www.npmjs.com/package/json-schema-to-ts) and use `.setTsInputType<FromSchema<typeof schema>>()`

Note that this doesn't give you runtime validation yet.

## <a name='Runtimevalidation'></a>Runtime validation

When writing the `LambdaFactoryManager`, you can add to it validators functions, which can be optionally consumed by the lambda implementation. Validators may be used to enforce a schema, but may also validate other other message properties (headers, message attributes, source origins, etc...)

Validators must:
- be asynchronous (even if the validation is synchronous, the function needs to return a Promise)
- throw an error when the validation fails
- takes a name and two functions
  - The validator itseld
  - An init function, run at cold start, allowing modifications of the arguments (and the BaseWrapperFactory as well) (see example below)
  

Adding a validator to the manager takes the following syntax

```typescript
const mgr = new LambdaFactoryManager().addValidation(
    "validationName",
    // Validation function 
    async (
      data: any, 
      rawData: APIGatewayEvent | EventBridgeEvent<any, any> | SQSEvent | SNSEvent, 
      arg2: T2,
      arg3: T3,
      //...
    ) => {

      await schema.validate( data );
    }, 
    // Init function
    ( wrapper: BaseWrapperFactory<any>, arg2: T4 ): [ T2, T3 ] => {

      let a: T2;
      let b: T3;
      return [ a, b ];
    }
);
```

In other words, the `init` function defines the arguments that the `validateInput` and `validateOutput` take (in this case: 1 arg of type `T4`) and returns a tuple or arguments fed into the validator (in this case: 2 args of type `T2` and `T3`).

This allows you to run type modifications, e.g. schema compilation (which should only run on a cold start).

Note the two first 2 parameters of the validation function are fixed and of type `any`. They represent the (1) extracted data itself (parsed request body, SNS message body, etc) and (2) the raw event that the lambda has received. It can be of any type because the validator defined at the `LambdaManager` level could be used with any event source (API Gateway, EB, SQS, SNS).

From the third argument on, the values are passed during the consumption of the validator:

```typescript
declare a: T4;
mgr.apiGatewayWrapperFactory("handler").validateInput( "validationName", a );
```

There is strong type safety in the sense that the second argument of the `validateInput` method matches the type of the third argument in the validator method (and so on, the n+2 argument of the `validateInput` matches the type of the n+3 argument of the validator, n >= 0 ).

The API Gateway factory also features a `validateOutput` method.

For example, a schema validation for `yup` could be written like that:

```typescript
manager.addValidation("yup", async function (data, rawData: any, schema: BaseSchema) {
    // Let it throw when the validation fails
    await schema.validate(data, {
      strict: true,
      abortEarly: true
    });
  }, (wrapper: BaseWrapperFactory<any>, schema: BaseSchema): [BaseSchema] => {

    if (schema instanceof StringSchema) {
      wrapper._messageType = MessageType.String;
    } else if (schema instanceof NumberSchema) {
      wrapper._messageType = MessageType.Number;
    } else if (schema instanceof ObjectSchema) {
      wrapper._messageType = MessageType.Object;
    }

    return [schema]
  })
```

### <a name='Usingpre-bakedvalidators'></a>Using pre-baked validators

We provide for you npm packages bundling common validators, notably:

- [`aws-lambda-handlers-yup`](https://www.npmjs.com/package/aws-lambda-handlers-yup): Yup schema validation
- [`aws-lambda-handlers-zod`](https://www.npmjs.com/package/aws-lambda-handlers-zod): Zod schema validation
- [`aws-lambda-handlers-ajv`](https://www.npmjs.com/package/aws-lambda-handlers-ajv): AJV schema validation

They expose one default export, a function taking a `LambdaFactoryManager` and returning another `LambdaFactoryManager` with the validator included.

```typescript
import yupValidation from 'aws-lambda-handlers-yup';
const mgr = yupValidation( new LambdaFactoryManager() );
```

`yup` and `zod` and `ajv` are listed as dependencies in their respective packages, which means that if you install them with your manager, your bundler will include them with your manager and, in turn, your lambda will also be bundles will ALL validators you have installed (whether you actually use the validation or not). This shouldn't affect the runtime, but it will bloat a bit your package size.

### <a name='APIGateway'></a>API Gateway

If you need to fail and API Gateway lambda, you may decide to throw an HTTPError (e.g. `throw new HTTPError.BAD_REQUEST()`) and the correct status code will be used. Otherwise, status code 500 will be used.

## <a name='JSONStringNumberorBuffer'></a>JSON, String, Number or Buffer ?

The API Gateway, SNS and SQS pass the message body (or request as a string), and we need to make some guesswork to determine if it should be JSON parsed, base64 parsed, number parsed or not parsed at all.

Here are the rules we generally apply:

- If you have called the yup, zod or ajv validator, we infer from the `interface` of the schema and set it for you..
- If the schema is not set, but `setTsInputType` was called, then the handler will use JSON.parse
- If `setNumberInputType`, `setStringInputType` or `setBinaryInputType` is used instead of `setTsInputType`, then the handler will parse a float, nothing and a base64 buffer, respectively

- If nothing is called, there will do no parsing and the type will unknown anyway. In other words, you will get a string for API Gateway, SQS and SNS, and potentially a JSON for the Event Bridge.
- For the API Gateway, if the `Content-Type` headers of the request are `application/json`, we'll use JSON.parse to parse the body.

## <a name='Metering'></a>Metering

If you have configured the Opentelementry Metrics SDK, then the following metrics will automatically be acquired.

Note that you can change the name of the metrics using the `.configureRuntime()` method (in the second argument, with type completion)

Note: Make sure your opentelemetry metrics sdk (@opentelemetry/sdk-trace-node and @opentelemetry/sdk-trace-base) is at version at least 1.9.1. Some previous versions do not implement the most recent standard of the `forceFlush()` method.


### <a name='Generalmetrics'></a>General metrics

- `lambda_exec_total` (counter): Number of total lambda invocations
- `lambda_error_total` (counter): Number of errored invocations (any lambda that throws an unhandled error)
- `lambda_cold_start_total` (counter): Number of cold starts
- `lambda_exec_time` (counter): Execution time in seconds

Note that the execution time we calculate can be significantly lower than the one provided by AWS, especially in case of a cold start (and more particularly when you are using auto-instrumementation for large libraries like aws-sdk v2). For a more accurate reading, we recommand you looking into the AWS Telemetry API which can give you more accurate results, but is outside of the scope of this framework.

### <a name='APIGateway-1'></a>API Gateway

In addition, the API Gateway will record

- `http_requests_total` (counter): HTTP Request (equals `lambda_exec_total`) with added cardinality by:
  - Status code (`status_code`)
  - HTTP method (`method`)

### <a name='SNS'></a>SNS

- `sns_records_total` (counter): Total number of SNS records (equals `lambda_exec_total` given that SNS can receive only 1 record at the time) with added cardinality by
  - Topic (`topic`)
  - Event source (`source`)

### <a name='SQS'></a>SQS

- `sqs_records_total` (counter): Total number of SQS records (is larger or equal to `lambda_exec_total` given that SQS can process multiple records at the time) with added cardinality by
  - Event source (`source`) (the name of the queue)
  - AWS Region (`region`)
  
Note that an failed invocation counts towards a status 500

## <a name='UsingSentry'></a>Using Sentry

Sentry's configuration is likely to be used across your organisation's microservices, save for its DSN, which is likely to be one per service.
You may compose a manager using `.configureSentry( opts: Sentry.NodeOptions, expand: boolean )` (see [@sentry/node](https://www.npmjs.com/package/@sentry/node)), and compose it as many times as you see fit (Note that the configuration is mutable, i.e. the `configureSentry` method does not return a new manager)

The way to configure Sentry is to do it on the manager level:

```typescript
// path/to/manager.ts
import { LambdaFactoryManager } from 'aws-lambda-handlers';
const mgr = new LambdaFactoryManager().configureSentry(
  {
    enabled: true,
  },
  true
);

// We'll import the manager later on !
export default mgr;
```

It would be a common pattern to have a shared Sentry configuration for your whole organisation, used across all services, and then overwrite the DSN in each service:

```typescript
// Import an org-wide manager
import manager from '@myorg/my-lambda-manager'; // Image you published your utility manager there
const myNewManager = manager.configureSentryDSN(MY_SENTRY_DSN);
export default myNewManager; // Optional
```

Because the configuration is mutable, lambda handlers can still reference `@myorg/my-lambda-manager` and inherit the correct DSN.

### <a name='DisablingSentry'></a>Disabling Sentry

Additionally, Sentry can be disabled on a per-lambda basis using

```typescript
wrapperFactory.sentryDisable();
```

or by setting the environment variable DISABLE_SENTRY in the lambda's configuration (useful to avoid having to rebuild when you want to temporarily disable Sentry)

## <a name='Secretinjection'></a>Secret injection

Another cool feature of those lambda wrappers is that secrets from the AWS Secret Manager can be injected before the handler is called.
Secrets are fetched during a cold start, of after a 2h cache has expired, but otherwise, the secret values are cached and reused between invocations.

Secrets are exposed in two ways:
- Injected into process.env
- Available in the controller method (the 2nd argument)

```typescript
controllerFactory.needsSecret(
  source, // Use 'aws' for the default AWS secret manager
  'key',
  'SecretName',
  'SecretKey',
  meta, // Use undefined for the default AWS secret manager
  true
);

class Controller implements RouteHandler {
  handler: IfHandler<RouteHandler> = async (data, secrets) => {
    //                                            ^^^^^^^^
    // secrets is of type Record<"key", string>
    // secrets.key is available as type "string" for use
    // process.env.key is also available for use
  };
}
```

### <a name='DealingwithKey-ValueSecrets'></a>Dealing with Key-Value Secrets

AWS Secrets can be of JSON type. It is pretty common to store a simple key-value structure in AWS, which we support for retrieval:

```typescript
controllerFactory.needsSecret(
  source,
  'process_env_key',
  'SecretName',
  'SecretKey',
  meta,
  true
);
```

Note that the lambda will fail if the provided secret is NOT JSON-valid, except if the `required` parameter is `false`.

### <a name='DealingwithStringSecrets'></a>Dealing with String Secrets

By setting `undefined` as the second parameter, the string version of the JSON is returned.

```typescript
controllerFactory.needsSecret(
  source,
  'process_env_key',
  'SecretName',
  undefined,
  meta,
  true
);
```

When the last parameter of the `needsSecret` method is true, the secret is required and the lambda will fail if it can't be found. When false, the method will be called, but the secret may be undefined.

### <a name='Providingasecretlisttothemanager'></a>Providing a secret list to the manager

Imagine an object `aws_secrets` contains the list of all available secrets in the format

```typescript
enum ENUM_OF_SECRET_NAME {
  'SecretKey',
  'SecretOtherKey',
}

export const aws_secrets = {
  secretName: ENUM_OF_SECRET_NAME,
  otherSecretName: ENUM_OF_OTHER_SECRET_NAME,
};
```

By setting the secret list into the manager, they can provide type safety when calling `needsSecret`:

```typescript
import { LambdaFactoryManager } from 'aws-lambda-handlers';
const mgr = new LambdaFactoryManager().setAWSSecrets(aws_secrets);
// Imagine a list of secrets, indexed by secret name on the first level, and secret key (for key-value secrets) on the second level

export default mgr;

///

mgr
  .apiGatewayWrapperFactory('read')
  .needsSecret('aws', 'key', 'secretName', 'SecretKey');
```

Autocompletion of the secret name:

![Autocompletion](./doc/secret_autocompletion.png)

Autocompletion of the secret key:

![Autocompletion](./doc/secret_key_autocompletion.png)

### <a name='Providingalternativesecretsources'></a>Providing alternative secret sources

Since v2, it is possible to specify an implementation for secret managers other than the AWS secrets manager (for example, Hashicorp Vault, or GCP)

Fetching credentials from other sources will typically require authentication, and you can store the authentication credentials in the AWS secrets manager, which will be retrieved before your custom fetcher is called.

In addition, when tuning the manager, you can require that the services consuming your manager (when using `needsSecret`) to specify an extra set of arguments along with the `secretName` and `secretKey` parameters. This "meta information" may be used to alter the behaviour of your fetcher. For example, the region where the secret manager is located, or the namespace of the secret, its version, etc...

The fetching logic is written at the manager level, so it is by default shared across projects.

```typescript
type META = {
  "metaKey": string
};

const awsSecrets = {
  "Hashicorp": {
    "Auth": "Auth",
    "OtherInfo": "OtherInfo"
  }
}

// K-V of secrets stored in your other secret manager
const otherSecrets = {
  "Secret": {
    "Key": "Key",
    "OtherKey": "OtherKey",
  },
  "Secret2": {
    "Key": "Key",
    "OtherKey": "OtherKey",
  }
}

const mgr = new LambdaFactoryManager()
  .setAWSSecrets( awsSecrets )
  .addSecretSource<META>()( // Note here the "special" syntax, due to the fact that typescript doesn't have partial type inference at the time of writing
      "HashicorpVault",
      otherSecrets,
      ( aws ) => { // aws is a convenience function helping with auto-completion, based on the secrets passed to the manager in .setAWSSecrets()
        return {
            // With auto-completion if you're using VSCode :) !
            "authKey": aws("Hashicorp", "Auth", true),
            "otherKey": aws("Hashicorp", "OtherInfo" ) // Required defaults to true
        };
      },
      async ( toFetch, awsSecrets ) => {
          /*
            toFetch is of type
            Record<string, {
              source: string,
              secret: string,
              secretKey?: string,
              meta: META,
              required: boolean
            }>

            Where the key of the record is to be reused as the key in the return object of type Record<string, string | undefined>
          */

        const hashicorp_auth = awsSecrets.authKey;
        const other_helper_secret_from_aws = awsSecrets.otherKey;

          // Possible implementation
          let out: Record<string, string> = {};
          for( let [ k, secret ] of Object.entries( toFetch ) ) {
              out[k] = // Fetch here the secret;
          }
          return out;
      }
    );
```

Note that the prefetched AWS secrets are only fetched if the consumer actually requires a secret from the additional secret source. In that case, those prefetching secrets end up in the configuration and can be picked up by some of your IaC tools if you wish it.

In the example above, the "Hashicorp" secret is stored in AWS and prefetched at runtime. The `aws` method provided in the prefetch definition callback provides is just a helper to help with the configuration by providing auto-completion of the aws secrets:

- If you previously passed secrets via `setAWSSecrets`, auto-completion is enabled and the typescript compiler will complain if you require a secret that "doesn't exist" (and you'll need to silence it).
  
- If you do not provide any AWS secrets, parameters of the `aws` method  become `( string, string | undefined )` and therefore any string can be passed without TS complaining.

As the lambda consumes the manager, the developer may now call:

```typescript
// Auto-completion here as well !
api.needsSecret(
  'HashicorpVault', // Same value as passed to the .addSecretSource method
  'injectedKey', // Any string
  'Secret',
  'Key',
  {
    metaKey: 'metaVal',
  },
  true
);
```

Which can then be consumed by the handler as `injectedKey`.

Visit 
[this example](https://github.com/NPellet/lambda-wrappers/tree/main/examples/secrets) for a more complete example.


## <a name='Configuringruntime'></a>Configuring runtime

There is a certain level of configuration you can use in order to control the behaviour, notably of unhandled errors, of the wrappers. For example, you may not wish for unhandled errors to raise an exception with Sentry, or register with Opentelemetry. You may also wish to decide what happens when schema validation fails. Those configurations can be done at the manager level (again, to be used across your organisation/services) and can be overridden on a per-lambda basis.

### <a name='Managerlevel'></a>Manager level

Simply call the following:

```typescript
const mgr = new LambdaFactoryManager().setRuntimeConfig({
  _general: {
    // General configuration for all types of even sources
    recordExceptionOnLambdaFail: true, // When your inner wrapper throws an unhandled error, should we record the exception ?
    logInput: false // Whether to log (info level) the input data of the lambda handler
  },
  apiGateway: {
    recordExceptionOnValidationFail: true, // When the schema validation fails, should we record the exception ?
  },
  eventBridge: {
    failLambdaOnValidationFail: true, // When the validation fails, should we make the lambda fail (true) or just return and do nothing (false) ?
    recordExceptionOnValidationFail: true, // When the schema validation fails, should we record the exception ?
  },
  sns: {
    recordExceptionOnValidationFail: true, // When the schema validation fails, should we record the exception ?
    silenceRecordOnValidationFail: false, // When the schema validation fails, should we tag the record for a retry ?
  },
  sqs: {
    recordExceptionOnValidationFail: true, // When the schema validation fails, should we record the exception ?
    silenceRecordOnValidationFail: false, // When the schema validation fails, should we tag the record for a retry ?
  },
});
```

Notes:

- For SNS and SQS, if you want to use dead-letter queues, then `silenceRecordOnValidationFail` should be set to `false`. `true` will just not execute your handler and exit silently. For the DLQ to work, the record needs to fail, and therefore you need AWS to retry it.

### <a name='Wrapperhandlerlevel'></a>Wrapper handler level

For each wrapper handler (one for each event source), you can call the same function with two parameters:

```typescript
wrapperFactory.configureRuntime(SpecificRuntimeConfig, GeneralRuntimeConfig);
```

Where `SpecificRuntimeConfig` matches the config for the API Gateway, EB, SNS and SQS (see section "Manager level") and `GeneralRuntimeConfig` matches the config under the key `_general` (again, see above for an example of the payload)

## <a name='Specificifities'></a>Specificifities

### <a name='APIGateway-1'></a>API Gateway

#### <a name='Input'></a>Input

The payload passed to your handler is of type `Request<T>` ( where `T` is the static type set in `setTsInputType` or infered from the schema ).

The payload may be retrieved using:

```
declare const request: Request<any>;

// Retrieves the payload, JSON parsed and validated
const payload = request.getData();
// Returns the raw APIGatewayProxyEvent, where the body is a string
const raw = request.getRawData()
```

#### <a name='Output'></a>Output

To return an API Gateway Response, you are expected to return a `HTTPResponse`, using the static constructors:

```typescript
return HTTPResponse.OK(/* your data */);
// or
return HTTPResponse.OK_NO_CONTENT();
// or
// ... other static methods
```

If you set an output type with `setTsOutputType`, typescript will enforce static type safety in your response and you must conform to it.

If you set an output schema with `setOutputSchema`, javascript will validate your payload. If the payload does not validate, an HTTPError 422 will be sent to the upstream caller, in order to protect it from failing further.

To reply with a managed Error, use the static constructor methods on `HTTPError`, which take an Error or a string in their static constructor methods.

```typescript
return HTTPError.BAD_REQUEST(error);
// or
return HTTPError.BAD_REQUEST('Failure !');
```

Errors can be "acceptable" or "anormal". An anormal error will be registered with Sentry and Opentelemetry, and should indicate a condition that your service shouldn't enter. If this condition is a consequence of an invalid payload, do not set the error to anormal. This is a problem with the sender of the request. To make an error anormal, just to do following

```typescript
return HTTPError.BAD_REQUEST(error).anormal();
```

Note: `HTTPError.INTERNAL_ERROR()` is by default anormal.

In summary, the API Gateway handler should return `Promise<HTTPError | HTTPResponse<T>>`:

#### <a name='Errorhandling'></a>Error handling

When your lambda throws an error, the wrapper will catch it and automatically reply with `HTTPResponse.INTERNAL_ERROR( error )`, which means it's considered "anormal" and will register the exception with Sentry as well as fail the Opentelemetry span. In other words, it's perfectly acceptable to let the handler fail.

### <a name='EventBridge'></a>Event Bridge

#### <a name='Input-1'></a>Input

The input type of the event bridge is of type `AwsEventBridgeEvent<T>`, and the following methods are exposed

```typescript
declare const data: AwsEventBridgeEvent<any>;

data.getData(); // => T
data.getSource(); // Returns the event source field
data.getDetailType(); // Returns the event detail-type field
data.getRawData(); // Returns the raw underlying EventBridgeEvent<string, T> object
```

#### <a name='Output-1'></a>Output

The event bridge lambda is not expect to return anything, but you may return if you so wishes. The value will be discarded.

In the following cases will Sentry and Opentelemetry pick up errors:

- When the schema doesn't validate the data
- When an unhandled exception is thrown from the lambda

## <a name='Anoteonerrorhandlingincontrollers'></a>A note on error handling in controllers

Error handling is an important part of the Lambda handler logic. Here is a list of good practices

- **Let the handler fail in case of unexpected errors**: We'll catch it for you and reply with an error 500 (for the API gateway at least). Same for SQS, we'll handle notifying the entry-point handler that the message processing has failed. We'll also notify Sentry and fail the span in Opentelemetry. Finally, we'll log appropriate messages.
- **When returning error, use the class HTTPError:** It allows us to implement some extra logic when the request fails. Also, it allows you to not respect to type `T` in `Request<T>`.
- **For errors that should be recorded, return an error like this: `return HTTPError.BAD_REQUEST( error ).anormal()`:** Any error set as "anormal" will trigger a Sentry error, register the exception in Opentelemetry and fail the tracing span.
- **`HTTPResponse.INTERNAL_ERROR` is always `anormal` and will always register**: You do not need to call `.anormal()`
