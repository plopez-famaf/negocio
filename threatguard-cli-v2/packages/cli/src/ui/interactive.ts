import { createInterface } from 'readline';
import { stdin, stdout } from 'process';
import { ConfigManager, Logger } from '@threatguard/core';
import { formatSuccess, formatError, formatInfo } from './formatters.js';

export interface InteractiveSessionOptions {
  configManager: ConfigManager;
  logger: Logger;
}

export class InteractiveSession {
  private rl = createInterface({
    input: stdin,
    output: stdout,
    prompt: 'threatguard> ',
  });
  
  private configManager: ConfigManager;
  private logger: Logger;
  private running = false;

  constructor(options: InteractiveSessionOptions) {
    this.configManager = options.configManager;
    this.logger = options.logger;
  }

  async start(): Promise<void> {
    this.running = true;
    
    // Set up readline handlers
    this.rl.on('line', (input) => {
      this.handleCommand(input.trim());
    });

    this.rl.on('close', () => {
      this.stop();
    });

    // Display welcome message
    console.log(formatInfo('Interactive ThreatGuard CLI'));
    console.log('Available commands: help, status, auth, threat, exit');
    console.log('Use Tab for command completion\n');

    this.rl.prompt();

    // Keep session running
    return new Promise((resolve) => {
      this.rl.on('close', resolve);
    });
  }

  private async handleCommand(input: string): Promise<void> {
    if (!input) {
      this.rl.prompt();
      return;
    }

    // Add to command history
    this.configManager.addRecentCommand(input);

    const [command, ...args] = input.split(' ');

    try {
      switch (command.toLowerCase()) {
        case 'help':
          this.showHelp();
          break;
        case 'exit':
        case 'quit':
          this.stop();
          return;
        case 'status':
          console.log(formatInfo('System status check - Feature coming in Phase 3'));
          break;
        case 'auth':
          console.log(formatInfo('Authentication commands - Feature coming in Phase 3'));
          break;
        case 'threat':
          console.log(formatInfo('Threat management - Feature coming in Phase 3'));
          break;
        case 'clear':
          console.clear();
          break;
        default:
          console.log(formatError(`Unknown command: ${command}`));
          console.log('Type "help" for available commands');
      }
    } catch (error) {
      console.log(formatError(`Command failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      this.logger.error('Interactive command failed', { command, error });
    }

    this.rl.prompt();
  }

  private showHelp(): void {
    console.log(formatSuccess('Available Commands:'));
    console.log('  help          - Show this help message');
    console.log('  status        - Show system status');
    console.log('  auth          - Authentication commands');
    console.log('  threat        - Threat management');
    console.log('  clear         - Clear screen');
    console.log('  exit, quit    - Exit interactive mode');
    console.log('\nNote: Full interactive features coming in Phase 3');
  }

  stop(): void {
    if (this.running) {
      console.log(formatSuccess('\nGoodbye! 👋'));
      this.rl.close();
      this.running = false;
    }
  }
}