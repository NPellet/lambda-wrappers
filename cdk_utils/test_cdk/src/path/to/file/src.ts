import { getAwsSecretDef } from "../../../../../../src/lambda/utils/secrets_manager";
import { createEventBridgeHandler } from "../../../../../../src/lambda";

const configuration = {
  secretInjection: {
    // The secret Algolia-Products with key lwaAdminApiKey will be injected into process.env.key
    // It will only happen at cold start of after a two hour cache expiracy
    secretKeyInProcessEnv: getAwsSecretDef(
      "Algolia-Products",
      "lwaAdminApiKey",
      false
    ),
  },
  useSentry: true,
  useOpentelemetry: true,
};

export const handler = createEventBridgeHandler(async (request, init) => {
  // Data if of instance AwsApiGatewayRequest<T>, where T is the typed schema
  // Init has the form of the result of the init method

  // This will validate the event data against the yup schema
  // The lambda will fail if the schema is not respected
  const data = await request.getData();
  console.log(data);
}, configuration);

export { configuration }; // Can be picked up by other tools, for example for OpenAPI or for CDK
