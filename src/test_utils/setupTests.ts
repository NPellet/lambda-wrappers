import { traceContextEnvironmentKey } from '../lambda/utils/telemetry';
import { memoryExporter, setupOtel } from './utils';
import api from '@opentelemetry/api';

beforeEach(() => {
  // Allow reset of the metrics
  api.metrics.disable();
  setupOtel();
});

afterEach(() => {
  process.env = {};
  delete process.env[traceContextEnvironmentKey];
  memoryExporter.reset();
});
