import { HTTPResponse } from '../../src/lambda';
import { LambdaManager } from './manager';

LambdaManager.apiGatewayWrapperFactory('handler')
  .needsSecret('aws', 'key', 'SecretName1', 'SecretKey1', undefined, false)
  .needsSecret(
    'hashicorpvault',
    'key2',
    'VaultSecretName1',
    'VaultSecretKey1',
    { version: 1 },
    true
  )
  .wrapFunc(async (payload, init, secrets) => {
    console.log(secrets.key);
    console.log(secrets.key2);
    return HTTPResponse.OK_NO_CONTENT();
  });
