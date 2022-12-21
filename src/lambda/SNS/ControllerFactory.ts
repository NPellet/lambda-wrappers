import { BaseSchema, InferType } from 'yup';
import { HandlerConfiguration } from '../config';
import { ConstructorOf, TOrSchema } from '../../util/types';
import { SecretConfig, SecretsContentOf, TSecretRef } from '../utils/secrets_manager';
import { createSNSHandler } from './sns';
import { AwsSNSRecord } from '../../util/sns/record';

export class SNSHandlerWrapperFactory<
  TInput,
  TSecretList extends TSecretRef,
  TSecrets extends string = string,
  THandler extends string = 'handle',
  SInput extends BaseSchema | undefined = undefined
> {
  public _inputSchema: SInput;
  public _secrets: Record<TSecrets, SecretConfig>;
  public __shimInput: TInput;
  public _handler: THandler;

  setInputSchema<U extends BaseSchema>(schema: U) {
    const constructor = this.constructor;

    const api = this.fork<TInput, TSecrets,THandler, U>();
    api._inputSchema = schema;
    api._secrets = this._secrets;

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
      required };
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

  setTsInputType<U>() {
    const api = this.fork<U, TSecrets, THandler, SInput>();
    api._inputSchema = this._inputSchema;
    api._secrets = this._secrets;
    api._handler = this._handler;
    return api;
  }

  makeHandlerFactory() {
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

    const handlerFactory = (controllerFactory: ConstructorOf<TInterface>) => {
      const configuration: HandlerConfiguration<TInterface, SInput, TSecrets> =
        {
          opentelemetry: true,
          sentry: true,
          yupSchemaInput: this._inputSchema,
          secretInjection: this._secrets,
          initFunction: async (secrets) => {
            return controllerFactory.init(secrets);
          },
        };

      const handler = createSNSHandler<INPUT, TInterface, TSecrets, SInput>(
        (event, init, secrets) => {
          return init[this._handler](event, secrets);
        },
        configuration
      );

      return {
        handler,
        configuration,
      };
    };

    return handlerFactory;
  }

  fork<
    TInput,   
    TSecrets extends string,
    THandler extends string,
    SInput extends BaseSchema | undefined = undefined
  >(): SNSHandlerWrapperFactory<TInput, TSecretList, TSecrets, THandler,  SInput> {
    return new SNSHandlerWrapperFactory<TInput, TSecretList, TSecrets, THandler, SInput>();
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
