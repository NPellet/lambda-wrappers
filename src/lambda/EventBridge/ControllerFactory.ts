import { BaseSchema } from 'yup';
import { HandlerConfiguration } from '../config';
import { ConstructorOf, MessageType, TOrSchema } from '../../util/types';
import { SecretConfig, SecretsContentOf, TSecretRef } from '../utils/secrets_manager';
import { createEventBridgeHandler } from './event';
import { AwsEventBridgeEvent } from '../../util/eventbridge';
import { BaseWrapperFactory } from '../BaseWrapperFactory';

export class EventBridgeHandlerWrapperFactory<
  TInput,
  TSecretList extends TSecretRef,
  TSecrets extends string = string,
  THandler extends string = 'handle',
  SInput extends BaseSchema | undefined = undefined
> extends BaseWrapperFactory<TSecretList> {
  public _inputSchema: SInput;
  public _handler: THandler;
  public _secrets: Record<TSecrets, SecretConfig>;
  public __shimInput: TInput;

  setInputSchema<U extends BaseSchema>(schema: U) {
    const constructor = this.constructor;

    const api = this.fork<TInput, TSecrets, THandler, U>();
    api._inputSchema = schema;
    api._secrets = this._secrets;
    api._handler = this._handler;
    api.setMessageTypeFromSchema(schema);

    return api;
  }

  needsSecret<U extends string, T extends keyof TSecretList>(
    key: U,
    secretName: T,
    secretKey: SecretsContentOf<T, TSecretList> | undefined,
    required: boolean = true
  ) {
    const api = this.fork<
      TInput,
      string extends TSecrets ? U : TSecrets | U,

      THandler,
      SInput
    >();
    api._secrets = api._secrets || {};
    api._secrets[key] = {
      "secret": secretName as string,
      "secretKey": secretKey as string | undefined,
      required
    };

    api._inputSchema = this._inputSchema;
    api._handler = this._handler;
    return api;
  }


  private copyAll(
    newObj: EventBridgeHandlerWrapperFactory<any, TSecretList, TSecrets, THandler, SInput>
  ) {
    newObj._inputSchema = this._inputSchema;
    newObj._secrets = this._secrets;
    newObj._handler = this._handler;
  }

  setTsInputType<U>() {
    const api = this.fork<U, TSecrets, THandler, SInput>();
    api._messageType = MessageType.Object;
    this.copyAll(api);
    return api;
  }
  /*
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
  */


  setHandler<T extends string>(handler: T) {
    const api = this.fork<TInput, TSecrets, T, SInput>();
    api._inputSchema = this._inputSchema;
    api._secrets = this._secrets;
    api._handler = handler;
    return api;
  }

  createHandler(controllerFactory: ConstructorOf<
    EventBridgeCtrlInterface<typeof this>
  >) {
    type INPUT = TOrSchema<TInput, SInput>;

    type TInterface = {
      [x in THandler]: (
        payload: AwsEventBridgeEvent<INPUT>,
        secrets: Record<TSecrets, string>
      ) => Promise<void>;
    };

    const configuration: HandlerConfiguration<TInterface, SInput, TSecrets> =
    {
      opentelemetry: true,
      sentry: true,
      yupSchemaInput: this._inputSchema,
      secretInjection: this._secrets,
      initFunction: async (secrets) => {
        await this.init();
        return controllerFactory.init(secrets);
      },
      messageType: this._messageType
    };

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
