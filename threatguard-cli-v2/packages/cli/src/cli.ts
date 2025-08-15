import { CommandModule } from 'yargs';
import { Logger } from '@threatguard/core';

// Import command modules
import { authCommands } from './commands/auth/index.js';
import { threatCommands } from './commands/threat/index.js';
import { behaviorCommands } from './commands/behavior/index.js';
import { networkCommands } from './commands/network/index.js';
import { intelCommands } from './commands/intel/index.js';
import { configCommands } from './commands/config/index.js';
import { interactiveCommand } from './commands/interactive/index.js';
import { statusCommand } from './commands/status/index.js';
import chatCommand from './commands/chat/index.js';

export interface CLIOptions {
  logger: Logger;
  version: string;
}

export interface GlobalArguments {
  verbose?: boolean;
  quiet?: boolean;
  'api-url'?: string;
  profile?: string;
  output?: 'table' | 'json' | 'yaml' | 'text';
  'no-color'?: boolean;
}

export class CLI {
  private logger: Logger;
  private version: string;
  public commands: CommandModule<{}, any>[];

  constructor(options: CLIOptions) {
    this.logger = options.logger;
    this.version = options.version;
    this.commands = this.initializeCommands();
  }

  private initializeCommands(): CommandModule<{}, any>[] {
    const commands: CommandModule<{}, any>[] = [];

    // Authentication commands
    commands.push(...authCommands);

    // Core feature commands
    commands.push(...threatCommands);
    commands.push(...behaviorCommands);
    commands.push(...networkCommands);
    commands.push(...intelCommands);

    // Configuration and utility commands
    commands.push(...configCommands);
    commands.push(statusCommand);
    commands.push(interactiveCommand);
    
    // Conversational interface
    commands.push(chatCommand);

    this.logger.debug('Initialized CLI commands', {
      commandCount: commands.length,
      commands: commands.map(cmd => cmd.command)
    });

    return commands;
  }

  getLogger(): Logger {
    return this.logger;
  }

  getVersion(): string {
    return this.version;
  }

  // Helper method for command handlers to access shared resources
  createCommandContext(globalArgs: GlobalArguments) {
    return {
      logger: this.logger,
      version: this.version,
      globalArgs,
    };
  }
}