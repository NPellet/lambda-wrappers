import { HTTPError, IfHandler, Response } from '../src/lambda';
import {
  APIGatewayHandlerWrapperFactory,
  APIGatewayCtrlInterface,
} from '../src/lambda/ApiGateway/ControllerFactory';
import { LambdaContext, testApiGatewayEvent } from '../src/test_utils/utils';
import { DynamoDB } from '@aws-sdk/client-dynamodb';

type AnimalType = 'Dog' | 'Cat' | 'Yeti';
type Animal = {
  id: string;
  name: string;
  type: AnimalType;
};

// CREATE
const createFac = new APIGatewayHandlerWrapperFactory()
  .setHandler('create')
  .setTsInputType<Animal>();
type createIf = APIGatewayCtrlInterface<typeof createFac>;

const readFac = new APIGatewayHandlerWrapperFactory()
  .setHandler('read')
  .setTsOutputType<Animal>()
  .setTsInputType<number>();
type readIf = APIGatewayCtrlInterface<typeof readFac>;

const updateFac = new APIGatewayHandlerWrapperFactory()
  .setHandler('update')
  .setTsInputType<Animal>();
type updateIf = APIGatewayCtrlInterface<typeof updateFac>;

const deleteFac = new APIGatewayHandlerWrapperFactory()
  .setHandler('delete')
  .setTsInputType<string>();
type deleteIf = APIGatewayCtrlInterface<typeof deleteFac>;

const DBAnimalFromAnimal = (animal: Animal) => ({
  PK: { S: animal.id },
  Name: {
    S: animal.name,
  },
  type: {
    S: animal.type,
  },
});

class MyController implements createIf, readIf, updateIf, deleteIf {
  constructor(private dynamoDB: DynamoDB, private tableName = 'animals') {}

  static async init() {
    return new MyController(new DynamoDB({}));
  }

  create: IfHandler<createIf> = async (payload, secrets) => {
    const animal = payload.getData();

    this.dynamoDB.putItem({
      Item: DBAnimalFromAnimal(animal),
      TableName: this.tableName,
    });

    return Response.OK('Created !');
  };

  read: IfHandler<readIf> = async (payload, secrets) => {
    const data = payload.getData();
    const animal = await this.dynamoDB.getItem({
      Key: {
        PK: { S: String(data) },
      },
      TableName: this.tableName,
    });

    if (animal.Item) {
      return Response.OK({
        id: animal.Item.PK.S!,
        name: animal.Item.name.S!,
        type: animal.Item.type.S as AnimalType,
      });
    } else {
      return HTTPError.NOT_FOUND('Animal not found');
    }
  };

  update: IfHandler<updateIf> = async (payload, secrets) => {
    const animal = payload.getData();
    this.dynamoDB.putItem({
      Item: DBAnimalFromAnimal(animal),
      TableName: this.tableName,
    });

    return Response.OK('Updated !');
  };

  delete: IfHandler<deleteIf> = async (payload, secrets) => {
    const data = payload.getData();

    this.dynamoDB.deleteItem({
      Key: { PK: { S: data } },
      TableName: this.tableName,
    });
    return Response.OK_NO_CONTENT();
  };
}

export const { handler: createHandler } =
  createFac.makeHandlerFactory()(MyController);
export const { handler: updateHandler } =
  updateFac.makeHandlerFactory()(MyController);
export const { handler: deleteHandler } =
  deleteFac.makeHandlerFactory()(MyController);
export const { handler: readHandler } =
  readFac.makeHandlerFactory()(MyController);
