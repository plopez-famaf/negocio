import { Logger, generateCorrelationId } from '@threatguard/core';
import type { ConversationContext, SessionState } from '../types/Context.js';
import type { NLParseResult } from '../types/Intent.js';
import type { ParsedCommand, SafetyValidation } from '../types/Command.js';
import { ConversationManager } from '../engine/ConversationManager.js';
import { ContextStore } from '../context/ContextStore.js';
import { ResponseGenerator } from './ResponseGenerator.js';
import { SuggestionEngine } from './SuggestionEngine.js';

export interface ChatManagerOptions {
  logger: Logger;
  conversationManager: ConversationManager;
  contextStore: ContextStore;
  responseGenerator: ResponseGenerator;
  suggestionEngine: SuggestionEngine;
  autoSuggestionsEnabled?: boolean;
  confirmationTimeout?: number;
  maxConcurrentSessions?: number;
}

export interface ChatSession {
  sessionId: string;
  userId?: string;
  startTime: string;
  lastActivity: string;
  isActive: boolean;
  currentState: ChatState;
  pendingConfirmation?: PendingConfirmation;
  messageHistory: ChatMessage[];
  context: ConversationContext;
}

export interface ChatMessage {
  id: string;
  timestamp: string;
  type: 'user' | 'bot' | 'system' | 'error';
  content: string;
  metadata?: {
    intent?: string;
    confidence?: string;
    processingTime?: number;
    suggestions?: Suggestion[];
    command?: ParsedCommand;
    safety?: SafetyValidation;
  };
}

export interface ChatResponse {
  message: ChatMessage;
  suggestions: Suggestion[];
  requiresConfirmation: boolean;
  confirmationPrompt?: string;
  command?: ParsedCommand;
  safety?: SafetyValidation;
}

export interface Suggestion {
  id: string;
  type: 'command' | 'workflow' | 'completion' | 'help';
  title: string;
  description: string;
  action: string;
  confidence: number;
  metadata?: {
    category?: string;
    risk?: string;
    estimatedTime?: number;
  };
}

export interface PendingConfirmation {
  id: string;
  command: ParsedCommand;
  safety: SafetyValidation;
  prompt: string;
  timeout: number;
  createdAt: string;
}

export type ChatState = 
  | 'idle' 
  | 'processing' 
  | 'waiting_confirmation' 
  | 'executing_command' 
  | 'waiting_clarification'
  | 'error';

/**
 * Main conversation orchestrator for interactive chat mode
 * Manages sessions, processes messages, and coordinates responses
 */
export class ChatManager {
  private logger: Logger;
  private conversationManager: ConversationManager;
  private contextStore: ContextStore;
  private responseGenerator: ResponseGenerator;
  private suggestionEngine: SuggestionEngine;
  private autoSuggestionsEnabled: boolean;
  private confirmationTimeout: number;
  private maxConcurrentSessions: number;

  // Active chat sessions
  private activeSessions: Map<string, ChatSession> = new Map();
  private sessionTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(options: ChatManagerOptions) {
    this.logger = options.logger;
    this.conversationManager = options.conversationManager;
    this.contextStore = options.contextStore;
    this.responseGenerator = options.responseGenerator;
    this.suggestionEngine = options.suggestionEngine;
    this.autoSuggestionsEnabled = options.autoSuggestionsEnabled ?? true;
    this.confirmationTimeout = options.confirmationTimeout ?? 30000; // 30 seconds
    this.maxConcurrentSessions = options.maxConcurrentSessions ?? 100;

    this.logger.info('Chat manager initialized', {
      autoSuggestions: this.autoSuggestionsEnabled,
      confirmationTimeout: this.confirmationTimeout,
      maxSessions: this.maxConcurrentSessions,
    });
  }

