import * as cdk from 'aws-cdk-lib';
import { Function } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { enableOpentelemetry } from './opentelemetry';
// import * as sqs from 'aws-cdk-lib/aws-sqs';
export class StackSQSConsumer extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: {
      sqs: cdk.aws_sqs.Queue;
      sns: cdk.aws_sns.Topic;
    } & cdk.StackProps
  ) {
    super(scope, id, props);

    const trigger = {
      handler: '../src/dist/ShelterService.handler',
    };

    const lastIndexOfSlash = trigger.handler.lastIndexOf('/');

    const fn = new Function(this, 'func', {
      functionName: 'lambda_sqsConsumer',
      runtime: cdk.aws_lambda.Runtime.NODEJS_14_X,
      code: cdk.aws_lambda.Code.fromAsset(
        trigger.handler.substring(0, lastIndexOfSlash)
      ),
      handler: trigger.handler.substr(lastIndexOfSlash + 1),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        LOG_LEVEL: 'debug',
        NOTIFICATION_TOPIC: props.sns.topicArn,
        FOOD_SERVICE_URL:
          'https://2q6qvr520d.execute-api.eu-central-1.amazonaws.com/prod',
      },
    });

    props.sqs.grantConsumeMessages(fn);
    props.sns.grantPublish(fn);

    const eventSource = new cdk.aws_lambda_event_sources.SqsEventSource(
      props.sqs,
      {
        batchSize: 5,
        maxBatchingWindow: cdk.Duration.seconds(5),
      }
    );

    fn.addEventSource(eventSource);

    enableOpentelemetry.call(this, fn, 'test-ShelterService');
  }
}
