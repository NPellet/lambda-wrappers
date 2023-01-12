import { BaseSchema, InferType } from 'yup';
import {
  HandlerConfiguration,
  ConfigGeneral,
  SourceConfigSNS,
  TInit,
} from '../config';
import { ConstructorOf, MessageType, TOrSchema } from '../../util/types';
import {
  SecretConfig,
  SecretsContentOf,
  TAllSecretRefs,
  TSecretRef,
} from '../utils/secrets_manager';
import { createSNSHandler } from './sns';
import { AwsSNSRecord } from '../../util/records/sns/record';
import { BaseWrapperFactory } from '../BaseWrapperFactory';
import { Handler, SNSEvent, SNSHandler } from 'aws-lambda';

export class SNSHandlerWrapperFactory<
  TInput,
  TSecretList extends TAllSecretRefs,
  TSecrets extends string = string,
  THandler extends string = 'handle',
  SInput extends BaseSchema | undefined = undefined,
  TInit = undefined
> extends BaseWrapperFactory<TSecretList> {
  public _inputSchema: SInput;
  protected _messageType: MessageType = MessageType.String;

  setInputSchema<U extends BaseSchema>(schema: U) {
    const api = this.fork<TInput, TSecrets, THandler, U, TInit>();
    api._inputSchema = schema;
    api.setMessageTypeFromSchema(schema);

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
      string extends TSecrets ? U : TSecrets | U,
      THandler,
      SInput,
      TInit
    >();

    api._needsSecret(source, key, secretName, secretKey, meta, required);
    api._inputSchema = this._inputSchema;
    return api;
  }

  setHandler<T extends string>(handler: T) {
    const api = this.fork<TInput, TSecrets, T, SInput, TInit>();
    api._inputSchema = this._inputSchema;
    api._handler = handler;
    return api;
  }

  private copyAll(
    newObj: SNSHandlerWrapperFactory<
      any,
      TSecretList,
      TSecrets,
      THandler,
      SInput,
      TInit
    >
  ) {
    newObj._inputSchema = this._inputSchema;
  }

  setTsInputType<U>() {
    const api = this.fork<U, TSecrets, THandler, SInput, TInit>();
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

  configureRuntime(cfg: SourceConfigSNS, general: ConfigGeneral) {
    super._configureRuntime({
      _general: general,
      sns: cfg,
    });
    return this;
  }

  fork<
    TInput,
    TSecrets extends string,
    THandler extends string,
    SInput extends BaseSchema | undefined = undefined,
    TInit = undefined
  >(): SNSHandlerWrapperFactory<
    TInput,
    TSecretList,
    TSecrets,
    THandler,
    SInput,
    TInit
  > {
    const n = new SNSHandlerWrapperFactory<
      TInput,
      TSecretList,
      TSecrets,
      THandler,
      SInput,
      TInit
    >(this.mgr);

    super.fork(n);
    return n;
  }

  initFunction<U>(func: (secrets: Record<TSecrets, string>) => Promise<U>) {
    const factory = this.fork<TInput, TSecrets, THandler, SInput, U>();
    factory.setInitFunction(func);
    return factory;
  }

  private buildConfiguration() {
    const configuration: HandlerConfiguration<TInit, SInput, any, TSecrets> =
      this.expandConfiguration({
        opentelemetry: true,
        sentry: true,
        yupSchemaInput: this._inputSchema,
        secretInjection: this._secrets,
        messageType: this._messageType,
      });

    return configuration;
  }

  /**
   * Returns a handler and a configuration based on a controller implementation
   * @param controllerFactory The controller
   * @returns An object containing `{ handler, configuration }` where the `handler` is the function to be exposed to AWS and `configuration` holds all the meta information
   */
  createHandler(
    controllerFactory: ConstructorOf<
      TSNSCtrlInterface<THandler, TInput, SInput, TSecrets>
    >
  ) {
    type INPUT = TOrSchema<TInput, SInput>;
    type TInterface = TSNSCtrlInterface<THandler, TInput, SInput, TSecrets>;

    const newWrapper = this.initFunction((secrets) => {
      return controllerFactory.init(secrets);
    });
    const configuration = newWrapper.buildConfiguration();

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

  wrapFunc(
    func: (
      payload: AwsSNSRecord<
        // subst for TOrSchema
        unknown extends TInput
          ? SInput extends BaseSchema
            ? InferType<SInput>
            : unknown
          : TInput
      >,
      init: TInit,
      secrets?: Record<TSecrets, string | undefined>
    ) => Promise<void>
  ) {
    const configuration = this.buildConfiguration();

    const handler = createSNSHandler<
      TOrSchema<TInput, SInput>,
      TInit,
      TSecrets,
      SInput
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

export type SNSCtrlInterface<T> = T extends SNSHandlerWrapperFactory<
  infer TInput,
  any,
  infer TSecrets,
  infer THandler,
  infer SInput,
  any
>
  ? {
      [x in THandler]: (
        payload: AwsSNSRecord<TOrSchema<TInput, SInput>>,
        secrets?: Record<TSecrets, string | undefined>
      ) => Promise<void>;
    }
  : never;

type TSNSCtrlInterface<
  THandler extends string,
  TInput,
  SInput,
  TSecrets extends string
> = {
  [x in THandler]: (
    payload: AwsSNSRecord<TOrSchema<TInput, SInput>>,
    secrets?: Record<TSecrets, string | undefined>
  ) => Promise<void>;
};
