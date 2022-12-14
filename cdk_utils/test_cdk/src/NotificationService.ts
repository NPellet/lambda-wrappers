import { IfHandler } from '@lendis-tech/lambda-handlers';
import {
  SNSHandlerWrapperFactory,
  SNSCtrlInterface,
} from '../../../src/lambda';
import { NotificationMessage } from './Interfaces';

// API Route definition file
const controllerFactory = new SNSHandlerWrapperFactory()
  .setTsInputType<NotificationMessage>()
  .setHandler('notify');

const handlerFactory = controllerFactory.makeHandlerFactory();
type Interface = SNSCtrlInterface<typeof controllerFactory>;

class Controller implements Interface {
  constructor() {}

  static async init() {
    return new Controller();
  }

  notify: IfHandler<Interface> = async (data) => {
    console.log(data.getData().AnimalName);
  };
}

export const { handler, configuration } = handlerFactory(Controller);
