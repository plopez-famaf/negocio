import { Logger } from '@threatguard/core';
import type { 
  Intent, 
  Entity, 
  IntentType, 
  ConfidenceLevel,
  INTENT_PATTERNS,
  ThreatKeywords,
} from '../types/Intent.js';
import type { ConversationContext } from '../types/Context.js';
import { INTENT_PATTERNS } from '../types/Intent.js';

export interface IntentClassifierOptions {
  logger: Logger;
  enableFuzzyMatching?: boolean;
  enableContextBoost?: boolean;
  enableSemanticAnalysis?: boolean;
  confidenceThreshold?: number;
}

/**
 * Advanced intent classifier with fuzzy matching, context awareness, and semantic analysis
 */
export class IntentClassifier {
  private logger: Logger;
  private enableFuzzyMatching: boolean;
  private enableContextBoost: boolean;
  private enableSemanticAnalysis: boolean;
  private confidenceThreshold: number;

  // Pre-compiled patterns for performance
  private intentPatterns: Map<IntentType, RegExp[]> = new Map();
  private fuzzyPatterns: Map<IntentType, string[]> = new Map();
  
  // Semantic similarity mappings
  private semanticGroups: Map<string, IntentType[]> = new Map();
  
  // Intent transition probabilities for context awareness
  private transitionProbabilities: Map<string, Map<IntentType, number>> = new Map();

  constructor(options: IntentClassifierOptions) {
    this.logger = options.logger;
    this.enableFuzzyMatching = options.enableFuzzyMatching ?? true;
    this.enableContextBoost = options.enableContextBoost ?? true;
    this.enableSemanticAnalysis = options.enableSemanticAnalysis ?? true;
    this.confidenceThreshold = options.confidenceThreshold ?? 0.6;

    this.initializePatterns();
    this.initializeSemanticGroups();
    this.initializeTransitionProbabilities();

    this.logger.debug('Intent classifier initialized', {
      fuzzyMatching: this.enableFuzzyMatching,
      contextBoost: this.enableContextBoost,
      semanticAnalysis: this.enableSemanticAnalysis,
      threshold: this.confidenceThreshold,
    });
  }

