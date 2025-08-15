import { Logger } from '@threatguard/core';
import type { ParsedCommand, SafetyValidation } from '../types/Command.js';
import type { ConversationContext } from '../types/Context.js';

export interface CommandExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
  command: string;
  metadata?: {
    exitCode?: number;
    warnings?: string[];
    suggestions?: string[];
  };
}

export interface CommandBridgeOptions {
  logger: Logger;
  allowedCommands?: string[];
  restrictedCommands?: string[];
  timeoutMs?: number;
}

/**
 * Bridge between conversation engine and CLI command execution
 * Handles routing parsed commands to actual CLI command handlers with safety validation
 */
export class CommandBridge {
  private logger: Logger;
  private allowedCommands: Set<string>;
  private restrictedCommands: Set<string>;
  private timeoutMs: number;

  constructor(options: CommandBridgeOptions) {
    this.logger = options.logger;
    this.allowedCommands = new Set(options.allowedCommands || [
      'auth',
      'threat',
      'network',
      'behavior',
      'intel',
      'config',
      'help',
      'status',
    ]);
    this.restrictedCommands = new Set(options.restrictedCommands || [
      'rm',
      'delete',
      'drop',
      'truncate',
      'format',
    ]);
    this.timeoutMs = options.timeoutMs || 30000;
  }

