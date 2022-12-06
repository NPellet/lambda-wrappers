import { ObjectSchema } from "yup";
import { wrapTelemetryApiGateway } from "./ApiGateway/telemetry/Wrapper";
import { wrapTelemetryEventBridge } from "./EventBridge/telemetry/Wrapper";
import { SecretConfig, SecretsRecord } from "./utils/secrets_manager";

export type HandlerConfiguration<
  I = any,
  U extends any | ObjectSchema<any> = any,
  V extends any | ObjectSchema<any> = any,
  TSecrets extends string = string
> = {
  secretInjection?: Record<TSecrets, SecretConfig>;
  yupSchemaInput?: U;
  yupSchemaOutput?: V;
  initFunction?: (secrets: SecretsRecord<TSecrets>) => Promise<I>;
  sentry?: boolean;
  opentelemetry?: boolean;
  type?: LambdaType;
};

export type HandlerConfigurationWithType<
  I,
  U extends any | ObjectSchema<any> = any,
  V extends any | ObjectSchema<any> = any,
  TSecrets extends string = string
> = Omit<HandlerConfiguration<I, U, V, TSecrets>, "type"> & {
  type: LambdaType;
};

export const enum LambdaType {
  EVENT_BRIDGE,
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
