#!/usr/bin/env node

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packagePath = resolve(__dirname, '..');

// Start the development server
exec(`node ../../../scripts/dev.js ${packagePath}`, { stdio: 'inherit' });