import { ObjectSchema } from "yup";
import { getAwsFromAccountFromArn } from "../util/aws";
import { wrapTelemetryApiGateway } from "./ApiGateway/telemetry/Wrapper";
import { wrapTelemetryEventBridge } from "./EventBridge/telemetry/Wrapper";
import {
  getAwsSecretDef,
  SecretConfig,
  SecretsRecord,
} from "./utils/secrets_manager";

export type HandlerConfiguration<
  TInit = any,
  U extends any | ObjectSchema<any> = any,
  V extends any | ObjectSchema<any> = any,
  TSecrets extends string = string
> = {
  secretInjection?: Record<TSecrets, SecretConfig>;
  yupSchemaInput?: U;
  yupSchemaOutput?: V;
  initFunction?: (secrets: SecretsRecord<TSecrets>) => Promise<TInit>;
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

export type TInit<A extends HandlerConfiguration> = A["initFunction"] extends (
  ...args: any[]
) => any
  ? Awaited<ReturnType<A["initFunction"]>>
  : never;

export type TSecrets<A extends HandlerConfiguration> =
  keyof A["secretInjection"];

export const buildHandlerConfiguration = <
  I,
  U extends any | ObjectSchema<any> = any,
  V extends any | ObjectSchema<any> = any,
  TSecrets extends string = string
>(cfg: {
  secretInjection?: Record<TSecrets, SecretConfig>;
  yupSchemaInput?: U;
  yupSchemaOutput?: V;
  initFunction?: (secrets: SecretsRecord<TSecrets>) => Promise<I>;
  sentry?: boolean;
  opentelemetry?: boolean;
}) => cfg;

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

const secrets = buildHandlerConfiguration({
  secretInjection: {
    k: getAwsSecretDef("Algolia-Products", "adminApiKey", true),
  },
});
