import { BaseSchema } from 'yup';
import { HandlerConfiguration } from '../config';
import { HTTPError, HTTPResponse } from '../../util/apigateway/response';
import { Request } from '../../util/apigateway/request';
import { ConstructorOf, TOrSchema } from '../../util/types';
import { createApiGatewayHandler } from './api';
import { SecretConfig, SecretsContentOf, TSecretRef} from '../utils/secrets_manager';
import { BaseWrapperFactory } from '../BaseWrapperFactory';

export class APIGatewayHandlerWrapperFactory<
  TInput,
  TOutput,
  TSecretList extends TSecretRef,
  TSecrets extends string = string,
  THandler extends string = 'handle',
  SInput extends BaseSchema | undefined = undefined,
  SOutput extends BaseSchema | undefined = undefined
> extends BaseWrapperFactory<TSecretList> {
  public _outputSchema: SOutput;
  public _secrets: Record<TSecrets, SecretConfig>;
  public _handler: THandler;
  public _inputSchema: SInput;
  public __shimInput: TInput;
  public __shimOutput: TOutput;


  setInputSchema<U extends BaseSchema>(schema: U) {
    const api = this.fork<TInput, TOutput, TSecrets, THandler, U, SOutput>();
    api._inputSchema = schema;
    api._outputSchema = this._outputSchema;
    api._secrets = this._secrets;
    api._handler = this._handler;
    return api;
  }

  setOutputSchema<U extends BaseSchema>(schema: U) {
    const api = this.fork<TInput, TOutput, TSecrets, THandler, SInput, U>();
    api._outputSchema = schema;
    api._inputSchema = this._inputSchema;
    api._secrets = this._secrets;
    api._handler = this._handler;
    return api;
  }

  needsSecret<U extends string, T extends  keyof TSecretList>(
    key: U,
    secretName: T,
    secretKey: SecretsContentOf<T, TSecretList> | undefined,
    required: boolean = true
  ) {
    const api = this.fork<
      TInput,
      TOutput,
      string extends TSecrets ? U : TSecrets | U,
      THandler,
      SInput,
      SOutput
    >();
    api._secrets = api._secrets || {};
    api._secrets[key] = {
      "secret": secretName as string,
      "secretKey": secretKey as string | undefined,
      required };
      
    api._inputSchema = this._inputSchema;
    api._outputSchema = this._outputSchema;
    api._handler = this._handler;
    return api;
  }

  setTsInputType<U>() {
    const api = this.fork<U, TOutput, TSecrets, THandler, SInput, SOutput>();
    api._inputSchema = this._inputSchema;
    api._outputSchema = this._outputSchema;
    api._secrets = this._secrets;
    api._handler = this._handler;
    return api;
  }

  setTsOutputType<U>() {
    const api = this.fork<TInput, U, TSecrets, THandler, SInput, SOutput>();
    api._inputSchema = this._inputSchema;
    api._outputSchema = this._outputSchema;
    api._secrets = this._secrets;
    api._handler = this._handler;
    return api;
  }

  setHandler<T extends string>(handler: T) {
    const api = this.fork<TInput, TOutput, TSecrets, T,  SInput, SOutput>();
    api._inputSchema = this._inputSchema;
    api._outputSchema = this._outputSchema;
    api._secrets = this._secrets;
    api._handler = handler;
    return api;
  }

  createHandler( controllerFactory: ConstructorOf<
    APIGatewayCtrlInterface<typeof this>
> ) {
      type IF = {
        [x in THandler]: (
          payload: Request<TOrSchema<TInput, SInput>>,
          secrets: Record<TSecrets, string>
        ) => Promise<HTTPResponse<TOrSchema<TOutput, SOutput>> | HTTPError>;
      };

      const configuration: HandlerConfiguration<
       IF,
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
        TOrSchema<TInput, SInput>,
        TOrSchema<TOutput, SOutput>,
        {
          [x in THandler]: (
            payload: Request<TOrSchema<TInput, SInput>>,
            secrets: Record<TSecrets, string>
          ) => Promise<HTTPResponse<TOrSchema<TOutput, SOutput>> | HTTPError>;
        },        TSecrets,
        SInput,
        SOutput
      >(async (event, init, secrets, c) => {
        await this.init();
        return init[this._handler](event, secrets);
      }, configuration);

      return {
        handler,
        configuration,
      };
    

  }

  fork<
    TInput,
    TOutput,
    TSecrets extends string = string,
    THandler extends string = 'handle',
    SInput extends BaseSchema | undefined = undefined,
    SOutput extends BaseSchema | undefined = undefined
  >() {
    return new APIGatewayHandlerWrapperFactory<
      TInput,
      TOutput,
      TSecretList,
      TSecrets,
      THandler,
      SInput,
      SOutput
    >( this.mgr );
  }
}

export type APIGatewayCtrlInterface<T> =
  T extends APIGatewayHandlerWrapperFactory<
    infer TInput,
    infer TOutput,
    any,
    infer TSecrets,
    infer THandler,
    infer SInput,
    infer SOutput
  >
    ? {
        [x in THandler]: (
          payload: Request<TOrSchema<TInput, SInput>>,
          secrets: Record<TSecrets, string>
        ) => Promise<HTTPResponse<TOrSchema<TOutput, SOutput>> | HTTPError>;
      }
    : never;

