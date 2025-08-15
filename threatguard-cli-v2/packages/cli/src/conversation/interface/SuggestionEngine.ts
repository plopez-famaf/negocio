import { Logger } from '@threatguard/core';
import type { ConversationContext } from '../types/Context.js';
import type { ParsedCommand } from '../types/Command.js';
import type { IntentType } from '../types/Intent.js';
import type { Suggestion } from './ChatManager.js';

export interface SuggestionEngineOptions {
  logger: Logger;
  maxSuggestions?: number;
  enableWorkflowSuggestions?: boolean;
  enableContextualSuggestions?: boolean;
  enableCompletionSuggestions?: boolean;
  confidenceThreshold?: number;
}

export interface SuggestionRule {
  id: string;
  trigger: SuggestionTrigger;
  suggestions: SuggestionTemplate[];
  conditions?: SuggestionCondition[];
  priority: number;
}

export interface SuggestionTrigger {
  type: 'intent' | 'phase' | 'error' | 'completion' | 'welcome' | 'post_execution';
  value: string;
}

export interface SuggestionTemplate {
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
    tags?: string[];
  };
}

export interface SuggestionCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'exists' | 'not_exists';
  value: any;
}

/**
 * Context-aware smart suggestions engine
 * Generates relevant command and workflow suggestions based on conversation state
 */
export class SuggestionEngine {
  private logger: Logger;
  private maxSuggestions: number;
  private enableWorkflowSuggestions: boolean;
  private enableContextualSuggestions: boolean;
  private enableCompletionSuggestions: boolean;
  private confidenceThreshold: number;

  // Suggestion rules organized by trigger type
  private suggestionRules: Map<string, SuggestionRule[]> = new Map();
  
  // Workflow patterns for contextual suggestions
  private workflowPatterns: Map<string, string[]> = new Map();

  constructor(options: SuggestionEngineOptions) {
    this.logger = options.logger;
    this.maxSuggestions = options.maxSuggestions ?? 5;
    this.enableWorkflowSuggestions = options.enableWorkflowSuggestions ?? true;
    this.enableContextualSuggestions = options.enableContextualSuggestions ?? true;
    this.enableCompletionSuggestions = options.enableCompletionSuggestions ?? true;
    this.confidenceThreshold = options.confidenceThreshold ?? 0.5;

    this.initializeSuggestionRules();
    this.initializeWorkflowPatterns();

    this.logger.debug('Suggestion engine initialized', {
      maxSuggestions: this.maxSuggestions,
      workflowSuggestions: this.enableWorkflowSuggestions,
      contextualSuggestions: this.enableContextualSuggestions,
      completionSuggestions: this.enableCompletionSuggestions,
      confidenceThreshold: this.confidenceThreshold,
    });
  }

  /**
   * Generate contextual suggestions based on conversation state
   */
  async generateContextualSuggestions(context: ConversationContext): Promise<Suggestion[]> {
    this.logger.debug('Generating contextual suggestions', {
      recentIntentsCount: context.recentIntents.length,
      recentEntitiesCount: context.recentEntities.length,
      sessionPhase: (context as any).session?.currentTopic,
    });

    try {
      const suggestions: Suggestion[] = [];

      // Generate workflow-based suggestions
      if (this.enableWorkflowSuggestions) {
        const workflowSuggestions = await this.generateWorkflowSuggestions(context);
        suggestions.push(...workflowSuggestions);
      }

      // Generate context-aware suggestions
      if (this.enableContextualSuggestions) {
        const contextSuggestions = await this.generateContextAwareSuggestions(context);
        suggestions.push(...contextSuggestions);
      }

      // Generate phase-specific suggestions
      const phaseSuggestions = await this.generatePhaseSuggestions(context);
      suggestions.push(...phaseSuggestions);

      // Rank and filter suggestions
      const rankedSuggestions = this.rankSuggestions(suggestions, context);
      const filteredSuggestions = this.filterSuggestions(rankedSuggestions);

      this.logger.debug('Contextual suggestions generated', {
        totalGenerated: suggestions.length,
        finalCount: filteredSuggestions.length,
      });

      return filteredSuggestions;

    } catch (error) {
      this.logger.error('Contextual suggestion generation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Generate workflow-based suggestions
   */
  private async generateWorkflowSuggestions(context: ConversationContext): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];
    
    if (context.recentIntents.length === 0) return suggestions;

    const lastIntent = context.recentIntents[0];
    const workflowNext = this.workflowPatterns.get(lastIntent);

    if (workflowNext) {
      for (const nextIntent of workflowNext) {
        const rules = this.suggestionRules.get(`intent_${nextIntent}`) || [];
        
        for (const rule of rules) {
          if (this.evaluateRuleConditions(rule, context)) {
            const ruleSuggestions = this.createSuggestionsFromRule(rule, context);
            suggestions.push(...ruleSuggestions);
          }
        }
      }
    }

    return suggestions;
  }

  /**
   * Generate context-aware suggestions based on recent conversation
   */
  private async generateContextAwareSuggestions(context: ConversationContext): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];

