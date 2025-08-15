import { Logger } from '@threatguard/core';
import type { 
  SafetyValidationRequest, 
  SafetyValidationResult, 
  CommandValidator 
} from '../types/Command.js';
import type { ConversationContext } from '../types/Context.js';

export interface AdvancedSafetyValidatorOptions {
  logger: Logger;
  strictMode?: boolean;
  baseValidator?: CommandValidator;
  riskThresholds?: RiskThresholds;
  contextAnalysis?: ContextAnalysisOptions;
  policyEngine?: PolicyEngineOptions;
}

export interface RiskThresholds {
  low: number;
  medium: number;
  high: number;
  critical: number;
}

export interface ContextAnalysisOptions {
  enableEnvironmentAnalysis: boolean;
  enableUserRoleAnalysis: boolean;
  enableTimeBasedAnalysis: boolean;
  enableCommandPatternAnalysis: boolean;
  enableWorkflowAnalysis: boolean;
}

export interface PolicyEngineOptions {
  enableEnterprisePolicies: boolean;
  policyConfigPath?: string;
  customPolicies?: SecurityPolicy[];
}

export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  conditions: PolicyCondition[];
  actions: PolicyAction[];
  priority: number;
  enabled: boolean;
}

export interface PolicyCondition {
  type: 'command_pattern' | 'user_role' | 'environment' | 'time_window' | 'resource_type' | 'custom';
  pattern?: string;
  value?: any;
  operator?: 'equals' | 'contains' | 'matches' | 'greater_than' | 'less_than' | 'in_range';
}

export interface PolicyAction {
  type: 'block' | 'require_approval' | 'log_warning' | 'limit_scope' | 'add_monitoring';
  parameters?: Record<string, any>;
  message?: string;
}

export interface UserRole {
  role: string;
  permissions: string[];
  restrictions: string[];
  riskLevel: 'low' | 'medium' | 'high';
  approvalLevel: 'none' | 'supervisor' | 'admin' | 'security_team';
}

export interface EnvironmentContext {
  type: 'development' | 'staging' | 'production';
  classification: 'public' | 'internal' | 'confidential' | 'restricted';
  criticality: 'low' | 'medium' | 'high' | 'critical';
  complianceRequirements: string[];
}

export interface RiskAssessment {
  baseRisk: number;
  contextualRisk: number;
  aggregatedRisk: number;
  riskFactors: RiskFactor[];
  mitigations: string[];
  recommendations: string[];
}

export interface RiskFactor {
  category: string;
  description: string;
  impact: number; // 0-1 scale
  likelihood: number; // 0-1 scale
  riskScore: number; // impact * likelihood
  source: string;
}

/**
 * Advanced Safety Validator with Context-Aware Risk Assessment
 * Provides enterprise-grade safety validation with contextual intelligence
 */
export class AdvancedSafetyValidator {
  private logger: Logger;
  private strictMode: boolean;
  private baseValidator?: CommandValidator;
  private riskThresholds: RiskThresholds;
  private contextAnalysis: ContextAnalysisOptions;
  private policyEngine: PolicyEngineOptions;

  // Risk assessment cache
  private riskAssessmentCache = new Map<string, { assessment: RiskAssessment; timestamp: number }>();
  private userRoleCache = new Map<string, UserRole>();
  private policyCache = new Map<string, SecurityPolicy>();

  // Predefined user roles
  private readonly defaultUserRoles: Record<string, UserRole> = {
    'junior_analyst': {
      role: 'junior_analyst',
      permissions: ['threat.view', 'scan.basic', 'report.view'],
      restrictions: ['system.admin', 'config.modify', 'data.delete'],
      riskLevel: 'high',
      approvalLevel: 'supervisor',
    },
    'senior_analyst': {
      role: 'senior_analyst',
      permissions: ['threat.*', 'scan.*', 'report.*', 'investigate.*'],
      restrictions: ['system.admin', 'config.critical'],
      riskLevel: 'medium',
      approvalLevel: 'admin',
    },
    'security_admin': {
      role: 'security_admin',
      permissions: ['*'],
      restrictions: [],
      riskLevel: 'low',
      approvalLevel: 'none',
    },
    'readonly_user': {
      role: 'readonly_user',
      permissions: ['*.view', '*.read'],
      restrictions: ['*.modify', '*.delete', '*.execute'],
      riskLevel: 'high',
      approvalLevel: 'supervisor',
    },
  };

