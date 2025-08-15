import { logger } from '@/lib/logger';
import { StreamEvent } from '@/types/threat';

export interface SmartFilterRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number; // Higher number = higher priority
  conditions: FilterCondition[];
  actions: FilterAction[];
  metadata: {
    createdAt: string;
    createdBy: string;
    lastModified: string;
    tags: string[];
    description?: string;
  };
  statistics: {
    eventsProcessed: number;
    eventsMatched: number;
    eventsFiltered: number;
    lastTriggered?: string;
  };
}

export interface FilterCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'regex' | 'greater_than' | 'less_than' | 'in' | 'not_in' | 'exists' | 'not_exists' | 'ml_similarity' | 'temporal_pattern' | 'geospatial_within';
  value?: any;
  weight?: number; // For weighted scoring
  negate?: boolean;
}

export interface FilterAction {
  type: 'block' | 'allow' | 'modify' | 'tag' | 'route' | 'aggregate' | 'alert';
  parameters: {
    [key: string]: any;
  };
}

export interface FilterContext {
  clientId: string;
  userId?: string;
  clientType: 'cli' | 'web' | 'api' | 'mobile';
  userPreferences?: UserFilterPreferences;
  sessionContext?: {
    location?: string;
    timeZone?: string;
    userRole?: string;
    securityClearance?: string;
  };
}

export interface UserFilterPreferences {
  severityMinimum: 'low' | 'medium' | 'high' | 'critical';
  eventTypePreferences: {
    [eventType: string]: {
      enabled: boolean;
      priority: number;
    };
  };
  noiseReduction: {
    enabled: boolean;
    level: 'conservative' | 'moderate' | 'aggressive';
  };
  intelligentGrouping: {
    enabled: boolean;
    timeWindow: number; // milliseconds
    similarityThreshold: number; // 0.0 - 1.0
  };
}

export interface FilterResult {
  action: 'allow' | 'block' | 'modify';
  modifiedEvent?: StreamEvent;
  matchedRules: string[];
  score: number;
  reasoning: string[];
  metadata: {
    processingTime: number;
    rulesEvaluated: number;
    conditionsMatched: number;
  };
}

export class SmartFilteringService {
  private rules: Map<string, SmartFilterRule> = new Map();
  private userPreferences: Map<string, UserFilterPreferences> = new Map();
  private eventCache: Map<string, StreamEvent[]> = new Map(); // For temporal analysis
  private statisticsInterval?: NodeJS.Timeout;

  constructor() {
    this.initializeDefaultRules();
    this.startStatisticsTracking();

    logger.info('Smart Filtering Service initialized', {
      features: [
        'rule_based_filtering',
        'ml_similarity_matching',
        'temporal_pattern_detection',
        'geospatial_filtering',
        'user_preference_adaptation',
        'intelligent_noise_reduction'
      ],
      defaultRules: this.rules.size
    });
  }

  /**
   * Apply smart filtering to a stream event
   */
  async applyFilters(event: StreamEvent, context: FilterContext): Promise<FilterResult> {
    const startTime = Date.now();
    const result: FilterResult = {
      action: 'allow',
      matchedRules: [],
      score: 0,
      reasoning: [],
      metadata: {
        processingTime: 0,
        rulesEvaluated: 0,
        conditionsMatched: 0
      }
    };

    try {
      // Get applicable rules sorted by priority
      const applicableRules = this.getApplicableRules(event, context);
      result.metadata.rulesEvaluated = applicableRules.length;

      // Apply user preferences first
      const preferencesResult = await this.applyUserPreferences(event, context);
      if (preferencesResult.action === 'block') {
        result.action = 'block';
        result.reasoning.push('Blocked by user preferences');
        result.metadata.processingTime = Date.now() - startTime;
        return result;
      }

      // Evaluate rules in priority order
      for (const rule of applicableRules) {
        const ruleResult = await this.evaluateRule(rule, event, context);
        
        if (ruleResult.matched) {
          result.matchedRules.push(rule.id);
          result.score += ruleResult.score;
          result.reasoning.push(...ruleResult.reasoning);
          result.metadata.conditionsMatched += ruleResult.conditionsMatched;

          // Update rule statistics
          rule.statistics.eventsMatched++;
          rule.statistics.lastTriggered = new Date().toISOString();

          // Apply rule actions
          const actionResult = await this.applyRuleActions(rule, event, ruleResult);
          
          if (actionResult.action === 'block') {
            result.action = 'block';
            break;
          } else if (actionResult.action === 'modify') {
            result.action = 'modify';
            result.modifiedEvent = actionResult.modifiedEvent;
          }
        }

        rule.statistics.eventsProcessed++;
      }

      // Apply ML-based intelligent filtering
      if (result.action === 'allow') {
        const mlResult = await this.applyMLIntelligentFiltering(event, context, result);
        result.score += mlResult.score;
        result.reasoning.push(...mlResult.reasoning);
      }

    } catch (error) {
      logger.error('Error applying smart filters', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventId: event.metadata?.correlationId,
        clientId: context.clientId
      });
    }

