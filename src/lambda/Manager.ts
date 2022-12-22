import { APIGatewayHandlerWrapperFactory } from "./ApiGateway/ControllerFactory";
import { EventBridgeHandlerWrapperFactory } from "./EventBridge/ControllerFactory";
import { SNSHandlerWrapperFactory } from "./SNS/ControllerFactory";
import { SQSHandlerWrapperFactory } from "./SQS/ControllerFactory";
import { TSecretRef } from "./utils/secrets_manager";
import { NodeOptions } from '@sentry/node';

export class LambdaFactoryManager<T extends TSecretRef> {
	sentryCfg: NodeOptions = {};

	constructor() {}

	public async init() {
	}

	public setSecrets<U extends TSecretRef> ( secrets: U ) {
		const newMgr = new LambdaFactoryManager<U>();
		newMgr.sentryCfg = this.sentryCfg;
		return newMgr;
	}

	public configureSentry( sentryOptions: NodeOptions, expand: boolean = true ) {
		if( expand ) {
			Object.assign( this.sentryCfg, sentryOptions );
		} else {
			this.sentryCfg = sentryOptions;
		}

		return this;
	}

	/**
	 * Sets Sentry's DSN. Shorthand for calling `configureSentry` with a DSN entry
	 * @param dsn 
	 */
	public configureSentryDSN( dsn: string ) {
		this.configureSentry( { dsn }, true );
	}

	/**
	 * Disable Sentry for the wrappers created by this manager
	 */
	public disableSentry( ) {
		this.configureSentry( { enabled: false }, true );
	}

	public apiGatewayWrapperFactory<U extends string>( handler: U ) {
		const wrapper = new APIGatewayHandlerWrapperFactory<any, any, T, string, U, undefined, undefined>( this );
		return wrapper.setHandler( handler );
	}

	public eventBridgeWrapperFactory<U extends string>( handler: U ) {
		const wrapper = new EventBridgeHandlerWrapperFactory<any, T, string, U, undefined>( this );
		return wrapper.setHandler( handler );
	}

	public sqsWrapperFactory<U extends string>( handler: U ) {
		const wrapper = new SQSHandlerWrapperFactory<any, T, string, U, undefined>( this );
		return wrapper.setHandler( handler );
	}

	public snsWrapperFactory<U extends string>( handler: U ) {
		const wrapper = new SNSHandlerWrapperFactory<any, T, string, U, undefined>( this );
		return wrapper.setHandler( handler );
	}
}

