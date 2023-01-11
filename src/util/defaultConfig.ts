import { SourceConfig } from '../lambda/config';

export const defaultSourceConfig: SourceConfig = {
  _general: {
    recordExceptionOnLambdaFail: true,
    metricNames: {
      lambda_invocations: 'lambda_exec_total',
      lambda_errors: 'lambda_error_total',
      lambda_cold_start: 'lambda_coldstart_total',
      lambda_exec_time: 'lambda_exec_time',
      http_requests_total: 'http_requests_total',
      sns_records_total: 'sns_records_total',
      sqs_records_total: 'sqs_records_total',
    },
  },
  eventBridge: {
    failLambdaOnValidationFail: true,
  },
};
