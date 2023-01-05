import { strict } from 'assert';
import { Handler } from 'aws-lambda';
import {
  LambdaSecretsHandler,
} from '../../util/LambdaHandler';
import { HandlerConfiguration } from '../config';
import { SecretFetcher } from '../Manager';
import { log } from './logger';
import { fetchAwsSecret } from './secrets_manager_aws';

export type TSecretRef = Record<string, Record<string, any>>;
export type METABase = undefined | Record<string, any>

export type TAllSecretRefs = Record<string, {
  lst: Record<string, TSecretRef>,
  src: METABase
}>;

export type SecretsContentOf<SRC extends keyof U, T extends keyof U[SRC]["lst"], U extends TAllSecretRefs> = keyof U[SRC]["lst"][T] | undefined;
export type SecretInj = HandlerConfiguration<any>['secretInjection'];
export type SecretFetchCfg<T extends string = string, META extends METABase = Record<string, any>> = Partial<Record<T, SecretConfig<META> >>;
export type SecretsRecord<TSecrets extends string> = Record<TSecrets, string>;

const SecretCache: Map<string, { expiresOn: Date; value: string }> = new Map();

export type SecretConfig<T extends METABase = undefined> = {
  secret: string,
  source?: string;
  required: boolean;
  secretKey?: string;
} & ( T extends undefined ? { meta?: undefined } : { meta: T });


export const modifyCacheExpiracy = (key: string, newDate: Date) => {
  SecretCache.get(key)!.expiresOn = newDate;
};

export const clearCache = () => {
  for (let k of SecretCache.keys()) {
    SecretCache.delete(k);
  }
};

export const wrapHandlerSecretsManager = <T, TSecrets extends string, U>(
  handler: LambdaSecretsHandler<T, TSecrets, U>,
  secrets: SecretInj,
  secretFetchers: Record<string, SecretFetcher<TSecrets, any>> = {}
) => {

  if( ! secretFetchers.aws ) {
    secretFetchers.aws = fetchSecretsFromAWS;
  } 

  const wrappedHandler: Handler<T, U | void> = async (event, context) => {
    log.debug('Checking AWS Secrets in environment variables');
    const secretsOut: Partial<Record<TSecrets, string>> = {};

    if (secrets) {
      const secretsToFetch: Map<string, SecretFetchCfg<TSecrets, undefined> > = new Map();
      // List all needed secrets for this lambda
      for (let [k, secretDef] of Object.entries(secrets)) {

        let { secret, source, required } = secretDef ;
        if( ! source ) {
          source = "aws"
        }
        const isInCache = SecretCache.has(k);
        const isExpired =
          !isInCache || SecretCache.get(k)!.expiresOn.getTime() < Date.now();

        if (!isInCache || isExpired) {
          // Fetch the secret
          log.debug(
            `Secret for key ${k} is either not in cache or has expired. Tagging for a refetch`
          );

          if( ! ( secretsToFetch.has(source) ) ) {
            secretsToFetch.set( source, {} );
          }

          secretsToFetch.get( source )![k] = secretDef;
        } else {
          secretsOut[k] = SecretCache.get(k)!.value;
          strict(
            process.env[k] !== undefined,
            'The Secret was found in the cache, but not in process.env. This points to a bug'
          );
        }
      }

      const awsSecrets = await fetchSecretsFromAWS( secretsToFetch.get('aws')! as SecretFetchCfg<string, undefined> );
      Object.assign( secretsOut, awsSecrets );

      for( let [ source, _secretsToFetch ] of secretsToFetch ) {
        
        if( source === "aws" ) {
          break;
        }

        const out = await secretFetchers[source]( _secretsToFetch, awsSecrets )
        Object.assign( secretsOut, out );
      }

    }

    for( let i in secretsOut ) {
      const o = secretsOut[ i ];
      if (o !== undefined) {
        process.env[i] = o;
        SecretCache.set(i, {
          expiresOn: new Date(Date.now() + 3600 * 1000 * 2),
          value: o
        });
      }
    }
    // End of secrets manager run. Move on to the handler

    return handler(event, secretsOut as Record<TSecrets, string>, context);
  };

  return wrappedHandler;
};


export const fetchSecretsFromAWS = async <TSecrets extends string>( secretsToFetch: SecretFetchCfg<TSecrets, undefined>): Promise<Partial<Record<TSecrets, string>>> => {

  
  if( ! secretsToFetch ) {
    return {};
  }

  const secretsOut: Partial<Record<TSecrets, string>> = {};
  const fetchedAwsSecrets: Map<string, string | object> = new Map();
  // TODO: Loop and simplify to fetch only main secrets, not multiple times the same secret

  const awsSecretsToFetch = new Set<string>();

  for( let k in secretsToFetch ) {
    awsSecretsToFetch.add( secretsToFetch[k]!.secret );
  }

  for (let awsSecretName of awsSecretsToFetch.values()) {
    log.debug(`Fetching secret ${awsSecretName} from AWS`);
    const awsSecret = await fetchAwsSecret(awsSecretName);
    fetchedAwsSecrets.set(awsSecretName, awsSecret);
  }

  for (let k in secretsToFetch) {

    const s = secretsToFetch[ k ] as SecretConfig<any>;
    const { secret, required, secretKey } = s;

      const awsSecretValue = fetchedAwsSecrets.get(secret);

      let value: string;
      if (secretKey === undefined) {
        strict(
          typeof awsSecretValue === 'string',
          'Secret value for secretName ' +
            secret +
            ' is not a string. Either use [ secretName, undefined ] with a string secret [ secretName, secretKey ] for a key-value secret'
        );

        value = awsSecretValue;
      } else {
        strict(
          typeof awsSecretValue === 'object',
          'Secret value for secretName ' +
            secret +
            ' is not an object. Either use secretKey: undefined with a string secret or secretKey: value for a key-value secret'
        );

        value = awsSecretValue[secretKey];
      }

      if (required && value === undefined) {
        throw new Error(
          `Secret ${secret} (key ${secretKey}) should not be undefined`
        );
      }

      log.debug(
        `Injecting newly fetched secret ${secret}:${secretKey} into env ${k}`
      );


      secretsOut[k] = value;
  }
  return secretsOut;
}
