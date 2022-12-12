import {
  SQSCtrlInterface,
  SQSHandlerWrapperFactory,
  IfHandler,
} from '../src/lambda';

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
