import {
  APIGatewayCtrlInterface,
  APIHandlerControllerFactory,
  RequestOf,
  Response,
} from '@lendis-tech/lambda-handlers';
import { SQS } from '@aws-sdk/client-sqs';
import { SNS } from '@aws-sdk/client-sns';
// API Route definition file
const controllerFactory = new APIHandlerControllerFactory().setHandler(
  'handle'
);

const handlerFactory = controllerFactory.makeHandlerFactory();

class Controller implements APIGatewayCtrlInterface<typeof controllerFactory> {
  sqs: SQS;
  sns: SNS;
  constructor() {
    this.sqs = new SQS({
      region: 'eu-central-1',
    });
    this.sns = new SNS({
      region: 'eu-central-1',
    });
  }

  static async init() {
    return new Controller();
  }

  async handle(data: RequestOf<typeof controllerFactory>) {
    await this.sqs.sendMessage({
      MessageBody: '[SQS] Hello from Route A',
      QueueUrl: process.env.SQS_QUEUE_URL,
    });

    await this.sns.publish({
      Message: '[SNS] Hello from Route A',
      TopicArn: process.env.SNS_TOPIC_ARN,
    });

    return Response.OK_NO_CONTENT();
  }
}

export const { handler, configuration } = handlerFactory(Controller);
