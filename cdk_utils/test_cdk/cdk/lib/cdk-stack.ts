import * as cdk from "aws-cdk-lib";
import { Function } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { enhanceCDKLambda } from "../../../src/v2/enhancCDKLambda";
// import * as sqs from 'aws-cdk-lib/aws-sqs';
import { resolve } from "path";
export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const trigger = {
      handler: "../src/path/to/file/main.handler",
    };

    const lastIndexOfSlash = trigger.handler.lastIndexOf("/");

    const fn = new Function(this, "func", {
      functionName: "func_test",
      runtime: cdk.aws_lambda.Runtime.NODEJS_14_X,
      code: cdk.aws_lambda.Code.fromAsset(
        trigger.handler.substring(0, lastIndexOfSlash)
      ),
      handler: trigger.handler.substr(lastIndexOfSlash + 1),
      timeout: cdk.Duration.minutes(1),
      memorySize: 512,
      environment: {},
    });

    enhanceCDKLambda(fn, resolve(trigger.handler));
  }
}
