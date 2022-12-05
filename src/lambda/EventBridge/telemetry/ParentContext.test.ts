import { telemetryFindEventBridgeParent } from "./ParentContext";
import {
  memoryExporter,
  provider,
  sampledAwsHeader,
  sampledAwsLambbda,
  sampledAwsSpanContextHeader,
  sampledAwsSpanContextLambbda,
  testEventBridgeEvent,
} from "../../../test_utils/utils";
import api from "@opentelemetry/api";
import { traceContextEnvironmentKey } from "../../utils/telemetry";
import _ from "lodash";
import { AWSXRAY_TRACE_ID_HEADER } from "@opentelemetry/propagator-aws-xray";

describe("Telemetry: Event Bridge parent context", function () {
  it("Fetches Lambda context", () => {
    process.env[traceContextEnvironmentKey] = sampledAwsLambbda;

    const ctx = telemetryFindEventBridgeParent(testEventBridgeEvent);
    const span = api.trace.getTracer("tester").startSpan("testspan", {}, ctx);
    span.end();
    provider.forceFlush();

    const spans = memoryExporter.getFinishedSpans();
    expect(spans.length).toBe(1);
    expect(spans[0].parentSpanId).toEqual(sampledAwsSpanContextLambbda.spanId);
  });

  it("Fetches from payload when possible", () => {
    const event = _.cloneDeep(testEventBridgeEvent);
    event.detail[AWSXRAY_TRACE_ID_HEADER] = sampledAwsHeader;
    const ctx = telemetryFindEventBridgeParent(event);
    const span = api.trace.getTracer("tester").startSpan("testspan", {}, ctx);
    span.end();
    provider.forceFlush();

    const spans = memoryExporter.getFinishedSpans();
    expect(spans.length).toBe(1);
    expect(spans[0].parentSpanId).toEqual(sampledAwsSpanContextHeader.spanId);
  });

  it("Prefers payload over lambda environment", () => {
    process.env[traceContextEnvironmentKey] = sampledAwsLambbda;
    const event = _.cloneDeep(testEventBridgeEvent);
    event.detail[AWSXRAY_TRACE_ID_HEADER] = sampledAwsHeader;
    const ctx = telemetryFindEventBridgeParent(event);
    const span = api.trace.getTracer("tester").startSpan("testspan", {}, ctx);
    span.end();
    provider.forceFlush();

    const spans = memoryExporter.getFinishedSpans();
    expect(spans.length).toBe(1);
    expect(spans[0].parentSpanId).toEqual(sampledAwsSpanContextHeader.spanId);
  });
});
