import {
  SQSCtrlInterface,
  SQSHandlerControllerFactory,
  SQSRecordOf,
} from '@lendis-tech/lambda-handlers';

// API Route definition file
const controllerFactory = new SQSHandlerControllerFactory()
  .setTsInputType<{ a: number }>()
  .setHandler('handle');

const handlerFactory = controllerFactory.makeHandlerFactory();

class Controller implements SQSCtrlInterface<typeof controllerFactory> {
  constructor() {}

  static async init() {
    return new Controller();
  }

  async handle(data: SQSRecordOf<typeof controllerFactory>) {
    console.log(data.getData().a);
    return;
  }
}

export const { handler, configuration } = handlerFactory(Controller);
