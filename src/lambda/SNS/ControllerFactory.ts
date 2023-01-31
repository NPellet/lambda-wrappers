import {
  HandlerConfiguration,
  ConfigGeneral,
  SourceConfigSNS,
} from '../config';
import { AllParametersExceptFirst, ConstructorOf, MessageType, TValidationInitParams, TValidationsBase } from '../../util/types';
import {
  SecretsContentOf,
  TAllSecretRefs,
} from '../utils/secrets_manager';
import { createSNSHandler } from './sns';
import { AwsSNSRecord } from '../../util/records/sns/record';
import { BaseWrapperFactory } from '../BaseWrapperFactory';

export class SNSHandlerWrapperFactory<
  TInput,
  TSecretList extends TAllSecretRefs,
  TSecrets extends string = string,
  THandler extends string = 'handle',
  TInit = undefined,
  TValidations extends TValidationsBase = {}
> extends BaseWrapperFactory<TSecretList> {
  public _messageType: MessageType = MessageType.String;

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
    api._messageType = this._messageType;
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
    TInit = undefined,
    TValidations extends TValidationsBase = {}
  >() {
    const n = new SNSHandlerWrapperFactory<
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

  initFunction<U>(func: (secrets: Record<TSecrets, string>) => Promise<U>) {
    const factory = this.fork<TInput, TSecrets, THandler, U, TValidations>();
    factory._messageType = this._messageType;
    factory.setInitFunction(func);
    return factory;
  }

  public addValidations<U extends TValidationsBase>(validations: U) {
    const wrapper = this.fork<TInput, TSecrets, THandler, TInit, TValidations & U>();
    wrapper.validations = { ...this.validations, ...validations };
    return wrapper;
  }

  
   validateInput<U extends keyof TValidations>(methodName: U, ...args: TValidationInitParams<TValidations[U]["init"]>) {
    this._validateInput( methodName as string, ...args );
    return this;
  }


  private buildConfiguration() {
    const configuration: HandlerConfiguration<TInit, TSecrets> =
      this.expandConfiguration({
        opentelemetry: true,
        sentry: true,
        //yupSchemaInput: this._inputSchema,
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
      TSNSCtrlInterface<THandler, TInput, TSecrets>
    >
  ) {
    type TInterface = TSNSCtrlInterface<THandler, TInput, TSecrets>;

    const newWrapper = this.initFunction((secrets) => {
      return controllerFactory.init(secrets);
    });
    const configuration = newWrapper.buildConfiguration();

    const handler = createSNSHandler<TInput, TInterface, TSecrets>(
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
      payload: AwsSNSRecord<TInput>,
      init: TInit,
      secrets?: Record<TSecrets, string | undefined>
    ) => Promise<void>
  ) {
    const configuration = this.buildConfiguration();

    const handler = createSNSHandler<TInput, TInit, TSecrets>(async (event, init, secrets) => {
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
  any,
  any
>
  ? TSNSCtrlInterface<THandler, TInput, TSecrets>
  : never;

type TSNSCtrlInterface<
  THandler extends string,
  TInput,
  TSecrets extends string
> = {
    [x in THandler]: (
      payload: AwsSNSRecord<TInput>,
      secrets: Record<TSecrets, string | undefined>
    ) => Promise<void>;
  };
