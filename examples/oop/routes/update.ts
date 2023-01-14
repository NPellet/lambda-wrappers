import { APIGatewayCtrlInterface } from '../../../src/lambda';
import { CRUDController } from '../controllers/controller';
import { LambdaManager } from '../manager';

const factory = LambdaManager.apiGatewayWrapperFactory('update');
export type UpdateController = APIGatewayCtrlInterface<typeof factory>;
export const { handler, configuration } = factory.createHandler(CRUDController);
