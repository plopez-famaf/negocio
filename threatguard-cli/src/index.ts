#!/usr/bin/env node

import { Command } from 'commander';
import figlet from 'figlet';
import chalk from 'chalk';
import { logger } from '@/utils/logger';
import { configManager } from '@/utils/config';
import { setupAuthCommands } from '@/commands/auth';
import { setupThreatCommands } from '@/commands/threat';
import { setupBehaviorCommands } from '@/commands/behavior';
import { setupNetworkCommands } from '@/commands/network';
import { setupIntelCommands } from '@/commands/intel';
import { setupConfigCommands } from '@/commands/config';
import { startInteractiveMode } from '@/ui/interactive';

async function main() {
  const program = new Command();

  // Display banner
  console.log(chalk.cyan(figlet.textSync('ThreatGuard', { horizontalLayout: 'full' })));
  console.log(chalk.gray('Real-time Threat Detection & Behavioral Analysis Platform\n'));

  // Configure main program
  program
    .name('threatguard')
    .description('Console-based threat detection and behavioral analysis platform')
    .version('1.0.0')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('--api-url <url>', 'API base URL')
    .hook('preAction', (thisCommand) => {
      const options = thisCommand.opts();
      
      if (options.verbose) {
        process.env.DEBUG = 'true';
      }
      
      if (options.apiUrl) {
        configManager.set('apiUrl', options.apiUrl);
      }
    });

  // Setup command groups
  setupAuthCommands(program);
  setupThreatCommands(program);
  setupBehaviorCommands(program);
  setupNetworkCommands(program);
  setupIntelCommands(program);
  setupConfigCommands(program);

  // Interactive mode (no subcommand)
  program
    .action(async () => {
      // Check authentication
      if (!configManager.isAuthenticated()) {
        logger.warning('You are not authenticated. Please run: threatguard auth login');
        process.exit(1);
      }

      // Start interactive mode
      await startInteractiveMode();
    });

  // Parse arguments
  try {
    await program.parseAsync();
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Command failed: ${error.message}`);
    } else {
      logger.error('An unexpected error occurred');
    }
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${reason}`);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down gracefully...');
  process.exit(0);
});

// Run the CLI
if (require.main === module) {
  main();
}