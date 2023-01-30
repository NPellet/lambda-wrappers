# Yup validation for AWS Lambda Handlers

Validation helper bundling AJV used for [aws-lambda-handlers](https://www.npmjs.com/package/aws-lambda-handlers)

## Installation

```
npm i aws-lambda-handlers-ajv
```

## Usage

```typescript
import ajvValidation from 'aws-lambda-handlers-ajv';
import { LambdaFactoryManager } from 'aws-lambda-handlers';

const mgr = new LambdaFactoryManager();
// ...Compose mgr with other methods at wish

const mgrWithValidation = ajvValidation( mgr );

export default mgrWithValidation;
```

The validator can then be used for runtime schema validation

```typescript
import mgr from '/path/to/manager'

const schema = {
    type: "object",
    properties: {
        keyStr: {
            type: "string"
        },
        keyNum: {
            type: "number"
        }
    }
} as const;

const { handler } = mgr
    .apiGatewayWrapperFactory('handler')
    .setTsInputType<JTDDataType<typeof schema>>()
    .validateInput("ajv", schema) // <== Note this line here
    .wrapFunc( async () => {
        //... Function logic
    })
```


