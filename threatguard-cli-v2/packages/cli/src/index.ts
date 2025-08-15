#!/usr/bin/env node

import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';
import { CLI } from './cli.js';
import { logger, generateCorrelationId } from '@threatguard/core';
import chalk from 'chalk';
import figlet from 'figlet';

// Display banner
console.log(chalk.cyan(figlet.textSync('ThreatGuard', { horizontalLayout: 'full' })));
console.log(chalk.gray('Next-Generation Threat Detection & Behavioral Analysis Platform\n'));

async function main(): Promise<void> {
  // Generate correlation ID for this CLI session
  const correlationId = generateCorrelationId();
  const sessionLogger = logger.withCorrelation(correlationId);

  try {
    // Create CLI instance
    const cli = new CLI({
      logger: sessionLogger,
      version: '2.0.0',
    });

    // Set up global error handlers
    process.on('uncaughtException', (error) => {
      sessionLogger.error('Uncaught exception', { error: error.message, stack: error.stack });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      sessionLogger.error('Unhandled rejection', { 
        reason: reason instanceof Error ? reason.message : String(reason),
        promise: String(promise) 
      });
      process.exit(1);
    });

    // Handle graceful shutdown
    const gracefulShutdown = (signal: string) => {
      sessionLogger.info(`Received ${signal}, shutting down gracefully...`);
      process.exit(0);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    // Build CLI with yargs
    const argv = await yargs(hideBin(process.argv))
      .scriptName('threatguard')
      .usage('$0 <command> [options]')
      .version('2.0.0')
      .alias('version', 'v')
      .help()
      .alias('help', 'h')
      .demandCommand(1, 'You must specify a command. Use --help for available commands.')
      .recommendCommands()
      .strict()
      .completion('completion', 'Generate shell completion script')
      .option('verbose', {
        type: 'boolean',
        description: 'Enable verbose logging',
        global: true,
      })
      .option('quiet', {
        type: 'boolean',
        description: 'Suppress all output except errors',
        global: true,
      })
      .option('api-url', {
        type: 'string',
        description: 'Override API base URL',
        global: true,
      })
      .option('profile', {
        type: 'string',
        description: 'Use specific configuration profile',
        global: true,
      })
      .option('output', {
        choices: ['table', 'json', 'yaml', 'text'] as const,
        description: 'Output format',
        global: true,
        default: 'table' as const,
      })
      .option('no-color', {
        type: 'boolean',
        description: 'Disable colored output',
        global: true,
      })
      .middleware([
        // Global middleware to set up logging and configuration
        (argv) => {
          if (argv.verbose) {
            logger.setLevel('debug');
          }
          if (argv.quiet) {
            logger.setLevel('error');
          }
        },
      ])
      .command(cli.commands)
      .fail((msg, err, yargs) => {
        if (err) {
          sessionLogger.error('Command execution failed', { 
            error: err.message,
            stack: err.stack 
          });
        } else {
          sessionLogger.error('Command failed', { message: msg });
        }
        
        if (msg?.includes('Unknown argument') || msg?.includes('Missing required argument')) {
          yargs.showHelp();
        }
        
        process.exit(1);
      })
      .parseAsync();

    // Log successful completion for debugging
    sessionLogger.debug('CLI command completed successfully', { 
      command: argv._[0],
      correlationId 
    });

  } catch (error) {
    sessionLogger.error('CLI initialization failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

// Only run main if this is the entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}