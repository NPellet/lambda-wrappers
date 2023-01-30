import { APIGatewayEvent } from "aws-lambda";
import { BaseSchema, NumberSchema, ObjectSchema, StringSchema } from "yup";
import { BaseWrapperFactory } from "aws-lambda-handlers";
import { LambdaFactoryManager } from "aws-lambda-handlers";
import { TAllSecretRefs } from "aws-lambda-handlers";
import { MessageType, TValidationsBase } from "aws-lambda-handlers";

const yupValidation = <U extends TAllSecretRefs, Z extends TValidationsBase>(manager: LambdaFactoryManager<U, Z>) => {

  return manager.addValidation("yup", async function (data, rawData: APIGatewayEvent, schema: BaseSchema) {
    // Let it throw when the validation fails
    await schema.validate(data, {
      strict: true,
      abortEarly: true
    });
  }, (wrapper: BaseWrapperFactory<any>, schema: BaseSchema): [BaseSchema] => {

    console.log("Calling !");
    console.log( schema );
    if (schema instanceof StringSchema) {
      wrapper._messageType = MessageType.String;
    } else if (schema instanceof NumberSchema) {
      wrapper._messageType = MessageType.Number;
    } else if (schema instanceof ObjectSchema) {
      wrapper._messageType = MessageType.Object;
    }

    return [schema]
  })
}

export default yupValidation;