import { Logger, ConfigManager } from '@threatguard/core';
import { ChatManager, ChatManagerOptions } from '../interface/ChatManager.js';
import { ConversationManager } from '../engine/ConversationManager.js';
import { ContextStore } from '../context/ContextStore.js';
import { ResponseGenerator } from '../interface/ResponseGenerator.js';
import { SuggestionEngine } from '../interface/SuggestionEngine.js';
import { NLProcessor } from '../engine/NLProcessor.js';
import { CommandMapper } from '../engine/CommandMapper.js';
import { SafetyValidator } from '../safety/SafetyValidator.js';
import { CommandBridge } from './CommandBridge.js';
import { AutocompletionEngine } from '../ui/AutocompletionEngine.js';
import { APIClient } from '../../services/api.js';
import { WebSocketClient } from '../../services/websocket.js';

export interface ChatManagerFactoryOptions {
  configManager: ConfigManager;
  logger: Logger;
  apiClient: APIClient;
  wsClient: WebSocketClient;
  options?: {
    autoSuggestionsEnabled?: boolean;
    confirmationTimeout?: number;
    maxConcurrentSessions?: number;
    enableAutocompletion?: boolean;
    autocompletionMaxCandidates?: number;
  };
}

export interface ChatManagerFactoryResult {
  chatManager: ChatManager;
  autocompletionEngine?: AutocompletionEngine;
}

/**
 * Factory for creating ChatManager instances with all required dependencies
 * Handles complex initialization and dependency injection for conversational CLI
 */
export class ChatManagerFactory {
  
  /**
   * Create a fully configured ChatManager instance with optional autocompletion
   */
  static async create(factoryOptions: ChatManagerFactoryOptions): Promise<ChatManagerFactoryResult> {
    const { configManager, logger, apiClient, wsClient, options = {} } = factoryOptions;

    logger.debug('Initializing ChatManager dependencies...');

    try {
      // Initialize ContextStore with persistence
      const contextStore = new ContextStore({
        logger: logger.child({ component: 'ContextStore' }),
        persistencePath: configManager.getContextStorePath?.() || './.threatguard-context',
        maxSessions: options.maxConcurrentSessions || 100,
      });

      // Initialize core conversation processing components
      const nlProcessor = new NLProcessor({
        logger: logger.child({ component: 'NLProcessor' }),
        apiClient,
        contextDepth: 5,
        confidenceThreshold: 0.7,
      });

      const commandMapper = new CommandMapper({
        logger: logger.child({ component: 'CommandMapper' }),
        apiClient,
        commandTemplates: configManager.getCommandTemplates?.() || {},
      });

      const safetyValidator = new SafetyValidator({
        logger: logger.child({ component: 'SafetyValidator' }),
        strictMode: true,
        requireConfirmationForHighRisk: true,
        maxRiskLevel: 'critical',
      });

      const commandBridge = new CommandBridge({
        logger: logger.child({ component: 'CommandBridge' }),
        allowedCommands: ['auth', 'threat', 'network', 'behavior', 'intel', 'config', 'help', 'status'],
        restrictedCommands: ['rm', 'delete', 'drop', 'truncate', 'format'],
        timeoutMs: options.confirmationTimeout || 30000,
      });

      // Initialize ConversationManager with all processing components
      const conversationManager = new ConversationManager({
        logger: logger.child({ component: 'ConversationManager' }),
        contextStore,
        nlProcessor,
        commandMapper,
        safetyValidator,
        commandBridge,
        maxHistoryLength: 100,
        defaultTimeout: options.confirmationTimeout || 30000,
      });

      // Initialize ResponseGenerator with templates and CLI context
      const responseGenerator = new ResponseGenerator({
        logger: logger.child({ component: 'ResponseGenerator' }),
        templatesPath: configManager.getTemplatesPath?.() || './templates',
        contextAware: true,
        includeMetadata: true,
        userPreferences: {
          verbosity: configManager.getVerbosity?.() || 'normal',
          format: 'terminal',
          includeExplanations: true,
          includeSuggestions: options.autoSuggestionsEnabled !== false,
        },
      });

      // Initialize SuggestionEngine with CLI commands and threat intelligence
      const suggestionEngine = new SuggestionEngine({
        logger: logger.child({ component: 'SuggestionEngine' }),
        apiClient,
        maxSuggestions: 8,
        categories: [
          'threat_detection',
          'network_monitoring',
          'behavior_analysis',
          'intel_lookup',
          'system_config',
          'help_support',
        ],
        contextDepth: 5,
        learningEnabled: true,
      });

      // Create ChatManager with all dependencies
      const chatManagerOptions: ChatManagerOptions = {
        logger: logger.child({ component: 'ChatManager' }),
        conversationManager,
        contextStore,
        responseGenerator,
        suggestionEngine,
        autoSuggestionsEnabled: options.autoSuggestionsEnabled !== false,
        confirmationTimeout: options.confirmationTimeout || 30000,
        maxConcurrentSessions: options.maxConcurrentSessions || 100,
      };

      const chatManager = new ChatManager(chatManagerOptions);

      // Initialize AutocompletionEngine if enabled
      let autocompletionEngine: AutocompletionEngine | undefined;
      if (options.enableAutocompletion !== false) {
        autocompletionEngine = new AutocompletionEngine({
          logger: logger.child({ component: 'AutocompletionEngine' }),
          maxCandidates: options.autocompletionMaxCandidates || 10,
          confidenceThreshold: 0.3,
          enableLearning: true,
          cacheTimeout: 30000,
        });
      }

      logger.info('ChatManager initialized successfully', {
        autoSuggestions: chatManagerOptions.autoSuggestionsEnabled,
        confirmationTimeout: chatManagerOptions.confirmationTimeout,
        maxSessions: chatManagerOptions.maxConcurrentSessions,
        autocompletionEnabled: !!autocompletionEngine,
      });

      return { 
        chatManager, 
        autocompletionEngine 
      };

    } catch (error) {
      logger.error('Failed to initialize ChatManager', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw new Error(`ChatManager initialization failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`);
    }
  }

  /**
   * Create ChatManager for testing with mocked dependencies
   */
  static async createForTesting(
    logger: Logger,
    overrides: Partial<ChatManagerFactoryOptions> = {}
  ): Promise<ChatManager> {
    const mockConfigManager = {
      getContextStorePath: () => './.test-context',
      getTemplatesPath: () => './test-templates',
      getVerbosity: () => 'debug' as const,
    } as ConfigManager;

    const mockApiClient = {
      isConnected: () => true,
      close: async () => {},
    } as APIClient;

    const mockWsClient = {
      isConnected: () => false,
      disconnect: async () => {},
    } as WebSocketClient;

    return this.create({
      configManager: mockConfigManager,
      logger,
      apiClient: mockApiClient,
      wsClient: mockWsClient,
      options: {
        autoSuggestionsEnabled: true,
        confirmationTimeout: 5000, // Shorter for testing
        maxConcurrentSessions: 1,
      },
      ...overrides,
    });
  }

  /**
   * Validate ChatManager dependencies
   */
  static validateDependencies(factoryOptions: ChatManagerFactoryOptions): {
    valid: boolean;
    errors: string[];
  } {
    const { configManager, logger, apiClient, wsClient } = factoryOptions;
    const errors: string[] = [];

    if (!configManager) {
      errors.push('ConfigManager is required');
    }

    if (!logger) {
      errors.push('Logger is required');
    }

    if (!apiClient) {
      errors.push('APIClient is required');
    }

    if (!wsClient) {
      errors.push('WebSocketClient is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export default ChatManagerFactory;