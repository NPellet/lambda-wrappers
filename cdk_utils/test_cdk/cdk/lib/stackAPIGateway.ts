import * as cdk from 'aws-cdk-lib';
import { Function } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { enableOpentelemetry } from './opentelemetry';

// import * as sqs from 'aws-cdk-lib/aws-sqs';
export class StackAPI extends cdk.Stack {
  public sqs: cdk.aws_sqs.Queue;
  public sns: cdk.aws_sns.Topic;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const apiGateway = new cdk.aws_apigateway.RestApi(this, 'rest', {
      restApiName: 'demo_otel',
    });

    const sqs = new cdk.aws_sqs.Queue(this, 'sqs', {
      queueName: 'demo_otel',
      receiveMessageWaitTime: cdk.Duration.seconds(20),
      visibilityTimeout: cdk.Duration.seconds(120),
    });

    const sns = new cdk.aws_sns.Topic(this, 'sns', {
      topicName: 'demo_otel',
    });
    this.sqs = sqs;
    this.sns = sns;

    const table = new cdk.aws_dynamodb.Table(this, 'table', {
      tableName: 'test_Animals',
      partitionKey: {
        name: 'PK',
        type: cdk.aws_dynamodb.AttributeType.STRING,
      },
    });

    const routeA = this.routeA(apiGateway);
    const routeB = this.routeB(apiGateway);

    sqs.grantSendMessages(routeA);
    sqs.grantSendMessages(routeB);

    sns.grantPublish(routeA);
    sns.grantPublish(routeB);

    table.grantFullAccess(routeA);
  }

  routeA(apiGateway: cdk.aws_apigateway.RestApi) {
    const handler = '../src/dist/AnimalService.handler';
    const lastIndexOfSlash = handler.lastIndexOf('/');

    const fn = new Function(this, 'API_A', {
      functionName: 'demo_otel_routea',
      runtime: cdk.aws_lambda.Runtime.NODEJS_14_X,
      code: cdk.aws_lambda.Code.fromAsset(
        handler.substring(0, lastIndexOfSlash)
      ),
      timeout: cdk.Duration.seconds(30),
      handler: handler.substr(lastIndexOfSlash + 1),
      environment: {
        LOG_LEVEL: 'debug',
        SHELTER_SERVICE_QUEUE_URL: this.sqs.queueUrl,
      },
    });

    const resource = apiGateway.root.addResource('CreateManyAnimals');
    resource.addMethod('POST', new cdk.aws_apigateway.LambdaIntegration(fn));

    enableOpentelemetry.call(this, fn, 'test-AnimalService');
    return fn;
  }

  routeB(apiGateway: cdk.aws_apigateway.RestApi) {
    const handler = '../src/dist/FoodService.handler';
    const lastIndexOfSlash = handler.lastIndexOf('/');

    const fn = new Function(this, 'API_B', {
      functionName: 'demo_otel_routeb',
      runtime: cdk.aws_lambda.Runtime.NODEJS_14_X,
      code: cdk.aws_lambda.Code.fromAsset(
        handler.substring(0, lastIndexOfSlash)
      ),
      timeout: cdk.Duration.seconds(30),
      handler: handler.substr(lastIndexOfSlash + 1),
      environment: {
        LOG_LEVEL: 'debug',
      },
    });

    const resource = apiGateway.root.addResource('buyFood');
    resource.addMethod('POST', new cdk.aws_apigateway.LambdaIntegration(fn));
    enableOpentelemetry.call(this, fn, 'test-FoodService');
    return fn;
  }
}
