import {
  EventBridgeCtrlInterface,
  EventBridgeHandlerWrapperFactory,
  IfHandler,
  SecretsOf,
} from '../src/lambda';
import { PayloadOf } from '../src/util/types';

// API Route definition file
const handlerWrapperFactory = new EventBridgeHandlerWrapperFactory().setHandler(
  'handle'
);

type controllerInterface = EventBridgeCtrlInterface<
  typeof handlerWrapperFactory
>;

class MyController implements controllerInterface {
  static async init() {
    return new MyController();
  }

  handle: IfHandler<controllerInterface> = async (payload, secrets) => {
    const data = payload.getData();
  };
}

const handlerWrapper = handlerWrapperFactory.makeHandlerFactory();
export const { handler, configuration } = handlerWrapper(MyController);
