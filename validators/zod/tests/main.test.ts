import { HTTPResponse, LambdaFactoryManager } from "aws-lambda-handlers";
import { LambdaContext, testApiGatewayEvent } from "./data";
import zodValidation from "../src/main";
import { z } from "zod";

describe("Testing zod validation", function() {
    
    it("Validation is enforced", async() => {

        const mainFunc = jest.fn( async function( data, init, secrets ) {
            return HTTPResponse.OK_NO_CONTENT();
        } );

        const mgr = new LambdaFactoryManager();
        const mgr2 = zodValidation( mgr );

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
    
});