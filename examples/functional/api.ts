import {
  HTTPError,
  HTTPResponse,
  LambdaFactoryManager,
} from '../../src/lambda';
import { DynamoDB } from '@aws-sdk/client-dynamodb';

// Define an input type
type Animal = {
  name: string;
  weight: string;
  id: string;
};

export const { handler, configuration } = new LambdaFactoryManager()
  .apiGatewayWrapperFactory('handler')
  .setTsInputType<Animal>()
  .setTsOutputType<{ processed: boolean }>()
  .initFunction(async () => {
    const dbClient = new DynamoDB({});
    return { dbClient };
  })
  .wrapFunc(async (payload, init, secrets) => {
    const animal = payload.getData(); // Note the strong typing on "Animal"

    if (animal.name.length == 0) {
      // Example to fail the request
      return HTTPError.BAD_REQUEST('Animal name must be defined');
    }

    await init.dbClient.batchWriteItem({
      RequestItems: {
        MyTable: [
          {
            PutRequest: {
              Item: {
                PK: { S: animal.id },
                name: { S: animal.name },
                weight: {
                  N: animal.weight,
                },
              },
            },
          },
        ],
      },
    });

    return HTTPResponse.OK({ processed: true });
  });
