#!/usr/bin/env node

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildPackage } from '../../../scripts/build.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packagePath = resolve(__dirname, '..');
const isProduction = process.argv.includes('--production') || process.env.NODE_ENV === 'production';

await buildPackage(packagePath, isProduction);