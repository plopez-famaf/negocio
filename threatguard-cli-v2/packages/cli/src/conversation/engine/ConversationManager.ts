import { Logger, generateCorrelationId } from '@threatguard/core';
import { NLProcessor } from './NLProcessor.js';
import { CommandMapper } from './CommandMapper.js';
import { ContextStore } from '../context/ContextStore.js';
import { SafetyValidator } from '../safety/SafetyValidator.js';
import { CommandBridge, CommandExecutionResult } from '../integration/CommandBridge.js';
import type { 
  ConversationContext, 
  SessionState, 
  Message, 
  MessageType,
  ContextualSuggestion,
  WorkflowState,
} from '../types/Context.js';
import type { Intent, NLParseResult } from '../types/Intent.js';
import type { ParsedCommand, SafetyValidation } from '../types/Command.js';

export interface ConversationManagerOptions {
  logger: Logger;
  contextStore: ContextStore;
  nlProcessor: NLProcessor;
  commandMapper: CommandMapper;
  safetyValidator: SafetyValidator;
  commandBridge: CommandBridge;
  maxHistoryLength?: number;
  defaultTimeout?: number;
}

export interface ConversationResult {
  response: string;
  command?: ParsedCommand;
  safetyValidation?: SafetyValidation;
  suggestions?: ContextualSuggestion[];
  requiresConfirmation?: boolean;
  confirmationPrompt?: string;
  context?: ConversationContext;
}

export class ConversationManager {
  private logger: Logger;
  private contextStore: ContextStore;
  private nlProcessor: NLProcessor;
  private commandMapper: CommandMapper;
  private safetyValidator: SafetyValidator;
  private commandBridge: CommandBridge;
  private maxHistoryLength: number;
  private defaultTimeout: number;

  constructor(options: ConversationManagerOptions) {
    this.logger = options.logger;
    this.contextStore = options.contextStore;
    this.nlProcessor = options.nlProcessor;
    this.commandMapper = options.commandMapper;
    this.safetyValidator = options.safetyValidator;
    this.commandBridge = options.commandBridge;
    this.maxHistoryLength = options.maxHistoryLength || 100;
    this.defaultTimeout = options.defaultTimeout || 30000;
  }

