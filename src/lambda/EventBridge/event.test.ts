import {
  LambdaContext,
  sampledAwsHeader,
  testEventBridgeEvent,
} from "../../test_utils/utils";

import _ from "lodash";
import { AWSXRAY_TRACE_ID_HEADER } from "@opentelemetry/propagator-aws-xray";
import { EventBridgeLambdaHandler } from "../../util/LambdaHandler";
import { createEventBridgeHandler } from "./event";
import { LambdaType } from "../config";
import * as yup from "yup";

const mockInit = jest.fn(async () => {});

const mockHandler = jest.fn(async () => {});

describe("Event bridge handler", function () {
  it("Calls init once", async () => {
    const handler = createEventBridgeHandler(mockHandler, {
      initFunction: mockInit,
      type: LambdaType.GENERIC,
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
    const init = async () => {};
    const handler = createEventBridgeHandler(
      async (request) => {
        const data = await request.getData();
        return;
      },
      {
        initFunction: init,
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
  });
});
