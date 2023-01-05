import { BaseSchema } from 'yup';
import {
  HandlerConfiguration,
  SourceConfigEB,
  SourceConfigGeneral,
} from '../config';
import { ConstructorOf, MessageType, TOrSchema } from '../../util/types';
import {
  SecretConfig,
  SecretsContentOf,
  TAllSecretRefs,
  TSecretRef,
} from '../utils/secrets_manager';
import { createEventBridgeHandler } from './event';
import { AwsEventBridgeEvent } from '../../util/records/eventbridge/eventbridge';
import { BaseWrapperFactory } from '../BaseWrapperFactory';

export class EventBridgeHandlerWrapperFactory<
  TInput,
  TSecretList extends TAllSecretRefs,
  TSecrets extends string = string,
  THandler extends string = 'handle',
  SInput extends BaseSchema | undefined = undefined
> extends BaseWrapperFactory<TSecretList> {
  public _inputSchema: SInput;
  public __shimInput: TInput;

  setInputSchema<U extends BaseSchema>(schema: U) {
    const api = this.fork<TInput, TSecrets, THandler, U>();
    api._inputSchema = schema;
    api.setMessageTypeFromSchema(schema);

    return api;
  }

  configureRuntime(cfg: SourceConfigEB, general: SourceConfigGeneral) {
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
      SInput
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
      SInput
    >
  ) {
    newObj._inputSchema = this._inputSchema;
  }

  setTsInputType<U>() {
    const api = this.fork<U, TSecrets, THandler, SInput>();
    api._messageType = MessageType.Object;
    this.copyAll(api);
    return api;
  }

  setHandler<T extends string>(handler: T) {
    const api = this.fork<TInput, TSecrets, T, SInput>();
    api._inputSchema = this._inputSchema;
    api._handler = handler;
    return api;
  }

  createHandler(
    controllerFactory: ConstructorOf<EventBridgeCtrlInterface<typeof this>>
  ) {
    type INPUT = TOrSchema<TInput, SInput>;

    type TInterface = {
      [x in THandler]: (
        payload: AwsEventBridgeEvent<INPUT>,
        secrets: Record<TSecrets, string>
      ) => Promise<void>;
    };

    const configuration: HandlerConfiguration<
      TInterface,
      SInput,
      any,
      TSecrets
    > = this.expandConfiguration({
      opentelemetry: true,
      sentry: true,
      yupSchemaInput: this._inputSchema,
      secretInjection: this._secrets,
      initFunction: async (secrets) => {
        await this.init();
        return controllerFactory.init(secrets);
      },
      messageType: this._messageType,
    });

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

  fork<
    TInput,
    TSecrets extends string,
    THandler extends string,
    SInput extends BaseSchema | undefined = undefined
  >() {
    const n = new EventBridgeHandlerWrapperFactory<
      TInput,
      TSecretList,
      TSecrets,
      THandler,
      SInput
    >(this.mgr);

    super.fork(n);
    return n;
  }
}

export type EventBridgeCtrlInterface<T> =
  T extends EventBridgeHandlerWrapperFactory<
    infer TInput,
    any,
    infer TSecrets,
    infer THandler,
    infer SInput
  >
    ? {
        [x in THandler]: (
          payload: AwsEventBridgeEvent<TOrSchema<TInput, SInput>>,
          secrets: Record<TSecrets, string>
        ) => Promise<void>;
      }
    : never;