  // Risk scoring matrices
  private readonly commandRiskMatrix: Record<string, number> = {
    'scan': 0.3,
    'investigate': 0.4,
    'analyze': 0.2,
    'report': 0.1,
    'contain': 0.7,
    'quarantine': 0.8,
    'block': 0.9,
    'delete': 0.9,
    'modify': 0.6,
    'admin': 0.8,
    'config': 0.7,
    'system': 0.8,
    'network': 0.5,
    'auth': 0.6,
  };

  private readonly environmentRiskMultipliers: Record<string, number> = {
    'development': 0.5,
    'staging': 0.7,
    'production': 1.5,
  };

  constructor(options: AdvancedSafetyValidatorOptions) {
    this.logger = options.logger;
    this.strictMode = options.strictMode !== false;
    this.baseValidator = options.baseValidator;
    
    this.riskThresholds = {
      low: 0.3,
      medium: 0.5,
      high: 0.7,
      critical: 0.9,
      ...options.riskThresholds,
    };

    this.contextAnalysis = {
      enableEnvironmentAnalysis: true,
      enableUserRoleAnalysis: true,
      enableTimeBasedAnalysis: true,
      enableCommandPatternAnalysis: true,
      enableWorkflowAnalysis: true,
      ...options.contextAnalysis,
    };

    this.policyEngine = {
      enableEnterprisePolicies: true,
      ...options.policyEngine,
    };

    this.initializeDefaultPolicies();
    this.loadUserRoles();

    this.logger.info('AdvancedSafetyValidator initialized', {
      strictMode: this.strictMode,
      riskThresholds: this.riskThresholds,
      contextAnalysis: this.contextAnalysis,
      policyEngine: this.policyEngine,
    });
  }

  /**
   * Validate command with advanced context-aware analysis
   */
  async validateCommand(request: SafetyValidationRequest): Promise<SafetyValidationResult> {
    const startTime = Date.now();
    
    this.logger.debug('Starting advanced safety validation', {
      command: request.command.substring(0, 50),
      userId: request.userId,
      environment: request.environment,
      contextKeys: Object.keys(request.context || {}),
    });

    try {
      // Perform base validation if available
      let baseResult: SafetyValidationResult | null = null;
      if (this.baseValidator) {
        baseResult = await this.baseValidator(request);
      }

      // Perform advanced risk assessment
      const riskAssessment = await this.performRiskAssessment(request);
      
      // Apply policy engine
      const policyResult = await this.applyPolicyEngine(request, riskAssessment);
      
      // Determine final result
      const finalResult = this.aggregateResults(baseResult, riskAssessment, policyResult, request);
      
      const processingTime = Date.now() - startTime;
      
      this.logger.info('Advanced safety validation completed', {
        command: request.command.substring(0, 50),
        allowed: finalResult.allowed,
        riskLevel: finalResult.riskLevel,
        requiresApproval: finalResult.requiresApproval,
        processingTime,
        riskScore: riskAssessment.aggregatedRisk,
      });

      return finalResult;

    } catch (error) {
      this.logger.error('Advanced safety validation failed', {
        command: request.command.substring(0, 50),
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Fail-safe: block command if validation fails
      return {
        allowed: false,
        reason: 'Safety validation system error',
        riskLevel: 'critical',
        requiresApproval: true,
        warnings: ['Safety validation system encountered an error'],
        recommendations: ['Contact system administrator'],
        mitigations: ['Manual review required'],
        approvalRequired: true,
        approvalLevel: 'security_team',
      };
    }
  }

  /**
   * Perform comprehensive risk assessment
   */
  private async performRiskAssessment(request: SafetyValidationRequest): Promise<RiskAssessment> {
    const cacheKey = this.generateCacheKey(request);
    const cached = this.riskAssessmentCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 30000) { // 30 second cache
      return cached.assessment;
    }

    const riskFactors: RiskFactor[] = [];

    // Base command risk assessment
    if (this.contextAnalysis.enableCommandPatternAnalysis) {
      riskFactors.push(...await this.analyzeCommandRisk(request));
    }

    // Environment-based risk assessment
    if (this.contextAnalysis.enableEnvironmentAnalysis) {
      riskFactors.push(...await this.analyzeEnvironmentRisk(request));
    }

    // User role-based risk assessment
    if (this.contextAnalysis.enableUserRoleAnalysis) {
      riskFactors.push(...await this.analyzeUserRoleRisk(request));
    }

    // Time-based risk assessment
    if (this.contextAnalysis.enableTimeBasedAnalysis) {
      riskFactors.push(...await this.analyzeTemporalRisk(request));
    }

    // Workflow context risk assessment
    if (this.contextAnalysis.enableWorkflowAnalysis) {
      riskFactors.push(...await this.analyzeWorkflowRisk(request));
    }

    // Calculate aggregated risk
    const baseRisk = this.calculateBaseRisk(riskFactors);
    const contextualRisk = this.calculateContextualRisk(riskFactors, request);
    const aggregatedRisk = this.aggregateRiskScores(baseRisk, contextualRisk);

    const assessment: RiskAssessment = {
      baseRisk,
      contextualRisk,
      aggregatedRisk,
      riskFactors,
      mitigations: this.generateMitigations(riskFactors),
      recommendations: this.generateRecommendations(riskFactors, aggregatedRisk),
    };

    // Cache the assessment
    this.riskAssessmentCache.set(cacheKey, {
      assessment,
      timestamp: Date.now(),
    });

    return assessment;
  }

  /**
   * Analyze command-specific risk
   */
  private async analyzeCommandRisk(request: SafetyValidationRequest): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];
    const command = request.command.toLowerCase();

