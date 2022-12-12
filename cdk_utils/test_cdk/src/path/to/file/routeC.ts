import {
  APIGatewayCtrlInterface,
  APIHandlerControllerFactory,
  RequestOf,
  Response,
} from '@lendis-tech/lambda-handlers';
import fetch from 'node-fetch';
// API Route definition file
const controllerFactory = new APIHandlerControllerFactory().setHandler(
  'handle'
);

const handlerFactory = controllerFactory.makeHandlerFactory();

class Controller implements APIGatewayCtrlInterface<typeof controllerFactory> {
  constructor() {}

  static async init() {
    return new Controller();
  }

  async handle(data: RequestOf<typeof controllerFactory>) {
    console.log('Handling :)');
    await fetch(process.env.API_URL + 'routeA', {
      method: 'GET',
    })
      .then((r) => {
        console.log('Route A: ' + r.status);
      })
      .catch((e) => {
        console.log(e);
      });

    await fetch(process.env.API_URL + 'routeB', {
      method: 'GET',
    })
      .then((r) => {
        console.log('Route B: ' + r.status);
      })
      .catch((e) => {
        console.log(e);
      });
    console.log('Done !');
    return Response.OK_NO_CONTENT();
  }
}

export const { handler, configuration } = handlerFactory(Controller);