    // Suggest based on recent entities
    if (context.recentEntities.length > 0) {
      const hasTargets = context.recentEntities.some(e => 
        ['ip_address', 'network_range', 'domain'].includes(e.type)
      );

      if (hasTargets) {
        suggestions.push({
          id: 'scan-recent-targets',
          type: 'command',
          title: 'Scan recent targets',
          description: 'Perform security scan on recently mentioned targets',
          action: 'scan recent targets for threats',
          confidence: 0.8,
          metadata: {
            category: 'security',
            risk: 'medium',
            estimatedTime: 120000,
            tags: ['scan', 'targets'],
          },
        });
      }

      const hasThreats = context.recentEntities.some(e => e.type === 'threat_type');
      if (hasThreats) {
        suggestions.push({
          id: 'investigate-threats',
          type: 'workflow',
          title: 'Investigate threats',
          description: 'Deep dive into recently identified threat types',
          action: 'analyze threats in detail',
          confidence: 0.7,
          metadata: {
            category: 'analysis',
            risk: 'low',
            tags: ['threats', 'investigation'],
          },
        });
      }
    }

    // Suggest based on recent commands pattern
    if (context.recentCommands.length > 0) {
      const lastCommand = context.recentCommands[0];
      
      if (lastCommand.includes('scan')) {
        suggestions.push({
          id: 'view-scan-results',
          type: 'command',
          title: 'View scan results',
          description: 'List and analyze recent scan findings',
          action: 'list threats',
          confidence: 0.9,
          metadata: {
            category: 'analysis',
            risk: 'safe',
            tags: ['results', 'analysis'],
          },
        });
      }

      if (lastCommand.includes('threat') && !lastCommand.includes('watch')) {
        suggestions.push({
          id: 'monitor-threats',
          type: 'command',
          title: 'Monitor threats',
          description: 'Start real-time threat monitoring',
          action: 'watch threats',
          confidence: 0.8,
          metadata: {
            category: 'monitoring',
            risk: 'safe',
            estimatedTime: -1, // Continuous
            tags: ['monitoring', 'realtime'],
          },
        });
      }
    }

