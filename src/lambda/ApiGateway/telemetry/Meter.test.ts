import { LambdaContext, testApiGatewayEvent } from '../../../test_utils/utils';
import { getApiGatewayTelemetryAttributes } from './Meter';

describe('Testing API Gateway metering', function () {
  test('Getting attributes works', function () {
    const out = getApiGatewayTelemetryAttributes(
      testApiGatewayEvent,
      {
        statusCode: 200,
        body: '',
      },
      LambdaContext
    );

    expect(out.faas).toBe(LambdaContext.functionName);
    expect(out.resource).toBe(testApiGatewayEvent.resource);
    expect(out.method).toBe(testApiGatewayEvent.httpMethod);
    expect(out.status_code).toBe('200');
  });
});