  /**
   * Process a natural language input and return conversation result
   */
  async processInput(
    sessionId: string, 
    input: string, 
    userId?: string
  ): Promise<ConversationResult> {
    const correlationId = generateCorrelationId();
    const processingLogger = this.logger.withCorrelation(correlationId);

    processingLogger.info('Processing conversation input', {
      sessionId,
      userId,
      inputLength: input.length,
    });

    try {
      // Get or create session context
      let context = await this.contextStore.getContext(sessionId);
      if (!context) {
        processingLogger.info('Creating new conversation session', { sessionId });
        await this.createNewSession(sessionId, userId);
        context = await this.contextStore.getContext(sessionId);
      }

      if (!context) {
        throw new Error('Failed to create conversation context');
      }

      // Add user message to history
      const userMessage = await this.contextStore.addMessage(sessionId, {
        type: 'user_input',
        content: input,
      });

      // Process natural language input
      const parseResult = await this.nlProcessor.process(input, context);
      
      processingLogger.debug('NL processing result', {
        intent: parseResult.intent.type,
        confidence: parseResult.confidence,
        entitiesCount: parseResult.entities.length,
      });

      // Map to command if applicable
      let command: ParsedCommand | undefined;
      let safetyValidation: SafetyValidation | undefined;

      if (parseResult.intent.type !== 'conversation_unknown' && 
          parseResult.intent.type !== 'help_general') {
        
        command = await this.commandMapper.mapToCommand(parseResult, context);
        
        if (command) {
          safetyValidation = await this.safetyValidator.validateCommand(command, context);
          processingLogger.debug('Command mapped and validated', {
            command: command.previewCommand,
            safetyLevel: safetyValidation.safetyLevel,
            requiresConfirmation: safetyValidation.requiresConfirmation,
          });
        }
      }

      // Generate response and suggestions
      const response = await this.generateResponse(parseResult, command, context);
      const suggestions = await this.generateSuggestions(parseResult, context);

      // Update conversation context
      await this.updateConversationContext(sessionId, parseResult, command, userMessage);

      // Store assistant response
      const assistantMessage = await this.contextStore.addMessage(sessionId, {
        type: 'assistant_response',
        content: response,
        intent: parseResult.intent,
        command,
        metadata: {
          suggestions,
          safetyValidation,
          correlationId,
        },
      });

      const result: ConversationResult = {
        response,
        command,
        safetyValidation,
        suggestions,
        requiresConfirmation: safetyValidation?.requiresConfirmation || false,
        confirmationPrompt: safetyValidation?.requiresConfirmation 
          ? this.generateConfirmationPrompt(command!, safetyValidation)
          : undefined,
        context: await this.contextStore.getContext(sessionId),
      };

      processingLogger.info('Conversation processing completed', {
        hasCommand: !!command,
        requiresConfirmation: result.requiresConfirmation,
        suggestionsCount: suggestions.length,
      });

      return result;

    } catch (error) {
      processingLogger.error('Conversation processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Store error message
      await this.contextStore.addMessage(sessionId, {
        type: 'error_message',
        content: `I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { correlationId, error: error instanceof Error ? error.message : 'Unknown error' },
      });

      return {
        response: "I'm sorry, I encountered an error processing your request. Please try rephrasing or use 'help' for available commands.",
        suggestions: [
          {
            type: 'help',
            content: 'Type "help" to see available commands',
            reasoning: 'Error recovery suggestion',
            confidence: 1.0,
            actionable: true,
          },
        ],
      };
    }
  }

  /**
   * Confirm and execute a pending command
   */
  async confirmCommand(sessionId: string, confirmed: boolean): Promise<ConversationResult> {
    const context = await this.contextStore.getContext(sessionId);
    if (!context?.session.pendingConfirmation) {
      return {
        response: "No command is pending confirmation.",
      };
    }

    const command = context.session.pendingConfirmation as ParsedCommand;

    if (!confirmed) {
      // Clear pending confirmation
      await this.contextStore.updateContext(sessionId, {
        session: {
          ...context.session,
          pendingConfirmation: undefined,
        },
      });

      await this.contextStore.addMessage(sessionId, {
        type: 'system_message',
        content: 'Command execution cancelled.',
      });

      return {
        response: "Command execution cancelled. Is there anything else I can help you with?",
        suggestions: await this.generateSuggestions({ intent: { type: 'help_general' } } as any, context),
      };
    }

    // Execute the command through CommandBridge
    this.logger.info('Executing confirmed command', {
      sessionId,
      command: command.previewCommand,
    });

    const safetyValidation = await this.safetyValidator.validateCommand(command, context);
    const executionResult = await this.commandBridge.executeCommand(command, safetyValidation, context);

    // Clear pending confirmation and update context
    await this.contextStore.updateContext(sessionId, {
      session: {
        ...context.session,
        pendingConfirmation: undefined,
        lastActivity: new Date().toISOString(),
      },
    });

    // Store execution message
    await this.contextStore.addMessage(sessionId, {
      type: 'command_execution',
      content: `Executed: ${command.previewCommand}`,
      command,
      executionResult,
    });

    const responseText = executionResult.success
      ? `✅ Command executed successfully!\n\n${executionResult.output}`
      : `❌ Command execution failed:\n\n${executionResult.error || 'Unknown error'}`;

    return {
      response: responseText,
      suggestions: await this.generateSuggestions({ intent: { type: 'conversation_continue' } } as any, context),
    };
  }

  /**
   * Get conversation history for a session
   */
  async getHistory(sessionId: string, limit?: number): Promise<Message[]> {
    return this.contextStore.getMessages(sessionId, limit || this.maxHistoryLength);
  }

  /**
   * Clear conversation history
   */
  async clearHistory(sessionId: string): Promise<void> {
    this.logger.info('Clearing conversation history', { sessionId });
    
    // Keep the session but clear messages
    await this.contextStore.updateContext(sessionId, {
      messages: [],
      recentIntents: [],
      recentEntities: [],
      recentCommands: [],
    });
  }

  /**
   * Create a new conversation session
   */
  private async createNewSession(sessionId: string, userId?: string): Promise<SessionState> {
    const session = await this.contextStore.createSession(userId);
    
    // Initialize with welcome message
    await this.contextStore.addMessage(sessionId, {
      type: 'system_message',
      content: "Hello! I'm your ThreatGuard AI assistant. I can help you with threat detection, security analysis, and system monitoring. Try asking me something like 'scan my network for threats' or 'show system status'.",
    });

    this.logger.info('Created new conversation session', { sessionId, userId });
    return session;
  }

  /**
   * Generate natural language response
   */
  private async generateResponse(
    parseResult: NLParseResult, 
    command: ParsedCommand | undefined,
    context: ConversationContext
  ): Promise<string> {
    const { intent, confidence } = parseResult;

    // Handle low confidence or unclear intent
    if (confidence === 'very_low' || confidence === 'low') {
      return this.generateClarificationResponse(parseResult);
    }

    // Handle specific intent types
    switch (intent.type) {
      case 'conversation_unknown':
        return "I'm not sure I understand. Could you try rephrasing that? You can ask me to scan for threats, check system status, or type 'help' for available commands.";

      case 'help_general':
        return this.generateHelpResponse(context);

      case 'auth_status':
        return `Let me check your authentication status...${command ? `\n\nI'll run: \`${command.previewCommand}\`` : ''}`;

      case 'system_status':
        return `I'll check the system status for you...${command ? `\n\nRunning: \`${command.previewCommand}\`` : ''}`;

      case 'threat_scan':
        return this.generateThreatScanResponse(command, parseResult);

      case 'threat_list':
        return `I'll retrieve the threat information you requested...${command ? `\n\nExecuting: \`${command.previewCommand}\`` : ''}`;

      case 'threat_watch':
        return `Starting real-time threat monitoring...${command ? `\n\nCommand: \`${command.previewCommand}\`` : ''}`;

      case 'interactive_start':
      case 'dashboard_open':
        return `I'll launch the interactive dashboard for you...${command ? `\n\nStarting: \`${command.previewCommand}\`` : ''}`;

      default:
        if (command) {
          return `I understand you want to ${intent.type.replace('_', ' ')}. ${command.description || ''}\n\nI'll execute: \`${command.previewCommand}\``;
        }
        return `I understand you want to ${intent.type.replace('_', ' ')}, but I need more information to help you with that.`;
    }
  }

  /**
   * Generate contextual suggestions
   */
  private async generateSuggestions(
    parseResult: NLParseResult, 
    context: ConversationContext
  ): Promise<ContextualSuggestion[]> {
    const suggestions: ContextualSuggestion[] = [];
    const { intent } = parseResult;

    // Always suggest help if user seems confused
    if (parseResult.confidence === 'very_low' || parseResult.confidence === 'low') {
      suggestions.push({
        type: 'help',
        content: 'Type "help" for available commands',
        reasoning: 'Low confidence in understanding user intent',
        confidence: 1.0,
        actionable: true,
      });
    }

    // Intent-specific suggestions
    switch (intent.type) {
      case 'threat_scan':
        suggestions.push(
          {
            type: 'command',
            content: 'monitor threats in real-time',
            reasoning: 'After scanning, users often want to monitor',
            confidence: 0.8,
            actionable: true,
          },
          {
            type: 'workflow',
            content: 'Would you like me to guide you through a complete security assessment?',
            reasoning: 'Threat scanning is often part of larger workflow',
            confidence: 0.7,
            actionable: true,
          }
        );
        break;

      case 'auth_status':
        if (context.session.authenticationStatus === 'unauthenticated') {
          suggestions.push({
            type: 'command',
            content: 'log in to access threat detection features',
            reasoning: 'User needs authentication for full functionality',
            confidence: 0.9,
            actionable: true,
          });
        }
        break;

      case 'system_status':
        suggestions.push(
          {
            type: 'command',
            content: 'check for active threats',
            reasoning: 'System status often leads to threat checking',
            confidence: 0.7,
            actionable: true,
          },
          {
            type: 'command',
            content: 'open the interactive dashboard',
            reasoning: 'Dashboard provides comprehensive system view',
            confidence: 0.6,
            actionable: true,
          }
        );
        break;
    }

    // Recent context suggestions
    if (context.recentCommands.length > 0) {
      const lastCommand = context.recentCommands[0];
      if (lastCommand.includes('scan') && !lastCommand.includes('watch')) {
        suggestions.push({
          type: 'command',
          content: 'start real-time monitoring',
          reasoning: 'Follow up scan with monitoring',
          confidence: 0.6,
          actionable: true,
        });
      }
    }

    return suggestions.slice(0, 3); // Limit to top 3 suggestions
  }

  /**
   * Generate help response
   */
  private generateHelpResponse(context: ConversationContext): string {
    const isAuthenticated = context.session.authenticationStatus === 'authenticated';
    
    let help = "I can help you with cybersecurity operations. Here are some things you can ask me:\n\n";
    
    if (!isAuthenticated) {
      help += "🔐 **Authentication:**\n";
      help += "- 'check my authentication status'\n";
      help += "- 'log me in'\n\n";
    }
    
    help += "🛡️ **Threat Detection:**\n";
    help += "- 'scan my network for threats'\n";
    help += "- 'show me critical alerts'\n";
    help += "- 'monitor threats in real-time'\n\n";
    
    help += "📊 **System Monitoring:**\n";
    help += "- 'check system status'\n";
    help += "- 'open dashboard'\n";
    help += "- 'show system health'\n\n";
    
    help += "You can speak naturally - I understand context and will help guide you through security operations!";
    
    return help;
  }

  /**
   * Generate threat scan response
   */
  private generateThreatScanResponse(command: ParsedCommand | undefined, parseResult: NLParseResult): string {
    if (!command) {
      return "I'd be happy to help you scan for threats! However, I need to know what you'd like to scan. You can specify:\n\n" +
             "- IP addresses (e.g., '192.168.1.1')\n" +
             "- Network ranges (e.g., '192.168.1.0/24')\n" +
             "- Domains (e.g., 'example.com')\n" +
             "- Or just say 'scan my network' for local network scanning";
    }

    let response = "I'll perform a security scan for you. ";
    
    const entities = parseResult.entities;
    const targets = entities.filter(e => ['ip_address', 'network_range', 'domain'].includes(e.type));
    const scanType = entities.find(e => e.type === 'scan_type');
    
    if (targets.length > 0) {
      response += `Targeting: ${targets.map(t => t.value).join(', ')}. `;
    }
    
    if (scanType) {
      response += `Performing a ${scanType.value} scan. `;
    }
    
    response += `\n\nCommand to execute: \`${command.previewCommand}\``;
    
    if (command.requiresConfirmation) {
      response += "\n\n⚠️ This scan will actively probe the specified targets. Please confirm you want to proceed.";
    }
    
    return response;
  }

  /**
   * Generate clarification response for unclear input
   */
  private generateClarificationResponse(parseResult: NLParseResult): string {
    if (parseResult.clarificationPrompt) {
      return parseResult.clarificationPrompt;
    }
    
    return "I'm not quite sure what you're asking for. Could you be more specific? " +
           "For example, you could say:\n" +
           "- 'scan my network for threats'\n" +
           "- 'show system status'\n" +
           "- 'list critical alerts'\n" +
           "- 'help with threat detection'";
  }

  /**
   * Generate confirmation prompt for commands requiring approval
   */
  private generateConfirmationPrompt(command: ParsedCommand, safety: SafetyValidation): string {
    let prompt = `⚠️ **Confirmation Required**\n\n`;
    prompt += `Command: \`${command.previewCommand}\`\n`;
    prompt += `Safety Level: ${safety.safetyLevel.toUpperCase()}\n\n`;
    
    if (safety.potentialRisks.length > 0) {
      prompt += `**Potential Risks:**\n`;
      safety.potentialRisks.forEach(risk => {
        prompt += `- ${risk}\n`;
      });
      prompt += `\n`;
    }
    
    if (command.description) {
      prompt += `**What this will do:** ${command.description}\n\n`;
    }
    
    prompt += `Do you want to proceed? (yes/no)`;
    
    return prompt;
  }

  /**
   * Update conversation context with new information
   */
  private async updateConversationContext(
    sessionId: string,
    parseResult: NLParseResult,
    command: ParsedCommand | undefined,
    userMessage: Message
  ): Promise<void> {
    const context = await this.contextStore.getContext(sessionId);
    if (!context) return;

    const updates: Partial<ConversationContext> = {
      session: {
        ...context.session,
        lastActivity: new Date().toISOString(),
        currentTopic: parseResult.intent.type,
        activeCommand: command?.command,
        pendingConfirmation: command?.requiresConfirmation ? command : undefined,
      },
    };

    // Update recent intents (keep last 5)
    const recentIntents = [parseResult.intent.type, ...context.recentIntents].slice(0, 5);
    updates.recentIntents = recentIntents;

    // Update recent entities
    if (parseResult.entities.length > 0) {
      const recentEntities = [...parseResult.entities, ...context.recentEntities].slice(0, 10);
      updates.recentEntities = recentEntities;
    }

    // Update recent commands if applicable
    if (command) {
      const recentCommands = [command.previewCommand, ...context.recentCommands].slice(0, 5);
      updates.recentCommands = recentCommands;
    }

    // Update total interactions
    updates.totalInteractions = (context.totalInteractions || 0) + 1;

    await this.contextStore.updateContext(sessionId, updates);
  }
}