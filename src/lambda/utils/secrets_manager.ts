import { aws_secrets } from "@lendis-tech/secrets-manager-utilities";
import { SecretsContentOf } from "@lendis-tech/secrets-manager-utilities/dist/secrets";
import { strict } from "assert";
import { Handler } from "aws-lambda";
import { LambdaHandler } from "../../util/LambdaHandler";
import { HandlerConfiguration } from "../config";
import { log } from "./logger";
import { fetchAwsSecret } from "./secrets_manager_aws";

const SecretCache: Map<string, { expiresOn: Date }> = new Map();

export type SecretTuple = {
  [K in keyof typeof aws_secrets]: [K, SecretsContentOf<K>];
}[keyof typeof aws_secrets];

export const getAwsSecretDef = <T extends keyof typeof aws_secrets>(
  secretName: T,
  secretKey: SecretsContentOf<T> | undefined
): SecretTuple => {
  return [secretName, secretKey] as SecretTuple;
};

export const modifyCacheExpiracy = (key: string, newDate: Date) => {
  SecretCache.get(key)!.expiresOn = newDate;
};

export const clearCache = () => {
  for (let k of SecretCache.keys()) {
    SecretCache.delete(k);
  }
};

export const wrapHandlerSecretsManager = <T, U>(
  handler: Handler<T, U>,
  secrets: HandlerConfiguration<any>["secretInjection"]
) => {
  const wrappedHandler: Handler<T, U | void> = async (
    event,
    context,
    callback
  ) => {
    log.debug("Checking AWS Secrets in environment variables");

    const secretsToFetch: Set<string> = new Set();
    // List all needed secrets for this lambda
    for (let [k, { secret, required }] of Object.entries(secrets)) {
      const isInCache = SecretCache.has(k);
      const isExpired =
        !isInCache || SecretCache.get(k)!.expiresOn.getTime() < Date.now();

      if (!isInCache || isExpired) {
        // Fetch the secret
        log.debug(
          `Secret for key ${k} is either not in cache or has expired. Tagging for a refetch`
        );
        secretsToFetch.add(secret[0]);
      } else {
        strict(
          process.env[k] !== undefined,
          "The Secret was found in the cache, but not in process.env. This points to a bug"
        );
      }
    }
    const fetchedAwsSecrets: Map<string, string | object> = new Map();
    for (let awsSecretName of secretsToFetch.values()) {
      log.debug(`Fetching secret ${awsSecretName} from AWS`);
      const awsSecret = await fetchAwsSecret(awsSecretName);
      fetchedAwsSecrets.set(awsSecretName, awsSecret);
    }

    for (let [k, { secret, required }] of Object.entries(secrets)) {
      if (secretsToFetch.has(secret[0])) {
        const awsSecretValue = fetchedAwsSecrets.get(secret[0]);

        let value: string;
        if (secret[1] === undefined) {
          strict(
            typeof awsSecretValue === "string",
            "Secret value for secretName " +
              secret[0] +
              " is not a string. Either use [ secretName, undefined ] with a string secret [ secretName, secretKey ] for a key-value secret"
          );

          value = awsSecretValue;
        } else {
          strict(
            typeof awsSecretValue === "object",
            "Secret value for secretName " +
              secret[0] +
              " is not a string. Either use [ secretName, undefined ] with a string secret [ secretName, secretKey ] for a key-value secret"
          );

          value = awsSecretValue[secret[1]];
        }

        if (required && value === undefined) {
          throw new Error(
            `Secret ${secret[0]} (key ${secret[1]}) should not be undefined`
          );
        }

        log.debug(
          `Injecting newly fetched secret ${secret[0]}:${secret[1]} into env ${k}`
        );

        if (value !== undefined) {
          process.env[k] = value;
        }

        SecretCache.set(k, {
          expiresOn: new Date(Date.now() + 3600 * 1000 * 2),
        });
      }
    }

    // End of secrets manager run. Move on to the handler

    return await handler(event, context, callback);
  };

  return wrappedHandler;
};
