import { AssertionError } from "assert";
import { Handler } from "aws-lambda";
import { event } from "../../test_utils/apigateway";
import { LambdaContext } from "../../test_utils/utils";
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
const handler: Handler<any, any> = async () => {
  return "Ok";
};

describe("Secret manager", () => {
  afterEach(() => {
    jest.clearAllMocks();
    clearCache();
    //delete process.env.key;
  });

  test("Testing getAwsSecretDef", function () {
    expect(getAwsSecretDef("Algolia-Products", "adminApiKey")).toStrictEqual([
      "Algolia-Products",
      "adminApiKey",
    ]);
  });

  test("Fetching basic functionality", async () => {
    const wrappedHandler = wrapHandlerSecretsManager(handler, {
      key: {
        secret: getAwsSecretDef("Algolia-Products", "adminApiKey"),
        required: true,
      },
    });

    await wrappedHandler(event, LambdaContext, () => {});

    expect(process.env.key).toBe("algoliaApiKey");
    expect(fetchAwsSecret).toHaveBeenCalledWith("Algolia-Products");
  });

  test("Fetching string and json", async () => {
    const wrappedHandler = wrapHandlerSecretsManager(handler, {
      key: {
        secret: getAwsSecretDef("Algolia-Products", "adminApiKey"),
        required: true,
      },
      key2: {
        secret: getAwsSecretDef("Google", undefined),
        required: true,
      },
    });

    await wrappedHandler(event, LambdaContext, () => {});

    expect(process.env.key).toBe("algoliaApiKey");
    expect(process.env.key2).toBe("secretString");
    expect(fetchAwsSecret).toHaveBeenNthCalledWith(1, "Algolia-Products");
    expect(fetchAwsSecret).toHaveBeenNthCalledWith(2, "Google");
  });

  test("Fetching wrong string/json pair", async () => {
    const wrappedHandler = wrapHandlerSecretsManager(handler, {
      key: {
        secret: getAwsSecretDef("Algolia-Products", undefined),
        required: true,
      },
    });
    expect(
      wrappedHandler(event, LambdaContext, () => {})
    ).rejects.toBeInstanceOf(AssertionError);
  });

  test("Fetching a secret twice should result in a single call", async () => {
    const wrappedHandler = wrapHandlerSecretsManager(handler, {
      key: {
        secret: getAwsSecretDef("Algolia-Products", "adminApiKey"),
        required: true,
      },
      key2: {
        secret: getAwsSecretDef("Algolia-Products", "apiKey"),
        required: true,
      },
    });

    await wrappedHandler(event, LambdaContext, () => {});

    expect(process.env.key).toBe("algoliaApiKey");
    expect(process.env.key2).toBe("algoliaApiKey");
    expect(fetchAwsSecret).toHaveBeenCalledTimes(1);
  });

  test("Subsequent handler calls does not result in more fetches to the secret manager, except after a cache clear", async () => {
    const wrappedHandler = wrapHandlerSecretsManager(handler, {
      key: {
        secret: getAwsSecretDef("Algolia-Products", "adminApiKey"),
        required: true,
      },
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
      key: {
        secret: getAwsSecretDef("Algolia-Products", "adminApiKey"),
        required: true,
      },
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
      key: {
        secret: getAwsSecretDef("Algolia-Products", "lwaAdminApiKey"),
        required: true,
      },
    });

    await expect(
      wrappedHandler(event, LambdaContext, () => {})
    ).rejects.toBeInstanceOf(Error);
  });

  test("Non-required secrets should not fail if undefined", async () => {
    const wrappedHandler = wrapHandlerSecretsManager(handler, {
      key: {
        secret: getAwsSecretDef("Algolia-Products", "lwaAdminApiKey"),
        required: false,
      },
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
        secret: {
          secret: getAwsSecretDef("Algolia-Products", "adminApiKey"),
          required: false,
        },
      },
    });

    await wrappedHandler(event, LambdaContext, () => {});
  });
});
