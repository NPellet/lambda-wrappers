import { testEventBridgeEvent } from "../../../test_utils/utils";
import { AwsEventBridgeEvent } from "./eventbridge";

describe('Event bridge event', () => {
    test('Output basic getters', async () => {
  
      const event = new AwsEventBridgeEvent(
        testEventBridgeEvent
      );
  
      expect(event.getDetailType()).toBe( testEventBridgeEvent["detail-type"] );
      expect(event.getRawData()).toBe( testEventBridgeEvent );
      expect(event.getRawRecord()).toBe( testEventBridgeEvent );
    });
});