import { LambdaFactoryManager } from '../../src/lambda';
import { failSQSRecord } from '../../src/util/records/sqs/record';

// Define an input type
type Animal = {
  name: string;
  weight: string;
  id: string;
};

export const { handler, configuration } = new LambdaFactoryManager()
  .sqsWrapperFactory('handler')
  .setTsInputType<Animal>()
  .wrapFunc(async (payload, init, secrets) => {
    const data = payload.getData();
    if (!data.name || data.name.length == 0) {
      return failSQSRecord(payload);
    }

    // Do something with the record

    return;
  });
