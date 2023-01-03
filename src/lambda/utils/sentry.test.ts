
jest.mock('@sentry/serverless', function() {
    return {
        ...jest.requireActual('@sentry/serverless'),
        AWSLambda: {
            init: jest.fn( () => {
            }),
            wrapHandler: jest.fn(( h ) => h )
        }
    }
})

import { AWSLambda } from '@sentry/serverless'
import { LambdaContext, testApiGatewayEvent } from "../../test_utils/utils";
import { HTTPError } from "../../util/records/apigateway/response";
import { LambdaFactoryManager } from "../Manager"


describe("Testing Sentry options", function () {

    jest.setTimeout( 60000 );
    it("Sentry configuration extends properly at manager level", function () {


        const manager = new LambdaFactoryManager().configureSentry({
            tracesSampleRate: 0.5
        }).configureSentryDSN("abc");

        expect(manager).toBeInstanceOf(LambdaFactoryManager);
        expect(manager.sentryCfg.tracesSampleRate).toBe(0.5);
        expect( manager.sentryCfg.dsn ).toBe('abc')
        const manager2 = manager.configureSentry({
            dsn: "abcd"
        }, false )

        expect(manager2).toBe(manager);
        expect(manager2.sentryCfg.tracesSampleRate).toBe(undefined);
        expect( manager2.sentryCfg.dsn ).toBe('abcd')
    });

    it("When Sentry is configured, the init function is called", async function() {

        const { handler,configuration } = new LambdaFactoryManager().configureSentry({
            tracesSampleRate: 0.5
        }).configureSentryDSN("https://public@sentry.example.com/1").apiGatewayWrapperFactory("handler").createHandler( class Ctrl {
            static async init() { return new Ctrl(); }
            async handler() { return HTTPError.BAD_REQUEST() }
        });

        const out = await handler( testApiGatewayEvent, LambdaContext, () => {} );
        expect( AWSLambda.wrapHandler ).toHaveBeenCalledTimes( 1 );
        expect( AWSLambda.init ).toHaveBeenCalledTimes( 1 );

        await handler( testApiGatewayEvent, LambdaContext, () => {} );
        expect( AWSLambda.wrapHandler ).toHaveBeenCalledTimes( 1 );
        expect( AWSLambda.init ).toHaveBeenCalledTimes( 1 );
    })
})