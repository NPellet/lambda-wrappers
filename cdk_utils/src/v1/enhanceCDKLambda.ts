import { Function } from "@aws-cdk/aws-lambda";

// @ts-ignore
import { HandlerConfiguration } from "../../../src/lambda/config";


const grantAccessV1 = (lambda: Function, region: string, secret: string) => {
  lambda.addToRolePolicy(
    new PolicyStatement({
      actions: [
        "secretsmanager:GetSecretValue",
        "secretsmanager:ListSecrets",
        "secretsmanager:DescribeSecret",
      ],
      resources: [`arn:aws:secretsmanager:${region}:*:secret:${secret}*`],
      effect: Effect.ALLOW,
    })
  );
};

export const enhanceCDKLambda = (fn: Function, region: string, pathToSource: string) => {
  const pathToHandler_finalDot = pathToSource.lastIndexOf(".");
  const pathToFile = pathToSource.substring(0, pathToHandler_finalDot);

  try {
    const handler = require(pathToFile);

    if (handler.configuration) {
      const cfg = handler.configuration as HandlerConfiguration;

      if (cfg.secretInjection) {
        for (let secretCfg of Object.values(cfg.secretInjection)) {
          const secretName = secretCfg.secret[0];
          grantAccessV1(fn, region, secretName);
        }
      }
    }
  } catch (e) {
    console.error("Could not process lambda at file " + pathToSource);
    console.error(e);
  }
};