  /**
   * Start a new chat session
   */
  async startChatSession(userId?: string): Promise<ChatSession> {
    // Check session limit
    if (this.activeSessions.size >= this.maxConcurrentSessions) {
      await this.cleanupOldestSession();
    }

    // Create new session in context store
    const sessionState = await this.contextStore.createSession(userId);
    const context = await this.contextStore.getContext(sessionState.sessionId);

    if (!context) {
      throw new Error('Failed to create conversation context');
    }

    // Create chat session
    const session: ChatSession = {
      sessionId: sessionState.sessionId,
      userId,
      startTime: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      isActive: true,
      currentState: 'idle',
      messageHistory: [],
      context,
    };

    this.activeSessions.set(session.sessionId, session);

    // Add welcome message
    const welcomeMessage = await this.generateWelcomeMessage(session);
    session.messageHistory.push(welcomeMessage);

    // Generate initial suggestions
    const suggestions = this.autoSuggestionsEnabled 
      ? await this.suggestionEngine.generateWelcomeSuggestions(context)
      : [];

    this.logger.info('Chat session started', {
      sessionId: session.sessionId,
      userId,
      suggestionsCount: suggestions.length,
    });

    return session;
  }

  /**
   * Process user message in chat session
   */
  async processMessage(sessionId: string, userInput: string): Promise<ChatResponse> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Chat session not found: ${sessionId}`);
    }

    const startTime = Date.now();
    session.lastActivity = new Date().toISOString();
    session.currentState = 'processing';

    this.logger.debug('Processing chat message', {
      sessionId,
      inputLength: userInput.length,
      currentState: session.currentState,
    });

    try {
      // Add user message to history
      const userMessage = this.createUserMessage(userInput);
      session.messageHistory.push(userMessage);

      // Handle special states
      if (session.pendingConfirmation) {
        return await this.handleConfirmationResponse(session, userInput);
      }

      // Process with conversation manager
      const conversationResult = await this.conversationManager.processInput(
        sessionId,
        userInput,
        session.userId
      );

      // Generate response
      const response = await this.generateChatResponse(
        session,
        conversationResult,
        startTime
      );

      // Update session state
      session.currentState = response.requiresConfirmation 
        ? 'waiting_confirmation' 
        : 'idle';

      // Add bot message to history
      session.messageHistory.push(response.message);

      // Handle confirmation if needed
      if (response.requiresConfirmation && response.command && response.safety) {
        session.pendingConfirmation = {
          id: generateCorrelationId(),
          command: response.command,
          safety: response.safety,
          prompt: response.confirmationPrompt || 'Do you want to proceed?',
          timeout: this.confirmationTimeout,
          createdAt: new Date().toISOString(),
        };

        // Set confirmation timeout
        this.setConfirmationTimeout(session);
      }

      this.logger.debug('Chat message processed', {
        sessionId,
        intent: conversationResult.response.includes('intent') ? 'parsed' : 'unknown',
        processingTime: Date.now() - startTime,
        requiresConfirmation: response.requiresConfirmation,
        suggestionsCount: response.suggestions.length,
      });

      return response;

    } catch (error) {
      session.currentState = 'error';
      
      this.logger.error('Chat message processing failed', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
      });

      // Generate error response
      const errorResponse = await this.generateErrorResponse(session, error);
      session.messageHistory.push(errorResponse.message);

      return errorResponse;
    }
  }

  /**
   * Handle confirmation response (yes/no/cancel)
   */
  private async handleConfirmationResponse(
    session: ChatSession,
    userInput: string
  ): Promise<ChatResponse> {
    const confirmation = session.pendingConfirmation;
    if (!confirmation) {
      throw new Error('No pending confirmation found');
    }

    const normalizedInput = userInput.toLowerCase().trim();
    const isConfirmed = ['yes', 'y', 'proceed', 'continue', 'execute', 'run'].includes(normalizedInput);
    const isDenied = ['no', 'n', 'cancel', 'abort', 'stop'].includes(normalizedInput);

    if (!isConfirmed && !isDenied) {
      // Unclear response, ask for clarification
      const clarificationMessage = this.createBotMessage(
        "Please respond with 'yes' to proceed or 'no' to cancel."
      );
      return {
        message: clarificationMessage,
        suggestions: [
          {
            id: 'confirm-yes',
            type: 'command',
            title: 'Yes, proceed',
            description: 'Execute the command',
            action: 'yes',
            confidence: 1.0,
          },
          {
            id: 'confirm-no',
            type: 'command',
            title: 'No, cancel',
            description: 'Cancel the operation',
            action: 'no',
            confidence: 1.0,
          },
        ],
        requiresConfirmation: true,
        confirmationPrompt: confirmation.prompt,
        command: confirmation.command,
        safety: confirmation.safety,
      };
    }

    // Clear pending confirmation
    session.pendingConfirmation = undefined;
    this.clearConfirmationTimeout(session.sessionId);

    if (isConfirmed) {
      // Execute the command
      session.currentState = 'executing_command';
      
      const executeResponse = await this.executeConfirmedCommand(session, confirmation);
      return executeResponse;
    } else {
      // Command cancelled
      session.currentState = 'idle';
      
      const cancelMessage = this.createBotMessage('Operation cancelled. How can I help you next?');
      const suggestions = await this.suggestionEngine.generateContextualSuggestions(session.context);

      return {
        message: cancelMessage,
        suggestions,
        requiresConfirmation: false,
      };
    }
  }

  /**
   * Execute confirmed command
   */
  private async executeConfirmedCommand(
    session: ChatSession,
    confirmation: PendingConfirmation
  ): Promise<ChatResponse> {
    try {
      // Here we would integrate with the actual command execution system
      // For now, we'll simulate command execution
      
      const executionMessage = this.createBotMessage(
        `Executing: ${confirmation.command.previewCommand}`
      );

      // Generate follow-up suggestions
      const suggestions = await this.suggestionEngine.generatePostExecutionSuggestions(
        confirmation.command,
        session.context
      );

      session.currentState = 'idle';

      return {
        message: executionMessage,
        suggestions,
        requiresConfirmation: false,
      };

    } catch (error) {
      session.currentState = 'error';
      
      const errorMessage = this.createBotMessage(
        `Command execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      return {
        message: errorMessage,
        suggestions: [],
        requiresConfirmation: false,
      };
    }
  }

  /**
   * Generate chat response from conversation result
   */
  private async generateChatResponse(
    session: ChatSession,
    conversationResult: any,
    startTime: number
  ): Promise<ChatResponse> {
    // Generate natural language response
    const responseText = await this.responseGenerator.generateResponse(
      conversationResult.response || 'I understand.',
      conversationResult.command,
      conversationResult.safetyValidation
    );

    // Create bot message
    const botMessage = this.createBotMessage(responseText, {
      intent: conversationResult.command?.intent,
      confidence: conversationResult.command?.confidence.toString(),
      processingTime: Date.now() - startTime,
      command: conversationResult.command,
      safety: conversationResult.safetyValidation,
    });

    // Generate suggestions
    const suggestions = this.autoSuggestionsEnabled
      ? await this.suggestionEngine.generateContextualSuggestions(session.context)
      : [];

    // Check if confirmation is required
    const requiresConfirmation = conversationResult.safetyValidation?.requiresConfirmation || false;
    const confirmationPrompt = requiresConfirmation
      ? await this.responseGenerator.generateConfirmationPrompt(
          conversationResult.command,
          conversationResult.safetyValidation
        )
      : undefined;

    return {
      message: botMessage,
      suggestions,
      requiresConfirmation,
      confirmationPrompt,
      command: conversationResult.command,
      safety: conversationResult.safetyValidation,
    };
  }

  /**
   * Generate error response
   */
  private async generateErrorResponse(session: ChatSession, error: any): Promise<ChatResponse> {
    const errorText = await this.responseGenerator.generateErrorResponse(error);
    const errorMessage = this.createErrorMessage(errorText);
    
    const suggestions = await this.suggestionEngine.generateErrorRecoverySuggestions(
      error,
      session.context
    );

    return {
      message: errorMessage,
      suggestions,
      requiresConfirmation: false,
    };
  }

  /**
   * End chat session
   */
  async endChatSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return;
    }

    // Clear any pending timeouts
    this.clearConfirmationTimeout(sessionId);

    // Mark session as inactive
    session.isActive = false;

    // Remove from active sessions
    this.activeSessions.delete(sessionId);

    // Clean up context store session
    await this.contextStore.deleteSession(sessionId);

    this.logger.info('Chat session ended', {
      sessionId,
      duration: Date.now() - new Date(session.startTime).getTime(),
      messageCount: session.messageHistory.length,
    });
  }

  /**
   * Get active chat session
   */
  getChatSession(sessionId: string): ChatSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * List active sessions
   */
  getActiveSessions(): ChatSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Helper methods for message creation
   */
  private createUserMessage(content: string): ChatMessage {
    return {
      id: generateCorrelationId(),
      timestamp: new Date().toISOString(),
      type: 'user',
      content,
    };
  }

  private createBotMessage(content: string, metadata?: any): ChatMessage {
    return {
      id: generateCorrelationId(),
      timestamp: new Date().toISOString(),
      type: 'bot',
      content,
      metadata,
    };
  }

  private createSystemMessage(content: string): ChatMessage {
    return {
      id: generateCorrelationId(),
      timestamp: new Date().toISOString(),
      type: 'system',
      content,
    };
  }

  private createErrorMessage(content: string): ChatMessage {
    return {
      id: generateCorrelationId(),
      timestamp: new Date().toISOString(),
      type: 'error',
      content,
    };
  }

  /**
   * Generate welcome message
   */
  private async generateWelcomeMessage(session: ChatSession): Promise<ChatMessage> {
    const welcomeText = await this.responseGenerator.generateWelcomeMessage(session.context);
    return this.createBotMessage(welcomeText);
  }

  /**
   * Confirmation timeout management
   */
  private setConfirmationTimeout(session: ChatSession): void {
    const timeoutId = setTimeout(() => {
      this.handleConfirmationTimeout(session.sessionId);
    }, this.confirmationTimeout);

    this.sessionTimeouts.set(session.sessionId, timeoutId);
  }

  private clearConfirmationTimeout(sessionId: string): void {
    const timeoutId = this.sessionTimeouts.get(sessionId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.sessionTimeouts.delete(sessionId);
    }
  }

  private async handleConfirmationTimeout(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.pendingConfirmation) {
      return;
    }

    // Clear pending confirmation
    session.pendingConfirmation = undefined;
    session.currentState = 'idle';

    // Add timeout message
    const timeoutMessage = this.createSystemMessage(
      'Confirmation timeout. Operation cancelled. How can I help you next?'
    );
    session.messageHistory.push(timeoutMessage);

    this.logger.debug('Confirmation timeout', { sessionId });
  }

  /**
   * Session cleanup
   */
  private async cleanupOldestSession(): Promise<void> {
    let oldestSession: ChatSession | null = null;
    let oldestTime = Date.now();

    for (const session of this.activeSessions.values()) {
      const lastActivity = new Date(session.lastActivity).getTime();
      if (lastActivity < oldestTime) {
        oldestTime = lastActivity;
        oldestSession = session;
      }
    }

    if (oldestSession) {
      await this.endChatSession(oldestSession.sessionId);
    }
  }

  /**
   * Get chat manager statistics
   */
  getStatistics(): {
    activeSessions: number;
    totalMessages: number;
    averageSessionDuration: number;
    pendingConfirmations: number;
  } {
    const sessions = Array.from(this.activeSessions.values());
    const totalMessages = sessions.reduce((sum, session) => sum + session.messageHistory.length, 0);
    const now = Date.now();
    const totalDuration = sessions.reduce((sum, session) => {
      return sum + (now - new Date(session.startTime).getTime());
    }, 0);

    const pendingConfirmations = sessions.filter(s => s.pendingConfirmation).length;

    return {
      activeSessions: sessions.length,
      totalMessages,
      averageSessionDuration: sessions.length > 0 ? totalDuration / sessions.length : 0,
      pendingConfirmations,
    };
  }
}