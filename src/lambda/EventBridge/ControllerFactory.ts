import { BaseSchema, InferType } from 'yup';
import { HandlerConfiguration, SourceConfigEB, ConfigGeneral } from '../config';
import { ConstructorOf, MessageType, TOrSchema } from '../../util/types';
import { SecretsContentOf, TAllSecretRefs } from '../utils/secrets_manager';
import { createEventBridgeHandler } from './event';
import { AwsEventBridgeEvent } from '../../util/records/eventbridge/eventbridge';
import { BaseWrapperFactory } from '../BaseWrapperFactory';

export class EventBridgeHandlerWrapperFactory<
  TInput,
  TSecretList extends TAllSecretRefs,
  TSecrets extends string = string,
  THandler extends string = 'handle',
  SInput extends BaseSchema | undefined = undefined,
  TInit = undefined
> extends BaseWrapperFactory<TSecretList> {
  public _inputSchema: SInput;

  setInputSchema<U extends BaseSchema>(schema: U) {
    const api = this.fork<TInput, TSecrets, THandler, U, TInit>();
    api._inputSchema = schema;
    api.setMessageTypeFromSchema(schema);
    return api;
  }

  configureRuntime(cfg: SourceConfigEB, general: ConfigGeneral) {
    super._configureRuntime({
      _general: general,
      eventBridge: cfg,
    });
    return this;
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

  private copyAll(
    newObj: EventBridgeHandlerWrapperFactory<
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

  setHandler<T extends string>(handler: T) {
    const api = this.fork<TInput, TSecrets, T, SInput, TInit>();
    api._inputSchema = this._inputSchema;
    api._handler = handler;
    return api;
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

  initFunction<U>(func: (secrets: Record<TSecrets, string>) => Promise<U>) {
    const factory = this.fork<TInput, TSecrets, THandler, SInput, U>();
    factory._inputSchema = this._inputSchema;
    factory._messageType = this._messageType;
    factory.setInitFunction(func);
    return factory;
  }

  fork<
    TInput,
    TSecrets extends string,
    THandler extends string,
    SInput extends BaseSchema | undefined = undefined,
    TInit = undefined
  >() {
    const n = new EventBridgeHandlerWrapperFactory<
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

  createHandler(
    controllerFactory: ConstructorOf<
      TEBCtrlInterface<THandler, TInput, SInput, TSecrets>
    >
  ) {
    type INPUT = TOrSchema<TInput, SInput>;

    type TInterface = {
      [x in THandler]: (
        payload: AwsEventBridgeEvent<INPUT>,
        secrets: Record<TSecrets, string>
      ) => Promise<void>;
    };

    const newWrapper = this.initFunction((secrets) => {
      return controllerFactory.init(secrets);
    });
    const configuration = newWrapper.buildConfiguration();

    const handler = createEventBridgeHandler<
      INPUT,
      TInterface,
      TSecrets,
      SInput
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
      payload: AwsEventBridgeEvent<
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

    const handler = createEventBridgeHandler<
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

export type EventBridgeCtrlInterface<T> =
  T extends EventBridgeHandlerWrapperFactory<
    infer TInput,
    any,
    infer TSecrets,
    infer THandler,
    infer SInput,
    infer TInit
  >
    ? TEBCtrlInterface<THandler, TInput, SInput, TSecrets>
    : never;

type TEBCtrlInterface<
  THandler extends string,
  TInput,
  SInput,
  TSecrets extends string
> = {
  [x in THandler]: (
    payload: AwsEventBridgeEvent<TOrSchema<TInput, SInput>>,
    secrets?: Record<TSecrets, string | undefined>
  ) => Promise<void>;
};
