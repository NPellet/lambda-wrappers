import {
  SQSCtrlInterface,
  SQSHandlerWrapperFactory,
  SecretsOf,
  IfHandler,
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

  handle: IfHandler<controllerInterface> = async (request, secrets) => {
    const data = request.getData();
  };
}

const handlerWrapper = handlerWrapperFactory.makeHandlerFactory();
export const { handler, configuration } = handlerWrapper(MyController);
