import { enableOpenTelemetry as _enableOpenTelemetry } from '@lendis-tech/ops-otel-infra-lambdas/dist/cdk_v2';
import { addLayer } from '@lendis-tech/ops-utils-infra-lambdas/dist/addLayer_cdkv2';

import * as cdk from 'aws-cdk-lib';

const OTEL_ENDPOINT = 'observability-staging.lendis.tech';
const OTEL_LAYER_ARN =
  'arn:aws:lambda:eu-central-1:441772730001:layer:opentelemetry_dev:46';
const NPM_LAYER_ARN =
  'arn:aws:lambda:eu-central-1:441772730001:layer:npm-base:4';

export { OTEL_ENDPOINT, OTEL_LAYER_ARN };

export const enableOpentelemetry = function (
  this: cdk.Stack,
  func: cdk.aws_lambda.Function,
  svc: string
) {
  _enableOpenTelemetry(func, this, svc, OTEL_ENDPOINT, OTEL_LAYER_ARN);

  addLayer(func, this, NPM_LAYER_ARN);
};
