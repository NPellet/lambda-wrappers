import * as cdk from 'aws-cdk-lib';
import { Function } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { enableOpentelemetry } from './opentelemetry';
// import * as sqs from 'aws-cdk-lib/aws-sqs';
export class StackSNSSubscribe extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: {
      sns: cdk.aws_sns.Topic;
    } & cdk.StackProps
  ) {
    super(scope, id, props);

    const trigger = {
      handler: '../src/dist/NotificationService.handler',
    };

    const lastIndexOfSlash = trigger.handler.lastIndexOf('/');

    const fn = new Function(this, 'func', {
      functionName: 'lambda_snsSubscriber',
      runtime: cdk.aws_lambda.Runtime.NODEJS_14_X,
      code: cdk.aws_lambda.Code.fromAsset(
        trigger.handler.substring(0, lastIndexOfSlash)
      ),
      timeout: cdk.Duration.seconds(30),
      handler: trigger.handler.substr(lastIndexOfSlash + 1),
      memorySize: 512,
      environment: {
        LOG_LEVEL: 'debug',
      },
    });

    const eventSource = new cdk.aws_lambda_event_sources.SnsEventSource(
      props.sns
    );

    fn.addEventSource(eventSource);

    enableOpentelemetry.call(this, fn, 'test-NotificationService');
  }
}
