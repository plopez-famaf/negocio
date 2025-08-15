import { Logger } from '@threatguard/core';
import type { 
  Intent, 
  Entity, 
  NLParseResult, 
  IntentType, 
  ConfidenceLevel,
  INTENT_PATTERNS,
  ThreatKeywords,
} from '../types/Intent.js';
import type { ConversationContext } from '../types/Context.js';
import { INTENT_PATTERNS } from '../types/Intent.js';
import { IntentClassifier } from '../nlp/IntentClassifier.js';
import { CommandPatternMatcher } from '../nlp/CommandPatternMatcher.js';
import { ContextualParser } from '../nlp/ContextualParser.js';
import { ThreatDomainParser } from '../nlp/ThreatDomainParser.js';

export interface NLProcessorOptions {
  logger: Logger;
  enableContextAwareness?: boolean;
  enableEntityExtraction?: boolean;
  enableAdvancedClassification?: boolean;
  enableCommandPatternMatching?: boolean;
  enableContextualParsing?: boolean;
  confidenceThreshold?: number;
}

export class NLProcessor {
  private logger: Logger;
  private enableContextAwareness: boolean;
  private enableEntityExtraction: boolean;
  private enableAdvancedClassification: boolean;
  private enableCommandPatternMatching: boolean;
  private enableContextualParsing: boolean;
  private confidenceThreshold: number;

  // Pre-compiled regex patterns for performance
  private intentPatterns: Map<IntentType, RegExp[]> = new Map();
  private entityPatterns: Map<string, RegExp> = new Map();

  // Advanced NLP components
  private intentClassifier: IntentClassifier;
  private commandPatternMatcher: CommandPatternMatcher;
  private contextualParser: ContextualParser;
  private threatDomainParser: ThreatDomainParser;

  constructor(options: NLProcessorOptions) {
    this.logger = options.logger;
    this.enableContextAwareness = options.enableContextAwareness ?? true;
    this.enableEntityExtraction = options.enableEntityExtraction ?? true;
    this.enableAdvancedClassification = options.enableAdvancedClassification ?? true;
    this.enableCommandPatternMatching = options.enableCommandPatternMatching ?? true;
    this.enableContextualParsing = options.enableContextualParsing ?? true;
    this.confidenceThreshold = options.confidenceThreshold ?? 0.6;

    this.initializePatterns();
    this.initializeAdvancedComponents();
  }

  /**
   * Initialize advanced NLP components
   */
  private initializeAdvancedComponents(): void {
    // Initialize advanced intent classifier
    this.intentClassifier = new IntentClassifier({
      logger: this.logger,
      enableFuzzyMatching: true,
      enableContextBoost: this.enableContextAwareness,
      enableSemanticAnalysis: true,
      confidenceThreshold: this.confidenceThreshold,
    });

    // Initialize command pattern matcher
    this.commandPatternMatcher = new CommandPatternMatcher({
      logger: this.logger,
      enableCommandCompletion: true,
      enableParameterInference: this.enableContextAwareness,
      enableNaturalLanguageFlags: true,
    });

    // Initialize contextual parser
    this.contextualParser = new ContextualParser({
      logger: this.logger,
      enableConversationFlow: this.enableContextualParsing,
      enableEntityPersistence: this.enableContextualParsing,
      enableImplicitReferences: this.enableContextualParsing,
      contextWindowSize: 10,
    });

    // Initialize threat domain parser
    this.threatDomainParser = new ThreatDomainParser({
      logger: this.logger,
      enableThreatIntelligence: true,
      enableBehavioralAnalysis: true,
      enableNetworkAnalysis: true,
    });

    this.logger.debug('Advanced NLP components initialized', {
      advancedClassification: this.enableAdvancedClassification,
      commandPatternMatching: this.enableCommandPatternMatching,
      contextualParsing: this.enableContextualParsing,
    });
  }

