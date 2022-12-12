#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { StackAPI } from '../lib/stackAPIGateway';
import { StackSQSConsumer } from '../lib/stackSQSConsumer';
import { StackSNSSubscribe } from '../lib/stackSNSSubscribe';

const env = { account: '441772730001', region: 'eu-central-1' };

const app = new cdk.App();
const api = new StackAPI(app, 'StackAPI', { env });
const sqs = new StackSQSConsumer(app, 'StackSQS', { sqs: api.sqs, env });
const sns = new StackSNSSubscribe(app, 'StackSNS', { sns: api.sns, env });
