import { HTTPResponse, LambdaFactoryManager } from '../../src/lambda';
import * as yup from 'yup';

export const { handler, configuration } = new LambdaFactoryManager()
  .apiGatewayWrapperFactory('handler')
  .setInputSchema(
    yup.object({
      keyA: yup.string(),
      keyB: yup.number(),
    })
  )
  .wrapFunc(async (payload, init, secrets) => {
    const data = payload.getData();

    console.log('keyA is ' + data.keyA);
    console.log('keyB is ' + data.keyB);

    // Write your logic here
    return HTTPResponse.OK({ processed: true });
  });
