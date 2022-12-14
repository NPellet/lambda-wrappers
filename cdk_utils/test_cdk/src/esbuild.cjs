const { nodeExternalsPlugin } = require('esbuild-node-externals');
const glob = require('glob');
const path = require('path');

const fs = require('fs');

const watchMode = process.env.ESBUILD_WATCH === 'true' || false;
if (watchMode) {
  console.log('Running in watch mode');
}

require('esbuild')
  .build({
    entryPoints: glob.sync('*.ts'),
    bundle: true,
    platform: 'node',
    watch: watchMode,
    target: 'node14',
    format: 'cjs',
    outdir: './dist',
    sourcemap: false,
    external: [
      '@aws-sdk/aws-lambda',
      'aws-cdk-lib',
      '@opentelemetry/api',
      'node-fetch',
      '@aws-sdk/*',
      'aws-sdk',
    ],
  })
  .catch(() => process.exit(1));
