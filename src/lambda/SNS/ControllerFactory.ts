import { BaseSchema, InferType } from 'yup';
import { HandlerConfiguration } from '../config';
import { ConstructorOf, TOrSchema } from '../../util/types';
import { aws_secrets } from '@lendis-tech/secrets-manager-utilities';
import { SecretsContentOf } from '@lendis-tech/secrets-manager-utilities/dist/secrets';
import { SecretConfig, getAwsSecretDef } from '../utils/secrets_manager';
import { createSNSHandler } from './sns';
import { SQSBatchItemFailure } from 'aws-lambda';
import { AwsSNSRecord } from '../../util/sns/record';

export class SNSHandlerWrapperFactory<
  TInput,
  THandler extends string,
  TSecrets extends string = string,
  SInput extends BaseSchema | undefined = undefined
> {
  public _inputSchema: SInput;
  public _secrets: Record<TSecrets, SecretConfig>;
  public __shimInput: TInput;
  public _handler: THandler;

  setInputSchema<U extends BaseSchema>(schema: U) {
    const constructor = this.constructor;

    const api = this.fork<TInput, THandler, TSecrets, U>();
    api._inputSchema = schema;
    api._secrets = this._secrets;

    return api;
  }

  needsSecret<U extends string, T extends keyof typeof aws_secrets>(
    key: U,
    secretName: T,
    secretKey: SecretsContentOf<T> | undefined,
    required: boolean = true
  ) {
    const api = this.fork<
      TInput,
      THandler,
      string extends TSecrets ? U : TSecrets | U,
      SInput
    >();
    api._secrets = api._secrets || {};
    api._secrets[key] = getAwsSecretDef(secretName, secretKey, required);
    api._inputSchema = this._inputSchema;
    api._handler = this._handler;

    return api;
  }

  setHandler<T extends string>(handler: T) {
    const api = this.fork<TInput, T, TSecrets, SInput>();
    api._inputSchema = this._inputSchema;
    api._secrets = this._secrets;
    api._handler = handler;
    return api;
  }

  setTsInputType<U>() {
    const api = this.fork<U, THandler, TSecrets, SInput>();
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
        (event, init, secrets, c) => {
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
    THandler extends string,
    TSecrets extends string = string,
    SInput extends BaseSchema | undefined = undefined
  >(): SNSHandlerWrapperFactory<TInput, THandler, TSecrets, SInput> {
    return new SNSHandlerWrapperFactory<TInput, THandler, TSecrets, SInput>();
  }
}

export type SNSCtrlInterface<T> = T extends SNSHandlerWrapperFactory<
  infer TInput,
  infer THandler,
  infer TSecrets,
  infer SInput
>
  ? {
      [x in THandler]: (
        payload: AwsSNSRecord<TOrSchema<TInput, SInput>>,
        secrets?: Record<TSecrets, string | undefined>
      ) => Promise<void | SQSBatchItemFailure>;
    }
  : never;
