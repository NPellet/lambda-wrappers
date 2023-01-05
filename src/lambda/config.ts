import { ObjectSchema } from 'yup';
import { MessageType } from '../util/types';
import { SecretFetcher } from './Manager';
import { METABase, SecretConfig, SecretsRecord } from './utils/secrets_manager';

export type SourceConfigEB = Partial<{
  failLambdaOnValidationFail: boolean;
  recordExceptionOnValidationFail: boolean;
}>;

export type SourceConfigSNS = Partial<{
  recordExceptionOnValidationFail: boolean;
  silenceRecordOnValidationFail: boolean;
}>;

export type SourceConfigSQS = Partial<{
  recordExceptionOnValidationFail: boolean;
  silenceRecordOnValidationFail: boolean;
}>;

export type SourceConfigAPIGateway = Partial<{
  recordExceptionOnValidationFail: boolean;
}>;

export type SourceConfigGeneral = Partial<{
  recordExceptionOnLambdaFail: boolean;
}>;

export type SourceConfig = Partial<{
  eventBridge: SourceConfigEB;
  apiGateway: SourceConfigAPIGateway;
  sns: SourceConfigSNS;
  sqs: SourceConfigSQS;
  _general: SourceConfigGeneral;
}>;

export type HandlerConfiguration<
  TInit = any,
  U extends any | ObjectSchema<any> = any,
  V extends any | ObjectSchema<any> = any,
  TSecrets extends string = string
> = {
  secretInjection?: Record<TSecrets, SecretConfig<METABase>>;

  secretFetchers?: Record<string, SecretFetcher<TSecrets, any>>;
  yupSchemaInput?: U;
  yupSchemaOutput?: V;
  initFunction?: (secrets: SecretsRecord<TSecrets>) => Promise<TInit>;
  sentry?: boolean;
  opentelemetry?: boolean;
  type?: LambdaType;
  messageType: MessageType;

  sources?: SourceConfig;
};

export type HandlerConfigurationWithType<
  I,
  U extends any | ObjectSchema<any> = any,
  V extends any | ObjectSchema<any> = any,
  TSecrets extends string = string
> = Omit<HandlerConfiguration<I, U, V, TSecrets>, 'type'> & {
  type: LambdaType;
};

export type TInit<A extends HandlerConfiguration> = A['initFunction'] extends (
  ...args: any[]
) => any
  ? Awaited<ReturnType<A['initFunction']>>
  : never;

export type TSecrets<A extends HandlerConfiguration> =
  keyof A['secretInjection'];

export const enum LambdaType {
  EVENT_BRIDGE,
  SNS,
  API_GATEWAY,
  SQS,
  GENERIC,
}
