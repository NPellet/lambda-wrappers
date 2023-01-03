import { ObjectSchema } from 'yup';
import { MessageType } from '../util/types';
import { wrapTelemetryApiGateway } from './ApiGateway/telemetry/Wrapper';
import { wrapTelemetryEventBridge } from './EventBridge/telemetry/Wrapper';
import { SecretFetcher } from './Manager';
import {
  METABase,
  SecretConfig,
  SecretFetchCfg,
  SecretsRecord,
} from './utils/secrets_manager';

export type HandlerConfiguration<
  TInit = any,
  U extends any | ObjectSchema<any> = any,
  V extends any | ObjectSchema<any> = any,
  TSecrets extends string = string
> = {
  secretInjection?: Record<TSecrets, SecretConfig<METABase>>,

  secretFetchers?: Record<string, SecretFetcher<TSecrets, any >>,
  yupSchemaInput?: U;
  yupSchemaOutput?: V;
  initFunction?: (secrets: SecretsRecord<TSecrets>) => Promise<TInit>;
  sentry?: boolean;
  opentelemetry?: boolean;
  type?: LambdaType;
  messageType: MessageType
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

export const LambdaTypeConfiguration = {
  [LambdaType.EVENT_BRIDGE]: {
    opentelemetryWrapper: wrapTelemetryEventBridge,
  },
  [LambdaType.API_GATEWAY]: {
    opentelemetryWrapper: wrapTelemetryApiGateway,
  },
};

