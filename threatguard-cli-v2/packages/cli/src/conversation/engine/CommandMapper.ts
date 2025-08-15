import { Logger } from '@threatguard/core';
import type { NLParseResult } from '../types/Intent.js';
import type { ParsedCommand, CommandMapping, COMMAND_MAPPINGS } from '../types/Command.js';
import type { ConversationContext } from '../types/Context.js';
import { COMMAND_MAPPINGS } from '../types/Command.js';

export interface CommandMapperOptions {
  logger: Logger;
  enableContextualMapping?: boolean;
  enableSmartDefaults?: boolean;
}

export class CommandMapper {
  private logger: Logger;
  private enableContextualMapping: boolean;
  private enableSmartDefaults: boolean;
  private mappingRules: Map<string, CommandMapping>;

  constructor(options: CommandMapperOptions) {
    this.logger = options.logger;
    this.enableContextualMapping = options.enableContextualMapping ?? true;
    this.enableSmartDefaults = options.enableSmartDefaults ?? true;
    
    // Index command mappings by intent type for fast lookup
    this.mappingRules = new Map();
    COMMAND_MAPPINGS.forEach(mapping => {
      this.mappingRules.set(mapping.intent, mapping);
    });

    this.logger.debug('Initialized command mapper', {
      mappingRulesCount: this.mappingRules.size,
      enableContextualMapping: this.enableContextualMapping,
      enableSmartDefaults: this.enableSmartDefaults,
    });
  }

