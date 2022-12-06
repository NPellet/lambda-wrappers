import { AssertionError } from "assert";
import { Handler } from "aws-lambda";
import { event } from "../../test_utils/apigateway";
import { LambdaContext } from "../../test_utils/utils";
import { LambdaSecretsHandler } from "../../util/LambdaHandler";
import { LambdaType } from "../config";
import { wrapGenericHandler } from "../Wrapper";

jest.mock("./secrets_manager_aws", function () {
  return {
    __esModule: true,
    fetchAwsSecret: jest.fn(async (secretName: string) => {
      if (secretName == "Algolia-Products") {
        return {
          adminApiKey: "algoliaApiKey",
          apiKey: "algoliaApiKey",
        };
      } else if (secretName === "Google") {
        return "secretString";
      }
    }),
  };
});

import {
  clearCache,
  getAwsSecretDef,
  modifyCacheExpiracy,
  wrapHandlerSecretsManager,
} from "./secrets_manager";

import { fetchAwsSecret } from "./secrets_manager_aws";
const handler: LambdaSecretsHandler<any, any, any> = async () => {
  return "Ok";
};

describe("Secret manager", () => {
  afterEach(() => {
    jest.clearAllMocks();
    clearCache();
    //delete process.env.key;
  });

  test("Testing getAwsSecretDef", function () {
    expect(getAwsSecretDef("Algolia-Products", "adminApiKey")).toStrictEqual({
      secret: ["Algolia-Products", "adminApiKey"],
      required: true,
    });
  });

  test("Fetching basic functionality", async () => {
    const wrappedHandler = wrapHandlerSecretsManager(handler, {
      key: getAwsSecretDef("Algolia-Products", "adminApiKey", true),
    });

    await wrappedHandler(event, LambdaContext, () => {});

    expect(process.env.key).toBe("algoliaApiKey");
    expect(fetchAwsSecret).toHaveBeenCalledWith("Algolia-Products");
  });

  test("Fetching string and json", async () => {
    const wrappedHandler = wrapHandlerSecretsManager(handler, {
      key: getAwsSecretDef("Algolia-Products", "adminApiKey", true),
      key2: getAwsSecretDef("Google", undefined, true),
    });

    await wrappedHandler(event, LambdaContext, () => {});

    expect(process.env.key).toBe("algoliaApiKey");
    expect(process.env.key2).toBe("secretString");
    expect(fetchAwsSecret).toHaveBeenNthCalledWith(1, "Algolia-Products");
    expect(fetchAwsSecret).toHaveBeenNthCalledWith(2, "Google");
  });

  test("Fetching wrong string/json pair", async () => {
    const wrappedHandler = wrapHandlerSecretsManager(handler, {
      key: getAwsSecretDef("Algolia-Products", undefined, true),
    });
    expect(
      wrappedHandler(event, LambdaContext, () => {})
    ).rejects.toBeInstanceOf(AssertionError);
  });

  test("Fetching a secret twice should result in a single call", async () => {
    const wrappedHandler = wrapHandlerSecretsManager(handler, {
      key: getAwsSecretDef("Algolia-Products", "adminApiKey", true),
      key2: getAwsSecretDef("Algolia-Products", "apiKey", true),
    });

    await wrappedHandler(event, LambdaContext, () => {});

    expect(process.env.key).toBe("algoliaApiKey");
    expect(process.env.key2).toBe("algoliaApiKey");
    expect(fetchAwsSecret).toHaveBeenCalledTimes(1);
  });

  test("Subsequent handler calls does not result in more fetches to the secret manager, except after a cache clear", async () => {
    const wrappedHandler = wrapHandlerSecretsManager(handler, {
      key: getAwsSecretDef("Algolia-Products", "adminApiKey", true),
    });

    await wrappedHandler(event, LambdaContext, () => {});
    expect(fetchAwsSecret).toHaveBeenCalledTimes(1);
    expect(process.env.key).toBe("algoliaApiKey");

    await wrappedHandler(event, LambdaContext, () => {});
    expect(fetchAwsSecret).toHaveBeenCalledTimes(1);
    expect(process.env.key).toBe("algoliaApiKey");

    clearCache();
    delete process.env.key;

    await wrappedHandler(event, LambdaContext, () => {});
    expect(fetchAwsSecret).toHaveBeenCalledTimes(2);
    expect(process.env.key).toBe("algoliaApiKey");
  });

  test("After expiring, a new call to the secret manager is done", async () => {
    const wrappedHandler = wrapHandlerSecretsManager(handler, {
      key: getAwsSecretDef("Algolia-Products", "adminApiKey", true),
    });

    await wrappedHandler(event, LambdaContext, () => {});
    expect(fetchAwsSecret).toHaveBeenCalledTimes(1);
    expect(process.env.key).toBe("algoliaApiKey");

    modifyCacheExpiracy("key", new Date(Date.now() - 1000));
    delete process.env.key;

    await wrappedHandler(event, LambdaContext, () => {});
    expect(fetchAwsSecret).toHaveBeenCalledTimes(2);
    expect(process.env.key).toBe("algoliaApiKey");
  });

  test("Required secrets should fail if undefined", async () => {
    const wrappedHandler = wrapHandlerSecretsManager(handler, {
      key: getAwsSecretDef("Algolia-Products", "lwaAdminApiKey", true),
    });

    await expect(
      wrappedHandler(event, LambdaContext, () => {})
    ).rejects.toBeInstanceOf(Error);
  });

  test("Non-required secrets should not fail if undefined", async () => {
    const wrappedHandler = wrapHandlerSecretsManager(handler, {
      key: getAwsSecretDef("Algolia-Products", "lwaAdminApiKey", false),
    });

    await expect(wrappedHandler(event, LambdaContext, () => {})).resolves.toBe(
      "Ok"
    );
    expect(process.env.key).toBeUndefined();
  });

  test("Secret is injected before the init method is called", async () => {
    const init = async () => {
      expect(process.env.secret).toBe("algoliaApiKey");
    };
    const handler = async (event: any, init) => {};

    const wrappedHandler = wrapGenericHandler(handler, {
      type: LambdaType.GENERIC,
      initFunction: init,
      secretInjection: {
        secret: getAwsSecretDef("Algolia-Products", "adminApiKey", false),
      },
    });

    await wrappedHandler(event, LambdaContext, () => {});
  });

  test("Secret is injected in the init and handler parameter", async () => {
    const wrappedHandler = wrapGenericHandler(
      async (event: any, init, secrets) => {
        expect(secrets.secret).toBe("algoliaApiKey");
      },
      {
        type: LambdaType.GENERIC,
        initFunction: async (secrets) => {
          expect(secrets.secret).toBe("algoliaApiKey");
        },
        secretInjection: {
          secret: getAwsSecretDef("Algolia-Products", "adminApiKey", false),
        },
      }
    );

    await wrappedHandler(event, LambdaContext, () => {});
  });
});
