# Yup validation for AWS Lambda Handlers

Validation helper bundling yup used for [aws-lambda-handlers](https://www.npmjs.com/package/aws-lambda-handlers)

## Installation

```
npm i aws-lambda-handlers-yup
```

## Usage

```typescript
import yupValidation from 'aws-lambda-handlers-yup';
import { LambdaFactoryManager } from 'aws-lambda-handlers';

const mgr = new LambdaFactoryManager();
// ...Compose mgr with other methods at wish

const mgrWithValidation = yupValidation( mgr );

export default mgrWithValidation;
```

The validator can then be used for runtime schema validation

```typescript
import mgr from '/path/to/manager'
import * as yup from 'yup';
import { InferType } from 'yup';

const schema = yup.object( {
    keyStr: yup.string(),
    keyNum: yup.number()
});

const { handler } = mgr
    .apiGatewayWrapperFactory('handler')
    .setTsInputType<InferType<typeof schema>>()
    .validateInput("yup", schema) // <== Note this line here
    .wrapFunc( async () => {
        //... Function logic
    })
```


