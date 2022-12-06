import { Function } from "aws-cdk-lib/aws-lambda";
// @ts-ignore
import { HandlerConfiguration } from "../../../src/lambda/config";
import { grantAccessV2 } from "@lendis-tech/secrets-manager-infrastructure/dist/cdk_v2";

export const enhanceCDKLambda = (fn: Function, pathToSource: string) => {
  const pathToHandler_finalDot = pathToSource.lastIndexOf(".");
  const pathToFile = pathToSource.substring(0, pathToHandler_finalDot);

  try {
    const handler = require(pathToFile);

    if (handler.configuration) {
      const cfg = handler.configuration as HandlerConfiguration;

      if (cfg.secretInjection) {
        for (let secretCfg of Object.values(cfg.secretInjection)) {
          const secretName = secretCfg.secret[0];
          grantAccessV2(fn, secretName);
        }
      }
    }
  } catch (e) {
    console.error("Could not process lambda at file " + pathToSource);
    console.error(e);
  }
};
