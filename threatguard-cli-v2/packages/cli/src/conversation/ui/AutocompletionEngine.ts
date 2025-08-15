import { Logger } from '@threatguard/core';
import type { ConversationContext } from '../types/Context.js';
import type { Suggestion } from '../interface/ChatManager.js';
import type { Intent } from '../types/Intent.js';

export interface CompletionCandidate {
  id: string;
  text: string;
  type: 'command' | 'parameter' | 'entity' | 'workflow' | 'template';
  confidence: number;
  description: string;
  category: string;
  preview?: string;
  insertText: string;
  cursorOffset?: number;
  metadata?: {
    intent?: string;
    entityType?: string;
    parameterType?: string;
    requiredContext?: string[];
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface AutocompletionRequest {
  input: string;
  cursorPosition: number;
  context: ConversationContext;
  recentSuggestions: Suggestion[];
  sessionHistory: string[];
}

export interface AutocompletionResult {
  candidates: CompletionCandidate[];
  primaryCandidate?: CompletionCandidate;
  processingTime: number;
  confidence: number;
}

export interface AutocompletionEngineOptions {
  logger: Logger;
  maxCandidates?: number;
  confidenceThreshold?: number;
  enableLearning?: boolean;
  cacheTimeout?: number;
}

/**
 * Advanced Auto-completion Engine for conversational AI interface
 * Provides context-aware, intelligent completion suggestions with learning capabilities
 */
export class AutocompletionEngine {
  private logger: Logger;
  private maxCandidates: number;
  private confidenceThreshold: number;
  private enableLearning: boolean;
  private cacheTimeout: number;

  // Completion caches for performance
  private completionCache = new Map<string, { result: AutocompletionResult; timestamp: number }>();
  private userPatterns = new Map<string, { pattern: string; frequency: number; lastUsed: number }>();
  private contextPatterns = new Map<string, CompletionCandidate[]>();

  // Static completion databases
  private commandCompletions: CompletionCandidate[] = [];
  private entityCompletions: CompletionCandidate[] = [];
  private workflowCompletions: CompletionCandidate[] = [];

  constructor(options: AutocompletionEngineOptions) {
    this.logger = options.logger;
    this.maxCandidates = options.maxCandidates || 10;
    this.confidenceThreshold = options.confidenceThreshold || 0.3;
    this.enableLearning = options.enableLearning !== false;
    this.cacheTimeout = options.cacheTimeout || 30000; // 30 seconds

    this.initializeCompletionDatabases();
    this.logger.debug('AutocompletionEngine initialized', {
      maxCandidates: this.maxCandidates,
      confidenceThreshold: this.confidenceThreshold,
      enableLearning: this.enableLearning,
    });
  }

  /**
   * Generate completion candidates for given input
   */
  async generateCompletions(request: AutocompletionRequest): Promise<AutocompletionResult> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(request);

    // Check cache first
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      this.logger.debug('Returning cached completion result', { cacheKey });
      return cached;
    }

    try {
      const candidates: CompletionCandidate[] = [];

      // Generate different types of completions
      const commandCandidates = await this.generateCommandCompletions(request);
      const entityCandidates = await this.generateEntityCompletions(request);
      const workflowCandidates = await this.generateWorkflowCompletions(request);
      const contextCandidates = await this.generateContextualCompletions(request);
      const learnedCandidates = await this.generateLearnedCompletions(request);

      // Combine and rank candidates
      candidates.push(...commandCandidates, ...entityCandidates, ...workflowCandidates, 
                    ...contextCandidates, ...learnedCandidates);

      // Filter and rank by confidence
      const filteredCandidates = candidates
        .filter(c => c.confidence >= this.confidenceThreshold)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, this.maxCandidates);

      // Determine primary candidate
      const primaryCandidate = filteredCandidates.length > 0 ? filteredCandidates[0] : undefined;

      const result: AutocompletionResult = {
        candidates: filteredCandidates,
        primaryCandidate,
        processingTime: Date.now() - startTime,
        confidence: primaryCandidate?.confidence || 0,
      };

      // Cache the result
      this.cacheResult(cacheKey, result);

      // Learn from this completion request
      if (this.enableLearning) {
        this.learnFromRequest(request, result);
      }

      this.logger.debug('Generated completion candidates', {
        candidatesCount: result.candidates.length,
        primaryConfidence: result.confidence,
        processingTime: result.processingTime,
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to generate completions', {
        error: error instanceof Error ? error.message : 'Unknown error',
        input: request.input.substring(0, 50),
      });

      return {
        candidates: [],
        processingTime: Date.now() - startTime,
        confidence: 0,
      };
    }
  }

  /**
   * Generate command-based completions
   */
  private async generateCommandCompletions(request: AutocompletionRequest): Promise<CompletionCandidate[]> {
    const input = request.input.toLowerCase().trim();
    const candidates: CompletionCandidate[] = [];

    // Match against command database
    for (const command of this.commandCompletions) {
      const similarity = this.calculateSimilarity(input, command.text.toLowerCase());
      if (similarity > 0.3) {
        candidates.push({
          ...command,
          confidence: similarity * 0.9, // Slight penalty for static completions
        });
      }
    }

    // Context-aware command suggestions
    const recentIntents = request.context.recentIntents.slice(0, 3);
    for (const intent of recentIntents) {
      const relatedCommands = this.getRelatedCommands(intent);
      for (const command of relatedCommands) {
        if (command.text.toLowerCase().includes(input)) {
          candidates.push({
            ...command,
            confidence: command.confidence * 1.1, // Boost for context relevance
          });
        }
      }
    }

    return candidates;
  }

  /**
   * Generate entity-based completions (IPs, domains, files, etc.)
   */
  private async generateEntityCompletions(request: AutocompletionRequest): Promise<CompletionCandidate[]> {
    const input = request.input;
    const candidates: CompletionCandidate[] = [];

    // IP address completion
    if (/^\d{1,3}\.(\d{1,3}\.){0,2}/.test(input)) {
      candidates.push({
        id: 'ip-completion',
        text: this.completeIPAddress(input),
        type: 'entity',
        confidence: 0.8,
        description: 'IP address completion',
        category: 'network',
        insertText: this.completeIPAddress(input),
        metadata: { entityType: 'ip_address' },
      });
    }

    // Domain completion
    if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{0,3}$/.test(input)) {
      const domainSuggestions = this.generateDomainCompletions(input);
      candidates.push(...domainSuggestions);
    }

    // File path completion
    if (input.includes('/') || input.includes('\\')) {
      const pathSuggestions = this.generatePathCompletions(input);
      candidates.push(...pathSuggestions);
    }

    // Hash completion (MD5, SHA1, SHA256)
    if (/^[a-fA-F0-9]{8,}$/.test(input)) {
      candidates.push({
        id: 'hash-completion',
        text: `${input} (hash lookup)`,
        type: 'entity',
        confidence: 0.7,
        description: 'Hash value for threat intelligence lookup',
        category: 'threat-intel',
        insertText: input,
        metadata: { entityType: 'hash' },
      });
    }

    return candidates;
  }

  /**
   * Generate workflow-based completions
   */
  private async generateWorkflowCompletions(request: AutocompletionRequest): Promise<CompletionCandidate[]> {
    const input = request.input.toLowerCase();
    const candidates: CompletionCandidate[] = [];

    // Match against workflow database
    for (const workflow of this.workflowCompletions) {
      if (workflow.text.toLowerCase().includes(input) || 
          workflow.description.toLowerCase().includes(input)) {
        candidates.push({
          ...workflow,
          confidence: workflow.confidence * 0.95,
        });
      }
    }

    // Context-driven workflow suggestions
    const context = request.context;
    if (context.recentCommands.some(cmd => cmd.includes('scan'))) {
      candidates.push({
        id: 'post-scan-workflow',
        text: 'analyze scan results',
        type: 'workflow',
        confidence: 0.8,
        description: 'Analyze and investigate scan results',
        category: 'investigation',
        insertText: 'analyze scan results and show detailed findings',
        metadata: { intent: 'threat_analysis' },
      });
    }

    return candidates;
  }

  /**
   * Generate contextual completions based on conversation history
   */
  private async generateContextualCompletions(request: AutocompletionRequest): Promise<CompletionCandidate[]> {
    const candidates: CompletionCandidate[] = [];
    const context = request.context;

    // Recent entity completions
    for (const entity of context.recentEntities.slice(0, 5)) {
      if (entity.value.toLowerCase().includes(request.input.toLowerCase())) {
        candidates.push({
          id: `recent-entity-${entity.id}`,
          text: entity.value,
          type: 'entity',
          confidence: 0.6,
          description: `Recent ${entity.type}: ${entity.value}`,
          category: 'recent',
          insertText: entity.value,
          metadata: { entityType: entity.type },
        });
      }
    }

    // Pattern-based suggestions from recent commands
    const recentPatterns = this.extractPatterns(context.recentCommands);
    for (const pattern of recentPatterns) {
      if (pattern.toLowerCase().includes(request.input.toLowerCase())) {
        candidates.push({
          id: `pattern-${pattern}`,
          text: pattern,
          type: 'template',
          confidence: 0.5,
          description: `Similar to recent commands`,
          category: 'pattern',
          insertText: pattern,
        });
      }
    }

    return candidates;
  }

  /**
   * Generate learned completions from user patterns
   */
  private async generateLearnedCompletions(request: AutocompletionRequest): Promise<CompletionCandidate[]> {
    if (!this.enableLearning) return [];

    const candidates: CompletionCandidate[] = [];
    const input = request.input.toLowerCase();

    // User pattern matching
    for (const [pattern, data] of this.userPatterns.entries()) {
      if (pattern.toLowerCase().includes(input)) {
        const recency = Date.now() - data.lastUsed;
        const recencyBoost = Math.max(0, 1 - (recency / (7 * 24 * 60 * 60 * 1000))); // Week decay
        const frequencyBoost = Math.min(1, data.frequency / 10); // Frequency factor

        candidates.push({
          id: `learned-${pattern}`,
          text: data.pattern,
          type: 'template',
          confidence: 0.4 + (recencyBoost * 0.3) + (frequencyBoost * 0.3),
          description: `Learned pattern (used ${data.frequency} times)`,
          category: 'learned',
          insertText: data.pattern,
        });
      }
    }

    return candidates;
  }

  /**
   * Initialize static completion databases
   */
  private initializeCompletionDatabases(): void {
    // Command completions
    this.commandCompletions = [
      {
        id: 'scan-threats',
        text: 'scan for threats',
        type: 'command',
        confidence: 0.9,
        description: 'Scan system for security threats',
        category: 'security',
        insertText: 'scan for threats',
        metadata: { intent: 'threat_scan', riskLevel: 'low' },
      },
      {
        id: 'auth-status',
        text: 'check authentication status',
        type: 'command',
        confidence: 0.8,
        description: 'Check current authentication status',
        category: 'auth',
        insertText: 'check authentication status',
        metadata: { intent: 'auth_status', riskLevel: 'low' },
      },
      {
        id: 'system-status',
        text: 'show system status',
        type: 'command',
        confidence: 0.8,
        description: 'Display current system status',
        category: 'system',
        insertText: 'show system status',
        metadata: { intent: 'system_status', riskLevel: 'low' },
      },
      {
        id: 'threat-watch',
        text: 'start threat monitoring',
        type: 'command',
        confidence: 0.9,
        description: 'Begin real-time threat monitoring',
        category: 'monitoring',
        insertText: 'start threat monitoring',
        metadata: { intent: 'threat_watch', riskLevel: 'medium' },
      },
      {
        id: 'network-scan',
        text: 'scan network for vulnerabilities',
        type: 'command',
        confidence: 0.8,
        description: 'Scan network infrastructure for vulnerabilities',
        category: 'network',
        insertText: 'scan network for vulnerabilities',
        metadata: { intent: 'network_scan', riskLevel: 'medium' },
      },
    ];

    // Workflow completions
    this.workflowCompletions = [
      {
        id: 'incident-response',
        text: 'start incident response workflow',
        type: 'workflow',
        confidence: 0.8,
        description: 'Initiate complete incident response procedure',
        category: 'incident',
        insertText: 'start incident response workflow',
        metadata: { intent: 'workflow_incident', riskLevel: 'high' },
      },
      {
        id: 'threat-hunting',
        text: 'begin threat hunting session',
        type: 'workflow',
        confidence: 0.8,
        description: 'Start proactive threat hunting workflow',
        category: 'hunting',
        insertText: 'begin threat hunting session',
        metadata: { intent: 'workflow_hunting', riskLevel: 'medium' },
      },
      {
        id: 'security-assessment',
        text: 'perform comprehensive security assessment',
        type: 'workflow',
        confidence: 0.7,
        description: 'Complete security assessment workflow',
        category: 'assessment',
        insertText: 'perform comprehensive security assessment',
        metadata: { intent: 'workflow_assessment', riskLevel: 'medium' },
      },
    ];
  }

  /**
   * Calculate text similarity using fuzzy matching
   */
  private calculateSimilarity(input: string, target: string): number {
    if (!input || !target) return 0;
    if (input === target) return 1;

    // Simple fuzzy matching algorithm
    const longer = input.length > target.length ? input : target;
    const shorter = input.length > target.length ? target : input;

    if (longer.length === 0) return 1;

    const editDistance = this.levenshteinDistance(input, target);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance for fuzzy matching
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Get related commands for a given intent
   */
  private getRelatedCommands(intent: string): CompletionCandidate[] {
    const related: Record<string, CompletionCandidate[]> = {
      'threat_scan': [
        {
          id: 'view-results',
          text: 'view scan results',
          type: 'command',
          confidence: 0.8,
          description: 'View detailed scan results',
          category: 'results',
          insertText: 'view scan results',
        },
        {
          id: 'export-results',
          text: 'export scan report',
          type: 'command',
          confidence: 0.7,
          description: 'Export scan results to file',
          category: 'export',
          insertText: 'export scan report',
        },
      ],
      'auth_status': [
        {
          id: 'login',
          text: 'login',
          type: 'command',
          confidence: 0.8,
          description: 'Authenticate with the system',
          category: 'auth',
          insertText: 'login',
        },
        {
          id: 'logout',
          text: 'logout',
          type: 'command',
          confidence: 0.7,
          description: 'Sign out of the system',
          category: 'auth',
          insertText: 'logout',
        },
      ],
    };

    return related[intent] || [];
  }

  /**
   * Complete IP address based on partial input
   */
  private completeIPAddress(partial: string): string {
    const parts = partial.split('.');
    const completed = [...parts];

    // Fill missing octets with placeholder
    while (completed.length < 4) {
      completed.push('0');
    }

    return completed.join('.');
  }

  /**
   * Generate domain completions
   */
  private generateDomainCompletions(partial: string): CompletionCandidate[] {
    const commonTLDs = ['.com', '.org', '.net', '.gov', '.edu', '.mil'];
    const candidates: CompletionCandidate[] = [];

    for (const tld of commonTLDs) {
      if (!partial.endsWith(tld)) {
        const baseDomain = partial.split('.')[0];
        candidates.push({
          id: `domain-${baseDomain}${tld}`,
          text: `${baseDomain}${tld}`,
          type: 'entity',
          confidence: 0.6,
          description: `Domain completion with ${tld}`,
          category: 'domain',
          insertText: `${baseDomain}${tld}`,
          metadata: { entityType: 'domain' },
        });
      }
    }

    return candidates;
  }

  /**
   * Generate file path completions
   */
  private generatePathCompletions(partial: string): CompletionCandidate[] {
    const candidates: CompletionCandidate[] = [];
    const commonPaths = ['/var/log/', '/etc/', '/home/', '/tmp/', 'C:\\Windows\\', 'C:\\Users\\'];

    for (const path of commonPaths) {
      if (path.toLowerCase().includes(partial.toLowerCase())) {
        candidates.push({
          id: `path-${path}`,
          text: path,
          type: 'entity',
          confidence: 0.5,
          description: `Common system path`,
          category: 'filesystem',
          insertText: path,
          metadata: { entityType: 'file_path' },
        });
      }
    }

    return candidates;
  }

  /**
   * Extract patterns from command history
   */
  private extractPatterns(commands: string[]): string[] {
    const patterns = new Set<string>();

    for (const command of commands) {
      // Extract common patterns
      const words = command.split(' ');
      if (words.length >= 2) {
        patterns.add(words.slice(0, 2).join(' '));
      }
      if (words.length >= 3) {
        patterns.add(words.slice(0, 3).join(' '));
      }
    }

    return Array.from(patterns);
  }

  /**
   * Cache completion result
   */
  private cacheResult(key: string, result: AutocompletionResult): void {
    this.completionCache.set(key, {
      result,
      timestamp: Date.now(),
    });

    // Clean old cache entries
    const cutoff = Date.now() - this.cacheTimeout;
    for (const [cacheKey, data] of this.completionCache.entries()) {
      if (data.timestamp < cutoff) {
        this.completionCache.delete(cacheKey);
      }
    }
  }

  /**
   * Get cached completion result
   */
  private getCachedResult(key: string): AutocompletionResult | null {
    const cached = this.completionCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.result;
    }
    return null;
  }

  /**
   * Generate cache key for completion request
   */
  private generateCacheKey(request: AutocompletionRequest): string {
    return `${request.input}:${request.cursorPosition}:${request.context.session.currentTopic}`;
  }

  /**
   * Learn from completion request for future improvements
   */
  private learnFromRequest(request: AutocompletionRequest, result: AutocompletionResult): void {
    if (!this.enableLearning) return;

    // Learn user patterns
    const pattern = request.input.trim();
    if (pattern.length > 2) {
      const existing = this.userPatterns.get(pattern);
      if (existing) {
        existing.frequency++;
        existing.lastUsed = Date.now();
      } else {
        this.userPatterns.set(pattern, {
          pattern,
          frequency: 1,
          lastUsed: Date.now(),
        });
      }
    }

    // Limit pattern storage
    if (this.userPatterns.size > 1000) {
      const sortedPatterns = Array.from(this.userPatterns.entries())
        .sort((a, b) => b[1].lastUsed - a[1].lastUsed);
      
      this.userPatterns.clear();
      sortedPatterns.slice(0, 500).forEach(([key, value]) => {
        this.userPatterns.set(key, value);
      });
    }
  }

  /**
   * Get completion statistics
   */
  getStatistics(): {
    cacheSize: number;
    patternCount: number;
    commandCompletions: number;
    workflowCompletions: number;
  } {
    return {
      cacheSize: this.completionCache.size,
      patternCount: this.userPatterns.size,
      commandCompletions: this.commandCompletions.length,
      workflowCompletions: this.workflowCompletions.length,
    };
  }

  /**
   * Clear learned patterns and cache
   */
  clearLearning(): void {
    this.userPatterns.clear();
    this.completionCache.clear();
    this.logger.info('Cleared completion learning data');
  }
}