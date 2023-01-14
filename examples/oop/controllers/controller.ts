import { HTTPResponse, IfHandler } from '../../../src/lambda';
import { CreateController } from '../routes/create';
import { DeleteController } from '../routes/delete';
import { ReadController } from '../routes/read';
import { UpdateController } from '../routes/update';

export class CRUDController
  implements
    ReadController,
    UpdateController,
    DeleteController,
    CreateController
{
  static async init() {
    return new CRUDController();
  }

  create: IfHandler<CreateController> = async (payload, secrets) => {
    // Application logic goes here
    return HTTPResponse.OK_NO_CONTENT();
  };

  read: IfHandler<ReadController> = async (payload, secrets) => {
    // Application logic goes here
    return HTTPResponse.OK_NO_CONTENT();
  };

  update: IfHandler<UpdateController> = async (payload, secrets) => {
    // Application logic goes here
    return HTTPResponse.OK_NO_CONTENT();
  };

  delete: IfHandler<DeleteController> = async (payload, secrets) => {
    // Application logic goes here
    return HTTPResponse.OK_NO_CONTENT();
  };
}
