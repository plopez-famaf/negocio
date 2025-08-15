import { Logger, generateCorrelationId } from '@threatguard/core';
import type { 
  ContextStore as IContextStore,
  ConversationContext, 
  SessionState, 
  Message, 
  MessageType 
} from '../types/Context.js';

export interface ContextStoreOptions {
  logger: Logger;
  maxSessions?: number;
  maxMessagesPerSession?: number;
  sessionTimeoutMs?: number;
}

/**
 * In-memory implementation of ContextStore
 * For production, this could be backed by Redis or database
 */
export class ContextStore implements IContextStore {
  private logger: Logger;
  private maxSessions: number;
  private maxMessagesPerSession: number;
  private sessionTimeoutMs: number;

  // In-memory storage
  private sessions: Map<string, SessionState> = new Map();
  private messages: Map<string, Message[]> = new Map();
  private contexts: Map<string, ConversationContext> = new Map();

  // Cleanup interval
  private cleanupInterval: NodeJS.Timeout;

  constructor(options: ContextStoreOptions) {
    this.logger = options.logger;
    this.maxSessions = options.maxSessions || 1000;
    this.maxMessagesPerSession = options.maxMessagesPerSession || 500;
    this.sessionTimeoutMs = options.sessionTimeoutMs || 24 * 60 * 60 * 1000; // 24 hours

    // Start cleanup interval (every hour)
    this.cleanupInterval = setInterval(() => {
      this.performCleanup().catch(error => {
        this.logger.error('Context store cleanup failed', { error });
      });
    }, 60 * 60 * 1000);

    this.logger.info('Context store initialized', {
      maxSessions: this.maxSessions,
      maxMessagesPerSession: this.maxMessagesPerSession,
      sessionTimeoutHours: this.sessionTimeoutMs / (60 * 60 * 1000),
    });
  }

  /**
   * Create a new conversation session
   */
  async createSession(userId?: string): Promise<SessionState> {
    const sessionId = generateCorrelationId();
    const now = new Date().toISOString();

    const session: SessionState = {
      sessionId,
      userId,
      startTime: now,
      lastActivity: now,
      isActive: true,
      preferences: {
        outputFormat: 'table',
        verboseMode: false,
        confirmDestructive: true,
        suggestCommands: true,
        explainCommands: true,
      },
      entities: {},
      variables: {},
      authenticationStatus: 'unauthenticated',
      permissions: [],
    };

    // Check session limit
    if (this.sessions.size >= this.maxSessions) {
      await this.evictOldestSession();
    }

    this.sessions.set(sessionId, session);

    // Initialize empty message list and context
    this.messages.set(sessionId, []);
    this.contexts.set(sessionId, {
      session,
      messages: [],
      recentIntents: [],
      recentEntities: [],
      recentCommands: [],
      errorCount: 0,
      averageResponseTime: 0,
      totalInteractions: 0,
    });

    this.logger.debug('Created new session', { sessionId, userId });
    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<SessionState | null> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    // Update last activity
    session.lastActivity = new Date().toISOString();
    return { ...session }; // Return copy
  }

  /**
   * Update session
   */
  async updateSession(sessionId: string, updates: Partial<SessionState>): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const updatedSession = { 
      ...session, 
      ...updates, 
      lastActivity: new Date().toISOString() 
    };
    
    this.sessions.set(sessionId, updatedSession);

    // Update context as well
    const context = this.contexts.get(sessionId);
    if (context) {
      context.session = updatedSession;
      this.contexts.set(sessionId, context);
    }

