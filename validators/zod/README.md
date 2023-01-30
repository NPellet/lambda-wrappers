# Yup validation for AWS Lambda Handlers

Validation helper bundling zod used for [aws-lambda-handlers](https://www.npmjs.com/package/aws-lambda-handlers)

## Installation

```
npm i aws-lambda-handlers-zod
```

## Usage

```typescript
import zodValidation from 'aws-lambda-handlers-zod';
import { LambdaFactoryManager } from 'aws-lambda-handlers';

const mgr = new LambdaFactoryManager();
// ...Compose mgr with other methods at wish

const mgrWithValidation = zodValidation( mgr );

export default mgrWithValidation;
```

The validator can then be used for runtime schema validation

```typescript
import mgr from '/path/to/manager'
import { z } from "zod";
import { InferType } from 'yup';

const schema = z.object( {
    keyStr: z.string(),
    keyNum: z.number()
});

const { handler } = mgr
    .apiGatewayWrapperFactory('handler')
    .setTsInputType<InferType<typeof schema>>()
    .validateInput("zod", schema) // <== Note this line here
    .wrapFunc( async () => {
        //... Function logic
    })
```


