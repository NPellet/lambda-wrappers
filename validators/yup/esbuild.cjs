const { nodeExternalsPlugin } = require("esbuild-node-externals");


require("esbuild")
  .build({
    entryPoints: ["src/main.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    outdir: "dist",
    sourcemap: true,
    external: [ "yup", "aws-lambda-handlers" ],
  
  })
  .catch(() => process.exit(1));
