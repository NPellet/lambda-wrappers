const { nodeExternalsPlugin } = require("esbuild-node-externals");

const path = require("path");

const fs = require("fs");

const watchMode = process.env.ESBUILD_WATCH === "true" || false;
if (watchMode) {
  console.log("Running in watch mode");
}

require("esbuild")
  .build({
    entryPoints: ["./src/v1/enhanceCDKLambda.ts", "./src/v2/enhanceCDKLambda.ts"],
    bundle: true,
    platform: "node",
    watch: watchMode,
    format: "cjs",
    outdir: "dist",
    sourcemap: true,
    external: [ "@aws-sdk/aws-lambda", "aws-cdk-lib" ],
  
  })
  .catch(() => process.exit(1));
