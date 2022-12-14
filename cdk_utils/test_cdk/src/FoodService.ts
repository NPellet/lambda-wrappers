import {
  APIGatewayCtrlInterface,
  APIGatewayHandlerWrapperFactory,
  HTTPError,
  IfHandler,
  Response,
} from '@lendis-tech/lambda-handlers';
import { SQS } from '@aws-sdk/client-sqs';
import api from '@opentelemetry/api';
import { Animal, FoodPurchaseQuery, FoodPurchaseResponse } from './Interfaces';

// API Route definition file
const controllerFactory = new APIGatewayHandlerWrapperFactory()
  .setTsInputType<FoodPurchaseQuery>()
  .setTsOutputType<FoodPurchaseResponse>()
  .setHandler('buyFood');

const handlerFactory = controllerFactory.makeHandlerFactory();

type Interface = APIGatewayCtrlInterface<typeof controllerFactory>;

class Controller implements Interface {
  constructor() {}

  static async init() {
    return new Controller();
  }

  getPriceForFood(type: FoodPurchaseQuery['type']) {
    if (type == 'premium') {
      return 36;
    } else {
      return 20;
    }
  }

  buyFood: IfHandler<Interface> = async (data) => {
    const food = data.getData();

    if (data.getData().type == 'superpremium') {
      return HTTPError.BAD_REQUEST("We don't sell that kind of food")
        .possibleUpstreamError(
          'Not supposed to receive a request for superpremium food'
        )
        .defiesLawsOfPhysics("I really don't understand what's going on !");
    }

    let price: number = food.quantity_kg * this.getPriceForFood(food.type);

    return Response.OK({
      price: price,
    });
  };
}

export const { handler, configuration } = handlerFactory(Controller);
