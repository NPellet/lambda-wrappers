import Ajv, { JSONSchemaType, ValidateFunction } from "ajv";
import { APIGatewayEvent } from "aws-lambda";
import { BaseWrapperFactory, LambdaFactoryManager } from "aws-lambda-handlers";
import { TAllSecretRefs } from "aws-lambda-handlers";
import { MessageType, TValidationsBase } from "aws-lambda-handlers";

const ajvValidation = <U extends TAllSecretRefs, Z extends TValidationsBase>(manager: LambdaFactoryManager<U, Z>) => {

  return manager.addValidation("ajv", async function (data, rawData: APIGatewayEvent, validate: ValidateFunction<any>) {
    // Let it throw when the validation fails
    const validated = validate(data);
    if( ! validated ) {
      throw new Error("AJV failed to validate. AJV Errors: " + JSON.stringify( validate.errors, undefined, "\t" ) );
    }

  }, (wrapper: BaseWrapperFactory<any>, schema: JSONSchemaType<object> | JSONSchemaType<number> | JSONSchemaType<string> ): [typeof validate] => {

    const ajv = new Ajv() // options can be passed, e.g. {allErrors: true}import { BaseWrapperFactory } from "aws-lambda-handlers";
    const validate = ajv.compile( schema )
    
    if (schema.type === "string") {
      wrapper._messageType = MessageType.String;
    } else if (schema.type === "number" ) {
      wrapper._messageType = MessageType.Number;
    } else {
      wrapper._messageType = MessageType.Object;
    }

    return [validate]
  })
}

export default ajvValidation;