  /**
   * Process natural language input and return intent and entities
   */
  async process(input: string, context?: ConversationContext): Promise<NLParseResult> {
    const startTime = Date.now();
    
    this.logger.debug('Processing natural language input', {
      inputLength: input.length,
      hasContext: !!context,
      advancedMode: this.enableAdvancedClassification,
    });

    try {
      // Normalize input
      const normalizedInput = this.normalizeInput(input);
      
      // Extract entities first
      const entities = this.enableEntityExtraction 
        ? await this.extractEntities(normalizedInput, context)
        : [];

      // Classify intent using advanced or basic classification
      const intent = this.enableAdvancedClassification 
        ? await this.advancedIntentClassification(normalizedInput, entities, context)
        : await this.classifyIntent(normalizedInput, entities, context);
      
      // Create initial parse result
      let parseResult: NLParseResult = {
        originalText: input,
        intent,
        entities,
        confidence: intent.confidence,
        processingTime: 0, // Will be set later
      };

      // Apply threat domain enhancement
      parseResult = await this.threatDomainParser.enhanceParseResult(parseResult, context);

      // Apply contextual enhancement if enabled
      if (this.enableContextualParsing && context) {
        const enhanced = await this.contextualParser.enhance(parseResult, context);
        parseResult = {
          ...enhanced,
          // Add contextual data to the result
          contextualEnhancements: enhanced.contextualEnhancements,
        } as any;
      }

      // Determine overall confidence
      const overallConfidence = this.calculateOverallConfidence(parseResult.intent, parseResult.entities);
      parseResult.confidence = overallConfidence;
      
      // Generate alternatives if confidence is low
      parseResult.alternatives = overallConfidence === 'very_low' || overallConfidence === 'low'
        ? await this.generateAlternatives(normalizedInput, context)
        : undefined;

      // Check if clarification is needed
      parseResult.requiresClarification = this.needsClarification(parseResult.intent, parseResult.entities, overallConfidence);
      parseResult.clarificationPrompt = parseResult.requiresClarification 
        ? this.generateClarificationPrompt(parseResult.intent, parseResult.entities, normalizedInput)
        : undefined;

      // Set final processing time
      parseResult.processingTime = Date.now() - startTime;

      this.logger.debug('NL processing completed', {
        intent: parseResult.intent.type,
        confidence: overallConfidence,
        entitiesCount: parseResult.entities.length,
        processingTime: parseResult.processingTime,
        hasContextualEnhancements: !!(parseResult as any).contextualEnhancements,
      });

      return parseResult;

    } catch (error) {
      this.logger.error('NL processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        input: input.substring(0, 100), // Log first 100 chars for debugging
      });

      // Return safe fallback result
      return {
        originalText: input,
        intent: {
          type: 'conversation_unknown',
          confidence: 'very_low',
          ambiguous: true,
        },
        entities: [],
        confidence: 'very_low',
        processingTime: Date.now() - startTime,
        requiresClarification: true,
        clarificationPrompt: "I'm sorry, I didn't understand that. Could you please rephrase your request?",
      };
    }
  }

  /**
   * Advanced intent classification using the IntentClassifier
   */
  private async advancedIntentClassification(
    normalizedInput: string,
    entities: Entity[],
    context?: ConversationContext
  ): Promise<Intent> {
    return await this.intentClassifier.classify(normalizedInput, entities, context);
  }

  /**
   * Initialize regex patterns for intent classification and entity extraction
   */
  private initializePatterns(): void {
    // Initialize intent patterns
    INTENT_PATTERNS.forEach(pattern => {
      const regexPatterns = pattern.patterns.map(p => 
        new RegExp(p, 'i') // Case-insensitive
      );
      this.intentPatterns.set(pattern.intent, regexPatterns);
    });

    // Initialize entity extraction patterns
    this.entityPatterns.set('ip_address', 
      /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g
    );
    
    this.entityPatterns.set('network_range', 
      /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(?:[0-9]|[1-2][0-9]|3[0-2])\b/g
    );
    
    this.entityPatterns.set('domain', 
      /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b/g
    );
    
    this.entityPatterns.set('url', 
      /https?:\/\/(?:[-\w.])+(?:\:[0-9]+)?(?:\/(?:[\w\/_.])*(?:\?(?:[\w&=%.])*)?(?:\#(?:[\w.])*)?)?/g
    );
    
    this.entityPatterns.set('hash', 
      /\b[a-fA-F0-9]{32,64}\b/g
    );
    
    this.entityPatterns.set('file_path', 
      /(?:[a-zA-Z]:)?(?:[\/\\][\w\s.-]+)+[\/\\]?/g
    );

    this.logger.debug('Initialized NL processing patterns', {
      intentPatternsCount: this.intentPatterns.size,
      entityPatternsCount: this.entityPatterns.size,
    });
  }

  /**
   * Normalize input text for processing
   */
  private normalizeInput(input: string): string {
    return input
      .toLowerCase()
      .trim()
      .replace(/[^\w\s\.\-\/\:]/g, ' ') // Keep alphanumeric, spaces, and common chars
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  /**
   * Classify the intent of the input
   */
  private async classifyIntent(
    normalizedInput: string, 
    entities: Entity[], 
    context?: ConversationContext
  ): Promise<Intent> {
    let bestMatch: { intent: IntentType; confidence: ConfidenceLevel; score: number } | null = null;
    let alternatives: IntentType[] = [];

    // Pattern-based classification
    for (const [intentType, patterns] of this.intentPatterns) {
      let maxScore = 0;
      
      for (const pattern of patterns) {
        const matches = normalizedInput.match(pattern);
        if (matches) {
          const score = matches.length + (matches[0]?.length || 0) / normalizedInput.length;
          maxScore = Math.max(maxScore, score);
        }
      }

      if (maxScore > 0) {
        const confidence = this.scoreToConfidence(maxScore);
        
        if (!bestMatch || maxScore > bestMatch.score) {
          if (bestMatch) {
            alternatives.push(bestMatch.intent);
          }
          bestMatch = { intent: intentType, confidence, score: maxScore };
        } else {
          alternatives.push(intentType);
        }
      }
    }

    // Context-aware adjustments
    if (this.enableContextAwareness && context) {
      bestMatch = this.adjustWithContext(bestMatch, normalizedInput, context);
    }

    // Keyword-based fallback
    if (!bestMatch) {
      bestMatch = this.keywordBasedClassification(normalizedInput);
    }

    // Default to unknown if no match
    if (!bestMatch) {
      return {
        type: 'conversation_unknown',
        confidence: 'very_low',
        ambiguous: true,
        alternatives: [],
      };
    }

    return {
      type: bestMatch.intent,
      confidence: bestMatch.confidence,
      entities: this.extractIntentEntities(bestMatch.intent, entities),
      ambiguous: alternatives.length > 0,
      alternatives: alternatives.slice(0, 3), // Top 3 alternatives
    };
  }

  /**
   * Extract entities from the input text
   */
  private async extractEntities(
    normalizedInput: string, 
    context?: ConversationContext
  ): Promise<Entity[]> {
    const entities: Entity[] = [];

    // Extract using regex patterns
    for (const [entityType, pattern] of this.entityPatterns) {
      const matches = [...normalizedInput.matchAll(pattern)];
      
      for (const match of matches) {
        if (match.index !== undefined) {
          entities.push({
            type: entityType as any,
            value: match[0],
            confidence: 'high',
            start: match.index,
            end: match.index + match[0].length,
          });
        }
      }
    }

    // Extract keyword-based entities
    entities.push(...this.extractKeywordEntities(normalizedInput));

    // Context-aware entity extraction
    if (context) {
      entities.push(...this.extractContextualEntities(normalizedInput, context));
    }

    // Deduplicate entities
    return this.deduplicateEntities(entities);
  }

  /**
   * Extract keyword-based entities (severity, scan types, etc.)
   */
  private extractKeywordEntities(input: string): Entity[] {
    const entities: Entity[] = [];

    // Severity levels
    const severityPattern = /\b(low|medium|high|critical|minor|major)\b/gi;
    const severityMatches = [...input.matchAll(severityPattern)];
    for (const match of severityMatches) {
      if (match.index !== undefined) {
        entities.push({
          type: 'severity',
          value: match[1].toLowerCase(),
          confidence: 'high',
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }

    // Scan types
    const scanTypePattern = /\b(quick|deep|full|comprehensive|basic)\b.*scan/gi;
    const scanMatches = [...input.matchAll(scanTypePattern)];
    for (const match of scanMatches) {
      if (match.index !== undefined) {
        entities.push({
          type: 'scan_type',
          value: match[1].toLowerCase(),
          confidence: 'high',
          start: match.index,
          end: match.index + match[1].length,
        });
      }
    }

    // Time ranges
    const timePattern = /\b(today|yesterday|last\s+(?:hour|day|week|month))\b/gi;
    const timeMatches = [...input.matchAll(timePattern)];
    for (const match of timeMatches) {
      if (match.index !== undefined) {
        entities.push({
          type: 'time_range',
          value: match[1].toLowerCase().replace(/\s+/g, ' '),
          confidence: 'medium',
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }

    // Threat types
    const threatPattern = /\b(malware|phishing|intrusion|anomaly|vulnerability|suspicious)\b/gi;
    const threatMatches = [...input.matchAll(threatPattern)];
    for (const match of threatMatches) {
      if (match.index !== undefined) {
        entities.push({
          type: 'threat_type',
          value: match[1].toLowerCase(),
          confidence: 'high',
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }

    return entities;
  }

  /**
   * Extract entities based on conversation context
   */
  private extractContextualEntities(input: string, context: ConversationContext): Entity[] {
    const entities: Entity[] = [];

    // If user says "my network" or "this system", try to infer from context
    if (/\b(my|this|the)\s+(network|system|server|domain)\b/i.test(input)) {
      // Check recent entities for network ranges or targets
      const recentNetworks = context.recentEntities.filter(e => 
        e.type === 'network_range' || e.type === 'ip_address'
      );
      
      if (recentNetworks.length > 0) {
        const lastNetwork = recentNetworks[0];
        entities.push({
          type: lastNetwork.type,
          value: lastNetwork.value,
          confidence: 'medium',
          start: 0, // Contextual, not from current input
          end: 0,
          metadata: { source: 'context', inferred: true },
        });
      }
    }

    return entities;
  }

  /**
   * Remove duplicate entities
   */
  private deduplicateEntities(entities: Entity[]): Entity[] {
    const seen = new Set<string>();
    return entities.filter(entity => {
      const key = `${entity.type}:${entity.value}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
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
   * Adjust intent classification based on conversation context
   */
  private adjustWithContext(
    bestMatch: { intent: IntentType; confidence: ConfidenceLevel; score: number } | null,
    input: string,
    context: ConversationContext
  ): { intent: IntentType; confidence: ConfidenceLevel; score: number } | null {
    if (!bestMatch) return null;

    // Boost confidence if intent matches recent conversation flow
    if (context.recentIntents.includes(bestMatch.intent)) {
      const currentConfidence = ['very_low', 'low', 'medium', 'high', 'very_high'].indexOf(bestMatch.confidence);
      const boostedConfidence = Math.min(currentConfidence + 1, 4);
      bestMatch.confidence = ['very_low', 'low', 'medium', 'high', 'very_high'][boostedConfidence] as ConfidenceLevel;
    }

    // Context-specific adjustments
    if (context.session.currentTopic) {
      const topic = context.session.currentTopic;
      
      // If continuing a threat-related conversation
      if (topic.startsWith('threat_') && input.includes('yes')) {
        bestMatch = { intent: 'conversation_continue', confidence: 'high', score: 1.0 };
      }
      
      // If user says "no" after a suggestion
      if (input.match(/\b(no|cancel|stop|abort)\b/i) && context.session.pendingConfirmation) {
        bestMatch = { intent: 'conversation_continue', confidence: 'very_high', score: 1.0 };
      }
    }

    return bestMatch;
  }

  /**
   * Keyword-based classification as fallback
   */
  private keywordBasedClassification(input: string): { intent: IntentType; confidence: ConfidenceLevel; score: number } | null {
    // Simple keyword matching
    const keywordMap: Record<string, IntentType> = {
      'scan': 'threat_scan',
      'threats': 'threat_list',
      'monitor': 'threat_watch',
      'watch': 'threat_watch',
      'status': 'system_status',
      'health': 'system_status',
      'login': 'auth_login',
      'logout': 'auth_logout',
      'auth': 'auth_status',
      'help': 'help_general',
      'dashboard': 'dashboard_open',
      'interactive': 'interactive_start',
    };

    for (const [keyword, intent] of Object.entries(keywordMap)) {
      if (input.includes(keyword)) {
        return { intent, confidence: 'low', score: 0.3 };
      }
    }

    return null;
  }

  /**
   * Extract entities relevant to a specific intent
   */
  private extractIntentEntities(intent: IntentType, allEntities: Entity[]): Record<string, any> {
    const intentEntities: Record<string, any> = {};

    switch (intent) {
      case 'threat_scan':
        const targets = allEntities.filter(e => 
          ['ip_address', 'network_range', 'domain'].includes(e.type)
        );
        if (targets.length > 0) {
          intentEntities.targets = targets.map(t => t.value);
        }

        const scanType = allEntities.find(e => e.type === 'scan_type');
        if (scanType) {
          intentEntities.scanType = scanType.value;
        }
        break;

      case 'threat_list':
        const severity = allEntities.find(e => e.type === 'severity');
        if (severity) {
          intentEntities.severity = severity.value;
        }

        const timeRange = allEntities.find(e => e.type === 'time_range');
        if (timeRange) {
          intentEntities.timeRange = timeRange.value;
        }
        break;

      case 'intel_query':
        const hash = allEntities.find(e => e.type === 'hash');
        if (hash) {
          intentEntities.hash = hash.value;
        }

        const ip = allEntities.find(e => e.type === 'ip_address');
        if (ip) {
          intentEntities.ip = ip.value;
        }
        break;
    }

    return intentEntities;
  }

  /**
   * Calculate overall confidence based on intent and entities
   */
  private calculateOverallConfidence(intent: Intent, entities: Entity[]): ConfidenceLevel {
    const confidenceScores = {
      'very_low': 0,
      'low': 1,
      'medium': 2,
      'high': 3,
      'very_high': 4,
    };

    let score = confidenceScores[intent.confidence];

    // Boost confidence if we have relevant entities
    if (entities.length > 0) {
      const relevantEntities = entities.filter(e => e.confidence === 'high' || e.confidence === 'very_high');
      score += relevantEntities.length * 0.5;
    }

    // Cap the score
    score = Math.min(Math.floor(score), 4);

    const confidenceLevels: ConfidenceLevel[] = ['very_low', 'low', 'medium', 'high', 'very_high'];
    return confidenceLevels[score];
  }

  /**
   * Check if clarification is needed
   */
  private needsClarification(intent: Intent, entities: Entity[], confidence: ConfidenceLevel): boolean {
    // Always need clarification for unknown intents
    if (intent.type === 'conversation_unknown') {
      return true;
    }

    // Need clarification for low confidence
    if (confidence === 'very_low' || confidence === 'low') {
      return true;
    }

    // Need clarification if intent is ambiguous
    if (intent.ambiguous && (intent.alternatives?.length || 0) > 0) {
      return true;
    }

    // Intent-specific clarification needs
    switch (intent.type) {
      case 'threat_scan':
        // Need targets for scanning
        const hasTargets = entities.some(e => 
          ['ip_address', 'network_range', 'domain'].includes(e.type)
        );
        return !hasTargets;

      case 'intel_query':
        // Need something to query
        const hasQueryable = entities.some(e => 
          ['hash', 'ip_address', 'domain', 'url'].includes(e.type)
        );
        return !hasQueryable;

      default:
        return false;
    }
  }

  /**
   * Generate clarification prompt
   */
  private generateClarificationPrompt(intent: Intent, entities: Entity[], input: string): string {
    if (intent.type === 'conversation_unknown') {
      return "I'm not sure what you'd like me to do. Could you try rephrasing that? For example:\n" +
             "- 'scan my network for threats'\n" +
             "- 'show system status'\n" +
             "- 'list critical alerts'";
    }

    switch (intent.type) {
      case 'threat_scan':
        return "I understand you want to scan for threats, but I need to know what to scan. " +
               "Could you specify an IP address, network range, or domain? For example:\n" +
               "- 'scan 192.168.1.0/24 for threats'\n" +
               "- 'scan example.com for vulnerabilities'";

      case 'intel_query':
        return "I can help you query threat intelligence, but I need something to look up. " +
               "Could you provide an IP address, domain, URL, or file hash?";

      default:
        if (intent.ambiguous) {
          return `I think you want to ${intent.type.replace('_', ' ')}, but I'm not completely sure. ` +
                 `Could you be more specific about what you'd like me to do?`;
        }
        return "Could you provide more details about what you'd like me to do?";
    }
  }

  /**
   * Generate alternative intent suggestions
   */
  private async generateAlternatives(input: string, context?: ConversationContext): Promise<Intent[]> {
    const alternatives: Intent[] = [];

    // Simple keyword-based alternatives
    if (input.includes('scan')) {
      alternatives.push({ type: 'threat_scan', confidence: 'low' });
    }
    if (input.includes('threat') || input.includes('alert')) {
      alternatives.push({ type: 'threat_list', confidence: 'low' });
    }
    if (input.includes('status') || input.includes('health')) {
      alternatives.push({ type: 'system_status', confidence: 'low' });
    }
    if (input.includes('help')) {
      alternatives.push({ type: 'help_general', confidence: 'medium' });
    }

    return alternatives.slice(0, 3);
  }

  /**
   * Get command patterns for a specific intent using the CommandPatternMatcher
   */
  async getCommandPattern(
    input: string,
    intent: Intent,
    entities: Entity[],
    context?: ConversationContext
  ): Promise<any> {
    if (!this.enableCommandPatternMatching) {
      return null;
    }

    return await this.commandPatternMatcher.match(input, intent, entities, context);
  }

  /**
   * Get comprehensive statistics about the NL processor
   */
  getStatistics(): {
    configuration: {
      contextAwareness: boolean;
      entityExtraction: boolean;
      advancedClassification: boolean;
      commandPatternMatching: boolean;
      contextualParsing: boolean;
      confidenceThreshold: number;
    };
    intentClassifier?: any;
    commandPatternMatcher?: any;
    contextualParser?: any;
    threatDomainParser?: any;
  } {
    const stats: any = {
      configuration: {
        contextAwareness: this.enableContextAwareness,
        entityExtraction: this.enableEntityExtraction,
        advancedClassification: this.enableAdvancedClassification,
        commandPatternMatching: this.enableCommandPatternMatching,
        contextualParsing: this.enableContextualParsing,
        confidenceThreshold: this.confidenceThreshold,
      },
    };

    // Add component statistics if available
    if (this.enableAdvancedClassification && this.intentClassifier) {
      stats.intentClassifier = this.intentClassifier.getStatistics();
    }

    if (this.enableCommandPatternMatching && this.commandPatternMatcher) {
      stats.commandPatternMatcher = this.commandPatternMatcher.getStatistics();
    }

    if (this.enableContextualParsing && this.contextualParser) {
      stats.contextualParser = this.contextualParser.getStatistics();
    }

    return stats;
  }

  /**
   * Cleanup old contextual data (should be called periodically)
   */
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): number {
    let cleanedCount = 0;

    if (this.enableContextualParsing && this.contextualParser) {
      cleanedCount += this.contextualParser.cleanup(maxAge);
    }

    this.logger.debug('NL processor cleanup completed', {
      cleanedItems: cleanedCount,
    });

    return cleanedCount;
  }

  /**
   * Update configuration for advanced components
   */
  updateConfiguration(updates: {
    enableContextAwareness?: boolean;
    enableEntityExtraction?: boolean;
    enableAdvancedClassification?: boolean;
    enableCommandPatternMatching?: boolean;
    enableContextualParsing?: boolean;
    confidenceThreshold?: number;
  }): void {
    if (updates.enableContextAwareness !== undefined) {
      this.enableContextAwareness = updates.enableContextAwareness;
    }
    if (updates.enableEntityExtraction !== undefined) {
      this.enableEntityExtraction = updates.enableEntityExtraction;
    }
    if (updates.enableAdvancedClassification !== undefined) {
      this.enableAdvancedClassification = updates.enableAdvancedClassification;
    }
    if (updates.enableCommandPatternMatching !== undefined) {
      this.enableCommandPatternMatching = updates.enableCommandPatternMatching;
    }
    if (updates.enableContextualParsing !== undefined) {
      this.enableContextualParsing = updates.enableContextualParsing;
    }
    if (updates.confidenceThreshold !== undefined) {
      this.confidenceThreshold = updates.confidenceThreshold;
    }

    this.logger.info('NL processor configuration updated', {
      contextAwareness: this.enableContextAwareness,
      entityExtraction: this.enableEntityExtraction,
      advancedClassification: this.enableAdvancedClassification,
      commandPatternMatching: this.enableCommandPatternMatching,
      contextualParsing: this.enableContextualParsing,
      confidenceThreshold: this.confidenceThreshold,
    });
  }
}