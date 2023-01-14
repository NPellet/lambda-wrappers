import { LambdaFactoryManager } from '../../src/lambda';

// List of AWS Secrets
enum AWSSecretName1 {
  'SecretKey1',
  'SecretKey2',
}
enum AWSSecretName2 {
  'SecretKey1',
  'SecretKey2',
}

enum AWSVaultSecret {
  'Token',
}

const AWSSecrets = {
  SecretName1: AWSSecretName1,
  SecretName2: AWSSecretName2,
  Vault: AWSVaultSecret,
};

// List of Hashicorp Vault Secrets
enum VaultSecretName1 {
  'VaultSecretKey1',
  'VaultSecretKey2',
}
enum VaultSecretName2 {
  'VaultSecretKey1',
  'VaultSecretKey2',
}

const VaultSecrets = {
  VaultSecretName1: VaultSecretName1,
  VaultSecretName2: VaultSecretName2,
};

export const LambdaManager = new LambdaFactoryManager()
  .setAWSSecrets(AWSSecrets)
  .addSecretSource<{ version?: number }>()(
  'hashicorpvault',
  VaultSecrets,
  (aws) => {
    return {
      token: aws('Vault', 'Token', true), // Get the vault token
    };
  },
  async (secretsToFetch, vaultSecrets) => {
    // vaultSecrets is of type { token?: string }
    const vaultToken = vaultSecrets.token!;
    let out: Record<string, string> = {};

    for (let [key, secret] of Object.entries(secretsToFetch)) {
      if (secret?.source !== 'hashicorpvault') {
        continue;
      }

      new URLSearchParams({ k: 'v' });
      let url = new URL(
        `https://pathtovault.ext/v1/secret/data/${secret.secret}`
      );

      if (secret.meta.version !== undefined) {
        url.search = new URLSearchParams({
          version: String(secret.meta.version),
        }).toString();
      }

      const vaultData = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'X-Vault-Token': vaultSecrets.token!,
        },
      }).then<{ data: { data: Record<string, any> } }>((r) => r.json());

      if (secret.secretKey) {
        out[key] = vaultData.data.data[secret.secretKey];
      } else {
        out[key] = JSON.stringify(vaultData.data.data);
      }
    }

    return out;
  }
);
