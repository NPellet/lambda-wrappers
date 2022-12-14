import { IfHandler } from '@lendis-tech/lambda-handlers';
import api, { ValueType } from '@opentelemetry/api';
import {
  SQSHandlerWrapperFactory,
  SQSCtrlInterface,
} from '../../../src/lambda';
import { SNS } from '@aws-sdk/client-sns';
import { failSQSRecord } from '../../../src/util/sqs/record';

import {
  FoodPurchaseQuery,
  FoodPurchaseResponse,
  NotificationMessage,
  ShelterMessage,
} from './Interfaces';
import fetch from 'node-fetch';
// API Route definition file
const controllerFactory = new SQSHandlerWrapperFactory()
  .setTsInputType<ShelterMessage>()
  .setHandler('receive');

const handlerFactory = controllerFactory.makeHandlerFactory();
type Interface = SQSCtrlInterface<typeof controllerFactory>;

// const foodQuantityHistogram = api.metrics
//   .getMeterProvider()
//   .getMeter('app')
//   .createHistogram('io.lendis.hist_0_100.shelter.ordered_food_quantity', {
//     description: 'Quantity of food ordered by the shelter service',
//     unit: 'kg',
//     valueType: ValueType.DOUBLE,
//   });

// const foodPriceHistogram = api.metrics
//   .getMeterProvider()
//   .getMeter('app')
//   .createHistogram('io.lendis.hist_0_1000.shelter.ordered_food_price', {
//     description: 'Price of food ordered by the shelter service',
//     unit: '€',
//     valueType: ValueType.DOUBLE,
//   });

class Controller implements Interface {
  constructor(private sns = new SNS({})) {}

  static async init() {
    return new Controller();
  }

  receive: IfHandler<Interface> = async (data) => {
    const { Animal, Action } = data.getData();

    if (Animal.type == 'Yeti') {
      // Who wants to adopt a yeti ??
      throw new Error("We don't accept yetis !");
    }

    if (Animal.type == 'Cat') {
      // Cats are the devil incarnate. No place in the shelter for them
      return failSQSRecord(data);
    }

    if (Action == 'Died') {
      return;
    }

    const foodPurchase: FoodPurchaseQuery = {
      quantity_kg: Animal.weight * 0.4,
      // type: Animal.picky_eater ? 'premium' : 'standard',
      type:
        Animal.name == 'Aurinko'
          ? 'superpremium'
          : Animal.picky_eater
          ? 'premium'
          : 'standard',
    };

    // foodQuantityHistogram.record(foodPurchase.quantity_kg);

    // We only want dogs
    const price = await fetch(process.env.FOOD_SERVICE_URL + '/buyFood', {
      method: 'POST',
      body: JSON.stringify(foodPurchase),
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then((r) => {
        if (r.status >= 400) {
          throw new Error("Couldn't buy food !");
        }

        return r;
      })
      .then<FoodPurchaseResponse>((r) => r.json());

    // foodPriceHistogram.record(price.price);
    // api.trace
    //   .getActiveSpan()
    //   ?.addEvent('Food ordered for ' + Animal.name + ' !', {
    //     'io.lendis.food.quantity': foodPurchase.quantity_kg + 'kg',
    //     'io.lendis.food.price': price.price + ' €',
    //   });

    // Notification service
    const notification: NotificationMessage = {
      AnimalName: Animal.name,
    };

    await this.sns.publish({
      TopicArn: process.env.NOTIFICATION_TOPIC,
      Message: JSON.stringify(notification),
    });
  };
}

export const { handler, configuration } = handlerFactory(Controller);
