# AWS Lambda Handlers

This is a collection of wrapper functions that you should use to wrap your handlers, whether you are implementing an API Gateway hander or an Event Bridge handler.
Other handlers will be supported in the future

## Usage

### TL;DR

The handler definition file may look something like:

```typescript
// Ran only once on a cold start. Use this method to cache data, initiate DB connection, etc...
const init = async () => {
  return {
    resourceKey: "value",
  };
};

const configuration = {
  yupSchema: yup.object({
    name: yup.string().required(),
  }),
  secretInjection: {
    // The secret Algolia-Products with key lwaAdminApiKey will be injected into process.env.key
    // It will only happen at cold start of after a two hour cache expiracy
    secretKeyInProcessEnv: {
      secret: getAwsSecretDef("Algolia-Products", "lwaAdminApiKey"),
      required: false,
    },
  },
  initFunction: init,
  useSentry: true,
  useOpentelemetry: true,
};

export const handler = createEventBridgeHandler(async (request, init) => {
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
}, configuration);

export { configuration }; // Can be picked up by other tools, for example for OpenAPI or for CDK
```

### API Gateway

The wrapper function to call is:

```typescript
createApiGatewayHandler(handler, initFunction, configuration);
```

The handler's first argument is an instance of `AwsApiGatewayRequest<T>` and exposes `public async getData(): Promise<T>` to fetch the data with optional validation

### Event bridge

The wrapper function to call is:

```typescript
createEventBridgeHandler(handler, initFunction, configuration);
```

The handler's first argument is an instance of `AwsEventBridgeEvent<T>` and exposes `public async getData(): Promise<T>` to fetch the data with optional validation.

## Without yup validation

You can opt out of the yup schema validation by skipping the configuration entry. In this case, by default the underlying type (for the API Gateway `body` and for the Event Bridge `detail`) becomes any. You can still force the type using

```typescript
createEventBridgeHandler<T, INIT>;
```

Where `T` is the underlying type and `INIT` is the result of the init function (without the wrapping `Promise<>`). Unfortunately, the `INIT` parameter is required until such time that partial type inference is supported in Typescript (should be happening in a couple of months). You may resort to using ` Awaited<ReturnType<typeof initFunction>>` to extract the return type of the init function
