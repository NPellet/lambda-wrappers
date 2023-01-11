import { APIGatewayEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { getFaasTelemetryAttributes } from '../../utils/telemetry';

export const getApiGatewayTelemetryAttributes = (
  event: APIGatewayEvent,
  out: APIGatewayProxyResult | undefined,
  context: Context
) => {
  return {
    status_code: String(out?.statusCode || '500'),
    method: event.httpMethod,
    resource: event.resource,
    ...getFaasTelemetryAttributes(context),
  };
};
