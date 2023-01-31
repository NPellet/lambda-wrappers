import { HTTPResponse, LambdaFactoryManager } from '../../src/lambda';

class MyResource {}

export const { handler, configuration } = new LambdaFactoryManager()
  .apiGatewayWrapperFactory('handler')
  .initFunction(async () => {
    return {
      resource: new MyResource(),
    };
  })
  .wrapFunc(async (payload, init, secrets) => {
    const resource = init.resource; // of type MyResource

    // Write your logic here
    return HTTPResponse.OK({ processed: true });
  });
