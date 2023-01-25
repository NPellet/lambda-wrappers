import {
  HandlerConfiguration,
  SourceConfigAPIGateway,
  ConfigGeneral,
} from '../config';
import {
  HTTPError,
  HTTPResponse,
} from '../../util/records/apigateway/response';
import { Request } from '../../util/records/apigateway/request';
import { ConstructorOf, MessageType } from '../../util/types';
import { createApiGatewayHandler } from './api';
import {
  SecretsContentOf,
  TAllSecretRefs,
} from '../utils/secrets_manager';
import { BaseWrapperFactory } from '../BaseWrapperFactory';

export type AllParametersExceptFirst<T> = T extends ( _: any, ...args: infer P) => any ? P : never;
export class APIGatewayHandlerWrapperFactory<
  TInput,
  TOutput,
  TSecretList extends TAllSecretRefs,
  TSecrets extends string = string,
  THandler extends string = 'handle',
  TInit = undefined,
  TValidations extends Record<string, (...args: any ) => Promise<void>> = {}
> extends BaseWrapperFactory<TSecretList> {
  
  protected _messageType: MessageType = MessageType.String;
  protected validations: TValidations;


  needsSecret<
    SRC extends keyof TSecretList & string,
    U extends string,
    T extends keyof TSecretList[SRC]['lst'] & string
  >(
    source: SRC,
    key: U,
    secretName: T,
    secretKey: (SecretsContentOf<SRC, T, TSecretList> & string) | undefined,
    meta: TSecretList[SRC]['src'],
    required: boolean = true
  ) {
    const api = this.fork<
      TInput,
      TOutput,
      string extends TSecrets ? U : TSecrets | U,
      THandler,
      TInit
    >();
    api._needsSecret(source, key, secretName, secretKey, meta, required);
    return api;
  }

  setTsInputType<U>() {
    const api = this.fork<
      U,
      TOutput,
      TSecrets,
      THandler,
      
      TInit
    >();
    api._messageType = MessageType.Object;
    api.validations = this.validations;
    return api;
  }

  setStringInputType() {
    const api = this.setTsInputType<string>();
    api._messageType = MessageType.String;
    return api;
  }

  setNumberInputType() {
    const api = this.setTsInputType<number>();
    api._messageType = MessageType.Number;
    return api;
  }

  setBinaryInputType() {
    const api = this.setTsInputType<Buffer>();
    api._messageType = MessageType.Binary;
    return api;
  }


  configureRuntime(cfg: SourceConfigAPIGateway, general: ConfigGeneral) {
    super._configureRuntime({
      _general: general,
      apiGateway: cfg,
    });
    return this;
  }

  setTsOutputType<U>() {
    const api = this.fork<
      TInput,
      U,
      TSecrets,
      THandler,
      TInit
    >();
    api.validations = this.validations;
    return api;
  }

  setHandler<T extends string>(handler: T) {
    const api = this.fork<
      TInput,
      TOutput,
      TSecrets,
      T,
      TInit
    >();
    api._handler = handler;
    api.validations = this.validations;
    return api;
  }

  initFunction<U>(func: (secrets: Record<TSecrets, string>) => Promise<U>) {
    const factory = this.fork<
      TInput,
      TOutput,
      TSecrets,
      THandler,
      
      U
    >();
    factory.setInitFunction(func);
    factory.validations = this.validations;
    return factory;
  }


  private buildConfiguration() {
    const configuration: HandlerConfiguration<
      TInit,
      TSecrets
    > = this.expandConfiguration({
      opentelemetry: true,
      sentry: true,
      //yupSchemaInput: this._inputSchema,
      //yupSchemaOutput: this._outputSchema,
      secretInjection: this._secrets,
      messageType: this._messageType,
    });

    return configuration;
  }

  fork<
    TInput,
    TOutput,
    TSecrets extends string = string,
    THandler extends string = 'handle',
    TInit = undefined
  >() {
    const n = new APIGatewayHandlerWrapperFactory<
      TInput,
      TOutput,
      TSecretList,
      TSecrets,
      THandler,
      
      TInit
    >(this.mgr);

    super.fork(n);
    //n._messageType = MessageType.String; // Default message type in absence of input

    return n;
  }


	public addValidations<U extends Record<string,  (...args: any[]) => Promise<void>>>( validations: U ) {
    const wrapper = this.fork<TInput, TOutput, TSecrets, THandler, TValidations & U>();
    wrapper.validations = {...this.validations, ...validations };
    return wrapper;
  }

  validateInput<U extends keyof TValidations>( methodName: U, ...args: AllParametersExceptFirst<TValidations[U]>) {

    const self = this;
    const validation = async function( data: any ) {
      await self.validations[ methodName].apply( self, [ data, ...args ] );
    }

    this.validateInputFn = validation;
  }

  validateOutput<U extends keyof TValidations>( methodName: U, ...args: AllParametersExceptFirst<TValidations[U]>) {

    const self = this;
    const validation = async function( data: any ) {
      await self.validations[ methodName].apply( self, [ data, ...args ] );
    }

    this.validateOutputFn = validation;
  }

  createHandler(
    controllerFactory: ConstructorOf<
      TAPIGatewayInterface<THandler, TInput, TOutput,  TSecrets>
    >
  ) {
    const newWrapper = this.initFunction((secrets) => {
      return controllerFactory.init(secrets);
    });
    const configuration = newWrapper.buildConfiguration();

    const handler = createApiGatewayHandler<
      TInput,
      TOutput,
      {
        [x in THandler]: (
          payload: Request<TInput>,
          secrets: Record<TSecrets, string>
        ) => Promise<HTTPResponse<TOutput> | HTTPError>;
      }, TSecrets
    >(async (event, init, secrets, c) => {
      return init[this._handler](event, secrets);
    }, configuration);

    return {
      handler,
      configuration,
    };
  }

  wrapFunc(
    func: (
      payload: Request<
        // subst for TOrSchema
         TInput
      >,
      init: TInit,
      secrets: Record<TSecrets, string | undefined>
    ) => Promise<HTTPResponse<TOutput> | HTTPError>
  ) {
    const configuration = this.buildConfiguration();

    const handler = createApiGatewayHandler<
      TInput,
      TOutput,
      TInit,
      TSecrets
      
    >(async (event, init, secrets) => {
      return func(event, init, secrets);
    }, configuration);

    return {
      [this._handler as THandler]: handler,
      configuration,
    } as {
      [x in THandler]: typeof handler;
    } & {
      configuration: typeof configuration;
    };
  }


}

export type APIGatewayCtrlInterface<T> =
  T extends APIGatewayHandlerWrapperFactory<
    infer TInput,
    infer TOutput,
    any,
    infer TSecrets,
    infer THandler,
    
    any
  >
    ? TAPIGatewayInterface<THandler, TInput, TOutput,  TSecrets>
    : never;

type TAPIGatewayInterface<
  THandler extends string,
  TInput,
  TOutput,
  TSecrets extends string
> = {
  [x in THandler]: (
    payload: Request<TInput>,
    secrets: Record<TSecrets, string | undefined>
  ) => Promise<HTTPResponse<TOutput> | HTTPError>;
};
