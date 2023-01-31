import {
  HandlerConfiguration,
  ConfigGeneral,
  SourceConfigSQS,
} from '../config';
import { AllParametersExceptFirst, ConstructorOf, MessageType, TValidationInitParams, TValidationsBase } from '../../util/types';
import { SecretsContentOf, TAllSecretRefs } from '../utils/secrets_manager';
import { createSQSHandler } from './sqs';
import { SQSBatchItemFailure } from 'aws-lambda';
import { BaseWrapperFactory } from '../BaseWrapperFactory';
import { AwsSQSRecord } from '../../util/records/sqs/record';

export class SQSHandlerWrapperFactory<
  TInput,
  TSecretList extends TAllSecretRefs,
  TSecrets extends string = string,
  THandler extends string = 'handle',
  TInit = undefined,
  TValidations extends TValidationsBase = {}
> extends BaseWrapperFactory<TSecretList> {

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

  configureRuntime(cfg: SourceConfigSQS, general: ConfigGeneral) {
    super._configureRuntime({
      _general: general,
      sqs: cfg,
    });
    return this;
  }

  fork<
    TInput,
    TSecrets extends string = string,
    THandler extends string = 'handle',
    TInit = undefined,
    TValidations extends TValidationsBase = {}
  >() {
    const n = new SQSHandlerWrapperFactory<
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
        secretInjection: this._secrets,
        messageType: this._messageType,
      });

    return configuration;
  }

  createHandler(
    controllerFactory: ConstructorOf<
      TSQSCtrlInterface<THandler, TInput, TSecrets>
    >
  ) {

    type TInterface = {
      [x in THandler]: (
        payload: AwsSQSRecord<TInput>,
        secrets: Record<TSecrets, string>
      ) => Promise<void | SQSBatchItemFailure>;
    };

    const newWrapper = this.initFunction((secrets) => {
      return controllerFactory.init(secrets);
    });
    const configuration = newWrapper.buildConfiguration();

    const handler = createSQSHandler<TInput, TInterface, TSecrets>(
      async (event, init, secrets, c) => {
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
      payload: AwsSQSRecord<TInput>,
      init: TInit,
      secrets?: Record<TSecrets, string | undefined>
    ) => Promise<void | SQSBatchItemFailure>
  ) {
    const configuration = this.buildConfiguration();

    const handler = createSQSHandler<
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

export type SQSCtrlInterface<T> = T extends SQSHandlerWrapperFactory<
  infer TInput,
  any,
  infer TSecrets,
  infer THandler
>
  ? TSQSCtrlInterface<THandler, TInput, TSecrets>
  : never;

type TSQSCtrlInterface<
  THandler extends string,
  TInput,
  TSecrets extends string
> = {
    [x in THandler]: (
      payload: AwsSQSRecord<TInput>,
      secrets?: Record<TSecrets, string | undefined>
    ) => Promise<void | SQSBatchItemFailure>;
  };