  /**
   * Classify intent with advanced pattern matching and context awareness
   */
  async classify(
    input: string,
    entities: Entity[],
    context?: ConversationContext
  ): Promise<Intent> {
    const startTime = Date.now();
    
    this.logger.debug('Classifying intent', {
      inputLength: input.length,
      entitiesCount: entities.length,
      hasContext: !!context,
    });

    try {
      const normalizedInput = this.normalizeInput(input);
      
      // Multiple classification approaches
      const results = await Promise.all([
        this.patternBasedClassification(normalizedInput),
        this.fuzzyMatchingClassification(normalizedInput),
        this.semanticAnalysisClassification(normalizedInput),
        this.entityBasedClassification(entities),
      ]);

      // Combine and rank results
      let combinedResults = this.combineResults(results);

      // Apply context boost if available
      if (this.enableContextBoost && context) {
        combinedResults = this.applyContextBoost(combinedResults, context);
      }

      // Select best result
      const bestResult = this.selectBestResult(combinedResults);

      // Validate confidence threshold
      if (bestResult.confidence < this.confidenceThreshold) {
        return {
          type: 'conversation_unknown',
          confidence: 'low',
          ambiguous: true,
          alternatives: combinedResults.slice(1, 4).map(r => r.intent),
          context: {
            reason: 'below_confidence_threshold',
            actualConfidence: bestResult.confidence,
            threshold: this.confidenceThreshold,
          },
        };
      }

      const processingTime = Date.now() - startTime;
      this.logger.debug('Intent classification completed', {
        intent: bestResult.intent,
        confidence: bestResult.confidenceLevel,
        processingTime,
      });

      return {
        type: bestResult.intent,
        confidence: bestResult.confidenceLevel,
        entities: this.extractIntentRelevantEntities(bestResult.intent, entities),
        ambiguous: combinedResults.length > 1 && combinedResults[1].confidence > 0.4,
        alternatives: combinedResults.slice(1, 3).map(r => r.intent),
        context: {
          classificationMethod: bestResult.method,
          confidence: bestResult.confidence,
          processingTime,
        },
      };

    } catch (error) {
      this.logger.error('Intent classification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        input: input.substring(0, 100),
      });

      return {
        type: 'conversation_unknown',
        confidence: 'very_low',
        ambiguous: true,
        context: { error: 'classification_failed' },
      };
    }
  }

  /**
   * Initialize regex patterns from intent definitions
   */
  private initializePatterns(): void {
    INTENT_PATTERNS.forEach(pattern => {
      const regexPatterns = pattern.patterns.map(p => new RegExp(p, 'i'));
      this.intentPatterns.set(pattern.intent, regexPatterns);
      
      // Store fuzzy patterns for approximate matching
      this.fuzzyPatterns.set(pattern.intent, pattern.patterns);
    });

    this.logger.debug('Initialized intent patterns', {
      exactPatterns: this.intentPatterns.size,
      fuzzyPatterns: this.fuzzyPatterns.size,
    });
  }

  /**
   * Initialize semantic groups for related intents
   */
  private initializeSemanticGroups(): void {
    this.semanticGroups.set('security_operations', [
      'threat_scan', 'threat_list', 'threat_watch', 'threat_details',
      'network_scan', 'network_monitor', 'vulnerability_scan'
    ]);

    this.semanticGroups.set('analysis_operations', [
      'behavior_analyze', 'behavior_patterns', 'behavior_baseline',
      'intel_query', 'intel_analyze'
    ]);

    this.semanticGroups.set('system_operations', [
      'system_status', 'system_health', 'system_info',
      'config_get', 'config_set', 'config_list'
    ]);

    this.semanticGroups.set('authentication_operations', [
      'auth_login', 'auth_logout', 'auth_status', 'auth_refresh'
    ]);

    this.semanticGroups.set('interactive_operations', [
      'interactive_start', 'dashboard_open', 'help_general', 'help_specific'
    ]);

    this.semanticGroups.set('conversation_operations', [
      'conversation_continue', 'conversation_clarify', 'conversation_unknown'
    ]);
  }

  /**
   * Initialize intent transition probabilities for context awareness
   */
  private initializeTransitionProbabilities(): void {
    // Common security workflow patterns
    this.setTransitionProbability('system_status', 'threat_scan', 0.7);
    this.setTransitionProbability('threat_scan', 'threat_list', 0.6);
    this.setTransitionProbability('threat_list', 'threat_details', 0.8);
    this.setTransitionProbability('threat_details', 'behavior_analyze', 0.5);
    this.setTransitionProbability('behavior_analyze', 'intel_query', 0.6);
    
    // Interactive flow patterns
    this.setTransitionProbability('auth_login', 'system_status', 0.7);
    this.setTransitionProbability('auth_login', 'interactive_start', 0.6);
    this.setTransitionProbability('dashboard_open', 'threat_watch', 0.5);
    
    // Configuration patterns
    this.setTransitionProbability('config_get', 'config_set', 0.7);
    this.setTransitionProbability('config_set', 'system_status', 0.5);
    
    // Help and conversation patterns
    this.setTransitionProbability('help_general', 'help_specific', 0.6);
    this.setTransitionProbability('conversation_unknown', 'help_general', 0.8);
  }

  /**
   * Pattern-based classification using regex matching
   */
  private async patternBasedClassification(input: string): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = [];

    for (const [intent, patterns] of this.intentPatterns) {
      let maxScore = 0;
      let bestMatch = '';

      for (const pattern of patterns) {
        const matches = input.match(pattern);
        if (matches) {
          const score = this.calculatePatternScore(matches, input);
          if (score > maxScore) {
            maxScore = score;
            bestMatch = matches[0];
          }
        }
      }

      if (maxScore > 0) {
        results.push({
          intent,
          confidence: maxScore,
          confidenceLevel: this.scoreToConfidence(maxScore),
          method: 'pattern_matching',
          evidence: bestMatch,
        });
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Fuzzy matching classification for approximate pattern matching
   */
  private async fuzzyMatchingClassification(input: string): Promise<ClassificationResult[]> {
    if (!this.enableFuzzyMatching) return [];

    const results: ClassificationResult[] = [];

    for (const [intent, patterns] of this.fuzzyPatterns) {
      let bestScore = 0;
      let bestPattern = '';

      for (const pattern of patterns) {
        const similarity = this.calculateFuzzySimilarity(input, pattern);
        if (similarity > bestScore) {
          bestScore = similarity;
          bestPattern = pattern;
        }
      }

      if (bestScore > 0.3) { // Minimum fuzzy threshold
        results.push({
          intent,
          confidence: bestScore * 0.8, // Reduce confidence for fuzzy matches
          confidenceLevel: this.scoreToConfidence(bestScore * 0.8),
          method: 'fuzzy_matching',
          evidence: bestPattern,
        });
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Semantic analysis classification using word embeddings and semantic similarity
   */
  private async semanticAnalysisClassification(input: string): Promise<ClassificationResult[]> {
    if (!this.enableSemanticAnalysis) return [];

    const results: ClassificationResult[] = [];
    const words = input.toLowerCase().split(/\s+/);

    // Simple semantic analysis based on keyword clustering
    for (const [group, intents] of this.semanticGroups) {
      const semanticScore = this.calculateSemanticScore(words, group);
      
      if (semanticScore > 0.2) {
        // Distribute score among intents in the group
        for (const intent of intents) {
          const intentSpecificScore = this.calculateIntentSpecificSemanticScore(words, intent);
          const combinedScore = (semanticScore + intentSpecificScore) / 2;

          if (combinedScore > 0.2) {
            results.push({
              intent,
              confidence: combinedScore * 0.7, // Reduce confidence for semantic matches
              confidenceLevel: this.scoreToConfidence(combinedScore * 0.7),
              method: 'semantic_analysis',
              evidence: group,
            });
          }
        }
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Entity-based classification using extracted entities to infer intent
   */
  private async entityBasedClassification(entities: Entity[]): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = [];

    if (entities.length === 0) return results;

    // Intent inference based on entity types
    const entityTypes = entities.map(e => e.type);
    
    // Security scanning entities
    if (entityTypes.some(t => ['ip_address', 'network_range', 'domain'].includes(t))) {
      results.push({
        intent: 'threat_scan',
        confidence: 0.6,
        confidenceLevel: 'medium',
        method: 'entity_inference',
        evidence: `target_entities: ${entityTypes.join(', ')}`,
      });
    }

    // Threat intelligence entities
    if (entityTypes.some(t => ['hash', 'cve', 'threat_type'].includes(t))) {
      results.push({
        intent: 'intel_query',
        confidence: 0.7,
        confidenceLevel: 'high',
        method: 'entity_inference',
        evidence: `intelligence_entities: ${entityTypes.join(', ')}`,
      });
    }

    // Behavioral analysis entities
    if (entityTypes.includes('time_range') || entityTypes.includes('user_id')) {
      results.push({
        intent: 'behavior_analyze',
        confidence: 0.5,
        confidenceLevel: 'medium',
        method: 'entity_inference',
        evidence: `behavioral_entities: ${entityTypes.join(', ')}`,
      });
    }

    // Severity-based threat listing
    if (entityTypes.includes('severity')) {
      results.push({
        intent: 'threat_list',
        confidence: 0.6,
        confidenceLevel: 'medium',
        method: 'entity_inference',
        evidence: `severity_entity: ${entities.find(e => e.type === 'severity')?.value}`,
      });
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Combine results from different classification methods
   */
  private combineResults(resultArrays: ClassificationResult[][]): ClassificationResult[] {
    const combinedMap = new Map<IntentType, ClassificationResult>();

    for (const results of resultArrays) {
      for (const result of results) {
        const existing = combinedMap.get(result.intent);
        
        if (existing) {
          // Combine scores using weighted average
          const totalWeight = 2; // Number of methods contributing
          const combinedConfidence = (existing.confidence + result.confidence) / totalWeight;
          
          existing.confidence = Math.max(existing.confidence, combinedConfidence);
          existing.confidenceLevel = this.scoreToConfidence(existing.confidence);
          existing.method = `${existing.method}+${result.method}`;
          existing.evidence = `${existing.evidence}; ${result.evidence}`;
        } else {
          combinedMap.set(result.intent, { ...result });
        }
      }
    }

    return Array.from(combinedMap.values()).sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Apply context boost based on conversation history
   */
  private applyContextBoost(
    results: ClassificationResult[],
    context: ConversationContext
  ): ClassificationResult[] {
    const boostedResults = [...results];

    if (context.recentIntents.length === 0) return boostedResults;

    const lastIntent = context.recentIntents[0];
    
    for (const result of boostedResults) {
      const transitionProb = this.getTransitionProbability(lastIntent, result.intent);
      
      if (transitionProb > 0) {
        // Boost confidence based on transition probability
        const boost = transitionProb * 0.3; // Maximum 30% boost
        result.confidence = Math.min(result.confidence + boost, 1.0);
        result.confidenceLevel = this.scoreToConfidence(result.confidence);
        result.method += '+context_boost';
        result.evidence += `; transition_from_${lastIntent}`;
      }
    }

    // Additional context-specific boosts
    this.applyDomainSpecificBoost(boostedResults, context);

    return boostedResults.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Apply domain-specific context boosts
   */
  private applyDomainSpecificBoost(
    results: ClassificationResult[],
    context: ConversationContext
  ): void {
    // Boost threat-related intents if in security context
    const threatDomainIntents = context.recentIntents.filter(i => i.startsWith('threat_'));
    if (threatDomainIntents.length >= 2) {
      for (const result of results) {
        if (result.intent.startsWith('threat_')) {
          result.confidence = Math.min(result.confidence + 0.2, 1.0);
          result.confidenceLevel = this.scoreToConfidence(result.confidence);
        }
      }
    }

    // Boost interactive intents if user prefers interactive mode
    if (context.session.preferences.suggestCommands) {
      for (const result of results) {
        if (['interactive_start', 'dashboard_open', 'help_general'].includes(result.intent)) {
          result.confidence = Math.min(result.confidence + 0.1, 1.0);
          result.confidenceLevel = this.scoreToConfidence(result.confidence);
        }
      }
    }
  }

  /**
   * Select the best classification result
   */
  private selectBestResult(results: ClassificationResult[]): ClassificationResult {
    if (results.length === 0) {
      return {
        intent: 'conversation_unknown',
        confidence: 0.0,
        confidenceLevel: 'very_low',
        method: 'fallback',
        evidence: 'no_classification_results',
      };
    }

    return results[0];
  }

  /**
   * Calculate pattern matching score
   */
  private calculatePatternScore(matches: RegExpMatchArray, input: string): number {
    const matchLength = matches[0].length;
    const inputLength = input.length;
    const coverage = matchLength / inputLength;
    const exactness = matches.length > 1 ? 0.9 : 1.0; // Slight penalty for partial matches
    
    return Math.min(coverage * exactness * 2, 1.0); // Scale to [0, 1]
  }

  /**
   * Calculate fuzzy similarity between input and pattern
   */
  private calculateFuzzySimilarity(input: string, pattern: string): number {
    // Simple Levenshtein distance-based similarity
    const distance = this.levenshteinDistance(input, pattern);
    const maxLength = Math.max(input.length, pattern.length);
    
    if (maxLength === 0) return 1.0;
    
    return 1 - (distance / maxLength);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate semantic score for a word group
   */
  private calculateSemanticScore(words: string[], group: string): number {
    const groupKeywords = this.getGroupKeywords(group);
    let score = 0;
    
    for (const word of words) {
      if (groupKeywords.includes(word)) {
        score += 0.3;
      }
      
      // Check for partial matches
      for (const keyword of groupKeywords) {
        if (keyword.includes(word) || word.includes(keyword)) {
          score += 0.1;
        }
      }
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculate intent-specific semantic score
   */
  private calculateIntentSpecificSemanticScore(words: string[], intent: IntentType): number {
    const intentKeywords = this.getIntentKeywords(intent);
    let score = 0;

    for (const word of words) {
      if (intentKeywords.includes(word)) {
        score += 0.4;
      }
    }

    return Math.min(score, 1.0);
  }

  /**
   * Get keywords for semantic groups
   */
  private getGroupKeywords(group: string): string[] {
    const keywords: Record<string, string[]> = {
      security_operations: ['scan', 'threat', 'security', 'vulnerability', 'attack', 'monitor'],
      analysis_operations: ['analyze', 'behavior', 'pattern', 'intelligence', 'investigate'],
      system_operations: ['status', 'health', 'system', 'config', 'settings', 'info'],
      authentication_operations: ['login', 'logout', 'auth', 'authenticate', 'session'],
      interactive_operations: ['help', 'dashboard', 'interactive', 'guide', 'assist'],
      conversation_operations: ['what', 'how', 'explain', 'clarify', 'understand'],
    };

    return keywords[group] || [];
  }

  /**
   * Get keywords for specific intents
   */
  private getIntentKeywords(intent: IntentType): string[] {
    const keywords: Partial<Record<IntentType, string[]>> = {
      threat_scan: ['scan', 'check', 'find', 'search', 'detect'],
      threat_list: ['list', 'show', 'display', 'threats', 'alerts'],
      threat_watch: ['watch', 'monitor', 'observe', 'track'],
      system_status: ['status', 'health', 'state', 'condition'],
      auth_login: ['login', 'signin', 'authenticate'],
      help_general: ['help', 'assist', 'guide', 'support'],
    };

    return keywords[intent] || [];
  }

  /**
   * Convert numeric score to confidence level
   */
  private scoreToConfidence(score: number): ConfidenceLevel {
    if (score >= 0.9) return 'very_high';
    if (score >= 0.7) return 'high';
    if (score >= 0.5) return 'medium';
    if (score >= 0.3) return 'low';
    return 'very_low';
  }

  /**
   * Extract entities relevant to a specific intent
   */
  private extractIntentRelevantEntities(intent: IntentType, entities: Entity[]): Record<string, any> {
    const relevantEntities: Record<string, any> = {};

    switch (intent) {
      case 'threat_scan':
        const targets = entities.filter(e => 
          ['ip_address', 'network_range', 'domain'].includes(e.type)
        );
        if (targets.length > 0) {
          relevantEntities.targets = targets.map(t => t.value);
        }
        break;

      case 'threat_list':
        const severity = entities.find(e => e.type === 'severity');
        if (severity) {
          relevantEntities.severity = severity.value;
        }
        break;

      case 'intel_query':
        const queryable = entities.filter(e => 
          ['hash', 'ip_address', 'domain', 'cve'].includes(e.type)
        );
        if (queryable.length > 0) {
          relevantEntities.indicators = queryable.map(e => ({
            type: e.type,
            value: e.value,
          }));
        }
        break;
    }

    return relevantEntities;
  }

  /**
   * Normalize input for processing
   */
  private normalizeInput(input: string): string {
    return input
      .toLowerCase()
      .trim()
      .replace(/[^\w\s.-]/g, ' ')
      .replace(/\s+/g, ' ');
  }

  /**
   * Set transition probability between intents
   */
  private setTransitionProbability(fromIntent: string, toIntent: IntentType, probability: number): void {
    if (!this.transitionProbabilities.has(fromIntent)) {
      this.transitionProbabilities.set(fromIntent, new Map());
    }
    this.transitionProbabilities.get(fromIntent)!.set(toIntent, probability);
  }

  /**
   * Get transition probability between intents
   */
  private getTransitionProbability(fromIntent: string, toIntent: IntentType): number {
    return this.transitionProbabilities.get(fromIntent)?.get(toIntent) || 0;
  }

  /**
   * Get classification statistics for debugging
   */
  getStatistics(): {
    totalPatterns: number;
    semanticGroups: number;
    transitionRules: number;
    configuration: {
      fuzzyMatching: boolean;
      contextBoost: boolean;
      semanticAnalysis: boolean;
      threshold: number;
    };
  } {
    return {
      totalPatterns: this.intentPatterns.size,
      semanticGroups: this.semanticGroups.size,
      transitionRules: Array.from(this.transitionProbabilities.values())
        .reduce((total, map) => total + map.size, 0),
      configuration: {
        fuzzyMatching: this.enableFuzzyMatching,
        contextBoost: this.enableContextBoost,
        semanticAnalysis: this.enableSemanticAnalysis,
        threshold: this.confidenceThreshold,
      },
    };
  }
}

interface ClassificationResult {
  intent: IntentType;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  method: string;
  evidence: string;
}