import { HandlerConfiguration, SourceConfigEB, ConfigGeneral } from '../config';
import { AllParametersExceptFirst, ConstructorOf, MessageType, TOrSchema, TValidationsBase } from '../../util/types';
import { SecretsContentOf, TAllSecretRefs } from '../utils/secrets_manager';
import { createEventBridgeHandler } from './event';
import { AwsEventBridgeEvent } from '../../util/records/eventbridge/eventbridge';
import { BaseWrapperFactory } from '../BaseWrapperFactory';

export class EventBridgeHandlerWrapperFactory<
  TInput,
  TSecretList extends TAllSecretRefs,
  TSecrets extends string = string,
  THandler extends string = 'handle',
  TInit = undefined,
  TValidations extends TValidationsBase = {}
> extends BaseWrapperFactory<TSecretList> {


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
      TInit,
      TValidations
    >();

    api._needsSecret(source, key, secretName, secretKey, meta, required);
    return api;
  }
  

  setHandler<T extends string>(handler: T) {
    const api = this.fork<TInput, TSecrets, T, TInit, TValidations>();
    api._handler = handler;
    return api;
  }

  setTsInputType<U>() {
    const api = this.fork<U, TSecrets, THandler, TInit, TValidations>();
    api._messageType = MessageType.Object;
    return api;
  }


  private buildConfiguration() {
    const configuration: HandlerConfiguration<TInit, TSecrets> =
      this.expandConfiguration({
        opentelemetry: true,
        sentry: true,
        secretInjection: this._secrets,
        messageType: this._messageType,
      });

    return configuration;
  }

  initFunction<U>(func: (secrets: Record<TSecrets, string>) => Promise<U>) {
    const factory = this.fork<TInput, TSecrets, THandler, U, TValidations>();
    factory.setInitFunction(func);
    return factory;
  }


  public addValidations<U extends Record<string, (...args: any[]) => Promise<void>>>(validations: U) {
    const wrapper = this.fork<TInput, TSecrets, THandler, TInit, TValidations & U>();
    wrapper.validations = { ...this.validations, ...validations };
    return wrapper;
  }

  validateInput<U extends keyof TValidations>(methodName: U, ...args: AllParametersExceptFirst<TValidations[U]>) {
    const self = this;
    const validation = async function (data: any, rawData: any) {
      await self.validations[methodName as string].apply(self, [data, rawData, ...args]);
    }
    this._validateInputFn.push(validation);
  }

  fork<
    TInput,
    TSecrets extends string,
    THandler extends string,
    TInit = undefined,
    TValidations extends TValidationsBase = {}
  >() {
    const n = new EventBridgeHandlerWrapperFactory<
      TInput,
      TSecretList,
      TSecrets,
      THandler,
      TInit,
      TValidations
    >(this.mgr);

    super.fork(n);
    return n;
  }

  createHandler(
    controllerFactory: ConstructorOf<
      TEBCtrlInterface<THandler, TInput, TSecrets>
    >
  ) {

    type TInterface = {
      [x in THandler]: (
        payload: AwsEventBridgeEvent<TInput>,
        secrets: Record<TSecrets, string>
      ) => Promise<void>;
    };

    const newWrapper = this.initFunction((secrets) => {
      return controllerFactory.init(secrets);
    });
    const configuration = newWrapper.buildConfiguration();

    const handler = createEventBridgeHandler<
      TInput,
      TInterface,
      TSecrets
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
      payload: AwsEventBridgeEvent<TInput>,
      init: TInit,
      secrets?: Record<TSecrets, string | undefined>
    ) => Promise<void>
  ) {
    const configuration = this.buildConfiguration();

    const handler = createEventBridgeHandler<
      TInput,
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

export type EventBridgeCtrlInterface<T> =
  T extends EventBridgeHandlerWrapperFactory<
    infer TInput,
    any,
    infer TSecrets,
    infer THandler
  >
  ? TEBCtrlInterface<THandler, TInput, TSecrets>
  : never;

type TEBCtrlInterface<
  THandler extends string,
  TInput,
  TSecrets extends string
> = {
    [x in THandler]: (
      payload: AwsEventBridgeEvent<TInput>,
      secrets?: Record<TSecrets, string | undefined>
    ) => Promise<void>;
  };
