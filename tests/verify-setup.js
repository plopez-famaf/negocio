#!/usr/bin/env node

/**
 * Quick setup verification script
 * Checks that the testing environment is properly configured
 */

const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

console.log(chalk.bold.cyan('🔧 ThreatGuard Testing Suite Setup Verification\n'));

// Check test files
const requiredFiles = [
  './integration/api-endpoints.test.js',
  './integration/websocket-communication.test.js',
  './e2e/cli-service-integration.test.js',
  './utils/test-helpers.js',
  './run-all-tests.js',
  './package.json',
  './README.md'
];

console.log(chalk.yellow('📁 Checking test files...'));
let allFilesExist = true;

requiredFiles.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    console.log(chalk.green(`✅ ${file}`));
  } else {
    console.log(chalk.red(`❌ ${file} - MISSING`));
    allFilesExist = false;
  }
});

// Check executability
console.log(chalk.yellow('\n⚙️  Checking script permissions...'));
const executableFiles = [
  './run-all-tests.js',
  './integration/api-endpoints.test.js',
  './integration/websocket-communication.test.js',
  './e2e/cli-service-integration.test.js'
];

executableFiles.forEach(file => {
  const fullPath = path.join(__dirname, file);
  try {
    fs.accessSync(fullPath, fs.constants.X_OK);
    console.log(chalk.green(`✅ ${file} - executable`));
  } catch (error) {
    console.log(chalk.yellow(`⚠️  ${file} - not executable (run: chmod +x ${file})`));
  }
});

// Check dependencies
console.log(chalk.yellow('\n📦 Checking dependencies...'));
const requiredModules = ['axios', 'socket.io-client', 'jsonwebtoken', 'chalk'];
let allDepsAvailable = true;

requiredModules.forEach(module => {
  try {
    require.resolve(module);
    console.log(chalk.green(`✅ ${module}`));
  } catch (error) {
    console.log(chalk.red(`❌ ${module} - run: npm install`));
    allDepsAvailable = false;
  }
});

// Check Node.js version
console.log(chalk.yellow('\n🔍 Environment check...'));
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion >= 16) {
  console.log(chalk.green(`✅ Node.js ${nodeVersion}`));
} else {
  console.log(chalk.red(`❌ Node.js ${nodeVersion} - requires 16+`));
  allFilesExist = false;
}

// Summary
console.log(chalk.bold.cyan('\n📊 Setup Verification Summary'));
console.log(chalk.dim('================================'));

if (allFilesExist && allDepsAvailable) {
  console.log(chalk.bold.green('🎉 SETUP COMPLETE!'));
  console.log(chalk.cyan('\n🚀 Ready to run tests:'));
  console.log(chalk.dim('   npm test                  # Run all tests'));
  console.log(chalk.dim('   npm run test:api          # API endpoint tests'));  
  console.log(chalk.dim('   npm run test:websocket    # WebSocket tests'));
  console.log(chalk.dim('   npm run test:cli          # CLI integration tests'));
  
  console.log(chalk.yellow('\n⚠️  Prerequisites:'));
  console.log(chalk.dim('   • Start bg-threat-ai service: cd bg-identity-ai && npm run dev'));
  console.log(chalk.dim('   • Verify service health: curl http://localhost:3001/health'));
  
} else {
  console.log(chalk.red('❌ SETUP INCOMPLETE'));
  console.log(chalk.yellow('\n🔧 Required actions:'));
  
  if (!allFilesExist) {
    console.log(chalk.dim('   • Some test files are missing'));
  }
  
  if (!allDepsAvailable) {
    console.log(chalk.dim('   • Run: npm install'));
  }
  
  console.log(chalk.dim('   • Fix issues above and run this script again'));
}

console.log(chalk.dim('\nFor detailed information, see: tests/README.md'));
console.log(chalk.dim('================================\n'));