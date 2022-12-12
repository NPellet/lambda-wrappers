import {
  SQSCtrlInterface,
  SQSHandlerWrapperFactory,
  SecretsOf,
} from '../src/lambda';
import { PayloadOf } from '../src/util/types';

// API Route definition file
const handlerWrapperFactory = new SQSHandlerWrapperFactory().setHandler(
  'handle'
);

type controllerInterface = SQSCtrlInterface<typeof handlerWrapperFactory>;

class MyController implements controllerInterface {
  static async init() {
    return new MyController();
  }

  async handle(
    request: PayloadOf<controllerInterface, 'handle'>,
    secrets: SecretsOf<controllerInterface, 'handle'>
  ) {
    const data = request.getData();
  }
}

const handlerWrapper = handlerWrapperFactory.makeHandlerFactory();
export const { handler, configuration } = handlerWrapper(MyController);
