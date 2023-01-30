import { HTTPResponse, LambdaFactoryManager } from "aws-lambda-handlers";
import yupValidation from "../src/main";
import * as yup from 'yup';
import { LambdaContext, testApiGatewayEvent } from "./data";

describe("Testing yup validation", function() {
    
    it("Validation is enforced", async() => {

        const mainFunc = jest.fn( async function( data, init, secrets ) {
            return HTTPResponse.OK_NO_CONTENT();
        } );

        const mgr = new LambdaFactoryManager();
        const mgr2 = yupValidation( mgr );

        const { handler } = mgr2
            .apiGatewayWrapperFactory("handler")
            .validateInput("yup", yup.object({
                key: yup.number()
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