import { Logger } from '@threatguard/core';
import type { ConversationContext } from '../types/Context.js';
import type { ParsedCommand, SafetyValidation } from '../types/Command.js';
import type { IntentType } from '../types/Intent.js';

export interface ResponseGeneratorOptions {
  logger: Logger;
  enablePersonalization?: boolean;
  responseStyle?: 'professional' | 'friendly' | 'concise';
  includeHelpfulHints?: boolean;
  maxResponseLength?: number;
}

export interface ResponseTemplate {
  id: string;
  intent: IntentType | 'general' | 'error' | 'confirmation' | 'welcome';
  patterns: string[];
  variables: string[];
  conditions?: ResponseCondition[];
}

export interface ResponseCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'exists';
  value: any;
}

/**
 * Natural language response generation engine
 * Creates contextually appropriate responses for chat interactions
 */
export class ResponseGenerator {
  private logger: Logger;
  private enablePersonalization: boolean;
  private responseStyle: 'professional' | 'friendly' | 'concise';
  private includeHelpfulHints: boolean;
  private maxResponseLength: number;

  // Response templates organized by intent
  private responseTemplates: Map<string, ResponseTemplate[]> = new Map();
  
  // Context-aware response modifiers
  private styleModifiers: Map<string, (text: string) => string> = new Map();

  constructor(options: ResponseGeneratorOptions) {
    this.logger = options.logger;
    this.enablePersonalization = options.enablePersonalization ?? true;
    this.responseStyle = options.responseStyle ?? 'professional';
    this.includeHelpfulHints = options.includeHelpfulHints ?? true;
    this.maxResponseLength = options.maxResponseLength ?? 500;

    this.initializeResponseTemplates();
    this.initializeStyleModifiers();

    this.logger.debug('Response generator initialized', {
      personalization: this.enablePersonalization,
      style: this.responseStyle,
      helpfulHints: this.includeHelpfulHints,
      maxLength: this.maxResponseLength,
    });
  }