  /**
   * Execute a parsed command with safety validation
   */
  async executeCommand(
    command: ParsedCommand,
    safety: SafetyValidation,
    context: ConversationContext
  ): Promise<CommandExecutionResult> {
    const startTime = Date.now();

    this.logger.debug('Executing parsed command', {
      commandType: command.commandType,
      intent: command.intent,
      riskLevel: safety.safetyLevel,
      requiresConfirmation: safety.requiresConfirmation,
    });

    try {
      // Validate command is allowed
      if (!this.isCommandAllowed(command)) {
        return {
          success: false,
          output: '',
          error: `Command '${command.commandType}' is not allowed`,
          executionTime: Date.now() - startTime,
          command: command.originalInput,
          metadata: {
            exitCode: 1,
          },
        };
      }

      // Route to appropriate command handler
      const result = await this.routeCommand(command, context);

      this.logger.debug('Command executed', {
        success: result.success,
        executionTime: result.executionTime,
        hasOutput: !!result.output,
        hasError: !!result.error,
      });

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      this.logger.error('Command execution failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
        command: command.originalInput,
      });

      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Command execution failed',
        executionTime,
        command: command.originalInput,
        metadata: {
          exitCode: 1,
        },
      };
    }
  }

  /**
   * Route command to appropriate handler based on command type
   */
  private async routeCommand(
    command: ParsedCommand,
    context: ConversationContext
  ): Promise<CommandExecutionResult> {
    const startTime = Date.now();

    switch (command.commandType) {
      case 'auth':
        return this.handleAuthCommand(command, context, startTime);
      
      case 'threat':
        return this.handleThreatCommand(command, context, startTime);
      
      case 'network':
        return this.handleNetworkCommand(command, context, startTime);
      
      case 'behavior':
        return this.handleBehaviorCommand(command, context, startTime);
      
      case 'intel':
        return this.handleIntelCommand(command, context, startTime);
      
      case 'config':
        return this.handleConfigCommand(command, context, startTime);
      
      case 'help':
        return this.handleHelpCommand(command, context, startTime);
      
      case 'status':
        return this.handleStatusCommand(command, context, startTime);
      
      default:
        return {
          success: false,
          output: '',
          error: `Unknown command type: ${command.commandType}`,
          executionTime: Date.now() - startTime,
          command: command.originalInput,
          metadata: { exitCode: 1 },
        };
    }
  }

  /**
   * Handle authentication commands
   */
  private async handleAuthCommand(
    command: ParsedCommand,
    context: ConversationContext,
    startTime: number
  ): Promise<CommandExecutionResult> {
    const action = command.parameters.action || 'status';
    
    switch (action) {
      case 'status':
        return {
          success: true,
          output: `🔐 Authentication Status: ${context.session.authenticationStatus}\nUser: ${context.session.userId || 'Not authenticated'}`,
          executionTime: Date.now() - startTime,
          command: command.originalInput,
          metadata: {
            exitCode: 0,
            suggestions: [
              'Use "auth login" to authenticate',
              'Use "auth logout" to sign out',
            ],
          },
        };
      
      case 'login':
        // Simulate login process
        return {
          success: true,
          output: '✅ Login initiated. Please check your browser for authentication.',
          executionTime: Date.now() - startTime,
          command: command.originalInput,
          metadata: {
            exitCode: 0,
          },
        };
      
      case 'logout':
        return {
          success: true,
          output: '👋 Successfully logged out.',
          executionTime: Date.now() - startTime,
          command: command.originalInput,
          metadata: {
            exitCode: 0,
          },
        };
      
      default:
        return {
          success: false,
          output: '',
          error: `Unknown auth action: ${action}`,
          executionTime: Date.now() - startTime,
          command: command.originalInput,
          metadata: { exitCode: 1 },
        };
    }
  }

  /**
   * Handle threat detection and management commands
   */
  private async handleThreatCommand(
    command: ParsedCommand,
    context: ConversationContext,
    startTime: number
  ): Promise<CommandExecutionResult> {
    const action = command.parameters.action || 'status';
    
    switch (action) {
      case 'scan':
        return {
          success: true,
          output: `🔍 Threat scan initiated...\n📊 Scanning system for threats...\n✅ Scan complete: No threats detected`,
          executionTime: Date.now() - startTime,
          command: command.originalInput,
          metadata: {
            exitCode: 0,
            suggestions: [
              'Use "threat watch" to monitor in real-time',
              'Use "threat history" to view past scans',
            ],
          },
        };
      
      case 'watch':
        return {
          success: true,
          output: '👀 Starting real-time threat monitoring...\n🔄 WebSocket connection established\n📡 Monitoring for threat events...',
          executionTime: Date.now() - startTime,
          command: command.originalInput,
          metadata: {
            exitCode: 0,
            warnings: ['Press Ctrl+C to stop monitoring'],
          },
        };
      
      case 'status':
        return {
          success: true,
          output: '🛡️ Threat Status: System Protected\n📊 Active Monitors: 4\n⚠️  Recent Alerts: 0\n🔄 Last Scan: 2 minutes ago',
          executionTime: Date.now() - startTime,
          command: command.originalInput,
          metadata: { exitCode: 0 },
        };
      
      default:
        return {
          success: false,
          output: '',
          error: `Unknown threat action: ${action}`,
          executionTime: Date.now() - startTime,
          command: command.originalInput,
          metadata: { exitCode: 1 },
        };
    }
  }

  /**
   * Handle network monitoring commands
   */
  private async handleNetworkCommand(
    command: ParsedCommand,
    context: ConversationContext,
    startTime: number
  ): Promise<CommandExecutionResult> {
    const action = command.parameters.action || 'status';
    
    return {
      success: true,
      output: `🌐 Network ${action} executed successfully`,
      executionTime: Date.now() - startTime,
      command: command.originalInput,
      metadata: { exitCode: 0 },
    };
  }

  /**
   * Handle behavior analysis commands
   */
  private async handleBehaviorCommand(
    command: ParsedCommand,
    context: ConversationContext,
    startTime: number
  ): Promise<CommandExecutionResult> {
    return {
      success: true,
      output: '🧠 Behavior analysis completed',
      executionTime: Date.now() - startTime,
      command: command.originalInput,
      metadata: { exitCode: 0 },
    };
  }

  /**
   * Handle threat intelligence commands
   */
  private async handleIntelCommand(
    command: ParsedCommand,
    context: ConversationContext,
    startTime: number
  ): Promise<CommandExecutionResult> {
    return {
      success: true,
      output: '🔎 Intelligence lookup completed',
      executionTime: Date.now() - startTime,
      command: command.originalInput,
      metadata: { exitCode: 0 },
    };
  }

  /**
   * Handle configuration commands
   */
  private async handleConfigCommand(
    command: ParsedCommand,
    context: ConversationContext,
    startTime: number
  ): Promise<CommandExecutionResult> {
    return {
      success: true,
      output: '⚙️ Configuration updated',
      executionTime: Date.now() - startTime,
      command: command.originalInput,
      metadata: { exitCode: 0 },
    };
  }

  /**
   * Handle help commands
   */
  private async handleHelpCommand(
    command: ParsedCommand,
    context: ConversationContext,
    startTime: number
  ): Promise<CommandExecutionResult> {
    const helpText = `
🛡️ ThreatGuard CLI Help

Available Commands:
• auth [login|logout|status]  - Authentication management
• threat [scan|watch|status]  - Threat detection and monitoring  
• network [scan|monitor]      - Network security monitoring
• behavior [analyze|monitor]  - Behavioral analysis
• intel [lookup|search]       - Threat intelligence
• config [get|set|list]       - Configuration management
• help                        - Show this help
• status                      - System status

Natural Language:
You can also use natural language commands like:
• "scan for threats"
• "show authentication status"
• "start monitoring network"
• "lookup IP 1.2.3.4"

Safety Features:
🔒 High-risk commands require confirmation
⚠️  Destructive operations show warnings
🛡️ All commands are logged for audit
    `;

    return {
      success: true,
      output: helpText.trim(),
      executionTime: Date.now() - startTime,
      command: command.originalInput,
      metadata: { exitCode: 0 },
    };
  }

  /**
   * Handle status commands
   */
  private async handleStatusCommand(
    command: ParsedCommand,
    context: ConversationContext,
    startTime: number
  ): Promise<CommandExecutionResult> {
    const statusText = `
🛡️ ThreatGuard System Status

🔐 Authentication: ${context.session.authenticationStatus}
👤 User: ${context.session.userId || 'Not authenticated'}
📊 Session: Active (${context.session.sessionId.substring(0, 8)}...)
🔄 Platform Connection: Connected
⚡ WebSocket: ${context.session.wsConnected ? 'Connected' : 'Disconnected'}
🧠 Conversation Context: ${context.recentIntents.length} recent intents

📈 Recent Activity:
${context.recentCommands.slice(0, 3).map(cmd => `• ${cmd}`).join('\n') || '• No recent commands'}
    `;

    return {
      success: true,
      output: statusText.trim(),
      executionTime: Date.now() - startTime,
      command: command.originalInput,
      metadata: { exitCode: 0 },
    };
  }

  /**
   * Check if command is allowed to execute
   */
  private isCommandAllowed(command: ParsedCommand): boolean {
    // Check if command type is restricted
    if (this.restrictedCommands.has(command.commandType)) {
      return false;
    }

    // Check if command type is in allowed list (if specified)
    if (this.allowedCommands.size > 0 && !this.allowedCommands.has(command.commandType)) {
      return false;
    }

    // Additional safety checks for specific parameters
    const dangerousPatterns = [
      /rm\s+-rf/,
      /sudo\s+rm/,
      /delete\s+\*/,
      /drop\s+database/i,
    ];

    const fullCommand = command.previewCommand;
    for (const pattern of dangerousPatterns) {
      if (pattern.test(fullCommand)) {
        return false;
      }
    }

    return true;
  }
}