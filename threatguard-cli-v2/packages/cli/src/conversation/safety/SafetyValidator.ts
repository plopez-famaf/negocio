import { Logger } from '@threatguard/core';
import type { ParsedCommand, SafetyValidation, SafetyLevel } from '../types/Command.js';
import type { ConversationContext } from '../types/Context.js';

export interface SafetyValidatorOptions {
  logger: Logger;
  strictMode?: boolean;
  allowDestructiveOperations?: boolean;
  requireConfirmationThreshold?: SafetyLevel;
}

export class SafetyValidator {
  private logger: Logger;
  private strictMode: boolean;
  private allowDestructiveOperations: boolean;
  private requireConfirmationThreshold: SafetyLevel;

  // Safety level hierarchy for comparison
  private readonly safetyLevels: Record<SafetyLevel, number> = {
    'safe': 0,
    'low': 1,
    'medium': 2,
    'high': 3,
    'critical': 4,
  };

  // Dangerous command patterns
  private readonly dangerousPatterns = [
    /rm\s+-rf?\s+\//, // rm -rf /
    /format\s+[a-z]:/i, // format c:
    /del\s+\/[sq]\s+\*/, // del /s /q *
    /shutdown\s+(-[a-z]\s+)*now/i, // shutdown now
    /reboot\s+(-[a-z]\s+)*now/i, // reboot now
    /dd\s+if=.*of=\/dev\//, // dd to device
    /mkfs\s+\/dev\//, // format filesystem
    /fdisk\s+\/dev\//, // partition operations
  ];

  // Sensitive data patterns
  private readonly sensitivePatterns = [
    /password[=\s]+[^\s]+/i,
    /api[_-]?key[=\s]+[^\s]+/i,
    /secret[=\s]+[^\s]+/i,
    /token[=\s]+[^\s]+/i,
    /private[_-]?key/i,
  ];

  // Network scanning intensity indicators
  private readonly intenseScanPatterns = [
    /--aggressive/,
    /--scan-delay\s+0/,
    /-T[45]/,
    /--max-rate\s+\d{4,}/,
    /--host-timeout\s+\d+ms/,
  ];

  constructor(options: SafetyValidatorOptions) {
    this.logger = options.logger;
    this.strictMode = options.strictMode ?? true;
    this.allowDestructiveOperations = options.allowDestructiveOperations ?? false;
    this.requireConfirmationThreshold = options.requireConfirmationThreshold ?? 'medium';

    this.logger.debug('Safety validator initialized', {
      strictMode: this.strictMode,
      allowDestructiveOperations: this.allowDestructiveOperations,
      confirmationThreshold: this.requireConfirmationThreshold,
    });
  }

