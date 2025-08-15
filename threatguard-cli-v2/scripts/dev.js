#!/usr/bin/env node

import { context } from 'esbuild';
import { createBuildOptions } from './build.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function startDev(packagePath) {
  console.log(`Starting development server for: ${packagePath}`);
  
  try {
    const options = {
      ...createBuildOptions(packagePath, false),
      watch: {
        onRebuild(error, result) {
          if (error) {
            console.error(`❌ Rebuild failed:`, error);
          } else {
            console.log(`✅ Rebuilt ${packagePath} at ${new Date().toLocaleTimeString()}`);
          }
        }
      }
    };
    
    const ctx = await context(options);
    await ctx.watch();
    
    console.log(`🚀 Development server started for ${packagePath}`);
    console.log('Watching for changes...');
    
    // Keep the process alive
    process.on('SIGINT', async () => {
      console.log('\n👋 Shutting down development server...');
      await ctx.dispose();
      process.exit(0);
    });
    
  } catch (error) {
    console.error(`❌ Failed to start development server:`, error);
    process.exit(1);
  }
}

// Get package path from command line
const args = process.argv.slice(2);
const packagePath = args[0] || resolve(__dirname, '../packages/cli');

await startDev(packagePath);