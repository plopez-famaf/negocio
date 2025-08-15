import { Logger } from '@threatguard/core';
import type { 
  Intent, 
  Entity, 
  NLParseResult,
  IntentType,
  ConfidenceLevel 
} from '../types/Intent.js';
import type { ConversationContext, Message } from '../types/Context.js';

export interface ContextualParserOptions {
  logger: Logger;
  enableConversationFlow?: boolean;
  enableEntityPersistence?: boolean;
  enableImplicitReferences?: boolean;
  contextWindowSize?: number;
}

/**
 * Advanced contextual parser that enhances NL processing with conversation history,
 * entity persistence, and implicit reference resolution
 */
export class ContextualParser {
  private logger: Logger;
  private enableConversationFlow: boolean;
  private enableEntityPersistence: boolean;
  private enableImplicitReferences: boolean;
  private contextWindowSize: number;

  // Conversation state tracking
  private conversationFlows: Map<string, ConversationFlow> = new Map();
  private entityMemory: Map<string, EntityMemory> = new Map();
  
  // Reference resolution patterns
  private pronounPatterns: Map<string, string[]> = new Map();
  private implicitReferences: Map<string, string[]> = new Map();

  constructor(options: ContextualParserOptions) {
    this.logger = options.logger;
    this.enableConversationFlow = options.enableConversationFlow ?? true;
    this.enableEntityPersistence = options.enableEntityPersistence ?? true;
    this.enableImplicitReferences = options.enableImplicitReferences ?? true;
    this.contextWindowSize = options.contextWindowSize ?? 10;

    this.initializeReferencePatterns();

    this.logger.debug('Contextual parser initialized', {
      conversationFlow: this.enableConversationFlow,
      entityPersistence: this.enableEntityPersistence,
      implicitReferences: this.enableImplicitReferences,
      contextWindow: this.contextWindowSize,
    });
  }

