import { MessageType, TValidationMethodBase } from '../util/types';
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

export type MetricNames = {
  lambda_invocations: string;
  lambda_errors: string;
  lambda_cold_start_total: string;
  lambda_exec_time: string;
  http_requests_total: string;
  sns_records_total: string;
  sqs_records_total: string;
};

export type ConfigGeneral = Partial<{
  recordExceptionOnLambdaFail: boolean;
  logInput: string;
  
  metricNames: Partial<MetricNames>;
}>;

export type SourceConfig = Partial<{
  eventBridge: SourceConfigEB;
  apiGateway: SourceConfigAPIGateway;
  sns: SourceConfigSNS;
  sqs: SourceConfigSQS;
  _general: ConfigGeneral;
}>;

export type HandlerConfiguration<
  TInit = any,
  TSecrets extends string = string
> = {
  secretInjection?: Record<TSecrets, SecretConfig<METABase>>;

  secretFetchers?: Record<string, SecretFetcher<TSecrets, any>>;
  validateInputFn?: TValidationMethodBase[];
  validateOutputFn?: TValidationMethodBase[];
  initFunction?: (secrets: SecretsRecord<TSecrets>) => Promise<TInit>;
  sentry?: boolean;
  opentelemetry?: boolean;
  type?: LambdaType;
  messageType: MessageType;

  sources?: SourceConfig;
};

export type HandlerConfigurationWithType<
  I,
  TSecrets extends string = string
> = Omit<HandlerConfiguration<I, TSecrets>, 'type'> & {
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

export const METER_NAME = 'aws-lambda-handlers';
