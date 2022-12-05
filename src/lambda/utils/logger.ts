import winston from "winston";

const log = winston.createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  transports: [new winston.transports.Console()],
});

export { log };
