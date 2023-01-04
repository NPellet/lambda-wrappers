import { MessageType } from "../../util/types"
import { createSNSHandler } from "./sns"


jest.mock('./telemetry/Wrapper', function() {

    const moduleContent= jest.requireActual('./telemetry/Wrapper');
    return {
      ...moduleContent,
      wrapTelemetrySNS: jest.fn( moduleContent.wrapTelemetrySNS )
    }
  })

  import { wrapTelemetrySNS } from "./telemetry/Wrapper";
  
describe("SNS: Telemetry", function() {

    it("Calls OTEL wrapper following opentelemetry flag", async() => {

        createSNSHandler( async ( data ) => {}, {
            opentelemetry: true,
            messageType: MessageType.String
        })

        expect( wrapTelemetrySNS ).toHaveBeenCalledTimes( 1 );
        jest.clearAllMocks();

        createSNSHandler( async ( data ) => {},{
            opentelemetry: false,
            messageType: MessageType.String
        })

        expect( wrapTelemetrySNS ).not.toHaveBeenCalled( );
    })
})