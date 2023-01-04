import {
  LambdaContext,
  memoryExporter,
  sampledAwsHeader,
  testEventBridgeEvent,
} from "../../test_utils/utils";

import _ from "lodash";
import { AWSXRAY_TRACE_ID_HEADER } from "@opentelemetry/propagator-aws-xray";
import { createEventBridgeHandler } from "./event";
import { LambdaType } from "../config";
import * as yup from "yup";
import { MessageType } from "../../util/types";


jest.mock('../../util/exceptions', function () {
  return {
    recordException: jest.fn(),
  };
});

jest.mock('./telemetry/Wrapper', function() {

  const moduleContent= jest.requireActual('./telemetry/Wrapper');
  return {
    ...moduleContent,
    wrapTelemetryEventBridge: jest.fn( moduleContent.wrapTelemetryEventBridge )
  }
})

import { wrapTelemetryEventBridge } from "./telemetry/Wrapper";
import { recordException } from '../../util/exceptions';
import { SpanKind, SpanStatusCode } from "@opentelemetry/api";

const mockInit = jest.fn(async () => {});

const mockHandler = jest.fn(async () => {});

describe("Event bridge handler", function () {
  it("Calls init once", async () => {
    const handler = createEventBridgeHandler(mockHandler, {
      initFunction: mockInit,
      type: LambdaType.GENERIC,

      messageType: MessageType.Binary,
      secretInjection: {},
    });

    const event = _.cloneDeep(testEventBridgeEvent);
    event.detail[AWSXRAY_TRACE_ID_HEADER] = sampledAwsHeader;

    await handler(event, LambdaContext, () => {});

    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(mockHandler).toHaveBeenCalledTimes(1);

    await handler(event, LambdaContext, () => {});
    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(mockHandler).toHaveBeenCalledTimes(2);
  });

  it("Checking schema validation", async () => {

    const handler = createEventBridgeHandler(async ( event ) => {
      expect( event.getDetailType() ).toBe( testEventBridgeEvent["detail-type"] );
      expect( event.getSource() ).toBe( testEventBridgeEvent.source );
    }, {
      initFunction: mockInit,
      type: LambdaType.GENERIC,

      messageType: MessageType.Binary,
      secretInjection: {},
    });
    await handler(testEventBridgeEvent, LambdaContext, () => {});
  });

  it("Checking schema validation", async () => {
    
    const handler = createEventBridgeHandler(
      async (request) => {
        const data = await request.getData();
        return;
      },
      {
        initFunction: async () => {},
        messageType: MessageType.Binary,
        yupSchemaInput: yup.object({
          field: yup.number().required(),
        }),
      }
    );

    await expect(
      handler(testEventBridgeEvent, LambdaContext, () => {})
    ).rejects.toBeDefined();

    const validObjectEvent = _.cloneDeep(testEventBridgeEvent);
    validObjectEvent.detail = { field: 23 };

    await expect(
      handler(validObjectEvent, LambdaContext, () => {})
    ).resolves.toBeUndefined();

    expect( recordException ).toHaveBeenCalled(); 
  });

  it("Unhandled exceptions lead to exception capture", async() => {

    const handler = createEventBridgeHandler(
      async (request) => {
        throw new Error("Unhandled exception");
      },
      {
        initFunction: async () => {},
        messageType: MessageType.Binary,
      }
    );

    await expect(
      handler(testEventBridgeEvent, LambdaContext, () => {})
    ).rejects.toBeDefined(); 

    expect( recordException ).toHaveBeenCalled();
      
  });

  test("Telemetry wrapper is called depending on otel flag", async () => {

    const handler = createEventBridgeHandler(
      async (request) => {
      },
      {
        opentelemetry: true,
        messageType: MessageType.Binary,
      }
    );

    const event = _.cloneDeep(testEventBridgeEvent);
    event.detail[AWSXRAY_TRACE_ID_HEADER] = sampledAwsHeader;


    await handler(event, LambdaContext, () => {});
    expect( wrapTelemetryEventBridge ).toHaveBeenCalled();

    const spans = memoryExporter.getFinishedSpans();
    expect(spans.length).toBe(2);
    expect(spans[0].status.code).toBe(SpanStatusCode.UNSET);
    expect(spans[0].kind).toBe(SpanKind.SERVER);
    expect(spans[1].status.code).toBe(SpanStatusCode.UNSET);
    expect(spans[0].kind).toBe(SpanKind.SERVER);

    expect(spans[0].parentSpanId).toBe(spans[1].spanContext().spanId);

    jest.clearAllMocks();


    const handler2 = createEventBridgeHandler(
      async (request) => {
      },
      {
        opentelemetry: false,
        messageType: MessageType.Binary,
      }
    );

    await handler2(testEventBridgeEvent, LambdaContext, () => {});
    expect( wrapTelemetryEventBridge ).not.toHaveBeenCalled();

  })
});
