import { ObjectSchema } from "yup";
import { TypedSchema } from "yup/lib/util/types";
import { wrapTelemetryApiGateway } from "./ApiGateway/telemetry/Wrapper";
import { wrapTelemetryEventBridge } from "./EventBridge/telemetry/Wrapper";
import { SecretTuple } from "./utils/secrets_manager";

export type HandlerConfiguration<
  I = any,
  U extends any | ObjectSchema<any> = any,
  V extends any | ObjectSchema<any> = any,
  TSecrets extends string = string
> = {
  secretInjection?: Record<
    TSecrets,
    { secret: SecretTuple; required: boolean }
  >;
  yupSchemaInput?: U;
  yupSchemaOutput?: V;
  initFunction?: (secrets: Record<TSecrets, string>) => Promise<I>;
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

export const LambdaTypeConfiguration = {
  [LambdaType.EVENT_BRIDGE]: {
    opentelemetryWrapper: wrapTelemetryEventBridge,
  },
  [LambdaType.API_GATEWAY]: {
    opentelemetryWrapper: wrapTelemetryApiGateway,
  },
};

export const enum LambdaType {
  EVENT_BRIDGE,
  API_GATEWAY,
  SQS,
  GENERIC,
}
