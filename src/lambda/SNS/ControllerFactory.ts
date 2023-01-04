import { BaseSchema, InferType } from 'yup';
import { HandlerConfiguration, SourceConfigGeneral, SourceConfigSNS } from '../config';
import { ConstructorOf, MessageType, TOrSchema } from '../../util/types';
import { SecretConfig, SecretsContentOf, TAllSecretRefs, TSecretRef } from '../utils/secrets_manager';
import { createSNSHandler } from './sns';
import { AwsSNSRecord } from '../../util/records/sns/record';
import { BaseWrapperFactory } from '../BaseWrapperFactory';

export class SNSHandlerWrapperFactory<
  TInput,
  TSecretList extends TAllSecretRefs,
  TSecrets extends string = string,
  THandler extends string = 'handle',
  SInput extends BaseSchema | undefined = undefined
>  extends BaseWrapperFactory<TSecretList> {
  public _inputSchema: SInput;
  public _secrets: Record<TSecrets, SecretConfig<any>>;
  public __shimInput: TInput;
  public _handler: THandler;
  protected _messageType: MessageType = MessageType.String;

  setInputSchema<U extends BaseSchema>(schema: U) {
    const constructor = this.constructor;

    const api = this.fork<TInput, TSecrets,THandler, U>();
    api._inputSchema = schema;
    api._secrets = this._secrets;
    api._handler = this._handler;
    api.setMessageTypeFromSchema( schema );

    return api;
  }

  
  needsSecret<SRC extends keyof TSecretList & string, U extends string, T extends keyof TSecretList[SRC]["lst"]>(
    source: SRC,
    key: U,
    secretName: T,
    secretKey: SecretsContentOf<SRC, T, TSecretList> | undefined,
    meta: TSecretList[SRC]["src"],
    required: boolean = true,

  ) {
    const api = this.fork<
      TInput,
      string extends TSecrets ? U : TSecrets | U,
      THandler,
      SInput
    >();
    api._secrets = api._secrets || {};
    api._secrets[key] = {
      secret: secretName as string,
      source,
      meta,
      secretKey: secretKey as string | undefined,
      required
    };

    api._inputSchema = this._inputSchema;
    api._handler = this._handler;
    return api;
  }



  setHandler<T extends string>(handler: T) {
    const api = this.fork<TInput, TSecrets, T, SInput>();
    api._inputSchema = this._inputSchema;
    api._secrets = this._secrets;
    api._handler = handler;
    return api;
  }


  private copyAll (
    newObj: SNSHandlerWrapperFactory<any,TSecretList, TSecrets, THandler, SInput>
  ) {
    newObj._inputSchema = this._inputSchema;
    newObj._secrets = this._secrets;
    newObj._handler = this._handler;
  }

  setTsInputType<U>() {
    const api = this.fork<U, TSecrets, THandler, SInput>();
    api._messageType = MessageType.Object;

    this.copyAll( api );
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

  configureRuntime( cfg: SourceConfigSNS, general: SourceConfigGeneral ) {
    super._configureRuntime( {
      _general: general,
      sns: cfg 
    })
    return this;
  }


  createHandler(controllerFactory: ConstructorOf<
    SNSCtrlInterface<typeof this>
  >) {
    type INPUT = TOrSchema<TInput, SInput>;

    type TInterface = {
      [x in THandler]: (
        payload: AwsSNSRecord<
          unknown extends TInput
            ? SInput extends BaseSchema
              ? InferType<SInput>
              : unknown
            : TInput
        >,
        secrets?: Record<TSecrets, string | undefined>
      ) => Promise<void>;
    };

    const configuration: HandlerConfiguration<TInterface, SInput, any, TSecrets> =
    this.expandConfiguration({
        opentelemetry: true,
        sentry: true,
        yupSchemaInput: this._inputSchema,
        secretInjection: this._secrets,
        initFunction: async (secrets) => {
          await this.init();
          return controllerFactory.init(secrets);
        },
        messageType: this._messageType
      });

    const handler = createSNSHandler<INPUT, TInterface, TSecrets, SInput>(
      async (event, init, secrets) => {
        return init[this._handler](event, secrets);
      },
      configuration
    );

    return {
      handler,
      configuration,
    };

  }

  fork<
    TInput,   
    TSecrets extends string,
    THandler extends string,
    SInput extends BaseSchema | undefined = undefined
  >(): SNSHandlerWrapperFactory<TInput, TSecretList, TSecrets, THandler,  SInput> {
    const n = new SNSHandlerWrapperFactory<TInput, TSecretList, TSecrets, THandler, SInput>( this.mgr );
  
    super.fork(n);
    return n;
  }
}

export type SNSCtrlInterface<T> = T extends SNSHandlerWrapperFactory<
  infer TInput,
  any,
  infer TSecrets,
  infer THandler,
  infer SInput
>
  ? {
      [x in THandler]: (
        payload: AwsSNSRecord<TOrSchema<TInput, SInput>>,
        secrets?: Record<TSecrets, string | undefined>
      ) => Promise<void>;
    }
  : never;