    // Check against command risk matrix
    for (const [cmdPattern, riskScore] of Object.entries(this.commandRiskMatrix)) {
      if (command.includes(cmdPattern)) {
        factors.push({
          category: 'command_pattern',
          description: `Command contains high-risk pattern: ${cmdPattern}`,
          impact: riskScore,
          likelihood: 0.8,
          riskScore: riskScore * 0.8,
          source: 'command_analysis',
        });
      }
    }

    // Check for destructive operations
    const destructivePatterns = [
      /delete|remove|rm\s+/i,
      /drop|truncate/i,
      /format|wipe/i,
      /shutdown|reboot/i,
    ];

    for (const pattern of destructivePatterns) {
      if (pattern.test(command)) {
        factors.push({
          category: 'destructive_operation',
          description: 'Command contains potentially destructive operations',
          impact: 0.9,
          likelihood: 0.7,
          riskScore: 0.63,
          source: 'destructive_pattern_analysis',
        });
        break;
      }
    }

    // Check for privilege escalation
    if (/sudo|su\s+|runas/i.test(command)) {
      factors.push({
        category: 'privilege_escalation',
        description: 'Command attempts privilege escalation',
        impact: 0.8,
        likelihood: 0.9,
        riskScore: 0.72,
        source: 'privilege_analysis',
      });
    }

