import { SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { EventBridgeEvent, Handler } from "aws-lambda";
import {
  LambdaContext,
  memoryExporter,
  sampledAwsHeader,
  sampledAwsSpanContextHeader,
  testEventBridgeEvent,
} from "../../../test_utils/utils";
import { flush } from "../../utils/telemetry";
import { wrapTelemetryEventBridge } from "./Wrapper";

const eventHandler: Handler<
  EventBridgeEvent<string, any>,
  string
> = async () => {
  return "ok";
};

jest.mock("./ParentContext", () => {
  const init = jest.requireActual("./ParentContext");
  return {
    __esModule: true,
    telemetryFindEventBridgeParent: jest.fn(
      init.telemetryFindEventBridgeParent
    ),
  };
});

import { telemetryFindEventBridgeParent } from "./ParentContext";
import _ from "lodash";
import { AWSXRAY_TRACE_ID_HEADER } from "@opentelemetry/propagator-aws-xray";

describe("Telemetry: Event bridge wrapper", function () {
  it("Creates a span and adds attributes", async () => {
    const handler = wrapTelemetryEventBridge(eventHandler);
    const event = _.cloneDeep(testEventBridgeEvent);
    event.detail[AWSXRAY_TRACE_ID_HEADER] = sampledAwsHeader;

    await handler(event, LambdaContext, () => {});
    await flush();

    const spans = memoryExporter.getFinishedSpans();

    expect(spans.length).toBe(1);
    expect(spans[0].status.code).toBe(SpanStatusCode.UNSET);
    expect(spans[0].kind).toBe(SpanKind.SERVER);

    expect(spans[0].attributes["lendis.eventbridge.source"]).toBe(
      testEventBridgeEvent.source
    );

    expect(spans[0].attributes["lendis.eventbridge.type"]).toBe(
      testEventBridgeEvent["detail-type"]
    );

    expect(telemetryFindEventBridgeParent).toHaveBeenCalled();

    expect(spans[0].parentSpanId).toBe(sampledAwsSpanContextHeader.spanId);
  });
});
