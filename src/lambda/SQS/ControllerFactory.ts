import { BaseSchema, InferType } from 'yup';
import {
  HandlerConfiguration,
  SourceConfigGeneral,
  SourceConfigSQS,
} from '../config';
import { ConstructorOf, MessageType, TOrSchema } from '../../util/types';
import {
  SecretConfig,
  SecretsContentOf,
  TAllSecretRefs,
  TSecretRef,
} from '../utils/secrets_manager';
import { createSQSHandler } from './sqs';
import { SQSBatchItemFailure } from 'aws-lambda';
import { BaseWrapperFactory } from '../BaseWrapperFactory';
import { AwsSQSRecord } from '../../util/records/sqs/record';

export class SQSHandlerWrapperFactory<
  TInput,
  TSecretList extends TAllSecretRefs,
  TSecrets extends string = string,
  THandler extends string = 'handle',
  SInput extends BaseSchema | undefined = undefined
> extends BaseWrapperFactory<TSecretList> {
  public _inputSchema: SInput;
  public __shimInput: TInput;
  protected _messageType: MessageType = MessageType.String;

  setInputSchema<U extends BaseSchema>(schema: U) {
    const constructor = this.constructor;
    const api = this.fork<TInput, TSecrets, THandler, U>();
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
      SInput
    >();

    api._needsSecret(source, key, secretName, secretKey, meta, required);
    api._inputSchema = this._inputSchema;
    //api._handler = this._handler;
    return api;
  }

  setHandler<T extends string>(handler: T) {
    const api = this.fork<TInput, TSecrets, T, SInput>();
    api._inputSchema = this._inputSchema;
    //api._secrets = this._secrets;
    api._handler = handler;
    return api;
  }

  private copyAll(
    newObj: SQSHandlerWrapperFactory<
      any,
      TSecretList,
      TSecrets,
      THandler,
      SInput
    >
  ) {
    newObj._inputSchema = this._inputSchema;
    //newObj._secrets = this._secrets;
    //newObj._handler = this._handler;
  }

  setTsInputType<U>() {
    const api = this.fork<U, TSecrets, THandler, SInput>();
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

  configureRuntime(cfg: SourceConfigSQS, general: SourceConfigGeneral) {
    super._configureRuntime({
      _general: general,
      sqs: cfg,
    });
    return this;
  }

  createHandler(
    controllerFactory: ConstructorOf<SQSCtrlInterface<typeof this>>
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

  fork<
    TInput,
    TSecrets extends string = string,
    THandler extends string = 'handle',
    SInput extends BaseSchema | undefined = undefined
  >() {
    const n = new SQSHandlerWrapperFactory<
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
