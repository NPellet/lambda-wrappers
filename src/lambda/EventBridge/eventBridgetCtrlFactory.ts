import { BaseSchema } from 'yup';
import { HandlerConfiguration } from '../config';
import { ConstructorOf, TOrSchema } from '../../util/types';
import { aws_secrets } from '@lendis-tech/secrets-manager-utilities';
import { SecretsContentOf } from '@lendis-tech/secrets-manager-utilities/dist/secrets';
import { SecretConfig, getAwsSecretDef } from '../utils/secrets_manager';
import { EventBridgeEvent } from 'aws-lambda';
import { createEventBridgeHandler } from './event';
import { AwsEventBridgeEvent } from '../../util/eventbridge';

export class EventBridgeHandlerControllerFactory<
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
        payload: AwsEventBridgeEvent<INPUT>,
        secrets?: Record<TSecrets, string | undefined>,
        originalEvent?: EventBridgeEvent<string, INPUT>
      ): Promise<void>;
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

      const handler = createEventBridgeHandler<
        INPUT,
        BaseController,
        TSecrets,
        SInput
      >((event, init, secrets, c) => {
        return init.handle(event, secrets);
      }, configuration);

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
  >(): EventBridgeHandlerControllerFactory<TInput, TSecrets, SInput> {
    return new EventBridgeHandlerControllerFactory<TInput, TSecrets, SInput>();
  }
}