    this.logger.debug('Updated session', { sessionId, updatedFields: Object.keys(updates) });
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    this.messages.delete(sessionId);
    this.contexts.delete(sessionId);
    this.logger.debug('Deleted session', { sessionId });
  }

  /**
   * Add message to session
   */
  async addMessage(sessionId: string, message: Omit<Message, 'id' | 'timestamp'>): Promise<Message> {
    const messages = this.messages.get(sessionId) || [];
    
    const fullMessage: Message = {
      ...message,
      id: generateCorrelationId(),
      timestamp: new Date().toISOString(),
    };

    messages.unshift(fullMessage); // Add to beginning for chronological order

    // Limit message history
    if (messages.length > this.maxMessagesPerSession) {
      messages.splice(this.maxMessagesPerSession);
    }

    this.messages.set(sessionId, messages);

    // Update context
    const context = this.contexts.get(sessionId);
    if (context) {
      context.messages = [...messages]; // Copy for immutability
      this.contexts.set(sessionId, context);
    }

    this.logger.debug('Added message to session', { 
      sessionId, 
      messageType: message.type, 
      messageId: fullMessage.id 
    });

    return fullMessage;
  }

  /**
   * Get messages for session
   */
  async getMessages(sessionId: string, limit?: number): Promise<Message[]> {
    const messages = this.messages.get(sessionId) || [];
    const limitedMessages = limit ? messages.slice(0, limit) : messages;
    return [...limitedMessages]; // Return copy
  }

  /**
   * Search messages
   */
  async searchMessages(sessionId: string, query: string): Promise<Message[]> {
    const messages = this.messages.get(sessionId) || [];
    const searchTerm = query.toLowerCase();
    
    return messages.filter(message => 
      message.content.toLowerCase().includes(searchTerm) ||
      message.type.toLowerCase().includes(searchTerm)
    );
  }

  /**
   * Get conversation context
   */
  async getContext(sessionId: string): Promise<ConversationContext | null> {
    const context = this.contexts.get(sessionId);
    return context ? { ...context } : null; // Return copy
  }

  /**
   * Update conversation context
   */
  async updateContext(sessionId: string, updates: Partial<ConversationContext>): Promise<void> {
    const context = this.contexts.get(sessionId);
    if (!context) {
      throw new Error(`Context not found for session: ${sessionId}`);
    }

    const updatedContext = { ...context, ...updates };
    this.contexts.set(sessionId, updatedContext);

    // Update session if it was modified
    if (updates.session) {
      this.sessions.set(sessionId, updates.session);
    }

    this.logger.debug('Updated context', { sessionId, updatedFields: Object.keys(updates) });
  }

  /**
   * Set entity value
   */
  async setEntity(sessionId: string, key: string, value: any): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.entities[key] = value;
    session.lastActivity = new Date().toISOString();
    this.sessions.set(sessionId, session);

    this.logger.debug('Set entity', { sessionId, key, valueType: typeof value });
  }

  /**
   * Get entity value
   */
  async getEntity(sessionId: string, key: string): Promise<any> {
    const session = this.sessions.get(sessionId);
    return session?.entities[key];
  }

  /**
   * Set variable value
   */
  async setVariable(sessionId: string, key: string, value: any): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.variables[key] = value;
    session.lastActivity = new Date().toISOString();
    this.sessions.set(sessionId, session);

    this.logger.debug('Set variable', { sessionId, key, valueType: typeof value });
  }

  /**
   * Get variable value
   */
  async getVariable(sessionId: string, key: string): Promise<any> {
    const session = this.sessions.get(sessionId);
    return session?.variables[key];
  }

  /**
   * Cleanup old sessions and data
   */
  async cleanup(olderThan: Date): Promise<number> {
    let cleanedCount = 0;
    const cutoffTime = olderThan.getTime();

    for (const [sessionId, session] of this.sessions.entries()) {
      const lastActivityTime = new Date(session.lastActivity).getTime();
      
      if (lastActivityTime < cutoffTime) {
        await this.deleteSession(sessionId);
        cleanedCount++;
      }
    }

    this.logger.info('Cleanup completed', { 
      cleanedSessions: cleanedCount,
      remainingSessions: this.sessions.size,
      cutoffDate: olderThan.toISOString(),
    });

    return cleanedCount;
  }

  /**
   * Get statistics about the context store
   */
  getStatistics(): {
    totalSessions: number;
    activeSessions: number;
    totalMessages: number;
    averageMessagesPerSession: number;
    oldestSession?: string;
    newestSession?: string;
  } {
    let totalMessages = 0;
    let oldestTime = Infinity;
    let newestTime = 0;
    let oldestSession = '';
    let newestSession = '';
    let activeSessions = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.isActive) {
        activeSessions++;
      }

      const sessionMessages = this.messages.get(sessionId)?.length || 0;
      totalMessages += sessionMessages;

      const sessionTime = new Date(session.startTime).getTime();
      if (sessionTime < oldestTime) {
        oldestTime = sessionTime;
        oldestSession = sessionId;
      }
      if (sessionTime > newestTime) {
        newestTime = sessionTime;
        newestSession = sessionId;
      }
    }

    return {
      totalSessions: this.sessions.size,
      activeSessions,
      totalMessages,
      averageMessagesPerSession: this.sessions.size > 0 ? totalMessages / this.sessions.size : 0,
      oldestSession: oldestSession || undefined,
      newestSession: newestSession || undefined,
    };
  }

  /**
   * Export session data for backup/migration
   */
  async exportSession(sessionId: string): Promise<{
    session: SessionState;
    messages: Message[];
    context: ConversationContext;
  } | null> {
    const session = this.sessions.get(sessionId);
    const messages = this.messages.get(sessionId);
    const context = this.contexts.get(sessionId);

    if (!session || !messages || !context) {
      return null;
    }

    return {
      session: { ...session },
      messages: [...messages],
      context: { ...context },
    };
  }

  /**
   * Import session data from backup/migration
   */
  async importSession(data: {
    session: SessionState;
    messages: Message[];
    context: ConversationContext;
  }): Promise<void> {
    const { session, messages, context } = data;
    
    this.sessions.set(session.sessionId, session);
    this.messages.set(session.sessionId, messages);
    this.contexts.set(session.sessionId, context);

    this.logger.info('Imported session', { 
      sessionId: session.sessionId,
      messagesCount: messages.length,
    });
  }

  /**
   * Shutdown the context store
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.logger.info('Context store shutdown', {
      totalSessions: this.sessions.size,
      totalMessages: Array.from(this.messages.values()).reduce((sum, msgs) => sum + msgs.length, 0),
    });
  }

  /**
   * Perform automatic cleanup
   */
  private async performCleanup(): Promise<void> {
    const cutoffDate = new Date(Date.now() - this.sessionTimeoutMs);
    const cleanedCount = await this.cleanup(cutoffDate);
    
    if (cleanedCount > 0) {
      this.logger.info('Automatic cleanup performed', { cleanedSessions: cleanedCount });
    }
  }

  /**
   * Evict oldest session when limit is reached
   */
  private async evictOldestSession(): Promise<void> {
    let oldestTime = Infinity;
    let oldestSessionId = '';

    for (const [sessionId, session] of this.sessions.entries()) {
      const lastActivityTime = new Date(session.lastActivity).getTime();
      if (lastActivityTime < oldestTime) {
        oldestTime = lastActivityTime;
        oldestSessionId = sessionId;
      }
    }

    if (oldestSessionId) {
      await this.deleteSession(oldestSessionId);
      this.logger.debug('Evicted oldest session', { sessionId: oldestSessionId });
    }
  }
}