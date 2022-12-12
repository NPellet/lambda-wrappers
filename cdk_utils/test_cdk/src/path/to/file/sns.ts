import {
  SNSCtrlInterface,
  SNSHandlerControllerFactory,
  SNSRecordOf,
} from '@lendis-tech/lambda-handlers';

// API Route definition file
const controllerFactory = new SNSHandlerControllerFactory()
  .setTsInputType<{ a: number }>()
  .setHandler('handle');

const handlerFactory = controllerFactory.makeHandlerFactory();

class Controller implements SNSCtrlInterface<typeof controllerFactory> {
  constructor() {}

  static async init() {
    return new Controller();
  }

  async handle(data: SNSRecordOf<typeof controllerFactory>) {
    console.log(data.getData().a);
    return;
  }
}

export const { handler, configuration } = handlerFactory(Controller);
