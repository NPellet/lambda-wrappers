import { IfHandler, Response } from '../src/lambda';
import {
  APIGatewayHandlerWrapperFactory,
  APIGatewayCtrlInterface,
} from '../src/lambda/ApiGateway/ControllerFactory';
import { LambdaContext, testApiGatewayEvent } from '../src/test_utils/utils';

// API Route definition file
const handlerWrapperFactory = new APIGatewayHandlerWrapperFactory().setHandler(
  'handle'
);

export type controllerInterface = APIGatewayCtrlInterface<
  typeof handlerWrapperFactory
>;

class MyController implements controllerInterface {
  static async init() {
    return new MyController();
  }

  handle: IfHandler<controllerInterface> = async (payload, secrets) => {
    const data = payload.getData();
    return Response.OK('Hello from handler');
  };
}

const handlerWrapper = handlerWrapperFactory.makeHandlerFactory();
export const { handler, configuration } = handlerWrapper(MyController);

// Testing the handler
const main = async () => {
  console.log(await handler(testApiGatewayEvent, LambdaContext, () => {}));
};

main();
