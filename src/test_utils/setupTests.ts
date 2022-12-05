import { traceContextEnvironmentKey } from "../lambda/utils/telemetry";
import { memoryExporter } from "./utils";

afterEach(() => {
  process.env = {};
  delete process.env[traceContextEnvironmentKey];
  memoryExporter.reset();
});