    return factors;
  }

  /**
   * Analyze environment-based risk
   */
  private async analyzeEnvironmentRisk(request: SafetyValidationRequest): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];
    const environment = request.environment || 'production';

    // Environment risk multiplier
    const envMultiplier = this.environmentRiskMultipliers[environment] || 1.0;
    
    if (envMultiplier > 1.0) {
      factors.push({
        category: 'environment',
        description: `Command executed in ${environment} environment`,
        impact: 0.6,
        likelihood: envMultiplier - 1.0,
        riskScore: 0.6 * (envMultiplier - 1.0),
        source: 'environment_analysis',
      });
    }

    // Check for production-specific restrictions
    if (environment === 'production') {
      const prodRestrictedPatterns = [
        /debug|test|experimental/i,
        /--unsafe|--force/i,
        /bypass|skip.*validation/i,
      ];

      for (const pattern of prodRestrictedPatterns) {
        if (pattern.test(request.command)) {
          factors.push({
            category: 'production_restriction',
            description: 'Command contains patterns restricted in production',
            impact: 0.8,
            likelihood: 0.9,
            riskScore: 0.72,
            source: 'production_policy',
          });
          break;
        }
      }
    }

    return factors;
  }

  /**
   * Analyze user role-based risk
   */
  private async analyzeUserRoleRisk(request: SafetyValidationRequest): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];
    
    if (!request.userId) {
      factors.push({
        category: 'authentication',
        description: 'Command executed without user identification',
        impact: 0.7,
        likelihood: 1.0,
        riskScore: 0.7,
        source: 'user_analysis',
      });
      return factors;
    }

    const userRole = this.getUserRole(request.userId);
    
    // Check permissions
    const hasPermission = this.checkUserPermissions(request.command, userRole);
    
    if (!hasPermission) {
      factors.push({
        category: 'authorization',
        description: `User role '${userRole.role}' lacks permission for this command`,
        impact: 0.9,
        likelihood: 1.0,
        riskScore: 0.9,
        source: 'permission_analysis',
      });
    }

    // Apply role-based risk level
    const roleRiskValues = { low: 0.2, medium: 0.5, high: 0.8 };
    const roleRisk = roleRiskValues[userRole.riskLevel];
    
    if (roleRisk > 0.3) {
      factors.push({
        category: 'user_role',
        description: `User role '${userRole.role}' has ${userRole.riskLevel} risk level`,
        impact: roleRisk,
        likelihood: 0.7,
        riskScore: roleRisk * 0.7,
        source: 'role_analysis',
      });
    }

    return factors;
  }

  /**
   * Analyze temporal risk factors
   */
  private async analyzeTemporalRisk(request: SafetyValidationRequest): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay(); // 0 = Sunday, 6 = Saturday

    // Off-hours risk
    if (hour < 8 || hour > 18) {
      factors.push({
        category: 'temporal',
        description: 'Command executed during off-business hours',
        impact: 0.4,
        likelihood: 0.6,
        riskScore: 0.24,
        source: 'temporal_analysis',
      });
    }

    // Weekend risk
    if (day === 0 || day === 6) {
      factors.push({
        category: 'temporal',
        description: 'Command executed during weekend',
        impact: 0.3,
        likelihood: 0.7,
        riskScore: 0.21,
        source: 'temporal_analysis',
      });
    }

    return factors;
  }

  /**
   * Analyze workflow-specific risk
   */
  private async analyzeWorkflowRisk(request: SafetyValidationRequest): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    // Multi-step workflow risk
    if (request.pipelineId || request.workflowId) {
      factors.push({
        category: 'workflow',
        description: 'Command is part of multi-step workflow',
        impact: 0.3,
        likelihood: 0.5,
        riskScore: 0.15,
        source: 'workflow_analysis',
      });
    }

    // Check for workflow context dependencies
    if (request.stepId && request.context) {
      const hasRequiredContext = this.validateWorkflowContext(request);
      
      if (!hasRequiredContext) {
        factors.push({
          category: 'workflow_context',
          description: 'Workflow step missing required context',
          impact: 0.6,
          likelihood: 0.8,
          riskScore: 0.48,
          source: 'workflow_validation',
        });
      }
    }

    return factors;
  }

  /**
   * Apply enterprise policy engine
   */
  private async applyPolicyEngine(
    request: SafetyValidationRequest,
    riskAssessment: RiskAssessment
  ): Promise<{ violations: string[]; actions: PolicyAction[] }> {
    const violations: string[] = [];
    const actions: PolicyAction[] = [];

    if (!this.policyEngine.enableEnterprisePolicies) {
      return { violations, actions };
    }

    // Check all policies
    for (const policy of this.policyCache.values()) {
      if (!policy.enabled) continue;

      const matches = this.evaluatePolicyConditions(policy.conditions, request, riskAssessment);
      
      if (matches) {
        violations.push(policy.name);
        actions.push(...policy.actions);
        
        this.logger.debug('Policy violation detected', {
          policyId: policy.id,
          policyName: policy.name,
          command: request.command.substring(0, 50),
        });
      }
    }

    return { violations, actions };
  }

  /**
   * Evaluate policy conditions
   */
  private evaluatePolicyConditions(
    conditions: PolicyCondition[],
    request: SafetyValidationRequest,
    riskAssessment: RiskAssessment
  ): boolean {
    return conditions.every(condition => {
      switch (condition.type) {
        case 'command_pattern':
          return condition.pattern ? new RegExp(condition.pattern).test(request.command) : false;
        
        case 'user_role':
          const userRole = this.getUserRole(request.userId || '');
          return condition.value === userRole.role;
        
        case 'environment':
          return condition.value === request.environment;
        
        case 'time_window':
          return this.checkTimeWindow(condition.value);
        
        default:
          return false;
      }
    });
  }

  /**
   * Aggregate all validation results
   */
  private aggregateResults(
    baseResult: SafetyValidationResult | null,
    riskAssessment: RiskAssessment,
    policyResult: { violations: string[]; actions: PolicyAction[] },
    request: SafetyValidationRequest
  ): SafetyValidationResult {
    // Determine if command should be allowed
    const hasBlockingPolicyViolations = policyResult.actions.some(a => a.type === 'block');
    const riskLevel = this.determineRiskLevel(riskAssessment.aggregatedRisk);
    const exceedsRiskThreshold = riskAssessment.aggregatedRisk >= this.riskThresholds.critical;
    
    const allowed = !hasBlockingPolicyViolations && 
                   !exceedsRiskThreshold && 
                   (baseResult?.allowed !== false);

    // Determine approval requirements
    const requiresApproval = !allowed || 
                           riskAssessment.aggregatedRisk >= this.riskThresholds.medium ||
                           policyResult.actions.some(a => a.type === 'require_approval') ||
                           baseResult?.requiresApproval === true;

    const approvalLevel = this.determineApprovalLevel(request, riskAssessment, policyResult);

    // Compile warnings and recommendations
    const warnings = [
      ...(baseResult?.warnings || []),
      ...policyResult.violations.map(v => `Policy violation: ${v}`),
      ...riskAssessment.riskFactors
        .filter(f => f.riskScore > 0.5)
        .map(f => f.description),
    ];

    const recommendations = [
      ...(baseResult?.recommendations || []),
      ...riskAssessment.recommendations,
    ];

    const mitigations = [
      ...(baseResult?.mitigations || []),
      ...riskAssessment.mitigations,
      ...policyResult.actions
        .filter(a => a.type === 'add_monitoring')
        .map(a => a.message || 'Enhanced monitoring required'),
    ];

    return {
      allowed,
      reason: allowed ? undefined : this.generateDenialReason(riskAssessment, policyResult),
      riskLevel,
      requiresApproval,
      warnings,
      recommendations,
      mitigations,
      approvalRequired: requiresApproval,
      approvalLevel,
    };
  }

  /**
   * Generate cache key for risk assessment
   */
  private generateCacheKey(request: SafetyValidationRequest): string {
    const keyParts = [
      request.command,
      request.userId || 'anonymous',
      request.environment || 'default',
      request.stepId || '',
      JSON.stringify(Object.keys(request.context || {})),
    ];
    
    return keyParts.join('|');
  }

  /**
   * Calculate base risk from factors
   */
  private calculateBaseRisk(factors: RiskFactor[]): number {
    if (factors.length === 0) return 0;
    
    const totalRisk = factors.reduce((sum, factor) => sum + factor.riskScore, 0);
    return Math.min(totalRisk / factors.length, 1.0);
  }

  /**
   * Calculate contextual risk adjustments
   */
  private calculateContextualRisk(factors: RiskFactor[], request: SafetyValidationRequest): number {
    const contextFactors = factors.filter(f => 
      f.category === 'environment' || 
      f.category === 'temporal' || 
      f.category === 'workflow'
    );
    
    if (contextFactors.length === 0) return 0;
    
    const contextRisk = contextFactors.reduce((sum, factor) => sum + factor.riskScore, 0);
    return Math.min(contextRisk, 0.5); // Cap contextual risk at 0.5
  }

  /**
   * Aggregate base and contextual risk scores
   */
  private aggregateRiskScores(baseRisk: number, contextualRisk: number): number {
    // Use weighted average with contextual risk as modifier
    return Math.min(baseRisk + (contextualRisk * 0.5), 1.0);
  }

  /**
   * Determine risk level from score
   */
  private determineRiskLevel(riskScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (riskScore >= this.riskThresholds.critical) return 'critical';
    if (riskScore >= this.riskThresholds.high) return 'high';
    if (riskScore >= this.riskThresholds.medium) return 'medium';
    return 'low';
  }

  /**
   * Determine required approval level
   */
  private determineApprovalLevel(
    request: SafetyValidationRequest,
    riskAssessment: RiskAssessment,
    policyResult: { violations: string[]; actions: PolicyAction[] }
  ): 'user' | 'supervisor' | 'admin' | 'security_team' {
    // Check policy actions first
    const policyApprovalActions = policyResult.actions.filter(a => a.type === 'require_approval');
    if (policyApprovalActions.length > 0) {
      const highestLevel = policyApprovalActions.reduce((highest, action) => {
        const level = action.parameters?.level || 'supervisor';
        return this.compareApprovalLevels(level, highest) > 0 ? level : highest;
      }, 'user');
      return highestLevel;
    }

    // Determine by risk level
    if (riskAssessment.aggregatedRisk >= this.riskThresholds.critical) {
      return 'security_team';
    }
    if (riskAssessment.aggregatedRisk >= this.riskThresholds.high) {
      return 'admin';
    }
    if (riskAssessment.aggregatedRisk >= this.riskThresholds.medium) {
      return 'supervisor';
    }
    
    return 'user';
  }

  /**
   * Compare approval levels (returns 1 if level1 > level2, -1 if level1 < level2, 0 if equal)
   */
  private compareApprovalLevels(level1: string, level2: string): number {
    const levels = ['user', 'supervisor', 'admin', 'security_team'];
    const index1 = levels.indexOf(level1);
    const index2 = levels.indexOf(level2);
    return index1 - index2;
  }

  /**
   * Generate denial reason
   */
  private generateDenialReason(
    riskAssessment: RiskAssessment,
    policyResult: { violations: string[]; actions: PolicyAction[] }
  ): string {
    if (policyResult.violations.length > 0) {
      return `Policy violations: ${policyResult.violations.join(', ')}`;
    }
    
    const riskLevel = this.determineRiskLevel(riskAssessment.aggregatedRisk);
    return `Command blocked due to ${riskLevel} risk level (score: ${riskAssessment.aggregatedRisk.toFixed(2)})`;
  }

  /**
   * Generate mitigations based on risk factors
   */
  private generateMitigations(factors: RiskFactor[]): string[] {
    const mitigations: string[] = [];
    
    factors.forEach(factor => {
      switch (factor.category) {
        case 'destructive_operation':
          mitigations.push('Consider using --dry-run flag first');
          mitigations.push('Ensure recent backup exists');
          break;
        
        case 'privilege_escalation':
          mitigations.push('Use principle of least privilege');
          mitigations.push('Implement additional authentication');
          break;
        
        case 'production_restriction':
          mitigations.push('Test in staging environment first');
          mitigations.push('Implement change management process');
          break;
        
        case 'authorization':
          mitigations.push('Request appropriate permissions');
          mitigations.push('Use role-based access delegation');
          break;
      }
    });

    return [...new Set(mitigations)]; // Remove duplicates
  }

  /**
   * Generate recommendations based on risk factors
   */
  private generateRecommendations(factors: RiskFactor[], aggregatedRisk: number): string[] {
    const recommendations: string[] = [];
    
    if (aggregatedRisk > 0.7) {
      recommendations.push('Consider alternative lower-risk approaches');
      recommendations.push('Implement comprehensive monitoring');
    }
    
    if (aggregatedRisk > 0.5) {
      recommendations.push('Validate command in safe environment first');
      recommendations.push('Prepare rollback procedures');
    }

    return recommendations;
  }

  /**
   * Get user role (with caching)
   */
  private getUserRole(userId: string): UserRole {
    if (!userId) {
      return this.defaultUserRoles.readonly_user;
    }

    const cached = this.userRoleCache.get(userId);
    if (cached) {
      return cached;
    }

    // For now, assign default role based on userId pattern
    // In production, this would query a user management system
    let role: UserRole;
    if (userId.includes('admin')) {
      role = this.defaultUserRoles.security_admin;
    } else if (userId.includes('senior')) {
      role = this.defaultUserRoles.senior_analyst;
    } else if (userId.includes('junior')) {
      role = this.defaultUserRoles.junior_analyst;
    } else {
      role = this.defaultUserRoles.senior_analyst; // Default
    }

    this.userRoleCache.set(userId, role);
    return role;
  }

  /**
   * Check user permissions
   */
  private checkUserPermissions(command: string, userRole: UserRole): boolean {
    const commandType = command.split(' ')[0];
    
    // Check restrictions first
    for (const restriction of userRole.restrictions) {
      if (this.matchesPermissionPattern(commandType, restriction)) {
        return false;
      }
    }

    // Check permissions
    for (const permission of userRole.permissions) {
      if (this.matchesPermissionPattern(commandType, permission)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Match command against permission pattern
   */
  private matchesPermissionPattern(command: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern.endsWith('*')) {
      return command.startsWith(pattern.slice(0, -1));
    }
    return command === pattern || command.startsWith(pattern + '.');
  }

  /**
   * Validate workflow context
   */
  private validateWorkflowContext(request: SafetyValidationRequest): boolean {
    // Check if required context variables are present
    const context = request.context || {};
    
    // Basic validation - ensure workflow has proper context
    return !!(request.stepId && Object.keys(context).length > 0);
  }

  /**
   * Check time window condition
   */
  private checkTimeWindow(timeWindow: any): boolean {
    const now = new Date();
    const hour = now.getHours();
    
    if (typeof timeWindow === 'object' && timeWindow.start && timeWindow.end) {
      return hour >= timeWindow.start && hour <= timeWindow.end;
    }
    
    return true; // Default allow if no specific time window
  }

  /**
   * Initialize default security policies
   */
  private initializeDefaultPolicies(): void {
    const policies: SecurityPolicy[] = [
      {
        id: 'production_destructive_block',
        name: 'Block Destructive Operations in Production',
        description: 'Prevent destructive operations in production environment',
        conditions: [
          { type: 'environment', value: 'production' },
          { type: 'command_pattern', pattern: 'delete|remove|drop|truncate|format' },
        ],
        actions: [{ type: 'block', message: 'Destructive operations not allowed in production' }],
        priority: 1,
        enabled: true,
      },
      {
        id: 'junior_analyst_restrictions',
        name: 'Junior Analyst Command Restrictions',
        description: 'Restrict junior analysts to read-only operations',
        conditions: [
          { type: 'user_role', value: 'junior_analyst' },
          { type: 'command_pattern', pattern: 'modify|delete|admin|config' },
        ],
        actions: [
          { 
            type: 'require_approval', 
            parameters: { level: 'supervisor' },
            message: 'Junior analyst requires supervisor approval for this operation' 
          }
        ],
        priority: 2,
        enabled: true,
      },
      {
        id: 'off_hours_monitoring',
        name: 'Enhanced Monitoring for Off-Hours Operations',
        description: 'Add monitoring for commands executed outside business hours',
        conditions: [
          { type: 'time_window', value: { start: 0, end: 8 } },
        ],
        actions: [
          { 
            type: 'add_monitoring',
            message: 'Enhanced monitoring enabled for off-hours operation'
          }
        ],
        priority: 3,
        enabled: true,
      },
    ];

    policies.forEach(policy => {
      this.policyCache.set(policy.id, policy);
    });
  }

  /**
   * Load user roles (placeholder for external integration)
   */
  private loadUserRoles(): void {
    // In production, this would load from external user management system
    Object.entries(this.defaultUserRoles).forEach(([userId, role]) => {
      this.userRoleCache.set(userId, role);
    });
  }

  /**
   * Get validation statistics
   */
  getStatistics(): {
    cacheSize: number;
    userRolesCached: number;
    policiesLoaded: number;
    averageRiskScore: number;
  } {
    const assessments = Array.from(this.riskAssessmentCache.values());
    const averageRisk = assessments.length > 0 
      ? assessments.reduce((sum, a) => sum + a.assessment.aggregatedRisk, 0) / assessments.length
      : 0;

    return {
      cacheSize: this.riskAssessmentCache.size,
      userRolesCached: this.userRoleCache.size,
      policiesLoaded: this.policyCache.size,
      averageRiskScore: averageRisk,
    };
  }

  /**
   * Clear validation cache
   */
  clearCache(): void {
    this.riskAssessmentCache.clear();
    this.logger.debug('Advanced safety validation cache cleared');
  }
}