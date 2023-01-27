import { APIGatewayEvent } from "aws-lambda";
import { BaseSchema } from "yup";
import { LambdaFactoryManager } from "../../../lambda/Manager";
import { TAllSecretRefs } from "../../../lambda/utils/secrets_manager";
import { TValidationsBase } from "../../../util/types";

const yupValidation = <U extends TAllSecretRefs, Z extends TValidationsBase>( manager: LambdaFactoryManager<U, Z> ) => {

    return manager.addValidation("yup", async function( data, rawData: APIGatewayEvent, schema: BaseSchema ) {
      // Let it throw when the validation fails
      await schema.validate( data, {
        strict: true,
        abortEarly: true
      } );
    });
}

export default yupValidation;