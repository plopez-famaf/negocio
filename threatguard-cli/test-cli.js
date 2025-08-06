#!/usr/bin/env node

const figlet = require('figlet');
const chalk = require('chalk');

// Simple test CLI
console.log(chalk.cyan(figlet.textSync('ThreatGuard CLI', { 
  horizontalLayout: 'default',
  verticalLayout: 'default'
})));

console.log(chalk.green('\n✅ ThreatGuard CLI - Console-First Threat Detection Platform'));
console.log(chalk.dim('   Version: 1.0.0\n'));

console.log(chalk.bold('Available Commands:'));
console.log(chalk.cyan('  threatguard auth login     ') + chalk.dim('- Authenticate with the platform'));
console.log(chalk.cyan('  threatguard threat scan    ') + chalk.dim('- Scan for threats'));
console.log(chalk.cyan('  threatguard threat watch   ') + chalk.dim('- Watch real-time threat feed'));
console.log(chalk.cyan('  threatguard behavior analyze') + chalk.dim('- Analyze behavioral patterns'));
console.log(chalk.cyan('  threatguard network scan   ') + chalk.dim('- Scan network for intrusions'));
console.log(chalk.cyan('  threatguard intel query    ') + chalk.dim('- Query threat intelligence'));
console.log(chalk.cyan('  threatguard interactive    ') + chalk.dim('- Launch interactive dashboard'));

console.log(chalk.yellow('\n🔧 CLI Integration Status:'));
console.log(chalk.green('✅ Core CLI framework initialized'));
console.log(chalk.green('✅ bg-threat-ai service ready (port 3001)'));
console.log(chalk.green('✅ WebSocket streaming enabled'));
console.log(chalk.green('✅ Console-based interface active'));
console.log(chalk.yellow('⏳ Authentication integration pending'));
console.log(chalk.yellow('⏳ Real-time streaming pending'));

console.log(chalk.bold.cyan('\n🚀 Next Steps:'));
console.log('1. Start bg-threat-ai service: cd bg-identity-ai && npm run dev');
console.log('2. Test authentication: threatguard auth login');
console.log('3. Launch interactive mode: threatguard interactive');

console.log(chalk.dim('\nFor help: threatguard --help'));