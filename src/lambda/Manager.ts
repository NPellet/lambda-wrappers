import { APIGatewayHandlerWrapperFactory } from "./ApiGateway/ControllerFactory";
import { EventBridgeHandlerWrapperFactory } from "./EventBridge/ControllerFactory";
import { SNSHandlerWrapperFactory } from "./SNS/ControllerFactory";
import { SQSHandlerWrapperFactory } from "./SQS/ControllerFactory";
import { TSecretRef } from "./utils/secrets_manager";

export class LambdaFactoryManager<T extends TSecretRef> {

	constructor() {}

	public setSecrets<U extends TSecretRef> ( secrets: U ) {
		const newMgr = new LambdaFactoryManager<U>();

		return newMgr;
	}

	public apiGatewayWrapperFactory<U extends string>( handler: U ) {
		const wrapper = new APIGatewayHandlerWrapperFactory<any, any, T, string, U, undefined, undefined>();
		return wrapper.setHandler( handler );
	}

	public eventBridgeWrapperFactory<U extends string>( handler: U ) {
		const wrapper = new EventBridgeHandlerWrapperFactory<any, T, string, U, undefined>();
		return wrapper.setHandler( handler );
	}

	public sqsWrapperFactory<U extends string>( handler: U ) {
		const wrapper = new SQSHandlerWrapperFactory<any, T, string, U, undefined>();
		return wrapper.setHandler( handler );
	}

	public snsWrapperFactory<U extends string>( handler: U ) {
		const wrapper = new SNSHandlerWrapperFactory<any, T, string, U, undefined>();
		return wrapper.setHandler( handler );
	}
}

