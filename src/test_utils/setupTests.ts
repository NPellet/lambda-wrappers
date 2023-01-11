import { traceContextEnvironmentKey } from '../lambda/utils/telemetry';
import { memoryExporter, setupOtel } from './utils';
const GLOBAL_OPENTELEMETRY_API_KEY = Symbol.for(`opentelemetry.js.api.1`);

beforeEach(() => {
  // Allow reset of the metrics
  globalThis[GLOBAL_OPENTELEMETRY_API_KEY]['metrics'] = undefined; // Allow reset of metrics
  setupOtel();
});

afterEach(() => {
  process.env = {};
  delete process.env[traceContextEnvironmentKey];
  memoryExporter.reset();
});
