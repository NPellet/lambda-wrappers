import { BaseSchema, InferType } from 'yup';
import {
  HandlerConfiguration,
  ConfigGeneral,
  SourceConfigSQS,
} from '../config';
import { ConstructorOf, MessageType, TOrSchema } from '../../util/types';
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
    api._messageType = this._messageType;
    return api;
  }

  setHandler<T extends string>(handler: T) {
    const api = this.fork<TInput, TSecrets, T, SInput>();
    api._inputSchema = this._inputSchema;
    api._messageType = this._messageType;
    api._handler = handler;
    return api;
  }

  private copyAll(
    newObj: SQSHandlerWrapperFactory<
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
    this.copyAll(api);
    return api;
  }

  setNumberInputType() {
    const api = this.setTsInputType<number>();
    api._messageType = MessageType.Number;
    this.copyAll(api);
    return api;
  }

  setBinaryInputType() {
    const api = this.setTsInputType<Buffer>();
    api._messageType = MessageType.Binary;
    this.copyAll(api);
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
    SInput extends BaseSchema | undefined = undefined,
    TInit = undefined
  >() {
    const n = new SQSHandlerWrapperFactory<
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
    factory._inputSchema = this._inputSchema;
    factory._messageType = this._messageType;
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

  createHandler(
    controllerFactory: ConstructorOf<
      TSQSCtrlInterface<THandler, TInput, SInput, TSecrets>
    >
  ) {
    type INPUT = TOrSchema<TInput, SInput>;

    type TInterface = {
      [x in THandler]: (
        payload: AwsSQSRecord<
          unknown extends TInput
            ? SInput extends BaseSchema
              ? InferType<SInput>
              : unknown
            : TInput
        >,
        secrets: Record<TSecrets, string>
      ) => Promise<void | SQSBatchItemFailure>;
    };

    const newWrapper = this.initFunction((secrets) => {
      return controllerFactory.init(secrets);
    });
    const configuration = newWrapper.buildConfiguration();

    const handler = createSQSHandler<INPUT, TInterface, TSecrets, SInput>(
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
      payload: AwsSQSRecord<
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

    const handler = createSQSHandler<
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

export type SQSCtrlInterface<T> = T extends SQSHandlerWrapperFactory<
  infer TInput,
  any,
  infer TSecrets,
  infer THandler,
  infer SInput
>
  ? {
      [x in THandler]: (
        payload: AwsSQSRecord<TOrSchema<TInput, SInput>>,
        secrets: Record<TSecrets, string>
      ) => Promise<void | SQSBatchItemFailure>;
    }
  : never;

type TSQSCtrlInterface<
  THandler extends string,
  TInput,
  SInput,
  TSecrets extends string
> = {
  [x in THandler]: (
    payload: AwsSQSRecord<TOrSchema<TInput, SInput>>,
    secrets?: Record<TSecrets, string | undefined>
  ) => Promise<void | SQSBatchItemFailure>;
};
