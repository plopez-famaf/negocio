import { Logger } from '@threatguard/core';
import type { 
  Intent, 
  Entity, 
  IntentType,
  ConfidenceLevel 
} from '../types/Intent.js';
import type { ConversationContext } from '../types/Context.js';

export interface CommandPatternMatcherOptions {
  logger: Logger;
  enableCommandCompletion?: boolean;
  enableParameterInference?: boolean;
  enableNaturalLanguageFlags?: boolean;
}

/**
 * Specialized matcher for detecting command patterns in natural language
 * and converting them to structured command representations
 */
export class CommandPatternMatcher {
  private logger: Logger;
  private enableCommandCompletion: boolean;
  private enableParameterInference: boolean;
  private enableNaturalLanguageFlags: boolean;

  // Command pattern recognition
  private commandPatterns: Map<string, CommandPattern> = new Map();
  private parameterPatterns: Map<string, ParameterPattern> = new Map();
  private flagPatterns: Map<string, FlagPattern> = new Map();

  // Natural language to CLI mapping
  private naturalLanguageFlags: Map<string, string[]> = new Map();
  private parameterAliases: Map<string, string> = new Map();

  constructor(options: CommandPatternMatcherOptions) {
    this.logger = options.logger;
    this.enableCommandCompletion = options.enableCommandCompletion ?? true;
    this.enableParameterInference = options.enableParameterInference ?? true;
    this.enableNaturalLanguageFlags = options.enableNaturalLanguageFlags ?? true;

    this.initializeCommandPatterns();
    this.initializeParameterPatterns();
    this.initializeFlagPatterns();
    this.initializeNaturalLanguageFlags();

    this.logger.debug('Command pattern matcher initialized', {
      commandPatterns: this.commandPatterns.size,
      parameterPatterns: this.parameterPatterns.size,
      flagPatterns: this.flagPatterns.size,
      naturalLanguageFlags: this.naturalLanguageFlags.size,
    });
  }

