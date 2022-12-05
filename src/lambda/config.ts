import { ObjectSchema } from "yup";
import { TypedSchema } from "yup/lib/util/types";
import { wrapTelemetryApiGateway } from "./ApiGateway/telemetry/Wrapper";
import { wrapTelemetryEventBridge } from "./EventBridge/telemetry/Wrapper";
import { SecretTuple } from "./utils/secrets_manager";

export type HandlerConfiguration<
  I = any,
  U extends TypedSchema | ObjectSchema<any> = undefined
> = {
  secretInjection?: Record<string, { secret: SecretTuple; required: boolean }>;
  yupSchema?: U;
  initFunction?: () => Promise<I>;
  sentry?: boolean;
  opentelemetry?: boolean;
  type?: LambdaType;
};

export type HandlerConfigurationWithType<
  I,
  U extends TypedSchema | ObjectSchema<any>
> = Omit<HandlerConfiguration<I, U>, "type"> & {
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
