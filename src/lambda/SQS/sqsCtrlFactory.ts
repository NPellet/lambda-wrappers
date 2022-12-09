import { BaseSchema, InferType } from 'yup';
import { HandlerConfiguration } from '../config';
import { ConstructorOf, TOrSchema } from '../../util/types';
import { aws_secrets } from '@lendis-tech/secrets-manager-utilities';
import { SecretsContentOf } from '@lendis-tech/secrets-manager-utilities/dist/secrets';
import { SecretConfig, getAwsSecretDef } from '../utils/secrets_manager';
import { createSQSHandler } from './sqs';
import { AwsSQSRecord } from '../../util/sqs/record';
import { SQSBatchItemFailure, SQSHandler } from 'aws-lambda';

export class SQSHandlerControllerFactory<
  TInput,
  TSecrets extends string = string,
  SInput extends BaseSchema | undefined = undefined
> {
  protected _inputSchema: SInput;
  protected _secrets: Record<TSecrets, SecretConfig>;
  setInputSchema<U extends BaseSchema>(schema: U) {
    const constructor = this.constructor;

    const api = this.fork<TInput, TSecrets, U>();
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
      string extends TSecrets ? U : TSecrets | U,
      SInput
    >();
    api._secrets = api._secrets || {};
    api._secrets[key] = getAwsSecretDef(secretName, secretKey, required);
    api._inputSchema = this._inputSchema;

    return api;
  }

  setTsInputType<U>() {
    const api = this.fork<U, TSecrets, SInput>();
    api._inputSchema = this._inputSchema;
    api._secrets = this._secrets;
    return api;
  }

  ready() {
    type INPUT = TOrSchema<TInput, SInput>;
    abstract class BaseController {
      abstract handle(
        payload: AwsSQSRecord<
          unknown extends TInput
            ? SInput extends BaseSchema
              ? InferType<SInput>
              : unknown
            : TInput
        >, // Normally this should be AwsSQSRecord<INPUT>, but getting a typescript bug: https://github.com/microsoft/TypeScript/issues/33133
        secrets?: Record<TSecrets, string | undefined>
      ): Promise<void | SQSBatchItemFailure>;
    }

    const handlerFactory = (
      controllerFactory: ConstructorOf<BaseController>
    ) => {
      const configuration: HandlerConfiguration<
        BaseController,
        SInput,
        TSecrets
      > = {
        opentelemetry: true,
        sentry: true,
        yupSchemaInput: this._inputSchema,
        secretInjection: this._secrets,
        initFunction: async (secrets) => {
          return controllerFactory.init(secrets);
        },
      };

      const handler = createSQSHandler<INPUT, BaseController, TSecrets, SInput>(
        (event, init, secrets, c) => {
          return init.handle(event, secrets);
        },
        configuration
      );

      return {
        handler,
        configuration,
      };
    };

    return { handlerFactory, BaseController };
  }

  fork<
    TInput,
    TSecrets extends string = string,
    SInput extends BaseSchema | undefined = undefined
  >(): SQSHandlerControllerFactory<TInput, TSecrets, SInput> {
    return new SQSHandlerControllerFactory<TInput, TSecrets, SInput>();
  }
}