  /**
   * Map natural language parse result to CLI command
   */
  async mapToCommand(
    parseResult: NLParseResult, 
    context?: ConversationContext
  ): Promise<ParsedCommand | undefined> {
    this.logger.debug('Mapping parse result to command', {
      intent: parseResult.intent.type,
      confidence: parseResult.confidence,
      entitiesCount: parseResult.entities.length,
    });

    try {
      // Get base mapping rule
      const mappingRule = this.mappingRules.get(parseResult.intent.type);
      if (!mappingRule) {
        this.logger.debug('No mapping rule found for intent', { intent: parseResult.intent.type });
        return undefined;
      }

      // Build command structure
      const command = await this.buildCommand(parseResult, mappingRule, context);
      
      this.logger.debug('Command mapping completed', {
        command: command.command,
        subcommand: command.subcommand,
        previewCommand: command.previewCommand,
        safetyLevel: command.safetyLevel,
      });

      return command;

    } catch (error) {
      this.logger.error('Command mapping failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        intent: parseResult.intent.type,
      });
      return undefined;
    }
  }

  /**
   * Build complete command structure from parse result and mapping rule
   */
  private async buildCommand(
    parseResult: NLParseResult,
    mappingRule: CommandMapping,
    context?: ConversationContext
  ): Promise<ParsedCommand> {
    const { intent, entities, originalText } = parseResult;
    
    // Start with base command structure
    const args: string[] = [];
    const options: Record<string, any> = { ...mappingRule.defaultOptions };

    // Map entities to command options
    entities.forEach(entity => {
      const optionName = mappingRule.entityMappings[entity.type];
      if (optionName) {
        if (optionName === 'targets') {
          // Handle multiple targets
          if (!options.targets) {
            options.targets = [];
          }
          options.targets.push(entity.value);
        } else {
          options[optionName] = entity.value;
        }
      }
    });

    // Apply contextual enhancements
    if (this.enableContextualMapping && context) {
      this.applyContextualEnhancements(options, mappingRule, context);
    }

    // Apply smart defaults
    if (this.enableSmartDefaults) {
      this.applySmartDefaults(options, mappingRule, parseResult, context);
    }

    // Build preview command string
    const previewCommand = this.buildPreviewCommand(
      mappingRule.command,
      mappingRule.subcommand,
      args,
      options
    );

    // Generate description
    const description = this.generateCommandDescription(mappingRule, options, parseResult);

    // Estimate execution time
    const estimatedExecutionTime = this.estimateExecutionTime(mappingRule, options);

    // Generate warnings
    const warnings = this.generateWarnings(mappingRule, options, parseResult);

    return {
      originalText,
      command: mappingRule.command,
      subcommand: mappingRule.subcommand,
      args,
      options,
      safetyLevel: mappingRule.safetyLevel,
      requiresConfirmation: mappingRule.requiresConfirmation,
      previewCommand,
      intent: intent.type,
      confidence: this.confidenceToNumber(parseResult.confidence),
      description,
      estimatedExecutionTime,
      warnings,
      context: {
        mappingRule: mappingRule.intent,
        entityMappings: Object.keys(mappingRule.entityMappings).length,
        hasContextualEnhancements: this.enableContextualMapping && !!context,
      },
    };
  }

  /**
   * Apply contextual enhancements based on conversation history
   */
  private applyContextualEnhancements(
    options: Record<string, any>,
    mappingRule: CommandMapping,
    context: ConversationContext
  ): void {
    // Inherit targets from recent context if not specified
    if (mappingRule.intent.includes('threat_') || mappingRule.intent.includes('network_')) {
      if (!options.targets && context.recentEntities.length > 0) {
        const recentTargets = context.recentEntities.filter(e => 
          ['ip_address', 'network_range', 'domain'].includes(e.type)
        );
        
        if (recentTargets.length > 0) {
          options.targets = [recentTargets[0].value];
          options._contextuallyInferred = true;
        }
      }
    }

    // Apply user preferences
    const userPrefs = context.session.preferences;
    if (userPrefs.outputFormat && !options.output) {
      options.output = userPrefs.outputFormat;
    }
    
    if (userPrefs.verboseMode && !('verbose' in options)) {
      options.verbose = true;
    }

    // Inherit scan type preferences
    if (mappingRule.intent === 'threat_scan' && !options['scan-type']) {
      const recentScans = context.recentCommands.filter(cmd => cmd.includes('scan'));
      if (recentScans.length > 0) {
        const lastScan = recentScans[0];
        const scanTypeMatch = lastScan.match(/--scan-type\s+(\w+)/);
        if (scanTypeMatch) {
          options['scan-type'] = scanTypeMatch[1];
        }
      }
    }
  }

  /**
   * Apply intelligent defaults based on context and intent
   */
  private applySmartDefaults(
    options: Record<string, any>,
    mappingRule: CommandMapping,
    parseResult: NLParseResult,
    context?: ConversationContext
  ): void {
    switch (mappingRule.intent) {
      case 'threat_scan':
        // Default to network discovery if no targets specified
        if (!options.targets) {
          options.targets = ['$(get-network-range)'];
          options._autoDetectNetwork = true;
        }
        
        // Default scan type based on urgency indicators
        if (!options['scan-type']) {
          const urgentKeywords = ['quick', 'fast', 'immediate', 'now'];
          const deepKeywords = ['deep', 'thorough', 'comprehensive', 'detailed'];
          
          const hasUrgent = urgentKeywords.some(keyword => 
            parseResult.originalText.toLowerCase().includes(keyword)
          );
          const hasDeep = deepKeywords.some(keyword => 
            parseResult.originalText.toLowerCase().includes(keyword)
          );
          
          if (hasUrgent) {
            options['scan-type'] = 'quick';
          } else if (hasDeep) {
            options['scan-type'] = 'deep';
          } else {
            options['scan-type'] = 'quick'; // Safe default
          }
        }
        break;

      case 'threat_list':
        // Default time range for threat listing
        if (!options.since && !options.timeRange) {
          options.since = 'today';
        }
        
        // Default to critical/high severity if not specified
        if (!options.severity) {
          options.severity = ['high', 'critical'];
        }
        break;

      case 'threat_watch':
        // Default to critical alerts only for monitoring
        if (!options.severity) {
          options.severity = ['critical'];
        }
        
        // Enable follow mode by default
        if (!('follow' in options)) {
          options.follow = true;
        }
        break;

      case 'system_status':
        // Add health check for status commands
        if (!('health-check' in options)) {
          options['health-check'] = true;
        }
        break;

      case 'network_scan':
        // Default to current network if no targets
        if (!options.targets) {
          options.targets = ['$(get-network-range)'];
        }
        break;
    }

    // Apply authentication-aware defaults
    if (context?.session.authenticationStatus === 'unauthenticated') {
      // Add skip-auth for certain safe operations
      if (['system_status', 'help_general'].includes(mappingRule.intent)) {
        options['skip-auth'] = true;
      }
    }
  }

  /**
   * Build preview command string for display
   */
  private buildPreviewCommand(
    command: string,
    subcommand: string | undefined,
    args: string[],
    options: Record<string, any>
  ): string {
    let preview = 'threatguard';
    
    preview += ` ${command}`;
    
    if (subcommand) {
      preview += ` ${subcommand}`;
    }
    
    // Add arguments
    if (args.length > 0) {
      preview += ` ${args.join(' ')}`;
    }
    
    // Add options
    Object.entries(options).forEach(([key, value]) => {
      if (key.startsWith('_')) return; // Skip internal options
      
      if (typeof value === 'boolean') {
        if (value) {
          preview += ` --${key}`;
        }
      } else if (Array.isArray(value)) {
        if (value.length > 0) {
          preview += ` --${key} ${value.join(',')}`;
        }
      } else if (value !== undefined && value !== null) {
        preview += ` --${key} ${value}`;
      }
    });
    
    return preview;
  }

  /**
   * Generate human-readable command description
   */
  private generateCommandDescription(
    mappingRule: CommandMapping,
    options: Record<string, any>,
    parseResult: NLParseResult
  ): string {
    let description = '';

    switch (mappingRule.intent) {
      case 'threat_scan':
        description = 'Perform a security scan';
        if (options.targets) {
          const targets = Array.isArray(options.targets) ? options.targets : [options.targets];
          description += ` on ${targets.join(', ')}`;
        }
        if (options['scan-type']) {
          description += ` using ${options['scan-type']} scanning mode`;
        }
        break;

      case 'threat_list':
        description = 'List security threats';
        if (options.severity) {
          const severities = Array.isArray(options.severity) ? options.severity : [options.severity];
          description += ` with ${severities.join('/')} severity`;
        }
        if (options.since) {
          description += ` from ${options.since}`;
        }
        break;

      case 'threat_watch':
        description = 'Start real-time threat monitoring';
        if (options.severity) {
          const severities = Array.isArray(options.severity) ? options.severity : [options.severity];
          description += ` for ${severities.join('/')} level threats`;
        }
        break;

      case 'system_status':
        description = 'Check system status and health';
        if (options['health-check']) {
          description += ' with comprehensive health validation';
        }
        break;

      case 'auth_status':
        description = 'Check authentication status and session information';
        break;

      case 'interactive_start':
      case 'dashboard_open':
        description = 'Launch interactive threat monitoring dashboard';
        break;

      default:
        description = `Execute ${mappingRule.intent.replace('_', ' ')} operation`;
    }

    return description;
  }

  /**
   * Estimate command execution time in milliseconds
   */
  private estimateExecutionTime(
    mappingRule: CommandMapping,
    options: Record<string, any>
  ): number {
    switch (mappingRule.intent) {
      case 'threat_scan':
        const scanType = options['scan-type'] || 'quick';
        const baseTime = scanType === 'quick' ? 30000 : scanType === 'deep' ? 300000 : 600000;
        
        // Adjust based on targets
        const targets = Array.isArray(options.targets) ? options.targets : [options.targets];
        const targetMultiplier = targets?.length || 1;
        
        return baseTime * Math.min(targetMultiplier, 5); // Cap at 5x

      case 'threat_list':
        return 5000; // 5 seconds for listing

      case 'threat_watch':
        return -1; // Indefinite monitoring

      case 'system_status':
        return options['health-check'] ? 10000 : 3000;

      case 'network_scan':
        return 60000; // 1 minute base time

      case 'behavior_analyze':
        return 120000; // 2 minutes for behavioral analysis

      default:
        return 5000; // Default 5 seconds
    }
  }

  /**
   * Generate warnings for potentially risky operations
   */
  private generateWarnings(
    mappingRule: CommandMapping,
    options: Record<string, any>,
    parseResult: NLParseResult
  ): string[] {
    const warnings: string[] = [];

    // Safety level warnings
    if (mappingRule.safetyLevel === 'high' || mappingRule.safetyLevel === 'critical') {
      warnings.push(`This is a ${mappingRule.safetyLevel} risk operation that may impact system performance`);
    }

    // Intent-specific warnings
    switch (mappingRule.intent) {
      case 'threat_scan':
        if (options.targets?.some((target: string) => !target.includes('localhost') && !target.includes('127.0.0.1'))) {
          warnings.push('This scan will probe external targets and may be detected by security systems');
        }
        
        if (options['scan-type'] === 'deep' || options['scan-type'] === 'full') {
          warnings.push('Deep scans may take significant time and generate high network traffic');
        }
        break;

      case 'network_scan':
        warnings.push('Network scanning may trigger security alerts and should be authorized');
        break;

      case 'threat_watch':
        warnings.push('Monitoring will run continuously until stopped (Ctrl+C)');
        break;
    }

    // Contextual warnings
    if (options._autoDetectNetwork) {
      warnings.push('Network range will be automatically detected');
    }

    if (options._contextuallyInferred) {
      warnings.push('Some parameters were inferred from conversation context');
    }

    return warnings;
  }

  /**
   * Convert confidence level to numeric value
   */
  private confidenceToNumber(confidence: string): number {
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
   * Get available command mappings for help and debugging
   */
  getMappingRules(): CommandMapping[] {
    return Array.from(this.mappingRules.values());
  }

  /**
   * Get mapping rule for a specific intent
   */
  getMappingRule(intent: string): CommandMapping | undefined {
    return this.mappingRules.get(intent);
  }
}