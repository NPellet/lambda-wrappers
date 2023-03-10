import { LambdaContext, testApiGatewayEvent, testEventBridgeEvent, testSingleSQSEvent, testSNSEvent, testSQSEvent } from "../test_utils/utils";
import { HTTPError, HTTPResponse } from "../util/records/apigateway/response";
import { LambdaFactoryManager } from "./Manager"

describe("Testing runtime validation", () => {

    afterEach(() => {
        jest.clearAllMocks();
    })

    const error = new Error("whoops");

    const failValidator = jest.fn(async () => {
        throw error;
    })

    const successValidator = jest.fn(async () => {
        return;
    })

    const mgr = new LambdaFactoryManager()
        .addValidation("failValidator", failValidator, (e) => [])
        .addValidation("successValidator", successValidator, (e) => []);



    describe("API Gateway", function () {

        it("Failed validator check", async () => {
            const _handler = jest.fn();
            const { handler } = mgr.apiGatewayWrapperFactory("handler").validateInput("failValidator").wrapFunc(_handler)

            await expect(handler(testApiGatewayEvent, LambdaContext, () => { })).resolves.toMatchObject({ statusCode: 500, body: expect.stringContaining("Lambda input schema validation failed") })

            expect(_handler).not.toHaveBeenCalled();
            expect(failValidator).toHaveBeenCalledWith(testApiGatewayEvent.body, testApiGatewayEvent);
        });

        it("Success validator check", async () => {
            const _handler = jest.fn(async () => {
                return HTTPResponse.OK_NO_CONTENT();
            });
            const { handler } = mgr.apiGatewayWrapperFactory("handler").validateInput("successValidator").wrapFunc(_handler)
            await expect(handler(testApiGatewayEvent, LambdaContext, () => { })).resolves.toMatchObject({ statusCode: 204 })

            expect(_handler).toHaveBeenCalled();
            expect(successValidator).toHaveBeenCalledWith(testApiGatewayEvent.body, testApiGatewayEvent);
        });

        it("Failed output validator check", async () => {
            const no_content = HTTPResponse.OK_NO_CONTENT();
            const _handler = jest.fn(async () => {
                return no_content;
            });
            const { handler } = mgr.apiGatewayWrapperFactory("handler").validateOutput("failValidator").wrapFunc(_handler)


            await expect(handler(testApiGatewayEvent, LambdaContext, () => { })).resolves.toMatchObject({ statusCode: 500, body: expect.stringContaining("Validation error: Output") })
            expect(failValidator).toHaveBeenCalledWith(null, no_content);

        });
    });


    describe("Event Bridge", function () {

        it("Failed validator check", async () => {
            const _handler = jest.fn();
            const { handler } = mgr.eventBridgeWrapperFactory("handler").validateInput("failValidator").wrapFunc(_handler)

            await expect(handler(testEventBridgeEvent, LambdaContext, () => { })).rejects.toBe(error);

            expect(_handler).not.toHaveBeenCalled();
            expect(failValidator).toHaveBeenCalledWith(testEventBridgeEvent.detail, testEventBridgeEvent);
        });

        it("Success validator check", async () => {
            const _handler = jest.fn(async () => {

            });
            const { handler } = mgr.eventBridgeWrapperFactory("handler").validateInput("successValidator").wrapFunc(_handler)
            await expect(handler(testEventBridgeEvent, LambdaContext, () => { })).resolves.toBeUndefined()

            expect(_handler).toHaveBeenCalled();
            expect(successValidator).toHaveBeenCalledWith(testEventBridgeEvent.detail, testEventBridgeEvent);
        });
    });


    describe("SQS", function () {

        it("Failed validator check", async () => {
            const _handler = jest.fn();
            const { handler } = mgr.sqsWrapperFactory("handler").validateInput("failValidator").wrapFunc(_handler)

            await expect(handler(testSingleSQSEvent, LambdaContext, () => { })).resolves.toStrictEqual({ "batchItemFailures": [{ "itemIdentifier": testSingleSQSEvent.Records[0].messageId }] });

            expect(_handler).not.toHaveBeenCalled();
            expect(failValidator).toHaveBeenCalledWith(JSON.parse(testSQSEvent.Records[0].body), testSQSEvent.Records[0]);
        });

        it("Success validator check", async () => {
            const _handler = jest.fn(async () => {

            });
            const { handler } = mgr.sqsWrapperFactory("handler").validateInput("successValidator").wrapFunc(_handler)
            await expect(handler(testSingleSQSEvent, LambdaContext, () => { })).resolves.toStrictEqual({ "batchItemFailures": [] })

            expect(_handler).toHaveBeenCalled();
            expect(successValidator).toHaveBeenCalledWith(JSON.parse(testSQSEvent.Records[0].body), testSQSEvent.Records[0]);
        });
    });




    describe("SNS", function () {

        it("Failed validator check", async () => {
            const _handler = jest.fn();
            const { handler } = mgr.snsWrapperFactory("handler").validateInput("failValidator").wrapFunc(_handler)

            await expect(handler(testSNSEvent, LambdaContext, () => { })).rejects.toBe(error);

            expect(_handler).not.toHaveBeenCalled();
            expect(failValidator).toHaveBeenCalledWith(testSNSEvent.Records[0].Sns.Message, testSNSEvent.Records[0]);
        });

        it("Success validator check", async () => {
            const _handler = jest.fn(async () => {

            });
            const { handler } = mgr.snsWrapperFactory("handler").validateInput("successValidator").wrapFunc(_handler)
            await expect(handler(testSNSEvent, LambdaContext, () => { })).resolves.toBeUndefined()

            expect(_handler).toHaveBeenCalled();
            expect(successValidator).toHaveBeenCalledWith(testSNSEvent.Records[0].Sns.Message, testSNSEvent.Records[0]);
        });
    });

    describe("Init function", function () {

        it("Init function is called", async () => {

            const validator = jest.fn( async () => {});
            const validatorInit = jest.fn();

            const mgr = new LambdaFactoryManager().addValidation("test", validator, validatorInit)
            const fac = mgr.apiGatewayWrapperFactory("handler");

            fac.validateInput("test");
            

            const handler = fac.wrapFunc(async function () {
                return HTTPResponse.OK_NO_CONTENT();
            })

            await expect(handler.handler(testApiGatewayEvent, LambdaContext, () => { })).resolves.toMatchObject({ statusCode: 204 });
            expect(validatorInit).toHaveBeenCalled();
            expect(validator).toHaveBeenCalled();
            await expect(handler.handler(testApiGatewayEvent, LambdaContext, () => { })).resolves.toMatchObject({ statusCode: 204 });
            expect(validatorInit).toHaveBeenCalledTimes(1);
        });
    });
});
