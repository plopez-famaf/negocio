#!/usr/bin/env node

import { build } from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Common build options for all packages
const createBuildOptions = (packagePath, isProduction = false) => {
  const packageJsonPath = resolve(packagePath, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  
  const dependencies = [
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.peerDependencies || {})
  ].filter(dep => !dep.startsWith('@threatguard/'));

  return {
    entryPoints: [resolve(packagePath, 'src/index.ts')],
    bundle: true,
    outdir: resolve(packagePath, 'dist'),
    format: 'esm',
    target: 'node20',
    platform: 'node',
    sourcemap: !isProduction,
    minify: isProduction,
    splitting: false,
    external: dependencies,
    banner: packageJson.bin ? {
      js: '#!/usr/bin/env node'
    } : undefined,
    define: {
      'process.env.NODE_ENV': isProduction ? '"production"' : '"development"'
    },
    logLevel: 'info'
  };
};

async function buildPackage(packagePath, isProduction = false) {
  console.log(`Building package: ${packagePath}`);
  
  try {
    const options = createBuildOptions(packagePath, isProduction);
    await build(options);
    console.log(`✅ Built ${packagePath} successfully`);
  } catch (error) {
    console.error(`❌ Failed to build ${packagePath}:`, error);
    process.exit(1);
  }
}

// Get package path from command line or build all
const args = process.argv.slice(2);
const packagePath = args[0];
const isProduction = args.includes('--production') || process.env.NODE_ENV === 'production';

if (packagePath) {
  // Build specific package
  await buildPackage(packagePath, isProduction);
} else {
  // Build all packages
  const packages = [
    resolve(__dirname, '../packages/core'),
    resolve(__dirname, '../packages/ui-components'),
    resolve(__dirname, '../packages/test-utils'),
    resolve(__dirname, '../packages/cli')
  ];
  
  for (const pkg of packages) {
    await buildPackage(pkg, isProduction);
  }
}

export { createBuildOptions, buildPackage };