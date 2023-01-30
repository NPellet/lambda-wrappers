import { LambdaFactoryManager } from "aws-lambda-handlers";
import yupValidation from 'aws-lambda-handlers-yup';


const mgr = yupValidation( new LambdaFactoryManager() );

const mgr2 = mgr.addSecretSource<any>()("hashicorp", {
    "a": {
        "b": "b",
        "c": "c"
    }
}, () => { return {} }, async () => {
    return {}
})