    return suggestions;
  }

  /**
   * Generate phase-specific suggestions
   */
  private async generatePhaseSuggestions(context: ConversationContext): Promise<Suggestion[]> {
    const phase = this.determineConversationPhase(context);
    const rules = this.suggestionRules.get(`phase_${phase}`) || [];

    const suggestions: Suggestion[] = [];

    for (const rule of rules) {
      if (this.evaluateRuleConditions(rule, context)) {
        const ruleSuggestions = this.createSuggestionsFromRule(rule, context);
        suggestions.push(...ruleSuggestions);
      }
    }

    return suggestions;
  }

  /**
   * Generate welcome suggestions for new sessions
   */
  async generateWelcomeSuggestions(context: ConversationContext): Promise<Suggestion[]> {
    const rules = this.suggestionRules.get('welcome') || [];
    const suggestions: Suggestion[] = [];

    for (const rule of rules) {
      const ruleSuggestions = this.createSuggestionsFromRule(rule, context);
      suggestions.push(...ruleSuggestions);
    }

    return this.filterSuggestions(suggestions);
  }

  /**
   * Generate suggestions after command execution
   */
  async generatePostExecutionSuggestions(
    command: ParsedCommand,
    context: ConversationContext
  ): Promise<Suggestion[]> {
    const rules = this.suggestionRules.get(`post_${command.intent}`) || 
                 this.suggestionRules.get('post_execution') || [];

    const suggestions: Suggestion[] = [];

    for (const rule of rules) {
      if (this.evaluateRuleConditions(rule, context, command)) {
        const ruleSuggestions = this.createSuggestionsFromRule(rule, context, command);
        suggestions.push(...ruleSuggestions);
      }
    }

    return this.filterSuggestions(suggestions);
  }

  /**
   * Generate error recovery suggestions
   */
  async generateErrorRecoverySuggestions(
    error: any,
    context: ConversationContext
  ): Promise<Suggestion[]> {
    const errorType = this.classifyError(error);
    const rules = this.suggestionRules.get(`error_${errorType}`) || 
                 this.suggestionRules.get('error_general') || [];

    const suggestions: Suggestion[] = [];

    for (const rule of rules) {
      const ruleSuggestions = this.createSuggestionsFromRule(rule, context);
      suggestions.push(...ruleSuggestions);
    }

    return this.filterSuggestions(suggestions);
  }

  /**
   * Generate completion suggestions for partial input
   */
  async generateCompletionSuggestions(
    partialInput: string,
    context: ConversationContext
  ): Promise<Suggestion[]> {
    if (!this.enableCompletionSuggestions) return [];

    const suggestions: Suggestion[] = [];
    const normalizedInput = partialInput.toLowerCase().trim();

    // Command completion patterns
    const completionPatterns = [
      { pattern: /^scan/, suggestions: ['scan my network', 'scan for threats', 'scan specific target'] },
      { pattern: /^threat/, suggestions: ['threat list', 'threat watch', 'threat details'] },
      { pattern: /^system/, suggestions: ['system status', 'system health'] },
      { pattern: /^auth/, suggestions: ['auth status', 'auth login'] },
      { pattern: /^help/, suggestions: ['help commands', 'help getting started'] },
    ];

    for (const { pattern, suggestions: completions } of completionPatterns) {
      if (pattern.test(normalizedInput)) {
        completions.forEach((completion, index) => {
          suggestions.push({
            id: `completion-${index}`,
            type: 'completion',
            title: completion,
            description: `Complete as: ${completion}`,
            action: completion,
            confidence: 0.9 - (index * 0.1),
            metadata: {
              category: 'completion',
              tags: ['autocomplete'],
            },
          });
        });
        break;
      }
    }

    return suggestions;
  }

  /**
   * Initialize suggestion rules
   */
  private initializeSuggestionRules(): void {
    // Welcome suggestions
    this.suggestionRules.set('welcome', [
      {
        id: 'welcome-basic',
        trigger: { type: 'welcome', value: 'new_session' },
        suggestions: [
          {
            id: 'system-status',
            type: 'command',
            title: 'Check system status',
            description: 'Get an overview of your security posture',
            action: 'system status',
            confidence: 0.9,
            metadata: { category: 'assessment', risk: 'safe', tags: ['status', 'overview'] },
          },
          {
            id: 'scan-network',
            type: 'command',
            title: 'Scan network',
            description: 'Perform a security scan of your network',
            action: 'scan my network for threats',
            confidence: 0.8,
            metadata: { category: 'security', risk: 'medium', estimatedTime: 120000, tags: ['scan', 'network'] },
          },
          {
            id: 'view-help',
            type: 'help',
            title: 'Getting started',
            description: 'Learn about available commands and features',
            action: 'help getting started',
            confidence: 0.7,
            metadata: { category: 'help', risk: 'safe', tags: ['help', 'tutorial'] },
          },
        ],
        priority: 10,
      },
    ]);

    // Discovery phase suggestions
    this.suggestionRules.set('phase_discovery', [
      {
        id: 'discovery-workflow',
        trigger: { type: 'phase', value: 'discovery' },
        suggestions: [
          {
            id: 'deep-scan',
            type: 'workflow',
            title: 'Perform deep scan',
            description: 'Comprehensive security assessment',
            action: 'scan thoroughly for all threats',
            confidence: 0.8,
            metadata: { category: 'security', risk: 'medium', estimatedTime: 600000, tags: ['deep', 'comprehensive'] },
          },
          {
            id: 'threat-intel',
            type: 'command',
            title: 'Check threat intelligence',
            description: 'Query threat databases for indicators',
            action: 'check threat intelligence',
            confidence: 0.7,
            metadata: { category: 'intelligence', risk: 'safe', tags: ['intel', 'reputation'] },
          },
        ],
        priority: 8,
      },
    ]);

    // Investigation phase suggestions
    this.suggestionRules.set('phase_investigation', [
      {
        id: 'investigation-workflow',
        trigger: { type: 'phase', value: 'investigation' },
        suggestions: [
          {
            id: 'behavior-analysis',
            type: 'workflow',
            title: 'Analyze user behavior',
            description: 'Investigate suspicious user activities',
            action: 'analyze user behavior patterns',
            confidence: 0.8,
            metadata: { category: 'analysis', risk: 'low', estimatedTime: 180000, tags: ['behavior', 'users'] },
          },
          {
            id: 'correlate-events',
            type: 'workflow',
            title: 'Correlate security events',
            description: 'Find relationships between security incidents',
            action: 'correlate security events',
            confidence: 0.7,
            metadata: { category: 'analysis', risk: 'safe', tags: ['correlation', 'events'] },
          },
        ],
        priority: 8,
      },
    ]);

    // Post-execution suggestions
    this.suggestionRules.set('post_threat_scan', [
      {
        id: 'post-scan-analysis',
        trigger: { type: 'post_execution', value: 'threat_scan' },
        suggestions: [
          {
            id: 'analyze-results',
            type: 'workflow',
            title: 'Analyze scan results',
            description: 'Deep dive into discovered vulnerabilities',
            action: 'analyze threat details',
            confidence: 0.9,
            metadata: { category: 'analysis', risk: 'safe', tags: ['results', 'analysis'] },
          },
          {
            id: 'start-monitoring',
            type: 'command',
            title: 'Start monitoring',
            description: 'Begin real-time threat monitoring',
            action: 'watch threats',
            confidence: 0.8,
            metadata: { category: 'monitoring', risk: 'safe', estimatedTime: -1, tags: ['monitoring', 'realtime'] },
          },
        ],
        priority: 9,
      },
    ]);

    // Error recovery suggestions
    this.suggestionRules.set('error_permission', [
      {
        id: 'permission-help',
        trigger: { type: 'error', value: 'permission' },
        suggestions: [
          {
            id: 'check-auth',
            type: 'command',
            title: 'Check authentication',
            description: 'Verify your login status',
            action: 'auth status',
            confidence: 0.9,
            metadata: { category: 'auth', risk: 'safe', tags: ['auth', 'status'] },
          },
          {
            id: 'login-help',
            type: 'help',
            title: 'Authentication help',
            description: 'Learn how to authenticate properly',
            action: 'help authentication',
            confidence: 0.8,
            metadata: { category: 'help', risk: 'safe', tags: ['help', 'auth'] },
          },
        ],
        priority: 10,
      },
    ]);

    this.logger.debug('Suggestion rules initialized', {
      ruleCount: Array.from(this.suggestionRules.values()).reduce((sum, arr) => sum + arr.length, 0),
      triggerTypes: this.suggestionRules.size,
    });
  }

  /**
   * Initialize workflow patterns
   */
  private initializeWorkflowPatterns(): void {
    // Security workflow patterns
    this.workflowPatterns.set('system_status', ['threat_scan', 'network_scan']);
    this.workflowPatterns.set('threat_scan', ['threat_list', 'threat_details', 'intel_query']);
    this.workflowPatterns.set('threat_list', ['threat_details', 'behavior_analyze']);
    this.workflowPatterns.set('threat_details', ['intel_query', 'behavior_analyze']);
    this.workflowPatterns.set('intel_query', ['threat_scan', 'behavior_analyze']);
    this.workflowPatterns.set('behavior_analyze', ['threat_watch', 'network_monitor']);
    
    // Authentication workflow
    this.workflowPatterns.set('auth_login', ['system_status', 'threat_scan']);
    this.workflowPatterns.set('auth_status', ['auth_login', 'system_status']);
    
    // Interactive workflow
    this.workflowPatterns.set('interactive_start', ['threat_watch', 'system_status']);
    this.workflowPatterns.set('dashboard_open', ['threat_watch', 'threat_list']);

    this.logger.debug('Workflow patterns initialized', {
      patternCount: this.workflowPatterns.size,
    });
  }

  /**
   * Helper methods
   */
  private evaluateRuleConditions(
    rule: SuggestionRule,
    context: ConversationContext,
    command?: ParsedCommand
  ): boolean {
    if (!rule.conditions) return true;

    return rule.conditions.every(condition => {
      return this.evaluateCondition(condition, context, command);
    });
  }

  private evaluateCondition(
    condition: SuggestionCondition,
    context: ConversationContext,
    command?: ParsedCommand
  ): boolean {
    let value: any;

    // Extract value based on field
    switch (condition.field) {
      case 'context.recentIntents.length':
        value = context.recentIntents.length;
        break;
      case 'context.recentEntities.length':
        value = context.recentEntities.length;
        break;
      case 'context.session.authenticationStatus':
        value = context.session.authenticationStatus;
        break;
      case 'command.safetyLevel':
        value = command?.safetyLevel;
        break;
      default:
        return false;
    }

    // Evaluate condition
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'contains':
        return Array.isArray(value) ? value.includes(condition.value) : 
               typeof value === 'string' ? value.includes(condition.value) : false;
      case 'greater_than':
        return typeof value === 'number' && value > condition.value;
      case 'exists':
        return value !== undefined && value !== null;
      case 'not_exists':
        return value === undefined || value === null;
      default:
        return false;
    }
  }

  private createSuggestionsFromRule(
    rule: SuggestionRule,
    context: ConversationContext,
    command?: ParsedCommand
  ): Suggestion[] {
    return rule.suggestions.map(template => ({
      id: template.id,
      type: template.type,
      title: template.title,
      description: template.description,
      action: template.action,
      confidence: template.confidence * (rule.priority / 10), // Apply rule priority
      metadata: template.metadata,
    }));
  }

  private rankSuggestions(suggestions: Suggestion[], context: ConversationContext): Suggestion[] {
    return suggestions
      .filter(s => s.confidence >= this.confidenceThreshold)
      .sort((a, b) => {
        // Primary sort by confidence
        if (b.confidence !== a.confidence) {
          return b.confidence - a.confidence;
        }
        
        // Secondary sort by type preference
        const typeOrder = { command: 0, workflow: 1, completion: 2, help: 3 };
        return (typeOrder[a.type] || 4) - (typeOrder[b.type] || 4);
      });
  }

  private filterSuggestions(suggestions: Suggestion[]): Suggestion[] {
    // Remove duplicates by action
    const seen = new Set<string>();
    const unique = suggestions.filter(suggestion => {
      if (seen.has(suggestion.action)) return false;
      seen.add(suggestion.action);
      return true;
    });

    // Limit to max suggestions
    return unique.slice(0, this.maxSuggestions);
  }

  private determineConversationPhase(context: ConversationContext): string {
    if (context.recentIntents.length === 0) return 'welcome';
    
    const lastIntent = context.recentIntents[0];
    
    if (lastIntent.startsWith('auth_')) return 'authentication';
    if (['system_status', 'threat_scan', 'network_scan'].includes(lastIntent)) return 'discovery';
    if (['threat_list', 'threat_details', 'intel_query', 'behavior_analyze'].includes(lastIntent)) return 'investigation';
    if (['threat_watch', 'network_monitor', 'dashboard_open'].includes(lastIntent)) return 'monitoring';
    if (lastIntent.startsWith('config_')) return 'configuration';
    
    return 'general';
  }

  private classifyError(error: any): string {
    const message = error instanceof Error ? error.message : String(error);
    
    if (message.includes('permission') || message.includes('unauthorized')) return 'permission';
    if (message.includes('network') || message.includes('connection')) return 'network';
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('validation') || message.includes('invalid')) return 'validation';
    
    return 'general';
  }

  /**
   * Update suggestion engine configuration
   */
  updateConfiguration(updates: {
    maxSuggestions?: number;
    enableWorkflowSuggestions?: boolean;
    enableContextualSuggestions?: boolean;
    enableCompletionSuggestions?: boolean;
    confidenceThreshold?: number;
  }): void {
    if (updates.maxSuggestions !== undefined) {
      this.maxSuggestions = updates.maxSuggestions;
    }
    if (updates.enableWorkflowSuggestions !== undefined) {
      this.enableWorkflowSuggestions = updates.enableWorkflowSuggestions;
    }
    if (updates.enableContextualSuggestions !== undefined) {
      this.enableContextualSuggestions = updates.enableContextualSuggestions;
    }
    if (updates.enableCompletionSuggestions !== undefined) {
      this.enableCompletionSuggestions = updates.enableCompletionSuggestions;
    }
    if (updates.confidenceThreshold !== undefined) {
      this.confidenceThreshold = updates.confidenceThreshold;
    }

    this.logger.info('Suggestion engine configuration updated', updates);
  }

  /**
   * Get suggestion engine statistics
   */
  getStatistics(): {
    ruleCount: number;
    workflowPatterns: number;
    configuration: {
      maxSuggestions: number;
      workflowSuggestions: boolean;
      contextualSuggestions: boolean;
      completionSuggestions: boolean;
      confidenceThreshold: number;
    };
  } {
    return {
      ruleCount: Array.from(this.suggestionRules.values()).reduce((sum, arr) => sum + arr.length, 0),
      workflowPatterns: this.workflowPatterns.size,
      configuration: {
        maxSuggestions: this.maxSuggestions,
        workflowSuggestions: this.enableWorkflowSuggestions,
        contextualSuggestions: this.enableContextualSuggestions,
        completionSuggestions: this.enableCompletionSuggestions,
        confidenceThreshold: this.confidenceThreshold,
      },
    };
  }
}