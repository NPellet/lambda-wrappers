import { BaseSchema } from 'yup';
import { HandlerConfiguration } from '../config';
import { HTTPError, Response } from '../../util/apigateway/response';
import { Request } from '../../util/apigateway/request';
import { ConstructorOf, TOrSchema } from '../../util/types';
import { createApiGatewayHandler } from './api';
import { aws_secrets } from '@lendis-tech/secrets-manager-utilities';
import { SecretsContentOf } from '@lendis-tech/secrets-manager-utilities/dist/secrets';
import { SecretConfig, getAwsSecretDef } from '../utils/secrets_manager';

/**
 * Notes
 * 08.12.2022: As much as I would like to defined a base class implementing the logic, it doesn't work. Here's the reasoning:
 * - Using base class:
 *  - The base class cannot know the result of the ready() function.
 *  - The base class abstract ready() function must therefore
 *  - It cannot implement a fork() function that refers to the derived class
 *  - The consumer will get `any` as a type when calling ready()
 * - Using the derived class:
 *  - The setOutputSchema and alike methods must return an instance of the derived class.
 *  - But they are calling .fork() internally, which, even if overloaded, will need to return an instance of the base class (because of no higher kinded types !)
 *  - Therefore, after calling .setOutputSchema(), we get a reference of the base class and not of the derived class. We could implement an overloaded .setOutputSchema() that types cast the result, but then we have lost all benefits of using inheritance
 *
 * ==> No inheritance possible
 */

export class APIGatewayHandlerWrapperFactory<
  TInput,
  TOutput,
  THandler extends string = 'handle',
  TSecrets extends string = string,
  SInput extends BaseSchema | undefined = undefined,
  SOutput extends BaseSchema | undefined = undefined
> {
  public _outputSchema: SOutput;
  public _secrets: Record<TSecrets, SecretConfig>;
  public _handler: THandler;
  public _inputSchema: SInput;
  public __shimInput: TInput;
  public __shimOutput: TOutput;

  setInputSchema<U extends BaseSchema>(schema: U) {
    const constructor = this.constructor;

    const api = this.fork<TInput, TOutput, THandler, TSecrets, U, SOutput>();
    api._inputSchema = schema;
    api._outputSchema = this._outputSchema;
    api._secrets = this._secrets;
    api._handler = this._handler;
    return api;
  }

  setOutputSchema<U extends BaseSchema>(schema: U) {
    const api = this.fork<TInput, TOutput, THandler, TSecrets, SInput, U>();
    api._outputSchema = schema;
    api._inputSchema = this._inputSchema;
    api._secrets = this._secrets;
    api._handler = this._handler;
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
      TOutput,
      THandler,
      string extends TSecrets ? U : TSecrets | U,
      SInput,
      SOutput
    >();
    api._secrets = api._secrets || {};
    api._secrets[key] = getAwsSecretDef(secretName, secretKey, required);
    api._inputSchema = this._inputSchema;
    api._outputSchema = this._outputSchema;
    api._handler = this._handler;
    return api;
  }

  setTsInputType<U>() {
    const api = this.fork<U, TOutput, THandler, TSecrets, SInput, SOutput>();
    api._inputSchema = this._inputSchema;
    api._outputSchema = this._outputSchema;
    api._secrets = this._secrets;
    api._handler = this._handler;
    return api;
  }

  setTsOutputType<U>() {
    const api = this.fork<TInput, U, THandler, TSecrets, SInput, SOutput>();
    api._inputSchema = this._inputSchema;
    api._outputSchema = this._outputSchema;
    api._secrets = this._secrets;
    api._handler = this._handler;
    return api;
  }

  setHandler<T extends string>(handler: T) {
    const api = this.fork<TInput, TOutput, T, TSecrets, SInput, SOutput>();
    api._inputSchema = this._inputSchema;
    api._outputSchema = this._outputSchema;
    api._secrets = this._secrets;
    api._handler = handler;
    return api;
  }

  makeHandlerFactory() {
    type INPUT = TOrSchema<TInput, SInput>;
    type OUTPUT = TOrSchema<TOutput, SOutput>;

    type TInterface = {
      [x in THandler]: (
        payload: Request<INPUT>,
        secrets: Record<TSecrets, string>
      ) => Promise<Response<OUTPUT> | HTTPError>;
    };

    const handlerFactory = (controllerFactory: ConstructorOf<TInterface>) => {
      const configuration: HandlerConfiguration<
        TInterface,
        SInput,
        SOutput,
        TSecrets
      > = {
        opentelemetry: true,
        sentry: true,
        yupSchemaInput: this._inputSchema,
        yupSchemaOutput: this._outputSchema,
        secretInjection: this._secrets,
        initFunction: async (secrets) => {
          return controllerFactory.init(secrets);
        },
      };

      const handler = createApiGatewayHandler<
        INPUT,
        OUTPUT,
        TInterface,
        TSecrets,
        SInput,
        SOutput
      >((event, init, secrets, c) => {
        return init[this._handler](event, secrets);
      }, configuration);

      return {
        handler,
        configuration,
      };
    };

    return handlerFactory;
  }

  fork<
    TInput,
    TOutput,
    TSecrets extends string = string,
    THandler extends string = 'handle',
    SInput extends BaseSchema | undefined = undefined,
    SOutput extends BaseSchema | undefined = undefined
  >(): APIGatewayHandlerWrapperFactory<
    TInput,
    TOutput,
    TSecrets,
    THandler,
    SInput,
    SOutput
  > {
    return new APIGatewayHandlerWrapperFactory<
      TInput,
      TOutput,
      TSecrets,
      THandler,
      SInput,
      SOutput
    >();
  }
}

export type APIGatewayCtrlInterface<T> =
  T extends APIGatewayHandlerWrapperFactory<
    infer TInput,
    infer TOutput,
    infer THandler,
    infer TSecrets,
    infer SInput,
    infer SOutput
  >
    ? {
        [x in THandler]: (
          payload: Request<TOrSchema<TInput, SInput>>,
          secrets: Record<TSecrets, string>
        ) => Promise<Response<TOrSchema<TOutput, SOutput>> | HTTPError>;
      }
    : never;