  /**
   * Match command patterns in natural language input
   */
  async match(
    input: string,
    intent: Intent,
    entities: Entity[],
    context?: ConversationContext
  ): Promise<CommandMatch | null> {
    this.logger.debug('Matching command patterns', {
      input: input.substring(0, 100),
      intent: intent.type,
      entitiesCount: entities.length,
    });

    try {
      const normalizedInput = this.normalizeInput(input);
      
      // Get base command pattern for intent
      const commandPattern = this.commandPatterns.get(intent.type);
      if (!commandPattern) {
        this.logger.debug('No command pattern found for intent', { intent: intent.type });
        return null;
      }

      // Extract command structure
      const commandMatch: CommandMatch = {
        command: commandPattern.command,
        subcommand: commandPattern.subcommand,
        parameters: {},
        flags: [],
        confidence: intent.confidence,
        originalInput: input,
        matchedPattern: commandPattern,
      };

      // Extract parameters from input and entities
      await this.extractParameters(commandMatch, normalizedInput, entities, context);

      // Extract flags from natural language
      await this.extractFlags(commandMatch, normalizedInput, context);

      // Apply command completion if enabled
      if (this.enableCommandCompletion) {
        await this.applyCommandCompletion(commandMatch, context);
      }

      // Validate and score the match
      const validation = this.validateMatch(commandMatch, intent);
      commandMatch.confidence = validation.confidence;
      commandMatch.validationErrors = validation.errors;

      this.logger.debug('Command pattern matching completed', {
        command: commandMatch.command,
        subcommand: commandMatch.subcommand,
        parametersCount: Object.keys(commandMatch.parameters).length,
        flagsCount: commandMatch.flags.length,
        confidence: commandMatch.confidence,
      });

      return commandMatch;

    } catch (error) {
      this.logger.error('Command pattern matching failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        intent: intent.type,
      });
      return null;
    }
  }

  /**
   * Initialize command patterns for different intents
   */
  private initializeCommandPatterns(): void {
    // Threat detection commands
    this.commandPatterns.set('threat_scan', {
      command: 'threat',
      subcommand: 'scan',
      requiredParameters: ['targets'],
      optionalParameters: ['scan-type', 'output', 'timeout'],
      patterns: [
        /scan\s+(?:for\s+)?threats?\s+(?:on\s+)?(.+)/i,
        /check\s+(.+)\s+for\s+(?:security\s+)?threats?/i,
        /(?:security\s+)?scan\s+(.+)/i,
      ],
    });

    this.commandPatterns.set('threat_list', {
      command: 'threat',
      subcommand: 'list',
      requiredParameters: [],
      optionalParameters: ['severity', 'since', 'limit', 'output'],
      patterns: [
        /(?:list|show)\s+(?:all\s+)?threats?/i,
        /(?:display|view)\s+(?:security\s+)?(?:alerts?|threats?)/i,
        /what\s+threats?\s+(?:have\s+been\s+)?(?:found|detected)/i,
      ],
    });

    this.commandPatterns.set('threat_watch', {
      command: 'threat',
      subcommand: 'watch',
      requiredParameters: [],
      optionalParameters: ['severity', 'follow', 'output'],
      patterns: [
        /(?:watch|monitor)\s+(?:for\s+)?threats?/i,
        /(?:real[\s-]?time|live)\s+(?:threat\s+)?monitoring/i,
        /start\s+(?:threat\s+)?monitoring/i,
      ],
    });

    this.commandPatterns.set('network_scan', {
      command: 'network',
      subcommand: 'scan',
      requiredParameters: ['targets'],
      optionalParameters: ['ports', 'scan-type', 'output'],
      patterns: [
        /(?:network\s+)?scan\s+(.+)/i,
        /check\s+network\s+(?:on\s+)?(.+)/i,
        /(?:port\s+)?scan\s+(.+)/i,
      ],
    });

    this.commandPatterns.set('behavior_analyze', {
      command: 'behavior',
      subcommand: 'analyze',
      requiredParameters: [],
      optionalParameters: ['user', 'time-range', 'output'],
      patterns: [
        /analyz[e|ing]\s+(?:user\s+)?behavio(?:u)?r/i,
        /(?:user\s+)?(?:activity\s+)?(?:pattern\s+)?analysis/i,
        /check\s+(?:for\s+)?(?:suspicious\s+)?(?:user\s+)?(?:activity|behavio(?:u)?r)/i,
      ],
    });

    this.commandPatterns.set('intel_query', {
      command: 'intel',
      subcommand: 'query',
      requiredParameters: ['indicator'],
      optionalParameters: ['type', 'source', 'output'],
      patterns: [
        /(?:look\s*up|query|check)\s+(?:threat\s+)?(?:intel(?:ligence)?|reputation)\s+(?:for\s+)?(.+)/i,
        /(?:intel(?:ligence)?|reputation)\s+(?:check|lookup)\s+(.+)/i,
        /is\s+(.+)\s+(?:malicious|safe|suspicious)/i,
      ],
    });

    this.commandPatterns.set('system_status', {
      command: 'system',
      subcommand: 'status',
      requiredParameters: [],
      optionalParameters: ['health-check', 'verbose', 'output'],
      patterns: [
        /(?:system\s+)?(?:status|health)/i,
        /check\s+system/i,
        /how\s+is\s+(?:the\s+)?system/i,
      ],
    });

    this.commandPatterns.set('auth_status', {
      command: 'auth',
      subcommand: 'status',
      requiredParameters: [],
      optionalParameters: ['verbose', 'output'],
      patterns: [
        /(?:auth(?:entication)?\s+)?status/i,
        /am\s+i\s+(?:logged\s+in|authenticated)/i,
        /(?:login\s+)?status/i,
      ],
    });

    this.commandPatterns.set('interactive_start', {
      command: 'interactive',
      subcommand: undefined,
      requiredParameters: [],
      optionalParameters: ['mode', 'theme'],
      patterns: [
        /(?:start|launch|open)\s+(?:interactive\s+)?(?:mode|dashboard)/i,
        /interactive/i,
        /dashboard/i,
      ],
    });
  }

  /**
   * Initialize parameter extraction patterns
   */
  private initializeParameterPatterns(): void {
    // Target parameters (IP, domain, network range)
    this.parameterPatterns.set('targets', {
      name: 'targets',
      patterns: [
        /(?:on|against|target(?:ing)?)\s+([^\s]+(?:\s+[^\s]+)*)/i,
        /(?:ip|address|host|server|domain)\s+([^\s]+)/i,
        /([0-9]{1,3}(?:\.[0-9]{1,3}){3}(?:\/[0-9]{1,2})?)/g,
        /([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.[a-zA-Z]{2,})/g,
      ],
      isArray: true,
      entityTypes: ['ip_address', 'network_range', 'domain'],
    });

    // Severity parameters
    this.parameterPatterns.set('severity', {
      name: 'severity',
      patterns: [
        /(?:severity|level|priority)\s+(low|medium|high|critical)/i,
        /(?:only\s+)?(low|medium|high|critical)(?:\s+(?:severity|priority|level))?/i,
      ],
      isArray: false,
      entityTypes: ['severity'],
    });

    // Time range parameters
    this.parameterPatterns.set('since', {
      name: 'since',
      patterns: [
        /(?:since|from|in\s+the\s+last)\s+(today|yesterday|last\s+(?:hour|day|week|month))/i,
        /(?:in\s+the\s+)?(?:past|last)\s+(\d+)\s+(minutes?|hours?|days?|weeks?|months?)/i,
      ],
      isArray: false,
      entityTypes: ['time_range'],
    });

    // Scan type parameters
    this.parameterPatterns.set('scan-type', {
      name: 'scan-type',
      patterns: [
        /(?:scan[\s-]?type|mode)\s+(quick|fast|deep|full|comprehensive)/i,
        /(quick|fast|deep|full|comprehensive)\s+scan/i,
      ],
      isArray: false,
      entityTypes: ['scan_type'],
    });

    // Output format parameters
    this.parameterPatterns.set('output', {
      name: 'output',
      patterns: [
        /(?:output|format|display)\s+(?:as\s+)?(table|json|csv|xml)/i,
        /(?:in\s+)?(table|json|csv|xml)\s+format/i,
      ],
      isArray: false,
      entityTypes: ['output_format'],
    });

    // User parameters for behavioral analysis
    this.parameterPatterns.set('user', {
      name: 'user',
      patterns: [
        /(?:for\s+)?user\s+([^\s]+)/i,
        /(?:of\s+)?(?:username|user(?:name)?)\s+([^\s]+)/i,
      ],
      isArray: false,
      entityTypes: ['user_id'],
    });

    // Threat intelligence indicator
    this.parameterPatterns.set('indicator', {
      name: 'indicator',
      patterns: [
        /(?:for\s+)?(?:indicator|ioc)\s+([^\s]+)/i,
        /(?:hash|md5|sha1|sha256)\s+([a-fA-F0-9]{32,64})/i,
      ],
      isArray: false,
      entityTypes: ['hash', 'ip_address', 'domain', 'url'],
    });
  }

  /**
   * Initialize flag extraction patterns
   */
  private initializeFlagPatterns(): void {
    this.flagPatterns.set('verbose', {
      flag: 'verbose',
      patterns: [
        /(?:with\s+)?(?:verbose|detailed)\s+(?:output|information)/i,
        /(?:show|include)\s+(?:all\s+)?details/i,
        /in\s+detail/i,
      ],
    });

    this.flagPatterns.set('follow', {
      flag: 'follow',
      patterns: [
        /(?:continuously|keep\s+running|follow|tail)/i,
        /(?:real[\s-]?time|live)\s+(?:updates|monitoring)/i,
        /(?:don't\s+stop|keep\s+watching)/i,
      ],
    });

    this.flagPatterns.set('health-check', {
      flag: 'health-check',
      patterns: [
        /(?:with\s+)?health\s+check/i,
        /(?:including|plus)\s+health/i,
        /comprehensive\s+(?:check|status)/i,
      ],
    });

    this.flagPatterns.set('aggressive', {
      flag: 'aggressive',
      patterns: [
        /aggressive(?:ly)?/i,
        /(?:intensive|thorough|comprehensive)\s+(?:scan|check)/i,
        /(?:all\s+)?(?:ports|services)/i,
      ],
    });

    this.flagPatterns.set('quiet', {
      flag: 'quiet',
      patterns: [
        /(?:quietly|silent(?:ly)?|no\s+output)/i,
        /(?:minimal|brief)\s+output/i,
        /(?:don't\s+show|hide)\s+(?:details|output)/i,
      ],
    });
  }

  /**
   * Initialize natural language to CLI flag mappings
   */
  private initializeNaturalLanguageFlags(): void {
    this.naturalLanguageFlags.set('quickly', ['--scan-type', 'quick']);
    this.naturalLanguageFlags.set('fast', ['--scan-type', 'quick']);
    this.naturalLanguageFlags.set('thoroughly', ['--scan-type', 'deep']);
    this.naturalLanguageFlags.set('comprehensively', ['--scan-type', 'full']);
    
    this.naturalLanguageFlags.set('silently', ['--quiet']);
    this.naturalLanguageFlags.set('quietly', ['--quiet']);
    this.naturalLanguageFlags.set('verbosely', ['--verbose']);
    this.naturalLanguageFlags.set('in detail', ['--verbose']);
    
    this.naturalLanguageFlags.set('continuously', ['--follow']);
    this.naturalLanguageFlags.set('live', ['--follow']);
    this.naturalLanguageFlags.set('real-time', ['--follow']);
    
    this.naturalLanguageFlags.set('as json', ['--output', 'json']);
    this.naturalLanguageFlags.set('as table', ['--output', 'table']);
    this.naturalLanguageFlags.set('as csv', ['--output', 'csv']);
  }

  /**
   * Extract parameters from input and entities
   */
  private async extractParameters(
    commandMatch: CommandMatch,
    input: string,
    entities: Entity[],
    context?: ConversationContext
  ): Promise<void> {
    // Extract from entities first (more reliable)
    this.extractParametersFromEntities(commandMatch, entities);

    // Extract from text patterns
    for (const [paramName, pattern] of this.parameterPatterns) {
      if (commandMatch.parameters[paramName]) continue; // Skip if already found

      for (const regex of pattern.patterns) {
        const matches = input.match(regex);
        if (matches) {
          const value = matches[1] || matches[0];
          if (pattern.isArray) {
            commandMatch.parameters[paramName] = commandMatch.parameters[paramName] || [];
            (commandMatch.parameters[paramName] as string[]).push(value.trim());
          } else {
            commandMatch.parameters[paramName] = value.trim();
          }
          break;
        }
      }
    }

    // Apply parameter inference if enabled
    if (this.enableParameterInference && context) {
      this.inferParametersFromContext(commandMatch, context);
    }
  }

  /**
   * Extract parameters from detected entities
   */
  private extractParametersFromEntities(commandMatch: CommandMatch, entities: Entity[]): void {
    for (const entity of entities) {
      for (const [paramName, pattern] of this.parameterPatterns) {
        if (pattern.entityTypes.includes(entity.type)) {
          if (pattern.isArray) {
            commandMatch.parameters[paramName] = commandMatch.parameters[paramName] || [];
            (commandMatch.parameters[paramName] as string[]).push(entity.value);
          } else {
            if (!commandMatch.parameters[paramName]) {
              commandMatch.parameters[paramName] = entity.value;
            }
          }
        }
      }
    }
  }

  /**
   * Infer missing parameters from conversation context
   */
  private inferParametersFromContext(commandMatch: CommandMatch, context: ConversationContext): void {
    const pattern = this.commandPatterns.get(commandMatch.matchedPattern.command);
    if (!pattern) return;

    // Infer targets from recent entities if needed
    if (pattern.requiredParameters.includes('targets') && !commandMatch.parameters.targets) {
      const recentTargets = context.recentEntities.filter(e => 
        ['ip_address', 'network_range', 'domain'].includes(e.type)
      );
      
      if (recentTargets.length > 0) {
        commandMatch.parameters.targets = [recentTargets[0].value];
        commandMatch.parameters._inferred = true;
      }
    }

    // Infer output format from user preferences
    if (!commandMatch.parameters.output && context.session.preferences.outputFormat) {
      commandMatch.parameters.output = context.session.preferences.outputFormat;
    }

    // Infer verbosity from user preferences
    if (!commandMatch.flags.includes('verbose') && context.session.preferences.verboseMode) {
      commandMatch.flags.push('verbose');
    }
  }

  /**
   * Extract flags from natural language
   */
  private async extractFlags(
    commandMatch: CommandMatch,
    input: string,
    context?: ConversationContext
  ): Promise<void> {
    // Extract explicit flags
    for (const [flagName, pattern] of this.flagPatterns) {
      for (const regex of pattern.patterns) {
        if (regex.test(input)) {
          if (!commandMatch.flags.includes(flagName)) {
            commandMatch.flags.push(flagName);
          }
          break;
        }
      }
    }

    // Extract natural language flags if enabled
    if (this.enableNaturalLanguageFlags) {
      for (const [phrase, flagMapping] of this.naturalLanguageFlags) {
        if (input.includes(phrase)) {
          if (flagMapping.length === 1) {
            // Simple flag
            if (!commandMatch.flags.includes(flagMapping[0].replace('--', ''))) {
              commandMatch.flags.push(flagMapping[0].replace('--', ''));
            }
          } else if (flagMapping.length === 2) {
            // Parameter flag
            const paramName = flagMapping[0].replace('--', '');
            commandMatch.parameters[paramName] = flagMapping[1];
          }
        }
      }
    }
  }

  /**
   * Apply command completion for missing required parameters
   */
  private async applyCommandCompletion(
    commandMatch: CommandMatch,
    context?: ConversationContext
  ): Promise<void> {
    const pattern = commandMatch.matchedPattern;
    
    for (const requiredParam of pattern.requiredParameters) {
      if (!commandMatch.parameters[requiredParam]) {
        const completion = this.generateParameterCompletion(requiredParam, context);
        if (completion) {
          commandMatch.parameters[requiredParam] = completion;
          commandMatch.parameters._autoCompleted = true;
        }
      }
    }
  }

  /**
   * Generate parameter completion suggestions
   */
  private generateParameterCompletion(parameter: string, context?: ConversationContext): string | string[] | null {
    switch (parameter) {
      case 'targets':
        // Try to infer network range
        return ['$(auto-detect-network)'];
        
      case 'output':
        // Default to user preference or table
        return context?.session.preferences.outputFormat || 'table';
        
      case 'scan-type':
        // Default to quick scan for safety
        return 'quick';
        
      case 'severity':
        // Default to high and critical
        return ['high', 'critical'];
        
      default:
        return null;
    }
  }

  /**
   * Validate the command match and calculate confidence
   */
  private validateMatch(commandMatch: CommandMatch, intent: Intent): ValidationResult {
    const errors: string[] = [];
    let confidence = this.confidenceToNumber(intent.confidence);

    const pattern = commandMatch.matchedPattern;

    // Check required parameters
    for (const requiredParam of pattern.requiredParameters) {
      if (!commandMatch.parameters[requiredParam]) {
        errors.push(`Missing required parameter: ${requiredParam}`);
        confidence *= 0.7; // Reduce confidence for missing required params
      }
    }

    // Boost confidence for well-populated commands
    const paramCount = Object.keys(commandMatch.parameters).length;
    const expectedParamCount = pattern.requiredParameters.length + pattern.optionalParameters.length;
    
    if (paramCount > 0) {
      const parameterScore = Math.min(paramCount / expectedParamCount, 1.0);
      confidence = Math.min(confidence + (parameterScore * 0.2), 1.0);
    }

    // Boost confidence for matching patterns
    if (pattern.patterns.some(p => p.test(commandMatch.originalInput))) {
      confidence = Math.min(confidence + 0.1, 1.0);
    }

    return {
      confidence: this.numberToConfidence(confidence),
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Normalize input for processing
   */
  private normalizeInput(input: string): string {
    return input
      .toLowerCase()
      .trim()
      .replace(/[^\w\s.-\/]/g, ' ')
      .replace(/\s+/g, ' ');
  }

  /**
   * Convert confidence level to number
   */
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

  /**
   * Convert number to confidence level
   */
  private numberToConfidence(score: number): ConfidenceLevel {
    if (score >= 0.9) return 'very_high';
    if (score >= 0.7) return 'high';
    if (score >= 0.5) return 'medium';
    if (score >= 0.3) return 'low';
    return 'very_low';
  }

  /**
   * Get available command patterns for debugging
   */
  getCommandPatterns(): Map<string, CommandPattern> {
    return new Map(this.commandPatterns);
  }

  /**
   * Get statistics about the matcher
   */
  getStatistics(): {
    patterns: number;
    parameters: number;
    flags: number;
    naturalLanguageFlags: number;
  } {
    return {
      patterns: this.commandPatterns.size,
      parameters: this.parameterPatterns.size,
      flags: this.flagPatterns.size,
      naturalLanguageFlags: this.naturalLanguageFlags.size,
    };
  }
}

interface CommandPattern {
  command: string;
  subcommand?: string;
  requiredParameters: string[];
  optionalParameters: string[];
  patterns: RegExp[];
}

interface ParameterPattern {
  name: string;
  patterns: RegExp[];
  isArray: boolean;
  entityTypes: string[];
}

interface FlagPattern {
  flag: string;
  patterns: RegExp[];
}

interface CommandMatch {
  command: string;
  subcommand?: string;
  parameters: Record<string, any>;
  flags: string[];
  confidence: ConfidenceLevel;
  originalInput: string;
  matchedPattern: CommandPattern;
  validationErrors?: string[];
}

interface ValidationResult {
  confidence: ConfidenceLevel;
  errors?: string[];
}