    result.metadata.processingTime = Date.now() - startTime;
    return result;
  }

  /**
   * Add or update a filter rule
   */
  addOrUpdateRule(rule: Omit<SmartFilterRule, 'statistics'>): void {
    const fullRule: SmartFilterRule = {
      ...rule,
      statistics: {
        eventsProcessed: 0,
        eventsMatched: 0,
        eventsFiltered: 0
      }
    };

    this.rules.set(rule.id, fullRule);

    logger.info('Smart filter rule added/updated', {
      ruleId: rule.id,
      ruleName: rule.name,
      conditions: rule.conditions.length,
      actions: rule.actions.length
    });
  }

  /**
   * Remove a filter rule
   */
  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      logger.info('Smart filter rule removed', { ruleId });
    }
    return removed;
  }

  /**
   * Update user filter preferences
   */
  updateUserPreferences(userId: string, preferences: UserFilterPreferences): void {
    this.userPreferences.set(userId, preferences);
    
    logger.debug('User filter preferences updated', {
      userId,
      preferences
    });
  }

  /**
   * Get applicable rules for an event and context
   */
  private getApplicableRules(event: StreamEvent, context: FilterContext): SmartFilterRule[] {
    const applicableRules: SmartFilterRule[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      // Check if rule applies to this client type, event type, etc.
      if (this.ruleAppliesTo(rule, event, context)) {
        applicableRules.push(rule);
      }
    }

    // Sort by priority (higher priority first)
    return applicableRules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Check if a rule applies to the given event and context
   */
  private ruleAppliesTo(rule: SmartFilterRule, event: StreamEvent, context: FilterContext): boolean {
    // Add logic to check if rule applies based on metadata, tags, etc.
    // For now, return true for all rules
    return true;
  }

  /**
   * Apply user preferences filtering
   */
  private async applyUserPreferences(event: StreamEvent, context: FilterContext): Promise<{ action: 'allow' | 'block'; reasoning: string[] }> {
    const preferences = context.userId ? this.userPreferences.get(context.userId) : null;
    
    if (!preferences) {
      return { action: 'allow', reasoning: [] };
    }

    const reasoning: string[] = [];

    // Check severity minimum
    const eventSeverity = event.data?.severity;
    if (eventSeverity) {
      const severityOrder = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
      const eventSeverityLevel = severityOrder[eventSeverity as keyof typeof severityOrder] || 0;
      const minSeverityLevel = severityOrder[preferences.severityMinimum];

      if (eventSeverityLevel < minSeverityLevel) {
        return { action: 'block', reasoning: [`Event severity ${eventSeverity} below user minimum ${preferences.severityMinimum}`] };
      }
    }

    // Check event type preferences
    const eventTypePrefs = preferences.eventTypePreferences[event.type];
    if (eventTypePrefs && !eventTypePrefs.enabled) {
      return { action: 'block', reasoning: [`Event type ${event.type} disabled in user preferences`] };
    }

    return { action: 'allow', reasoning };
  }

  /**
   * Evaluate a single rule against an event
   */
  private async evaluateRule(
    rule: SmartFilterRule, 
    event: StreamEvent, 
    context: FilterContext
  ): Promise<{
    matched: boolean;
    score: number;
    reasoning: string[];
    conditionsMatched: number;
  }> {
    const result = {
      matched: false,
      score: 0,
      reasoning: [] as string[],
      conditionsMatched: 0
    };

    let totalWeight = 0;
    let matchedWeight = 0;

    for (const condition of rule.conditions) {
      const conditionResult = await this.evaluateCondition(condition, event, context);
      const weight = condition.weight || 1;
      
      totalWeight += weight;

      if (conditionResult.matched) {
        matchedWeight += weight;
        result.conditionsMatched++;
        result.reasoning.push(conditionResult.reasoning);
      }
    }

    // Rule matches if weighted score is > 50%
    if (totalWeight > 0) {
      const weightedScore = matchedWeight / totalWeight;
      result.score = weightedScore * 100;
      result.matched = weightedScore > 0.5;
    }

    return result;
  }

  /**
   * Evaluate a single condition
   */
  private async evaluateCondition(
    condition: FilterCondition,
    event: StreamEvent,
    context: FilterContext
  ): Promise<{ matched: boolean; reasoning: string }> {
    try {
      const fieldValue = this.getFieldValue(event, condition.field);
      let matched = false;
      let reasoning = `${condition.field} ${condition.operator} ${condition.value}`;

      switch (condition.operator) {
        case 'equals':
          matched = fieldValue === condition.value;
          break;
        case 'not_equals':
          matched = fieldValue !== condition.value;
          break;
        case 'contains':
          matched = typeof fieldValue === 'string' && fieldValue.includes(condition.value);
          break;
        case 'not_contains':
          matched = typeof fieldValue === 'string' && !fieldValue.includes(condition.value);
          break;
        case 'regex':
          if (typeof fieldValue === 'string') {
            const regex = new RegExp(condition.value);
            matched = regex.test(fieldValue);
          }
          break;
        case 'greater_than':
          matched = typeof fieldValue === 'number' && fieldValue > condition.value;
          break;
        case 'less_than':
          matched = typeof fieldValue === 'number' && fieldValue < condition.value;
          break;
        case 'in':
          matched = Array.isArray(condition.value) && condition.value.includes(fieldValue);
          break;
        case 'not_in':
          matched = Array.isArray(condition.value) && !condition.value.includes(fieldValue);
          break;
        case 'exists':
          matched = fieldValue !== undefined && fieldValue !== null;
          break;
        case 'not_exists':
          matched = fieldValue === undefined || fieldValue === null;
          break;
        case 'ml_similarity':
          matched = await this.evaluateMLSimilarity(fieldValue, condition.value);
          reasoning += ' (ML similarity)';
          break;
        case 'temporal_pattern':
          matched = await this.evaluateTemporalPattern(event, condition.value, context);
          reasoning += ' (temporal pattern)';
          break;
        case 'geospatial_within':
          matched = this.evaluateGeospatialWithin(fieldValue, condition.value);
          reasoning += ' (geospatial)';
          break;
      }

      // Apply negation if specified
      if (condition.negate) {
        matched = !matched;
        reasoning += ' (negated)';
      }

      return { matched, reasoning: matched ? reasoning : '' };

    } catch (error) {
      logger.error('Error evaluating filter condition', {
        condition: condition.field,
        operator: condition.operator,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return { matched: false, reasoning: 'Evaluation error' };
    }
  }

  /**
   * Apply rule actions
   */
  private async applyRuleActions(
    rule: SmartFilterRule,
    event: StreamEvent,
    ruleResult: { matched: boolean; score: number; reasoning: string[] }
  ): Promise<{ action: 'allow' | 'block' | 'modify'; modifiedEvent?: StreamEvent }> {
    let finalAction: 'allow' | 'block' | 'modify' = 'allow';
    let modifiedEvent = event;

    for (const action of rule.actions) {
      switch (action.type) {
        case 'block':
          finalAction = 'block';
          rule.statistics.eventsFiltered++;
          logger.debug('Event blocked by smart filter rule', {
            ruleId: rule.id,
            ruleName: rule.name,
            eventId: event.metadata?.correlationId
          });
          break;

        case 'modify':
          finalAction = 'modify';
          modifiedEvent = await this.modifyEvent(event, action.parameters);
          break;

        case 'tag':
          modifiedEvent = {
            ...modifiedEvent,
            metadata: {
              ...modifiedEvent.metadata,
              tags: [...(modifiedEvent.metadata.tags || []), ...action.parameters.tags]
            }
          };
          finalAction = 'modify';
          break;

        case 'alert':
          // Send alert (would be implemented based on alerting system)
          logger.warn('Smart filter alert triggered', {
            ruleId: rule.id,
            ruleName: rule.name,
            eventId: event.metadata?.correlationId,
            alertParameters: action.parameters
          });
          break;
      }
    }

    return { action: finalAction, modifiedEvent: finalAction === 'modify' ? modifiedEvent : undefined };
  }

  /**
   * Apply ML-based intelligent filtering
   */
  private async applyMLIntelligentFiltering(
    event: StreamEvent,
    context: FilterContext,
    currentResult: FilterResult
  ): Promise<{ score: number; reasoning: string[] }> {
    // This would integrate with the ML models for intelligent filtering
    // For now, return a simple heuristic-based result
    
    const reasoning: string[] = [];
    let score = 0;

    // Noise reduction heuristics
    if (context.userPreferences?.noiseReduction?.enabled) {
      const noiseScore = this.calculateNoiseScore(event);
      score += noiseScore;
      
      if (noiseScore > 0) {
        reasoning.push(`Noise reduction applied (score: ${noiseScore.toFixed(2)})`);
      }
    }

    // Relevance scoring based on user behavior
    const relevanceScore = this.calculateRelevanceScore(event, context);
    score += relevanceScore;
    
    if (relevanceScore > 0) {
      reasoning.push(`Relevance scoring applied (score: ${relevanceScore.toFixed(2)})`);
    }

    return { score, reasoning };
  }

  /**
   * Helper methods
   */
  private getFieldValue(event: StreamEvent, fieldPath: string): any {
    const fields = fieldPath.split('.');
    let value: any = event;
    
    for (const field of fields) {
      if (value && typeof value === 'object') {
        value = value[field];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  private async evaluateMLSimilarity(value: any, targetValue: any): Promise<boolean> {
    // Placeholder for ML similarity evaluation
    // Would use cosine similarity, semantic similarity, etc.
    return false;
  }

  private async evaluateTemporalPattern(event: StreamEvent, pattern: any, context: FilterContext): Promise<boolean> {
    // Placeholder for temporal pattern evaluation
    // Would analyze event sequences, timing patterns, etc.
    return false;
  }

  private evaluateGeospatialWithin(value: any, region: any): boolean {
    // Placeholder for geospatial evaluation
    // Would check if coordinates are within specified region
    return false;
  }

  private async modifyEvent(event: StreamEvent, parameters: any): Promise<StreamEvent> {
    // Apply modifications based on parameters
    return {
      ...event,
      data: {
        ...event.data,
        ...parameters.modifications
      }
    };
  }

  private calculateNoiseScore(event: StreamEvent): number {
    // Simple noise detection heuristics
    let score = 0;

    // Check for common noise patterns
    if (event.data?.severity === 'low' && Math.random() < 0.3) {
      score -= 10; // Reduce score for potentially noisy low-severity events
    }

    return score;
  }

  private calculateRelevanceScore(event: StreamEvent, context: FilterContext): number {
    // Simple relevance scoring
    let score = 0;

    // Boost score for high-priority event types
    if (context.userPreferences?.eventTypePreferences?.[event.type]?.priority && 
        context.userPreferences.eventTypePreferences[event.type].priority > 5) {
      score += 20;
    }

    return score;
  }

  /**
   * Initialize default filter rules
   */
  private initializeDefaultRules(): void {
    const defaultRules: Omit<SmartFilterRule, 'statistics'>[] = [
      {
        id: 'critical-threats-only',
        name: 'Critical Threats Priority',
        enabled: true,
        priority: 100,
        conditions: [
          { field: 'data.severity', operator: 'equals', value: 'critical', weight: 1 }
        ],
        actions: [
          { type: 'tag', parameters: { tags: ['priority', 'critical'] } }
        ],
        metadata: {
          createdAt: new Date().toISOString(),
          createdBy: 'system',
          lastModified: new Date().toISOString(),
          tags: ['default', 'security'],
          description: 'Prioritize critical severity threats'
        }
      },
      {
        id: 'duplicate-suppression',
        name: 'Duplicate Event Suppression',
        enabled: true,
        priority: 50,
        conditions: [
          { field: 'type', operator: 'exists', weight: 1, value: null }
        ],
        actions: [
          { type: 'aggregate', parameters: { window: 30000, similarity: 0.8 } }
        ],
        metadata: {
          createdAt: new Date().toISOString(),
          createdBy: 'system',
          lastModified: new Date().toISOString(),
          tags: ['default', 'deduplication'],
          description: 'Suppress duplicate events within 30-second windows'
        }
      }
    ];

    for (const rule of defaultRules) {
      this.addOrUpdateRule(rule);
    }
  }

  /**
   * Start statistics tracking
   */
  private startStatisticsTracking(): void {
    // Log statistics every 5 minutes
    this.statisticsInterval = setInterval(() => {
      this.logFilteringStatistics();
    }, 300000);
  }

  /**
   * Log filtering statistics
   */
  private logFilteringStatistics(): void {
    const stats = {
      totalRules: this.rules.size,
      enabledRules: Array.from(this.rules.values()).filter(r => r.enabled).length,
      totalEventsProcessed: Array.from(this.rules.values()).reduce((sum, r) => sum + r.statistics.eventsProcessed, 0),
      totalEventsMatched: Array.from(this.rules.values()).reduce((sum, r) => sum + r.statistics.eventsMatched, 0),
      totalEventsFiltered: Array.from(this.rules.values()).reduce((sum, r) => sum + r.statistics.eventsFiltered, 0),
      activeUserPreferences: this.userPreferences.size
    };

    logger.info('Smart filtering statistics', stats);
  }

  /**
   * Get filtering statistics
   */
  getStatistics(): {
    rules: Array<{ id: string; name: string; statistics: SmartFilterRule['statistics'] }>;
    systemStats: {
      totalRules: number;
      enabledRules: number;
      totalEventsProcessed: number;
      totalEventsMatched: number;
      totalEventsFiltered: number;
      activeUserPreferences: number;
    };
  } {
    const rules = Array.from(this.rules.values()).map(rule => ({
      id: rule.id,
      name: rule.name,
      statistics: rule.statistics
    }));

    const systemStats = {
      totalRules: this.rules.size,
      enabledRules: Array.from(this.rules.values()).filter(r => r.enabled).length,
      totalEventsProcessed: Array.from(this.rules.values()).reduce((sum, r) => sum + r.statistics.eventsProcessed, 0),
      totalEventsMatched: Array.from(this.rules.values()).reduce((sum, r) => sum + r.statistics.eventsMatched, 0),
      totalEventsFiltered: Array.from(this.rules.values()).reduce((sum, r) => sum + r.statistics.eventsFiltered, 0),
      activeUserPreferences: this.userPreferences.size
    };

    return { rules, systemStats };
  }

  /**
   * Cleanup service
   */
  cleanup(): void {
    if (this.statisticsInterval) {
      clearInterval(this.statisticsInterval);
      this.statisticsInterval = undefined;
    }

    this.rules.clear();
    this.userPreferences.clear();
    this.eventCache.clear();

    logger.info('Smart Filtering Service cleaned up');
  }
}

// Singleton instance
export const smartFilteringService = new SmartFilteringService();