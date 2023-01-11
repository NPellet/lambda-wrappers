import {
  getMeterExporter,
  LambdaContext,
  testApiGatewayEvent,
} from '../../test_utils/utils';
import { defaultSourceConfig } from '../../util/defaultConfig';
import {
  HTTPError,
  HTTPResponse,
} from '../../util/records/apigateway/response';
import { LambdaFactoryManager } from '../Manager';

jest.mock('../utils/telemetry', function () {
  const actual = jest.requireActual('../utils/telemetry');
  return {
    __esModule: true,
    ...actual,
    wrapLatencyMetering: jest.fn(actual.wrapLatencyMetering),
  };
});

import { wrapLatencyMetering } from '../utils/telemetry';

const badRequestHandler = async () => {
  return HTTPError.BAD_REQUEST();
};
const errorHandler = async () => {
  throw new Error('Not ok ');
};
const okHandler = async () => {
  return HTTPResponse.OK_NO_CONTENT();
};

const makeHandler = (
  _handler: () => Promise<HTTPError | HTTPResponse<any>>
) => {
  const { handler } = new LambdaFactoryManager()
    .apiGatewayWrapperFactory('handler')
    .createHandler(
      class Ctrl {
        static async init() {
          return new Ctrl();
        }

        handler = _handler;
      }
    );
  return handler;
};

describe('Testing API Gateway metering', function () {
  test('Metering telemetry is called', async () => {
    const handler = makeHandler(badRequestHandler);

    expect(wrapLatencyMetering).toHaveBeenCalled();

    try {
      await handler(testApiGatewayEvent, LambdaContext, () => {});
    } catch (e) {}

    const metrics = getMeterExporter().getMetrics()[0].scopeMetrics[0].metrics;

    expect(metrics.length).toBe(5);
    const executions = metrics.find(
      (metric) =>
        metric.descriptor.name ==
        defaultSourceConfig._general?.metricNames?.lambda_invocations
    );

    // 1 cold start
    expect(
      metrics.find(
        (m) =>
          m.descriptor.name ===
          defaultSourceConfig._general?.metricNames?.lambda_cold_start
      )?.dataPoints[0].value
    ).toBe(1);

    // No errors
    expect(
      metrics.find(
        (m) =>
          m.descriptor.name ===
          defaultSourceConfig._general?.metricNames?.lambda_errors
      )?.dataPoints.length
    ).toBe(0);
  });

  test('Gateway returns an HTTPError should be recorded in http_response', async () => {
    const handler = makeHandler(badRequestHandler);
    try {
      await handler(testApiGatewayEvent, LambdaContext, () => {});
    } catch (e) {}

    const metrics = getMeterExporter().getMetrics()[0].scopeMetrics[0].metrics;
    const response = metrics.find(
      (metric) =>
        metric.descriptor.name ==
        defaultSourceConfig._general?.metricNames?.http_statuscode_total
    )?.dataPoints[0];

    expect(response?.value).toBe(1);
    expect(response?.attributes.status_code).toBe('400');

    const exec = metrics.find(
      (metric) =>
        metric.descriptor.name ==
        defaultSourceConfig._general?.metricNames?.lambda_errors
    )?.dataPoints;

    expect(exec?.length).toBe(0);
  });

  test('Gateway that throws should be recorded in http_response AND in lambda exec errors', async () => {
    const handler = makeHandler(errorHandler);
    try {
      const out = await handler(testApiGatewayEvent, LambdaContext, () => {});
    } catch (e) {}

    const metrics = getMeterExporter().getMetrics()[0].scopeMetrics[0].metrics;
    const response = metrics.find(
      (metric) =>
        metric.descriptor.name ==
        defaultSourceConfig._general?.metricNames?.http_statuscode_total
    )?.dataPoints[0];

    expect(response?.value).toBe(1);
    expect(response?.attributes.status_code).toBe('500');

    const exec = metrics.find(
      (metric) =>
        metric.descriptor.name ==
        defaultSourceConfig._general?.metricNames?.lambda_errors
    )?.dataPoints[0];

    expect(exec?.value).toBe(1);
  });

  test('Gateway that that returns normally should have no error and correct status_code', async () => {
    const handler = makeHandler(okHandler);
    try {
      const out = await handler(testApiGatewayEvent, LambdaContext, () => {});
    } catch (e) {}
    const metrics = getMeterExporter().getMetrics()[0].scopeMetrics[0].metrics;
    const response = metrics.find(
      (metric) =>
        metric.descriptor.name ==
        defaultSourceConfig._general?.metricNames?.http_statuscode_total
    )?.dataPoints[0];

    expect(response?.value).toBe(1);
    expect(response?.attributes.status_code).toBe('204');

    const exec = metrics.find(
      (metric) =>
        metric.descriptor.name ==
        defaultSourceConfig._general?.metricNames?.lambda_errors
    )?.dataPoints;

    expect(exec?.length).toBe(0);
  });
});