  /**
   * Enhance NL parse result with contextual information
   */
  async enhance(
    parseResult: NLParseResult,
    context: ConversationContext
  ): Promise<EnhancedNLParseResult> {
    const startTime = Date.now();
    
    this.logger.debug('Enhancing parse result with context', {
      intent: parseResult.intent.type,
      entitiesCount: parseResult.entities.length,
      messagesCount: context.messages.length,
    });

    try {
      // Create enhanced copy
      const enhanced: EnhancedNLParseResult = {
        ...parseResult,
        contextualEnhancements: {
          resolvedReferences: [],
          inheritedEntities: [],
          conversationFlow: null,
          implicitContext: {},
          confidence: parseResult.confidence,
        },
      };

      // Apply contextual enhancements
      if (this.enableImplicitReferences) {
        await this.resolveImplicitReferences(enhanced, context);
      }

      if (this.enableEntityPersistence) {
        await this.inheritPersistentEntities(enhanced, context);
      }

      if (this.enableConversationFlow) {
        await this.analyzeConversationFlow(enhanced, context);
      }

      // Update entity memory
      this.updateEntityMemory(enhanced, context.session.sessionId);

      // Calculate enhanced confidence
      enhanced.confidence = this.calculateEnhancedConfidence(enhanced);
      enhanced.contextualEnhancements.confidence = enhanced.confidence;

      const processingTime = Date.now() - startTime;
      this.logger.debug('Contextual enhancement completed', {
        originalConfidence: parseResult.confidence,
        enhancedConfidence: enhanced.confidence,
        resolvedReferences: enhanced.contextualEnhancements.resolvedReferences.length,
        inheritedEntities: enhanced.contextualEnhancements.inheritedEntities.length,
        processingTime,
      });

      return enhanced;

    } catch (error) {
      this.logger.error('Contextual enhancement failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        intent: parseResult.intent.type,
      });

      // Return original result on error
      return {
        ...parseResult,
        contextualEnhancements: {
          resolvedReferences: [],
          inheritedEntities: [],
          conversationFlow: null,
          implicitContext: {},
          confidence: parseResult.confidence,
          error: 'contextual_enhancement_failed',
        },
      };
    }
  }

  /**
   * Resolve implicit references (pronouns, "this", "that", etc.)
   */
  private async resolveImplicitReferences(
    enhanced: EnhancedNLParseResult,
    context: ConversationContext
  ): Promise<void> {
    const input = enhanced.originalText.toLowerCase();
    const resolved: ResolvedReference[] = [];

    // Handle pronoun references
    for (const [pronoun, types] of this.pronounPatterns) {
      const pronounRegex = new RegExp(`\\b${pronoun}\\b`, 'gi');
      const matches = [...input.matchAll(pronounRegex)];

      for (const match of matches) {
        const reference = this.resolvePronounReference(pronoun, types, context);
        if (reference) {
          resolved.push({
            original: pronoun,
            resolved: reference.value,
            type: reference.type,
            confidence: reference.confidence,
            source: 'pronoun_resolution',
            position: match.index || 0,
          });

          // Add resolved entity to entities list
          enhanced.entities.push({
            type: reference.type as any,
            value: reference.resolved,
            confidence: reference.confidence,
            start: match.index || 0,
            end: (match.index || 0) + match[0].length,
            metadata: { 
              source: 'contextual_resolution',
              original: pronoun,
            },
          });
        }
      }
    }

    // Handle implicit references ("scan it", "check that", etc.)
    for (const [phrase, entities] of this.implicitReferences) {
      if (input.includes(phrase)) {
        const implicitEntity = this.resolveImplicitEntity(phrase, entities, context);
        if (implicitEntity) {
          resolved.push({
            original: phrase,
            resolved: implicitEntity.value,
            type: implicitEntity.type,
            confidence: implicitEntity.confidence,
            source: 'implicit_resolution',
            position: input.indexOf(phrase),
          });

          enhanced.entities.push({
            type: implicitEntity.type as any,
            value: implicitEntity.resolved,
            confidence: implicitEntity.confidence,
            start: input.indexOf(phrase),
            end: input.indexOf(phrase) + phrase.length,
            metadata: { 
              source: 'contextual_resolution',
              original: phrase,
            },
          });
        }
      }
    }

    enhanced.contextualEnhancements.resolvedReferences = resolved;
  }

  /**
   * Inherit persistent entities from conversation history
   */
  private async inheritPersistentEntities(
    enhanced: EnhancedNLParseResult,
    context: ConversationContext
  ): Promise<void> {
    const inherited: InheritedEntity[] = [];
    const sessionId = context.session.sessionId;
    const entityMemory = this.entityMemory.get(sessionId);

    if (!entityMemory) return;

    // Check if we need to inherit entities based on intent
    const needsTargets = this.intentNeedsTargets(enhanced.intent.type);
    const needsTimeContext = this.intentNeedsTimeContext(enhanced.intent.type);
    const needsUserContext = this.intentNeedsUserContext(enhanced.intent.type);

    // Inherit target entities if needed and not present
    if (needsTargets && !this.hasTargetEntities(enhanced.entities)) {
      const recentTargets = entityMemory.entities.filter(e => 
        ['ip_address', 'network_range', 'domain'].includes(e.type) &&
        this.isEntityRecent(e, this.contextWindowSize)
      );

      if (recentTargets.length > 0) {
        const target = recentTargets[0];
        inherited.push({
          entity: {
            type: target.type as any,
            value: target.value,
            confidence: 'medium',
            start: 0,
            end: 0,
            metadata: { 
              source: 'inherited_from_context',
              originalTimestamp: target.timestamp,
            },
          },
          source: 'recent_conversation',
          confidence: 'medium',
          ageInMessages: target.ageInMessages,
        });

        enhanced.entities.push(inherited[inherited.length - 1].entity);
      }
    }

    // Inherit time context if needed
    if (needsTimeContext && !this.hasTimeEntities(enhanced.entities)) {
      const recentTimeEntities = entityMemory.entities.filter(e => 
        e.type === 'time_range' && this.isEntityRecent(e, 3) // More restrictive for time
      );

      if (recentTimeEntities.length > 0) {
        const timeEntity = recentTimeEntities[0];
        inherited.push({
          entity: {
            type: 'time_range',
            value: timeEntity.value,
            confidence: 'low',
            start: 0,
            end: 0,
            metadata: { 
              source: 'inherited_time_context',
              originalTimestamp: timeEntity.timestamp,
            },
          },
          source: 'recent_time_context',
          confidence: 'low',
          ageInMessages: timeEntity.ageInMessages,
        });

        enhanced.entities.push(inherited[inherited.length - 1].entity);
      }
    }

    // Inherit user context for behavioral analysis
    if (needsUserContext && !this.hasUserEntities(enhanced.entities)) {
      const recentUserEntities = entityMemory.entities.filter(e => 
        e.type === 'user_id' && this.isEntityRecent(e, 5)
      );

      if (recentUserEntities.length > 0) {
        const userEntity = recentUserEntities[0];
        inherited.push({
          entity: {
            type: 'user_id',
            value: userEntity.value,
            confidence: 'medium',
            start: 0,
            end: 0,
            metadata: { 
              source: 'inherited_user_context',
              originalTimestamp: userEntity.timestamp,
            },
          },
          source: 'recent_user_context',
          confidence: 'medium',
          ageInMessages: userEntity.ageInMessages,
        });

        enhanced.entities.push(inherited[inherited.length - 1].entity);
      }
    }

    enhanced.contextualEnhancements.inheritedEntities = inherited;
  }

  /**
   * Analyze conversation flow and determine context
   */
  private async analyzeConversationFlow(
    enhanced: EnhancedNLParseResult,
    context: ConversationContext
  ): Promise<void> {
    const sessionId = context.session.sessionId;
    let flow = this.conversationFlows.get(sessionId);

    if (!flow) {
      flow = {
        sessionId,
        phases: [],
        currentPhase: null,
        transitionCount: 0,
        lastUpdate: new Date().toISOString(),
      };
      this.conversationFlows.set(sessionId, flow);
    }

    // Determine current conversation phase
    const newPhase = this.determineConversationPhase(enhanced.intent.type, context);
    
    if (!flow.currentPhase || flow.currentPhase.phase !== newPhase) {
      // Phase transition
      if (flow.currentPhase) {
        flow.currentPhase.endTime = new Date().toISOString();
        flow.phases.push(flow.currentPhase);
      }

      flow.currentPhase = {
        phase: newPhase,
        startTime: new Date().toISOString(),
        endTime: null,
        intents: [enhanced.intent.type],
        entities: enhanced.entities.length,
      };
      
      flow.transitionCount++;
    } else {
      // Continue current phase
      flow.currentPhase.intents.push(enhanced.intent.type);
      flow.currentPhase.entities += enhanced.entities.length;
    }

    flow.lastUpdate = new Date().toISOString();

    // Set conversation flow context
    enhanced.contextualEnhancements.conversationFlow = {
      currentPhase: newPhase,
      phaseIntents: flow.currentPhase.intents,
      transitionCount: flow.transitionCount,
      isPhaseTransition: flow.currentPhase.intents.length === 1,
    };

    // Add implicit context based on conversation flow
    enhanced.contextualEnhancements.implicitContext = this.generateImplicitContext(flow, enhanced);
  }

  /**
   * Update entity memory with new entities
   */
  private updateEntityMemory(enhanced: EnhancedNLParseResult, sessionId: string): void {
    let memory = this.entityMemory.get(sessionId);
    
    if (!memory) {
      memory = {
        sessionId,
        entities: [],
        lastUpdate: new Date().toISOString(),
      };
      this.entityMemory.set(sessionId, memory);
    }

    // Add new entities to memory
    for (const entity of enhanced.entities) {
      // Skip entities that were inherited or resolved (to avoid cycles)
      if (entity.metadata?.source?.includes('inherited') || 
          entity.metadata?.source?.includes('contextual_resolution')) {
        continue;
      }

      memory.entities.unshift({
        type: entity.type,
        value: entity.value,
        confidence: entity.confidence,
        timestamp: new Date().toISOString(),
        ageInMessages: 0,
      });
    }

    // Age existing entities and clean up old ones
    memory.entities = memory.entities.map(e => ({
      ...e,
      ageInMessages: e.ageInMessages + 1,
    })).filter(e => e.ageInMessages < this.contextWindowSize * 2);

    memory.lastUpdate = new Date().toISOString();
  }

  /**
   * Calculate enhanced confidence based on contextual factors
   */
  private calculateEnhancedConfidence(enhanced: EnhancedNLParseResult): ConfidenceLevel {
    let score = this.confidenceToNumber(enhanced.confidence);

    // Boost for resolved references
    if (enhanced.contextualEnhancements.resolvedReferences.length > 0) {
      score += 0.1 * enhanced.contextualEnhancements.resolvedReferences.length;
    }

    // Boost for inherited entities that fill gaps
    if (enhanced.contextualEnhancements.inheritedEntities.length > 0) {
      score += 0.15 * enhanced.contextualEnhancements.inheritedEntities.length;
    }

    // Boost for conversation flow continuity
    if (enhanced.contextualEnhancements.conversationFlow && 
        !enhanced.contextualEnhancements.conversationFlow.isPhaseTransition) {
      score += 0.1;
    }

    // Cap the score
    score = Math.min(score, 1.0);

    return this.numberToConfidence(score);
  }

  /**
   * Initialize reference resolution patterns
   */
  private initializeReferencePatterns(): void {
    // Pronoun to entity type mappings
    this.pronounPatterns.set('it', ['ip_address', 'domain', 'system', 'threat']);
    this.pronounPatterns.set('this', ['ip_address', 'domain', 'network_range', 'threat']);
    this.pronounPatterns.set('that', ['ip_address', 'domain', 'network_range', 'threat']);
    this.pronounPatterns.set('them', ['threats', 'systems', 'users']);
    this.pronounPatterns.set('these', ['threats', 'systems', 'alerts']);
    this.pronounPatterns.set('those', ['threats', 'systems', 'alerts']);

    // Implicit reference phrases
    this.implicitReferences.set('scan it', ['ip_address', 'domain', 'network_range']);
    this.implicitReferences.set('check it', ['ip_address', 'domain', 'system']);
    this.implicitReferences.set('monitor it', ['network_range', 'system']);
    this.implicitReferences.set('analyze it', ['system', 'user_id', 'threat']);
    this.implicitReferences.set('the same', ['ip_address', 'domain', 'scan_type']);
    this.implicitReferences.set('again', ['command', 'operation']);
  }

  /**
   * Resolve pronoun reference to specific entity
   */
  private resolvePronounReference(
    pronoun: string,
    types: string[],
    context: ConversationContext
  ): { value: string; resolved: string; type: string; confidence: ConfidenceLevel } | null {
    const recentEntities = context.recentEntities.slice(0, 5); // Last 5 entities
    
    for (const type of types) {
      const entity = recentEntities.find(e => e.type === type);
      if (entity) {
        return {
          value: pronoun,
          resolved: entity.value,
          type: entity.type,
          confidence: 'medium',
        };
      }
    }

    return null;
  }

  /**
   * Resolve implicit entity reference
   */
  private resolveImplicitEntity(
    phrase: string,
    entityTypes: string[],
    context: ConversationContext
  ): { value: string; resolved: string; type: string; confidence: ConfidenceLevel } | null {
    const recentEntities = context.recentEntities.slice(0, 3); // More restrictive for implicit
    
    for (const type of entityTypes) {
      const entity = recentEntities.find(e => e.type === type);
      if (entity) {
        return {
          value: phrase,
          resolved: entity.value,
          type: entity.type,
          confidence: 'low',
        };
      }
    }

    return null;
  }

  /**
   * Determine conversation phase based on intent sequence
   */
  private determineConversationPhase(intent: IntentType, context: ConversationContext): ConversationPhase {
    const recentIntents = context.recentIntents.slice(0, 3);

    // Authentication phase
    if (intent.startsWith('auth_') || 
        (recentIntents.some(i => i.startsWith('auth_')) && recentIntents.length < 3)) {
      return 'authentication';
    }

    // Discovery phase
    if (['system_status', 'network_scan', 'threat_scan'].includes(intent)) {
      return 'discovery';
    }

    // Investigation phase
    if (['threat_list', 'threat_details', 'intel_query', 'behavior_analyze'].includes(intent)) {
      return 'investigation';
    }

    // Monitoring phase
    if (['threat_watch', 'network_monitor', 'dashboard_open'].includes(intent)) {
      return 'monitoring';
    }

    // Configuration phase
    if (intent.startsWith('config_')) {
      return 'configuration';
    }

    // Help/conversation phase
    if (['help_general', 'help_specific', 'conversation_continue'].includes(intent)) {
      return 'assistance';
    }

    return 'general';
  }

  /**
   * Generate implicit context based on conversation flow
   */
  private generateImplicitContext(flow: ConversationFlow, enhanced: EnhancedNLParseResult): Record<string, any> {
    const context: Record<string, any> = {};

    if (flow.currentPhase) {
      context.conversationPhase = flow.currentPhase.phase;
      context.phaseIntentCount = flow.currentPhase.intents.length;
      context.isNewPhase = flow.currentPhase.intents.length === 1;
    }

    // Add workflow suggestions based on current phase
    switch (flow.currentPhase?.phase) {
      case 'discovery':
        context.suggestedNextActions = ['investigate findings', 'list threats', 'check details'];
        break;
      case 'investigation':
        context.suggestedNextActions = ['monitor for changes', 'analyze behavior', 'check intelligence'];
        break;
      case 'monitoring':
        context.suggestedNextActions = ['view alerts', 'investigate incidents', 'check status'];
        break;
    }

    return context;
  }

  /**
   * Helper methods for entity checking
   */
  private intentNeedsTargets(intent: IntentType): boolean {
    return ['threat_scan', 'network_scan', 'vulnerability_scan'].includes(intent);
  }

  private intentNeedsTimeContext(intent: IntentType): boolean {
    return ['threat_list', 'behavior_analyze', 'intel_query'].includes(intent);
  }

  private intentNeedsUserContext(intent: IntentType): boolean {
    return ['behavior_analyze', 'behavior_patterns'].includes(intent);
  }

  private hasTargetEntities(entities: Entity[]): boolean {
    return entities.some(e => ['ip_address', 'network_range', 'domain'].includes(e.type));
  }

  private hasTimeEntities(entities: Entity[]): boolean {
    return entities.some(e => e.type === 'time_range');
  }

  private hasUserEntities(entities: Entity[]): boolean {
    return entities.some(e => e.type === 'user_id');
  }

  private isEntityRecent(entity: MemoryEntity, maxAge: number): boolean {
    return entity.ageInMessages < maxAge;
  }

  private confidenceToNumber(confidence: ConfidenceLevel): number {
    switch (confidence) {
      case 'very_high': return 0.95;
      case 'high': return 0.8;
      case 'medium': return 0.6;
      case 'low': return 0.4;
      case 'very_low': return 0.2;
      default: return 0.5;
    }
  }

  private numberToConfidence(score: number): ConfidenceLevel {
    if (score >= 0.9) return 'very_high';
    if (score >= 0.7) return 'high';
    if (score >= 0.5) return 'medium';
    if (score >= 0.3) return 'low';
    return 'very_low';
  }

  /**
   * Get contextual parser statistics
   */
  getStatistics(): {
    activeSessions: number;
    totalEntityMemories: number;
    averageEntitiesPerSession: number;
    conversationFlows: number;
  } {
    const entityMemories = Array.from(this.entityMemory.values());
    const totalEntities = entityMemories.reduce((sum, memory) => sum + memory.entities.length, 0);

    return {
      activeSessions: this.entityMemory.size,
      totalEntityMemories: totalEntities,
      averageEntitiesPerSession: entityMemories.length > 0 ? totalEntities / entityMemories.length : 0,
      conversationFlows: this.conversationFlows.size,
    };
  }

  /**
   * Clean up old session data
   */
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    let cleanedCount = 0;

    // Clean up old entity memories
    for (const [sessionId, memory] of this.entityMemory.entries()) {
      const memoryAge = now - new Date(memory.lastUpdate).getTime();
      if (memoryAge > maxAge) {
        this.entityMemory.delete(sessionId);
        cleanedCount++;
      }
    }

    // Clean up old conversation flows
    for (const [sessionId, flow] of this.conversationFlows.entries()) {
      const flowAge = now - new Date(flow.lastUpdate).getTime();
      if (flowAge > maxAge) {
        this.conversationFlows.delete(sessionId);
        cleanedCount++;
      }
    }

    this.logger.debug('Contextual parser cleanup completed', {
      cleanedSessions: cleanedCount,
      remainingMemories: this.entityMemory.size,
      remainingFlows: this.conversationFlows.size,
    });

    return cleanedCount;
  }
}

