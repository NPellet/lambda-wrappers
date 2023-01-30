import { HTTPResponse, LambdaFactoryManager, MessageType } from "aws-lambda-handlers";
import { LambdaContext, testApiGatewayEvent } from "./data";
import zodValidation from "../src/main";
import { z } from "zod";

describe("Testing zod validation", function() {
    

    const mgr = new LambdaFactoryManager();
    const mgr2 = zodValidation( mgr );

    
    it("Validation is enforced", async() => {

        const mainFunc = jest.fn( async function( data, init, secrets ) {
            return HTTPResponse.OK_NO_CONTENT();
        } );

        const { handler } = mgr2
            .apiGatewayWrapperFactory("handler")
            .validateInput("zod", z.object({
                key: z.number()
            }))
            .wrapFunc( mainFunc );

        await expect( handler( testApiGatewayEvent( {
            key: 1
        }), LambdaContext, () => {} ) ).resolves.toMatchObject( {
            statusCode: 204 
        });

        expect( mainFunc ).toHaveBeenCalled();

        jest.clearAllMocks();
        await expect( handler( testApiGatewayEvent( {
            key: "string"
        }), LambdaContext, () => {} ) ).resolves.toMatchObject( {
            statusCode: 500 
        });

        expect( mainFunc ).not.toHaveBeenCalled();


    });


    it("Infers message type", function() {

        expect( mgr2.eventBridgeWrapperFactory("a").validateInput( "zod", z.string() ).wrapFunc( async () => {} ).configuration.messageType ).toBe(MessageType.String)
        expect( mgr2.eventBridgeWrapperFactory("a").validateInput( "zod", z.number() ).wrapFunc( async () => {} ).configuration.messageType ).toBe(MessageType.Number)
        expect( mgr2.eventBridgeWrapperFactory("a").validateInput( "zod", z.object( {} ) ).wrapFunc( async () => {} ).configuration.messageType ).toBe(MessageType.Object)
    })

    
});