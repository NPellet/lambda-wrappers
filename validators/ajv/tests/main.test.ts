import { HTTPResponse, LambdaFactoryManager, MessageType } from "aws-lambda-handlers";
import { LambdaContext, testApiGatewayEvent } from "./data";
import zodValidation from "../src/main";
import { JTDDataType, JTDSchemaType } from "ajv/dist/core";

describe("Testing ajv validation", function () {

    const mgr = new LambdaFactoryManager();
    const mgr2 = zodValidation(mgr);


    it("Validation is enforced", async () => {

        const mainFunc = jest.fn(async function (data, init, secrets) {
            return HTTPResponse.OK_NO_CONTENT();
        });

        const schema = {
            type: "object",
            properties: {
                key: {
                    type: "number",
                    nullable: false
                }
            }
        } as const;

  
        const { handler } = mgr2
            .apiGatewayWrapperFactory("handler")
            .validateInput("ajv", schema)
            .wrapFunc(mainFunc);

        await expect(handler(testApiGatewayEvent({
            key: 1
        }), LambdaContext, () => { })).resolves.toMatchObject({
            statusCode: 204
        });

        expect(mainFunc).toHaveBeenCalled();

        jest.clearAllMocks();
        await expect(handler(testApiGatewayEvent({
            key: "string"
        }), LambdaContext, () => { })).resolves.toMatchObject({
            statusCode: 500
        });

        expect(mainFunc).not.toHaveBeenCalled();


    });


    it("Infers message type", function () {

        expect(mgr2.eventBridgeWrapperFactory("a").validateInput("ajv", { type: "string" }).wrapFunc(async () => { }).configuration.messageType).toBe(MessageType.String)
        expect(mgr2.eventBridgeWrapperFactory("a").validateInput("ajv", { type: "number" }).wrapFunc(async () => { }).configuration.messageType).toBe(MessageType.Number)
        expect(mgr2.eventBridgeWrapperFactory("a").validateInput("ajv", { type: "object" }).wrapFunc(async () => { }).configuration.messageType).toBe(MessageType.Object)
    })


});