type ConversationPhase = 'authentication' | 'discovery' | 'investigation' | 'monitoring' | 'configuration' | 'assistance' | 'general';

interface EnhancedNLParseResult extends NLParseResult {
  contextualEnhancements: {
    resolvedReferences: ResolvedReference[];
    inheritedEntities: InheritedEntity[];
    conversationFlow: ConversationFlowContext | null;
    implicitContext: Record<string, any>;
    confidence: ConfidenceLevel;
    error?: string;
  };
}

interface ResolvedReference {
  original: string;
  resolved: string;
  type: string;
  confidence: ConfidenceLevel;
  source: string;
  position: number;
}

interface InheritedEntity {
  entity: Entity;
  source: string;
  confidence: ConfidenceLevel;
  ageInMessages: number;
}

interface ConversationFlow {
  sessionId: string;
  phases: ConversationPhaseInfo[];
  currentPhase: ConversationPhaseInfo | null;
  transitionCount: number;
  lastUpdate: string;
}

interface ConversationPhaseInfo {
  phase: ConversationPhase;
  startTime: string;
  endTime: string | null;
  intents: IntentType[];
  entities: number;
}

interface ConversationFlowContext {
  currentPhase: ConversationPhase;
  phaseIntents: IntentType[];
  transitionCount: number;
  isPhaseTransition: boolean;
}

interface EntityMemory {
  sessionId: string;
  entities: MemoryEntity[];
  lastUpdate: string;
}

interface MemoryEntity {
  type: string;
  value: string;
  confidence: ConfidenceLevel;
  timestamp: string;
  ageInMessages: number;
}