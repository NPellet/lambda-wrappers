import { exec } from 'child_process';
import {
  getMeterExporter,
  LambdaContext,
  testSNSEvent,
} from '../../test_utils/utils';
import { defaultSourceConfig } from '../../util/defaultConfig';
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

const okHandler = async () => {};

const makeHandler = (_handler: () => Promise<void>) => {
  const { handler } = new LambdaFactoryManager()
    .snsWrapperFactory('handler')
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

describe('Testing SNS metering', function () {
  test('Metering telemetry is called', async () => {
    const handler = makeHandler(okHandler);

    expect(wrapLatencyMetering).toHaveBeenCalled();
  });

  test('Increment counter is called', async () => {
    const handler = makeHandler(async () => {});

    expect(wrapLatencyMetering).toHaveBeenCalled();

    try {
      await handler(testSNSEvent, LambdaContext, () => {});
    } catch (e) {}

    const metrics = getMeterExporter().getMetrics()[0].scopeMetrics[0].metrics;

    const executions = metrics.find(
      (metric) =>
        metric.descriptor.name ==
        defaultSourceConfig._general?.metricNames?.sns_records_total
    );

    expect(executions).toBeDefined();
    expect(executions?.dataPoints[0].value).toBe(1);

    expect(executions?.dataPoints[0].attributes.source).toBe(
      testSNSEvent.Records[0].EventSource
    );
    expect(executions?.dataPoints[0].attributes.topic).toBe(
      testSNSEvent.Records[0].Sns.TopicArn
    );
  });
});
