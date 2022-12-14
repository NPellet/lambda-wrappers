import {
  APIGatewayCtrlInterface,
  APIGatewayHandlerWrapperFactory,
  IfHandler,
  Response,
} from '@lendis-tech/lambda-handlers';
import { SQS } from '@aws-sdk/client-sqs';
import api from '@opentelemetry/api';
import { Animal, ShelterMessage } from './Interfaces';
import { DynamoDB } from '@aws-sdk/client-dynamodb';

// API Route definition file
const controllerFactory = new APIGatewayHandlerWrapperFactory()
  .setTsInputType<Array<Animal>>()
  .setTsOutputType<void>()
  .setHandler('createMany');

const handlerFactory = controllerFactory.makeHandlerFactory();

type Interface = APIGatewayCtrlInterface<typeof controllerFactory>;

class Controller implements Interface {
  constructor(
    private sqs = new SQS({}) //private table = new DynamoDB({}),
  ) //private tracer = api.trace.getTracer('AnimalService')
  {}

  static async init() {
    return new Controller();
  }

  createMany: IfHandler<Interface> = async (data) => {
    const animals = data.getData();
    /*const counter = api.metrics
      .getMeter('AnimalService')
      .createCounter('io.lendis.animalservice.animal_count');
*/
    for (let animal of animals) {
      //  await this.tracer.startActiveSpan(
      // 'CreateOneAnimalOfMany',
      // async (span) => {

      //  span.setAttribute('io.lendis.animal.name', animal.name);
      //  span.setAttribute('io.lendis.animal.type', animal.type);
      // Notify shelter service

      // await this.table.putItem({
      //   TableName: 'test_Animals',
      //   Item: {
      //     PK: { S: String(Date.now()) },
      //     name: { S: animal.name },
      //     weight: { N: String(animal.weight) },
      //     type: { S: animal.type },
      //     picky: { BOOL: animal.picky_eater },
      //   },
      // });

      const shelterMessage: ShelterMessage = {
        Action: 'Born',
        Animal: animal,
      };

      await this.sqs.sendMessage({
        MessageBody: JSON.stringify(shelterMessage),
        QueueUrl: process.env.SHELTER_SERVICE_QUEUE_URL,
      });

      //counter.add(1);

      //    span.end();
      //   }
      // );
    }

    return Response.OK_NO_CONTENT();
  };
}

export const { handler, configuration } = handlerFactory(Controller);
