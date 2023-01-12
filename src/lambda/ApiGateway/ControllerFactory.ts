import { BaseSchema, InferType } from 'yup';
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
import { ConstructorOf, MessageType, TOrSchema } from '../../util/types';
import { createApiGatewayHandler } from './api';
import {
  SecretConfig,
  SecretsContentOf,
  TAllSecretRefs,
  TSecretRef,
} from '../utils/secrets_manager';
import { BaseWrapperFactory } from '../BaseWrapperFactory';

export class APIGatewayHandlerWrapperFactory<
  TInput,
  TOutput,
  TSecretList extends TAllSecretRefs,
  TSecrets extends string = string,
  THandler extends string = 'handle',
  SInput extends BaseSchema | undefined = undefined,
  SOutput extends BaseSchema | undefined = undefined,
  TInit = undefined
> extends BaseWrapperFactory<TSecretList> {
  public _outputSchema: SOutput;
  public _secrets: Record<TSecrets, SecretConfig<any>>;
  protected _messageType: MessageType = MessageType.String;
  //public _handler: THandler;
  public _inputSchema: SInput;
  public: TInput;
  public __shimOutput: TOutput;

  setInputSchema<U extends BaseSchema>(schema: U) {
    const api = this.fork<
      TInput,
      TOutput,
      TSecrets,
      THandler,
      U,
      SOutput,
      TInit
    >();
    api._inputSchema = schema;
    api._outputSchema = this._outputSchema;
    api.setMessageTypeFromSchema(schema);

    return api;
  }

  setOutputSchema<U extends BaseSchema>(schema: U) {
    const api = this.fork<
      TInput,
      TOutput,
      TSecrets,
      THandler,
      SInput,
      U,
      TInit
    >();
    api._outputSchema = schema;
    api._inputSchema = this._inputSchema;
    return api;
  }

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
      SInput,
      SOutput,
      TInit
    >();
    api._needsSecret(source, key, secretName, secretKey, meta, required);
    api._inputSchema = this._inputSchema;
    api._outputSchema = this._outputSchema;
    return api;
  }

  setTsInputType<U>() {
    const api = this.fork<
      U,
      TOutput,
      TSecrets,
      THandler,
      SInput,
      SOutput,
      TInit
    >();
    api._messageType = MessageType.Object;
    this.copyAll(api);
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

  private copyAll(
    newObj: APIGatewayHandlerWrapperFactory<
      any,
      any,
      TSecretList,
      TSecrets,
      THandler,
      SInput,
      SOutput,
      TInit
    >
  ) {
    newObj._inputSchema = this._inputSchema;
    newObj._outputSchema = this._outputSchema;
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
      SInput,
      SOutput,
      TInit
    >();
    this.copyAll(api);
    return api;
  }

  setHandler<T extends string>(handler: T) {
    const api = this.fork<
      TInput,
      TOutput,
      TSecrets,
      T,
      SInput,
      SOutput,
      TInit
    >();
    api._inputSchema = this._inputSchema;
    api._outputSchema = this._outputSchema;
    api._handler = handler;

    return api;
  }

  initFunction<U>(func: (secrets: Record<TSecrets, string>) => Promise<U>) {
    const factory = this.fork<
      TInput,
      TOutput,
      TSecrets,
      THandler,
      SInput,
      SOutput,
      U
    >();
    factory._inputSchema = this._inputSchema;
    factory.setInitFunction(func);
    return factory;
  }

  private buildConfiguration() {
    const configuration: HandlerConfiguration<
      TInit,
      SInput,
      SOutput,
      TSecrets
    > = this.expandConfiguration({
      opentelemetry: true,
      sentry: true,
      yupSchemaInput: this._inputSchema,
      yupSchemaOutput: this._outputSchema,
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
    SInput extends BaseSchema | undefined = undefined,
    SOutput extends BaseSchema | undefined = undefined,
    TInit = undefined
  >() {
    const n = new APIGatewayHandlerWrapperFactory<
      TInput,
      TOutput,
      TSecretList,
      TSecrets,
      THandler,
      SInput,
      SOutput,
      TInit
    >(this.mgr);

    super.fork(n);
    //n._messageType = MessageType.String; // Default message type in absence of input

    return n;
  }

  createHandler(
    controllerFactory: ConstructorOf<
      TAPIGatewayInterface<THandler, TInput, TOutput, SInput, SOutput, TSecrets>
    >
  ) {
    const newWrapper = this.initFunction((secrets) => {
      return controllerFactory.init(secrets);
    });
    const configuration = newWrapper.buildConfiguration();

    const handler = createApiGatewayHandler<
      TOrSchema<TInput, SInput>,
      TOrSchema<TOutput, SOutput>,
      {
        [x in THandler]: (
          payload: Request<TOrSchema<TInput, SInput>>,
          secrets: Record<TSecrets, string>
        ) => Promise<HTTPResponse<TOrSchema<TOutput, SOutput>> | HTTPError>;
      },
      TSecrets,
      SInput,
      SOutput
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
        unknown extends TInput
          ? SInput extends BaseSchema
            ? InferType<SInput>
            : unknown
          : TInput
      >,
      init: TInit,
      secrets: Record<TSecrets, string | undefined>
    ) => Promise<HTTPResponse<TOrSchema<TOutput, SOutput>> | HTTPError>
  ) {
    const configuration = this.buildConfiguration();

    const handler = createApiGatewayHandler<
      TOrSchema<TInput, SInput>,
      TOrSchema<TOutput, SOutput>,
      TInit,
      TSecrets,
      SInput,
      SOutput
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
    infer SInput,
    infer SOutput,
    any
  >
    ? TAPIGatewayInterface<THandler, TInput, TOutput, SInput, SOutput, TSecrets>
    : never;

type TAPIGatewayInterface<
  THandler extends string,
  TInput,
  TOutput,
  SInput,
  SOutput,
  TSecrets extends string
> = {
  [x in THandler]: (
    payload: Request<TOrSchema<TInput, SInput>>,
    secrets: Record<TSecrets, string | undefined>
  ) => Promise<HTTPResponse<TOrSchema<TOutput, SOutput>> | HTTPError>;
};
