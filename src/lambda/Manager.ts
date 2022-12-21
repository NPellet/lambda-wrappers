import { APIGatewayHandlerWrapperFactory } from "./ApiGateway/ControllerFactory";
import { TSecretRef } from "./utils/secrets_manager";

export class LambdaFactoryManager<T extends TSecretRef> {

	constructor() {}

	public setSecrets<U extends TSecretRef> ( secrets: U ) {
		const newMgr = new LambdaFactoryManager<U>();

		return newMgr;
	}

	public apiGatewayWrapperFactory<U extends string>( handler: U ) {
		const wrapper =  new APIGatewayHandlerWrapperFactory<any, any, T, string, U, undefined, undefined>();
		return wrapper.setHandler( handler );
	}
}

