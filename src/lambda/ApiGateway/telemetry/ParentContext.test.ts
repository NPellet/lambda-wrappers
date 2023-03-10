import { telemetryFindApiGatewayParent } from './ParentContext';
import {
  memoryExporter,
  provider,
  sampledAwsHeader,
  sampledAwsLambbda,
  sampledAwsSpanContextHeader,
  sampledAwsSpanContextLambbda,
  testApiGatewayEvent,
  unsampledAwsLambbda,
} from '../../../test_utils/utils';
import api from '@opentelemetry/api';
import { traceContextEnvironmentKey } from '../../utils/telemetry';
import _ from 'lodash';
import { AWSXRAY_TRACE_ID_HEADER } from '@opentelemetry/propagator-aws-xray';

describe('Telemetry: API Gateway parent context', function () {
  it('Fetches Lambda context', () => {
    process.env[traceContextEnvironmentKey] = sampledAwsLambbda;

    const ctx = telemetryFindApiGatewayParent(testApiGatewayEvent);
    const span = api.trace.getTracer('tester').startSpan('testspan', {}, ctx);
    span.end();
    provider.forceFlush();

    const spans = memoryExporter.getFinishedSpans();
    expect(spans.length).toBe(1);
    expect(spans[0].parentSpanId).toEqual(sampledAwsSpanContextLambbda.spanId);
  });

  it('Fetches HTTP header context', () => {
    const event = _.cloneDeep(testApiGatewayEvent);
    event.headers[AWSXRAY_TRACE_ID_HEADER] = sampledAwsHeader;
    const ctx = telemetryFindApiGatewayParent(event);
    const span = api.trace.getTracer('tester').startSpan('testspan', {}, ctx);
    span.end();
    provider.forceFlush();

    const spans = memoryExporter.getFinishedSpans();
    expect(spans.length).toBe(1);
    expect(spans[0].parentSpanId).toEqual(sampledAwsSpanContextHeader.spanId);
  });

  it('Fetches Header over Lambda', () => {
    process.env[traceContextEnvironmentKey] = sampledAwsLambbda;
    const event = _.cloneDeep(testApiGatewayEvent);
    event.headers[AWSXRAY_TRACE_ID_HEADER] = sampledAwsHeader;

    const ctx = telemetryFindApiGatewayParent(event);
    const span = api.trace.getTracer('tester').startSpan('testspan', {}, ctx);
    span.end();
    provider.forceFlush();

    const spans = memoryExporter.getFinishedSpans();
    expect(spans.length).toBe(1);
    expect(spans[0].parentSpanId).toEqual(sampledAwsSpanContextHeader.spanId);
  });

  it('Fetches header content over lambda content when span is not sampling', () => {
    process.env[traceContextEnvironmentKey] = unsampledAwsLambbda;
    const event = _.cloneDeep(testApiGatewayEvent);
    event.headers[AWSXRAY_TRACE_ID_HEADER] = sampledAwsHeader;

    const ctx = telemetryFindApiGatewayParent(event);
    const span = api.trace.getTracer('tester').startSpan('testspan', {}, ctx);
    span.end();
    provider.forceFlush();

    const spans = memoryExporter.getFinishedSpans();
    expect(spans.length).toBe(1);
    expect(spans[0].parentSpanId).toEqual(sampledAwsSpanContextHeader.spanId);
  });
});
