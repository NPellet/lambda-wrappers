import { IfHandler, Response } from '../src/lambda';
import {
  APIGatewayHandlerWrapperFactory,
  APIGatewayCtrlInterface,
} from '../src/lambda/ApiGateway/ControllerFactory';
import yup from 'yup';

// API Route definition file
const handlerWrapperFactory = new APIGatewayHandlerWrapperFactory()
  .setHandler('handle')
  .setTsInputType<{
    t: string;
    u: number;
    v: {
      a: string;
      b: number;
    };
  }>()
  .setOutputSchema(
    yup.object({
      a: yup.number(),
    })
  )
  .needsSecret('myKey', 'cloudinary', 'cloudinaryApiKey');

export type controllerInterface = APIGatewayCtrlInterface<
  typeof handlerWrapperFactory
>;

class MyController implements controllerInterface {
  static async init() {
    return new MyController();
  }

  handle: IfHandler<controllerInterface> = async (payload, secrets) => {
    const data = payload.getData();

    return Response.OK({
      a: 1,
    });
  };
}

const handlerWrapper = handlerWrapperFactory.makeHandlerFactory();
export const { handler, configuration } = handlerWrapper(MyController);
