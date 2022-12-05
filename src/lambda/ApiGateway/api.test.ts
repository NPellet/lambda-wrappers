import { AWSXRAY_TRACE_ID_HEADER } from "@opentelemetry/propagator-aws-xray";
import {
  APIGatewayEvent,
  APIGatewayProxyCallback,
  APIGatewayProxyResult,
  Handler,
} from "aws-lambda";
import _ from "lodash";
import {
  sampledAwsHeader,
  testApiGatewayEvent,
  LambdaContext,
  memoryExporter,
} from "../../test_utils/utils";
import api, { SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { SemanticAttributes } from "@opentelemetry/semantic-conventions";
import {
  successHandler,
  event,
  errorHandler,
  exceptionHandler,
  malformedHandler,
  successLHandler,
  exceptionLHandler,
  errorLHandler,
  malformedLHandler,
} from "../../test_utils/apigateway";
import { createApiGatewayHandler } from "./api";
import * as yup from "yup";

jest.mock("../../util/exceptions", function () {
  return {
    recordException: jest.fn(),
  };
});

jest.mock("../Wrapper", function () {
  const actual = jest.requireActual("../Wrapper");
  return {
    wrapGenericHandler: jest.fn(actual.wrapGenericHandler),
  };
});
import { wrapGenericHandler } from "../Wrapper";

jest.mock("./telemetry/Wrapper", function () {
  const actual = jest.requireActual("./telemetry/Wrapper");
  return {
    wrapTelemetryApiGateway: jest.fn(actual.wrapTelemetryApiGateway),
  };
});
import { wrapTelemetryApiGateway } from "./telemetry/Wrapper";

import { recordException } from "../../util/exceptions";
import { HandlerConfiguration, LambdaType } from "../config";
import { AwsApiGatewayRequest } from "../../util/apigateway";

const init = async () => {};

describe("API Gateway. Sanitizing outputs", function () {
  const cfg: HandlerConfiguration = {
    type: LambdaType.GENERIC,
    secretInjection: {},
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("Handles 200 ", async () => {
    const handler = createApiGatewayHandler(successLHandler, init, cfg);

    expect(wrapGenericHandler).toHaveBeenCalled();
    const out = await handler(event, LambdaContext, () => {});
    expect(out.statusCode).toBe(200);
    expect(out.body).toBe("Ok");
  });

  it("Handles 500 ", async () => {
    const handler = createApiGatewayHandler(errorLHandler, init, cfg);
    const out = await handler(event, LambdaContext, () => {});

    expect(out.statusCode).toBe(500);
    expect(out.body).toBe("Internal Server Error");
  });

  it("Handles exception ", async () => {
    const handler = createApiGatewayHandler(exceptionLHandler, init, cfg);
    const out = await handler(event, LambdaContext, () => {});

    expect(out.statusCode).toBe(500);
    expect(out.body).toContain("The lambda execution for the API Gateway ");
    expect(recordException).toHaveBeenCalled();
  });

  it("Handles malformed output ", async () => {
    const handler = createApiGatewayHandler(malformedLHandler, init, cfg);
    const out = await handler(event, LambdaContext, () => {});

    expect(out.statusCode).toBe(500);
    expect(out.body).toContain("Lambda has outputed a malformed");
    expect(recordException).toHaveBeenCalled();
  });
  /*
  it("Handles sync handler ", async () => {
    const handler = createApiGatewayHandler(syncHandler, cfg);
    const out = await handler(event, LambdaContext, () => {});

    expect(out.statusCode).toBe(500);
    expect(out.body).toContain("Lambda function malformed.");
    expect(recordException).toHaveBeenCalled();
  });*/
});

describe("API Gateway: Telemetry", function () {
  process.env.USE_OPENTELEMETRY = "1";
  const cfg: HandlerConfiguration = {
    type: LambdaType.API_GATEWAY,
    secretInjection: {},
    opentelemetry: true,
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("Creates 2 nested spans ", async () => {
    const handler = createApiGatewayHandler(successLHandler, init, cfg);

    expect(wrapGenericHandler).toHaveBeenCalled();
    const out = await handler(event, LambdaContext, () => {});

    expect(out.statusCode).toBe(200);

    const spans = memoryExporter.getFinishedSpans();

    expect(wrapTelemetryApiGateway).toHaveBeenCalled();

    expect(spans.length).toBe(2);
    expect(spans[0].status.code).toBe(SpanStatusCode.UNSET);
    expect(spans[0].kind).toBe(SpanKind.SERVER);
    expect(spans[1].status.code).toBe(SpanStatusCode.OK);
    expect(spans[0].kind).toBe(SpanKind.SERVER);

    expect(spans[0].parentSpanId).toBe(spans[1].spanContext().spanId);
  });

  it("Checking schema validation", async () => {
    const handler = createApiGatewayHandler(
      async (request) => {
        await request.getData();

        return {
          statusCode: 200,
          body: "Ok",
        };
      },
      init,
      {
        yupSchema: yup.object({
          num: yup.number().required(),
        }),
      }
    );

    await expect(
      handler(testApiGatewayEvent, LambdaContext, () => {})
    ).resolves.toMatchObject({
      statusCode: 500,
      body: expect.stringContaining("in JSON at position"),
    });

    const wrongObjectGatewayEvent = _.cloneDeep(testApiGatewayEvent);
    wrongObjectGatewayEvent.body = JSON.stringify({ property: "value" });
    await expect(
      handler(wrongObjectGatewayEvent, LambdaContext, () => {})
    ).resolves.toMatchObject({
      statusCode: 500,
      body: expect.stringContaining("num is a required field"),
    });

    const validObjectGatewayEvent = _.cloneDeep(testApiGatewayEvent);
    validObjectGatewayEvent.body = JSON.stringify({ num: 12 });
    await expect(
      handler(validObjectGatewayEvent, LambdaContext, () => {})
    ).resolves.toMatchObject({
      statusCode: 200,
    });
  });
});
