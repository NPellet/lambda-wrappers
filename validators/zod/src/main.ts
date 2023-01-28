import { APIGatewayEvent } from "aws-lambda";
import { z } from 'zod'
import { BaseWrapperFactory } from "aws-lambda-handlers";
import { LambdaFactoryManager } from "aws-lambda-handlers";
import { TAllSecretRefs } from "aws-lambda-handlers";
import { MessageType, TValidationsBase } from "aws-lambda-handlers";

const zodValidation = <U extends TAllSecretRefs, Z extends TValidationsBase>(manager: LambdaFactoryManager<U, Z>) => {

  return manager.addValidation("zod", async function (data, rawData: APIGatewayEvent, schema: z.ZodType) {
    // Let it throw when the validation fails
    await schema.parseAsync(data);

  }, (wrapper: BaseWrapperFactory<any>, schema: z.ZodType): [z.ZodType] => {

    if (schema instanceof z.ZodString) {
      wrapper._messageType = MessageType.String;
    } else if (schema instanceof z.ZodNumber) {
      wrapper._messageType = MessageType.Number;
    } else if (schema instanceof z.ZodObject) {
      wrapper._messageType = MessageType.Object;
    }

    return [schema]
  })
}

export default zodValidation;