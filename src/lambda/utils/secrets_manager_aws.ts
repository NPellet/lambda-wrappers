import { SecretsManager } from "@aws-sdk/client-secrets-manager";

const Secrets = new SecretsManager({});

export const fetchAwsSecret = async (secretName: string) => {
  const secretValue = await Secrets.getSecretValue({
    SecretId: secretName,
  });

  const asString = secretValue.SecretString;

  if (!asString) {
    throw new Error("Secret doesn't have a SecretString parameter");
  }

  try {
    const asJSON = JSON.parse(asString);
    return asJSON;
  } catch (e) {
    return asString;
  }
};