  /**
   * Validate command safety and generate safety information
   */
  async validateCommand(
    command: ParsedCommand,
    context?: ConversationContext
  ): Promise<SafetyValidation> {
    this.logger.debug('Validating command safety', {
      command: command.command,
      subcommand: command.subcommand,
      safetyLevel: command.safetyLevel,
    });

    try {
      const validation = await this.performSafetyAnalysis(command, context);
      
      this.logger.debug('Safety validation completed', {
        safetyLevel: validation.safetyLevel,
        requiresConfirmation: validation.requiresConfirmation,
        risksCount: validation.potentialRisks.length,
        estimatedImpact: validation.estimatedImpact,
      });

      return validation;

    } catch (error) {
      this.logger.error('Safety validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        command: command.previewCommand,
      });

      // Return safest possible validation on error
      return {
        safetyLevel: 'critical',
        requiresConfirmation: true,
        potentialRisks: ['Safety validation failed - manual review required'],
        mitigation: ['Carefully review the command before executing'],
        previewCommand: command.previewCommand,
        estimatedImpact: 'high',
      };
    }
  }

  /**
   * Perform comprehensive safety analysis
   */
  private async performSafetyAnalysis(
    command: ParsedCommand,
    context?: ConversationContext
  ): Promise<SafetyValidation> {
    const risks: string[] = [];
    const mitigation: string[] = [];
    let finalSafetyLevel = command.safetyLevel;
    let estimatedImpact: 'none' | 'low' | 'medium' | 'high' = 'low';

    // 1. Check for dangerous command patterns
    const dangerousPatternRisks = this.checkDangerousPatterns(command);
    risks.push(...dangerousPatternRisks);

    // 2. Check for sensitive data exposure
    const sensitiveDataRisks = this.checkSensitiveData(command);
    risks.push(...sensitiveDataRisks);

    // 3. Analyze command-specific risks
    const commandSpecificRisks = this.analyzeCommandSpecificRisks(command);
    risks.push(...commandSpecificRisks.risks);
    if (commandSpecificRisks.elevatedSafety) {
      finalSafetyLevel = this.elevateSafetyLevel(finalSafetyLevel);
    }

    // 4. Check network and external target risks
    const networkRisks = this.analyzeNetworkRisks(command);
    risks.push(...networkRisks);

    // 5. Context-based risk assessment
    if (context) {
      const contextRisks = this.analyzeContextualRisks(command, context);
      risks.push(...contextRisks);
    }

    // 6. Generate mitigation strategies
    mitigation.push(...this.generateMitigationStrategies(command, risks));

    // 7. Determine estimated impact
    estimatedImpact = this.calculateEstimatedImpact(finalSafetyLevel, risks, command);

    // 8. Determine if confirmation is required
    const requiresConfirmation = this.determineConfirmationRequirement(
      finalSafetyLevel,
      risks,
      command,
      context
    );

    return {
      safetyLevel: finalSafetyLevel,
      requiresConfirmation,
      potentialRisks: this.deduplicateAndPrioritizeRisks(risks),
      mitigation,
      previewCommand: command.previewCommand,
      estimatedImpact,
    };
  }

  /**
   * Check for dangerous command patterns
   */
  private checkDangerousPatterns(command: ParsedCommand): string[] {
    const risks: string[] = [];
    const fullCommand = command.previewCommand;

    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(fullCommand)) {
        risks.push(`Command contains potentially destructive pattern: ${pattern.source}`);
      }
    }

    // Check for privilege escalation
    if (fullCommand.includes('sudo') || fullCommand.includes('su ')) {
      risks.push('Command requires elevated privileges');
    }

    // Check for system-wide operations
    if (fullCommand.includes('--all') || fullCommand.includes('*')) {
      risks.push('Command may affect multiple targets or systems');
    }

    return risks;
  }

  /**
   * Check for sensitive data exposure
   */
  private checkSensitiveData(command: ParsedCommand): string[] {
    const risks: string[] = [];
    const fullCommand = command.previewCommand;

    for (const pattern of this.sensitivePatterns) {
      if (pattern.test(fullCommand)) {
        risks.push('Command may expose sensitive credentials or keys');
        break; // Only report once
      }
    }

    // Check for password in arguments
    if (command.options.password || command.options.pass) {
      risks.push('Password specified in command line (may be logged)');
    }

    return risks;
  }

  /**
   * Analyze command-specific risks
   */
  private analyzeCommandSpecificRisks(command: ParsedCommand): { risks: string[]; elevatedSafety: boolean } {
    const risks: string[] = [];
    let elevatedSafety = false;

    switch (command.intent) {
      case 'threat_scan':
        risks.push(...this.analyzeThreatScanRisks(command));
        break;

      case 'network_scan':
        risks.push(...this.analyzeNetworkScanRisks(command));
        elevatedSafety = true;
        break;

      case 'behavior_analyze':
        if (command.options.target === 'all' || command.options.target === '*') {
          risks.push('Behavioral analysis of all users may impact privacy');
        }
        break;

      case 'config_set':
        risks.push('Configuration changes may affect system behavior');
        if (command.options.key?.includes('api') || command.options.key?.includes('url')) {
          risks.push('API configuration changes may break connectivity');
        }
        break;

      case 'intel_query':
        if (command.options.upload) {
          risks.push('Uploading data to external threat intelligence services');
        }
        break;
    }

    return { risks, elevatedSafety };
  }

  /**
   * Analyze threat scan specific risks
   */
  private analyzeThreatScanRisks(command: ParsedCommand): string[] {
    const risks: string[] = [];
    const { options } = command;

    // Check scan intensity
    const scanType = options['scan-type'];
    if (scanType === 'deep' || scanType === 'full') {
      risks.push(`${scanType} scanning may generate significant network traffic`);
      risks.push('Intensive scans may be detected by intrusion detection systems');
    }

    // Check target scope
    const targets = options.targets || [];
    if (Array.isArray(targets)) {
      const externalTargets = targets.filter((target: string) => 
        !target.includes('localhost') && 
        !target.includes('127.0.0.1') &&
        !target.includes('192.168.') &&
        !target.includes('10.') &&
        !target.startsWith('172.')
      );

      if (externalTargets.length > 0) {
        risks.push('Scanning external targets may violate acceptable use policies');
        risks.push('External scans may trigger security alerts at target organizations');
      }

      if (targets.length > 10) {
        risks.push('Scanning large number of targets may impact network performance');
      }
    }

    // Check aggressive options
    if (options.aggressive || options['max-rate']) {
      risks.push('Aggressive scanning options may impact target systems');
    }

    return risks;
  }

  /**
   * Analyze network scan specific risks
   */
  private analyzeNetworkScanRisks(command: ParsedCommand): string[] {
    const risks: string[] = [];
    const fullCommand = command.previewCommand;

    // Check for intensive scanning patterns
    for (const pattern of this.intenseScanPatterns) {
      if (pattern.test(fullCommand)) {
        risks.push('High-intensity network scanning may impact network performance');
        break;
      }
    }

    // Check for service enumeration
    if (fullCommand.includes('-sV') || fullCommand.includes('--version')) {
      risks.push('Service version detection may trigger security monitoring');
    }

    // Check for OS detection
    if (fullCommand.includes('-O') || fullCommand.includes('--osscan')) {
      risks.push('OS detection scanning is easily detected by security systems');
    }

    return risks;
  }

  /**
   * Analyze network and external target risks
   */
  private analyzeNetworkRisks(command: ParsedCommand): string[] {
    const risks: string[] = [];
    const { options } = command;

    // Check for network range scanning
    if (options.targets) {
      const targets = Array.isArray(options.targets) ? options.targets : [options.targets];
      
      for (const target of targets) {
        if (typeof target === 'string') {
          // CIDR notation indicates network range
          if (target.includes('/')) {
            const cidr = parseInt(target.split('/')[1]);
            if (cidr < 24) {
              risks.push(`Large network range (/${cidr}) may affect many systems`);
            }
          }

          // Check for wildcard or broadcast addresses
          if (target.includes('*') || target.endsWith('.255')) {
            risks.push('Wildcard or broadcast addresses may impact many systems');
          }

          // Check for cloud/public IP ranges
          if (this.isCloudOrPublicIP(target)) {
            risks.push('Targeting cloud or public IP addresses may violate terms of service');
          }
        }
      }
    }

    return risks;
  }

  /**
   * Analyze contextual risks based on conversation history
   */
  private analyzeContextualRisks(command: ParsedCommand, context: ConversationContext): string[] {
    const risks: string[] = [];

    // Check for rapid repeated operations
    const recentCommands = context.recentCommands.slice(0, 5);
    const sameCommandCount = recentCommands.filter(cmd => 
      cmd.includes(command.command)
    ).length;

    if (sameCommandCount >= 3) {
      risks.push('Repeated execution of similar commands in short time');
    }

    // Check authentication status
    if (context.session.authenticationStatus !== 'authenticated') {
      if (['threat_scan', 'network_scan', 'behavior_analyze'].includes(command.intent)) {
        risks.push('Executing security operations without authentication');
      }
    }

    // Check for escalating risk pattern
    const recentIntents = context.recentIntents.slice(0, 3);
    const escalatingPattern = ['system_status', 'threat_scan', 'network_scan'];
    if (this.matchesPattern(recentIntents, escalatingPattern)) {
      risks.push('Command pattern suggests potential reconnaissance activity');
    }

    return risks;
  }

  /**
   * Generate mitigation strategies
   */
  private generateMitigationStrategies(command: ParsedCommand, risks: string[]): string[] {
    const mitigation: string[] = [];

    // General mitigations
    if (risks.length > 0) {
      mitigation.push('Review command carefully before execution');
      mitigation.push('Ensure you have authorization to perform this operation');
    }

    // Command-specific mitigations
    switch (command.intent) {
      case 'threat_scan':
      case 'network_scan':
        mitigation.push('Verify target systems are owned or authorized for testing');
        mitigation.push('Consider running during maintenance windows');
        if (command.options['scan-type'] === 'deep' || command.options['scan-type'] === 'full') {
          mitigation.push('Consider using quick scan first to assess impact');
        }
        break;

      case 'config_set':
        mitigation.push('Back up current configuration before making changes');
        mitigation.push('Test configuration changes in non-production environment first');
        break;

      case 'behavior_analyze':
        mitigation.push('Ensure compliance with privacy policies and regulations');
        mitigation.push('Limit analysis scope to necessary users/timeframes');
        break;
    }

    // Risk-specific mitigations
    if (risks.some(risk => risk.includes('external'))) {
      mitigation.push('Obtain explicit permission before scanning external systems');
    }

    if (risks.some(risk => risk.includes('network traffic'))) {
      mitigation.push('Monitor network utilization during operation');
      mitigation.push('Consider rate limiting or time delays');
    }

    if (risks.some(risk => risk.includes('privilege'))) {
      mitigation.push('Verify necessity of elevated privileges');
      mitigation.push('Use principle of least privilege');
    }

    return mitigation;
  }

  /**
   * Calculate estimated impact
   */
  private calculateEstimatedImpact(
    safetyLevel: SafetyLevel,
    risks: string[],
    command: ParsedCommand
  ): 'none' | 'low' | 'medium' | 'high' {
    const safetyScore = this.safetyLevels[safetyLevel];
    const riskScore = risks.length;

    // High impact indicators
    const highImpactKeywords = ['destructive', 'delete', 'format', 'external', 'all systems'];
    const hasHighImpactRisk = risks.some(risk => 
      highImpactKeywords.some(keyword => risk.toLowerCase().includes(keyword))
    );

    if (hasHighImpactRisk || safetyScore >= 4) {
      return 'high';
    }

    if (safetyScore >= 3 || riskScore >= 3) {
      return 'medium';
    }

    if (safetyScore >= 1 || riskScore >= 1) {
      return 'low';
    }

    return 'none';
  }

  /**
   * Determine if confirmation is required
   */
  private determineConfirmationRequirement(
    safetyLevel: SafetyLevel,
    risks: string[],
    command: ParsedCommand,
    context?: ConversationContext
  ): boolean {
    // Always require confirmation for critical safety level
    if (safetyLevel === 'critical') {
      return true;
    }

    // Check against threshold
    const safetyScore = this.safetyLevels[safetyLevel];
    const thresholdScore = this.safetyLevels[this.requireConfirmationThreshold];

    if (safetyScore >= thresholdScore) {
      return true;
    }

    // Force confirmation if too many risks
    if (risks.length >= 3) {
      return true;
    }

    // Context-based confirmation requirements
    if (context) {
      // Require confirmation if user preferences demand it
      if (context.session.preferences.confirmDestructive && command.safetyLevel !== 'safe') {
        return true;
      }

      // Require confirmation for unauthenticated sensitive operations
      if (context.session.authenticationStatus !== 'authenticated' &&
          ['threat_scan', 'network_scan', 'behavior_analyze'].includes(command.intent)) {
        return true;
      }
    }

    // Check if command was explicitly marked as requiring confirmation
    return command.requiresConfirmation;
  }

  /**
   * Elevate safety level by one step
   */
  private elevateSafetyLevel(currentLevel: SafetyLevel): SafetyLevel {
    const levels: SafetyLevel[] = ['safe', 'low', 'medium', 'high', 'critical'];
    const currentIndex = levels.indexOf(currentLevel);
    return currentIndex < levels.length - 1 ? levels[currentIndex + 1] : currentLevel;
  }

  /**
   * Check if IP is in cloud or public range
   */
  private isCloudOrPublicIP(target: string): boolean {
    // Simple check for well-known cloud ranges
    const cloudRanges = [
      /^52\./, // AWS
      /^54\./, // AWS
      /^23\./, // AWS
      /^107\./, // AWS
      /^13\./, // Microsoft Azure
      /^40\./, // Microsoft Azure
      /^104\./, // Microsoft Azure
      /^35\./, // Google Cloud
      /^34\./, // Google Cloud
    ];

    return cloudRanges.some(pattern => pattern.test(target.split('/')[0]));
  }

  /**
   * Check if recent intents match a concerning pattern
   */
  private matchesPattern(recentIntents: string[], pattern: string[]): boolean {
    if (recentIntents.length < pattern.length) {
      return false;
    }

    return pattern.every((patternIntent, index) => 
      recentIntents[index] === patternIntent
    );
  }

  /**
   * Deduplicate and prioritize risks
   */
  private deduplicateAndPrioritizeRisks(risks: string[]): string[] {
    // Remove duplicates
    const uniqueRisks = [...new Set(risks)];

    // Sort by priority (destructive risks first)
    const priorityKeywords = ['destructive', 'delete', 'format', 'external', 'privilege'];
    
    return uniqueRisks.sort((a, b) => {
      const aPriority = priorityKeywords.some(keyword => a.toLowerCase().includes(keyword));
      const bPriority = priorityKeywords.some(keyword => b.toLowerCase().includes(keyword));
      
      if (aPriority && !bPriority) return -1;
      if (!aPriority && bPriority) return 1;
      return 0;
    });
  }

  /**
   * Update safety configuration
   */
  updateConfiguration(updates: Partial<SafetyValidatorOptions>): void {
    if (updates.strictMode !== undefined) {
      this.strictMode = updates.strictMode;
    }
    if (updates.allowDestructiveOperations !== undefined) {
      this.allowDestructiveOperations = updates.allowDestructiveOperations;
    }
    if (updates.requireConfirmationThreshold !== undefined) {
      this.requireConfirmationThreshold = updates.requireConfirmationThreshold;
    }

    this.logger.info('Safety validator configuration updated', {
      strictMode: this.strictMode,
      allowDestructiveOperations: this.allowDestructiveOperations,
      confirmationThreshold: this.requireConfirmationThreshold,
    });
  }

  /**
   * Get current configuration
   */
  getConfiguration(): SafetyValidatorOptions {
    return {
      logger: this.logger,
      strictMode: this.strictMode,
      allowDestructiveOperations: this.allowDestructiveOperations,
      requireConfirmationThreshold: this.requireConfirmationThreshold,
    };
  }
}