  /**
   * Generate natural language response
   */
  async generateResponse(
    baseResponse: string,
    command?: ParsedCommand,
    safety?: SafetyValidation,
    context?: ConversationContext
  ): Promise<string> {
    this.logger.debug('Generating response', {
      hasCommand: !!command,
      hasSafety: !!safety,
      hasContext: !!context,
      baseLength: baseResponse.length,
    });

    try {
      let response = baseResponse;

      // If we have a command, generate intent-specific response
      if (command) {
        response = await this.generateCommandResponse(command, safety, context);
      }

      // Apply style modifications
      response = this.applyStyleModifications(response, context);

      // Add helpful hints if enabled
      if (this.includeHelpfulHints && command) {
        response = this.addHelpfulHints(response, command, context);
      }

      // Apply length constraints
      response = this.enforceResponseLength(response);

      this.logger.debug('Response generated', {
        originalLength: baseResponse.length,
        finalLength: response.length,
        intent: command?.intent,
      });

      return response;

    } catch (error) {
      this.logger.error('Response generation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        intent: command?.intent,
      });

      return this.generateFallbackResponse();
    }
  }

  /**
   * Generate command-specific response
   */
  private async generateCommandResponse(
    command: ParsedCommand,
    safety?: SafetyValidation,
    context?: ConversationContext
  ): Promise<string> {
    const templates = this.responseTemplates.get(command.intent) || 
                    this.responseTemplates.get('general') || [];

    if (templates.length === 0) {
      return this.generateGenericCommandResponse(command, safety);
    }

    // Select best template based on conditions
    const template = this.selectBestTemplate(templates, command, safety, context);
    
    // Fill template with dynamic content
    return this.fillTemplate(template, command, safety, context);
  }

  /**
   * Select best template based on conditions
   */
  private selectBestTemplate(
    templates: ResponseTemplate[],
    command: ParsedCommand,
    safety?: SafetyValidation,
    context?: ConversationContext
  ): ResponseTemplate {
    // Find templates that match current conditions
    const matchingTemplates = templates.filter(template => {
      if (!template.conditions) return true;

      return template.conditions.every(condition => {
        return this.evaluateCondition(condition, command, safety, context);
      });
    });

    // Return first matching template or fallback to first available
    return matchingTemplates[0] || templates[0];
  }

  /**
   * Evaluate template condition
   */
  private evaluateCondition(
    condition: ResponseCondition,
    command: ParsedCommand,
    safety?: SafetyValidation,
    context?: ConversationContext
  ): boolean {
    let value: any;

    // Extract value based on field
    switch (condition.field) {
      case 'command.safetyLevel':
        value = command.safetyLevel;
        break;
      case 'safety.requiresConfirmation':
        value = safety?.requiresConfirmation;
        break;
      case 'command.options.targets':
        value = command.options.targets;
        break;
      case 'context.phase':
        value = (context as any)?.session?.currentTopic;
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
      default:
        return false;
    }
  }

  /**
   * Fill template with dynamic content
   */
  private fillTemplate(
    template: ResponseTemplate,
    command: ParsedCommand,
    safety?: SafetyValidation,
    context?: ConversationContext
  ): string {
    // Select random pattern from template
    const pattern = template.patterns[Math.floor(Math.random() * template.patterns.length)];
    
    let response = pattern;

    // Replace template variables
    const variables = this.extractTemplateVariables(command, safety, context);
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      response = response.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return response;
  }

  /**
   * Extract variables for template filling
   */
  private extractTemplateVariables(
    command: ParsedCommand,
    safety?: SafetyValidation,
    context?: ConversationContext
  ): Record<string, any> {
    const variables: Record<string, any> = {
      // Command variables
      command: command.command,
      subcommand: command.subcommand || '',
      previewCommand: command.previewCommand,
      description: command.description || '',
      
      // Target variables
      targets: this.formatTargets(command.options.targets),
      targetCount: Array.isArray(command.options.targets) ? command.options.targets.length : 0,
      
      // Safety variables
      safetyLevel: command.safetyLevel,
      requiresConfirmation: safety?.requiresConfirmation ? 'yes' : 'no',
      riskCount: safety?.potentialRisks?.length || 0,
      
      // Time variables
      estimatedTime: this.formatEstimatedTime(command.estimatedExecutionTime),
      
      // Context variables
      userId: context?.session?.userId || 'user',
      sessionPhase: this.getSessionPhase(context),
    };

    return variables;
  }

  /**
   * Generate confirmation prompt
   */
  async generateConfirmationPrompt(
    command: ParsedCommand,
    safety: SafetyValidation
  ): Promise<string> {
    const templates = this.responseTemplates.get('confirmation') || [];
    
    if (templates.length === 0) {
      return this.generateGenericConfirmationPrompt(command, safety);
    }

    const template = this.selectBestTemplate(templates, command, safety);
    return this.fillTemplate(template, command, safety);
  }

  /**
   * Generate error response
   */
  async generateErrorResponse(error: any): Promise<string> {
    const templates = this.responseTemplates.get('error') || [];
    
    if (templates.length === 0) {
      return this.generateGenericErrorResponse(error);
    }

    // Select template based on error type
    const errorType = this.classifyError(error);
    const matchingTemplates = templates.filter(t => 
      t.conditions?.some(c => c.field === 'error.type' && c.value === errorType)
    );

    const template = matchingTemplates[0] || templates[0];
    
    let response = template.patterns[0];
    response = response.replace('{error}', this.formatError(error));
    
    return response;
  }

  /**
   * Generate welcome message
   */
  async generateWelcomeMessage(context?: ConversationContext): Promise<string> {
    const templates = this.responseTemplates.get('welcome') || [];
    
    if (templates.length === 0) {
      return this.generateGenericWelcomeMessage(context);
    }

    const template = templates[Math.floor(Math.random() * templates.length)];
    
    let response = template.patterns[0];
    
    // Personalize if enabled and user context available
    if (this.enablePersonalization && context?.session?.userId) {
      response = response.replace('{user}', context.session.userId);
    } else {
      response = response.replace('{user}', '');
    }

    return response;
  }

  /**
   * Initialize response templates
   */
  private initializeResponseTemplates(): void {
    // Threat scanning responses
    this.responseTemplates.set('threat_scan', [
      {
        id: 'threat-scan-basic',
        intent: 'threat_scan',
        patterns: [
          "I'll scan {targets} for security threats using a {safetyLevel} scan.",
          "Starting threat scan on {targets}. This will take approximately {estimatedTime}.",
          "Scanning {targets} for vulnerabilities and security issues.",
        ],
        variables: ['targets', 'safetyLevel', 'estimatedTime'],
        conditions: [
          { field: 'command.options.targets', operator: 'exists', value: true }
        ],
      },
      {
        id: 'threat-scan-confirmation',
        intent: 'threat_scan',
        patterns: [
          "I'll scan {targets} for threats. This is a {safetyLevel} risk operation. Proceed?",
          "Ready to scan {targets}. This may generate network traffic and take {estimatedTime}. Continue?",
        ],
        variables: ['targets', 'safetyLevel', 'estimatedTime'],
        conditions: [
          { field: 'safety.requiresConfirmation', operator: 'equals', value: true }
        ],
      },
    ]);

    // Threat listing responses
    this.responseTemplates.set('threat_list', [
      {
        id: 'threat-list-basic',
        intent: 'threat_list',
        patterns: [
          "Here are the current security threats and alerts.",
          "Displaying recent threats based on your criteria.",
          "Found {riskCount} threats matching your filters.",
        ],
        variables: ['riskCount'],
      },
    ]);

    // System status responses
    this.responseTemplates.set('system_status', [
      {
        id: 'system-status-basic',
        intent: 'system_status',
        patterns: [
          "Checking system status and security health.",
          "Running comprehensive system diagnostics.",
          "Analyzing system health and security posture.",
        ],
        variables: [],
      },
    ]);

    // Intelligence query responses
    this.responseTemplates.set('intel_query', [
      {
        id: 'intel-query-basic',
        intent: 'intel_query',
        patterns: [
          "Looking up threat intelligence for the provided indicators.",
          "Querying threat databases for reputation and analysis.",
          "Checking {targetCount} indicators against threat intelligence feeds.",
        ],
        variables: ['targetCount'],
      },
    ]);

    // Welcome messages
    this.responseTemplates.set('welcome', [
      {
        id: 'welcome-basic',
        intent: 'welcome',
        patterns: [
          "Hello{user}! I'm ThreatGuard, your cybersecurity assistant. How can I help you today?",
          "Welcome{user} to ThreatGuard. I can help you with threat detection, analysis, and security operations.",
          "Hi{user}! Ready to secure your environment? Ask me to scan, analyze, or monitor for threats.",
        ],
        variables: ['user'],
      },
    ]);

    // Confirmation prompts
    this.responseTemplates.set('confirmation', [
      {
        id: 'confirmation-basic',
        intent: 'confirmation',
        patterns: [
          "This operation has {safetyLevel} risk. Do you want to proceed?",
          "Command: {previewCommand}\nRisk level: {safetyLevel}\nContinue? (yes/no)",
          "Ready to execute {description}. This is a {safetyLevel} risk operation. Proceed?",
        ],
        variables: ['safetyLevel', 'previewCommand', 'description'],
      },
    ]);

    // Error responses
    this.responseTemplates.set('error', [
      {
        id: 'error-basic',
        intent: 'error',
        patterns: [
          "I encountered an error: {error}. Please try again or ask for help.",
          "Something went wrong: {error}. Let me know if you need assistance.",
          "Error: {error}. Would you like me to suggest an alternative approach?",
        ],
        variables: ['error'],
      },
    ]);

    // General responses
    this.responseTemplates.set('general', [
      {
        id: 'general-basic',
        intent: 'general',
        patterns: [
          "I understand. Let me help you with that.",
          "I'll take care of that for you.",
          "Processing your request.",
        ],
        variables: [],
      },
    ]);

    this.logger.debug('Response templates initialized', {
      templateCount: Array.from(this.responseTemplates.values()).reduce((sum, arr) => sum + arr.length, 0),
      intentCount: this.responseTemplates.size,
    });
  }

  /**
   * Initialize style modifiers
   */
  private initializeStyleModifiers(): void {
    this.styleModifiers.set('professional', (text: string) => {
      return text.replace(/!/g, '.').replace(/\b(awesome|cool|great)\b/gi, 'excellent');
    });

    this.styleModifiers.set('friendly', (text: string) => {
      return text.replace(/\.$/, '!').replace(/\bI'll\b/g, "I'll gladly");
    });

    this.styleModifiers.set('concise', (text: string) => {
      return text.replace(/\bI'll\b/g, 'Will').replace(/\bLet me\b/g, 'Will');
    });
  }

  /**
   * Apply style modifications
   */
  private applyStyleModifications(response: string, context?: ConversationContext): string {
    const modifier = this.styleModifiers.get(this.responseStyle);
    return modifier ? modifier(response) : response;
  }

  /**
   * Add helpful hints
   */
  private addHelpfulHints(
    response: string,
    command: ParsedCommand,
    context?: ConversationContext
  ): string {
    if (!this.includeHelpfulHints) return response;

    const hints: string[] = [];

    // Add time estimate hint
    if (command.estimatedExecutionTime && command.estimatedExecutionTime > 60000) {
      hints.push(`This operation may take ${this.formatEstimatedTime(command.estimatedExecutionTime)}.`);
    }

    // Add safety hint
    if (command.safetyLevel === 'high' || command.safetyLevel === 'critical') {
      hints.push('This is a high-impact operation - please review carefully.');
    }

    // Add context hint
    if (command.options._inferred) {
      hints.push('Some parameters were inferred from our conversation.');
    }

    if (hints.length > 0) {
      response += '\n\n💡 ' + hints.join(' ');
    }

    return response;
  }

  /**
   * Helper methods
   */
  private formatTargets(targets: any): string {
    if (!targets) return 'current system';
    if (Array.isArray(targets)) {
      if (targets.length === 1) return targets[0];
      if (targets.length <= 3) return targets.join(', ');
      return `${targets.slice(0, 2).join(', ')} and ${targets.length - 2} others`;
    }
    return String(targets);
  }

  private formatEstimatedTime(milliseconds?: number): string {
    if (!milliseconds || milliseconds <= 0) return 'a moment';
    
    if (milliseconds < 60000) return `${Math.ceil(milliseconds / 1000)} seconds`;
    if (milliseconds < 3600000) return `${Math.ceil(milliseconds / 60000)} minutes`;
    return `${Math.ceil(milliseconds / 3600000)} hours`;
  }

  private getSessionPhase(context?: ConversationContext): string {
    return (context as any)?.session?.currentTopic || 'general';
  }

  private classifyError(error: any): string {
    const message = error instanceof Error ? error.message : String(error);
    
    if (message.includes('permission') || message.includes('unauthorized')) return 'permission';
    if (message.includes('network') || message.includes('connection')) return 'network';
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('validation') || message.includes('invalid')) return 'validation';
    
    return 'general';
  }

  private formatError(error: any): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  private enforceResponseLength(response: string): string {
    if (response.length <= this.maxResponseLength) {
      return response;
    }

    // Truncate at last complete sentence before limit
    const truncated = response.substring(0, this.maxResponseLength);
    const lastSentence = truncated.lastIndexOf('.');
    
    if (lastSentence > this.maxResponseLength * 0.7) {
      return truncated.substring(0, lastSentence + 1);
    }

    return truncated + '...';
  }

  private generateFallbackResponse(): string {
    return "I understand your request and will help you with that.";
  }

  private generateGenericCommandResponse(command: ParsedCommand, safety?: SafetyValidation): string {
    if (safety?.requiresConfirmation) {
      return `I'll execute: ${command.previewCommand}\nThis is a ${command.safetyLevel} risk operation. Proceed?`;
    }
    return `Executing: ${command.previewCommand}`;
  }

  private generateGenericConfirmationPrompt(command: ParsedCommand, safety: SafetyValidation): string {
    return `Command: ${command.previewCommand}\nRisk level: ${command.safetyLevel}\nProceed? (yes/no)`;
  }

  private generateGenericErrorResponse(error: any): string {
    return `I encountered an error: ${this.formatError(error)}. Please try again.`;
  }

  private generateGenericWelcomeMessage(context?: ConversationContext): string {
    return "Hello! I'm ThreatGuard, your cybersecurity assistant. How can I help you today?";
  }

  /**
   * Update response style
   */
  updateResponseStyle(style: 'professional' | 'friendly' | 'concise'): void {
    this.responseStyle = style;
    this.logger.debug('Response style updated', { style });
  }

  /**
   * Get response generator statistics
   */
  getStatistics(): {
    templateCount: number;
    intentCount: number;
    styleModifiers: number;
    configuration: {
      personalization: boolean;
      style: string;
      helpfulHints: boolean;
      maxLength: number;
    };
  } {
    return {
      templateCount: Array.from(this.responseTemplates.values()).reduce((sum, arr) => sum + arr.length, 0),
      intentCount: this.responseTemplates.size,
      styleModifiers: this.styleModifiers.size,
      configuration: {
        personalization: this.enablePersonalization,
        style: this.responseStyle,
        helpfulHints: this.includeHelpfulHints,
        maxLength: this.maxResponseLength,
      },
    };
  }
}