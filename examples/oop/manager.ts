import { LambdaFactoryManager } from '../../src/lambda';

export const LambdaManager = new LambdaFactoryManager().configureSentry({
  attachStacktrace: true,
});
