const { nodeExternalsPlugin } = require("esbuild-node-externals");

const path = require("path");

const fs = require("fs");

const watchMode = process.env.ESBUILD_WATCH === "true" || false;
if (watchMode) {
  console.log("Running in watch mode");
}

require("esbuild")
  .build({
    entryPoints: ["src/lambda/index.ts"],
    bundle: true,
    platform: "node",
    watch: watchMode,
    format: "cjs",
    outdir: "dist",
    sourcemap: true,
    //external: [ "winston", "@aws-sdk/client-secrets-manager", "@opentelemetry/api", "@opentelemetry/semantic-conventions", "aws-sdk" ],¨
    minify: true,
    plugins: [  nodeExternalsPlugin() ] 
  
  })
  .catch(() => process.exit(1));
