import { Logger } from '@threatguard/core';
import type { ConversationContext } from '../types/Context.js';
import type { CommandResult, SafetyValidationRequest } from '../types/Command.js';
import { SafetyValidator } from '../safety/SafetyValidator.js';
import { CommandPipeline } from '../integration/CommandPipeline.js';

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  command: string;
  parameters: Record<string, any>;
  condition?: string;
  onSuccess?: string; // Next step ID
  onFailure?: string; // Next step ID or action
  timeout: number;
  retryable: boolean;
  optional: boolean;
  estimatedDuration: number; // seconds
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  category: 'incident_response' | 'threat_hunting' | 'security_assessment' | 'compliance' | 'investigation' | 'custom';
  version: string;
  steps: WorkflowStep[];
  metadata: {
    author: string;
    created: Date;
    updated: Date;
    tags: string[];
    estimatedDuration: number;
    complexity: 'low' | 'medium' | 'high';
    requiredPermissions: string[];
  };
  variables: WorkflowVariable[];
  triggers: WorkflowTrigger[];
}

export interface WorkflowVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  defaultValue?: any;
  required: boolean;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    options?: any[];
  };
}

export interface WorkflowTrigger {
  type: 'manual' | 'event' | 'schedule' | 'condition';
  condition?: string;
  eventType?: string;
  schedule?: string; // cron expression
  parameters?: Record<string, any>;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';
  currentStep?: string;
  steps: WorkflowStepExecution[];
  context: Record<string, any>;
  variables: Record<string, any>;
  startTime?: Date;
  endTime?: Date;
  pausedAt?: Date;
  progress: {
    completed: number;
    total: number;
    percentage: number;
    currentStepName?: string;
  };
  results: Record<string, CommandResult>;
  errors: Array<{
    stepId: string;
    error: string;
    timestamp: Date;
    recoverable: boolean;
    retryCount: number;
  }>;
  metrics: {
    totalDuration?: number;
    stepDurations: Record<string, number>;
    retryCount: number;
    pauseCount: number;
  };
}

export interface WorkflowStepExecution {
  stepId: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'paused';
  startTime?: Date;
  endTime?: Date;
  result?: CommandResult;
  attempts: number;
  nextStep?: string;
  duration?: number;
  pausedDuration?: number;
}

export interface WorkflowEngineOptions {
  logger: Logger;
  safetyValidator: SafetyValidator;
  commandPipeline: CommandPipeline;
  maxConcurrentWorkflows?: number;
  enablePersistence?: boolean;
  workflowDirectory?: string;
}

/**
 * Advanced Workflow Engine for Security Operations
 * Manages predefined security workflows and dynamic workflow generation
 */
export class WorkflowEngine {
  private logger: Logger;
  private safetyValidator: SafetyValidator;
  private commandPipeline: CommandPipeline;
  private maxConcurrentWorkflows: number;
  private enablePersistence: boolean;

  // Workflow storage
  private workflowDefinitions = new Map<string, WorkflowDefinition>();
  private activeExecutions = new Map<string, WorkflowExecution>();
  private workflowTemplates = new Map<string, WorkflowDefinition>();

  constructor(options: WorkflowEngineOptions) {
    this.logger = options.logger;
    this.safetyValidator = options.safetyValidator;
    this.commandPipeline = options.commandPipeline;
    this.maxConcurrentWorkflows = options.maxConcurrentWorkflows || 10;
    this.enablePersistence = options.enablePersistence !== false;

    this.initializePredefinedWorkflows();
    this.logger.info('WorkflowEngine initialized', {
      maxConcurrentWorkflows: this.maxConcurrentWorkflows,
      enablePersistence: this.enablePersistence,
    });
  }

  /**
   * Initialize predefined security workflows
   */
  private initializePredefinedWorkflows(): void {
    // Incident Response Workflow
    this.registerWorkflow(this.createIncidentResponseWorkflow());
    
    // Threat Hunting Workflow
    this.registerWorkflow(this.createThreatHuntingWorkflow());
    
    // Security Assessment Workflow
    this.registerWorkflow(this.createSecurityAssessmentWorkflow());
    
    // Compliance Check Workflow
    this.registerWorkflow(this.createComplianceCheckWorkflow());

    this.logger.debug('Initialized predefined workflows', {
      count: this.workflowDefinitions.size,
      workflows: Array.from(this.workflowDefinitions.keys()),
    });
  }

  /**
   * Create Incident Response Workflow
   */
  private createIncidentResponseWorkflow(): WorkflowDefinition {
    return {
      id: 'incident_response_standard',
      name: 'Standard Incident Response',
      description: 'Comprehensive incident response workflow following industry best practices',
      category: 'incident_response',
      version: '1.0.0',
      steps: [
        {
          id: 'detect',
          name: 'Initial Detection',
          description: 'Detect and validate the security incident',
          command: 'threat scan --comprehensive',
          parameters: {},
          timeout: 30000,
          retryable: true,
          optional: false,
          estimatedDuration: 60,
        },
        {
          id: 'classify',
          name: 'Incident Classification',
          description: 'Classify the incident severity and type',
          command: 'threat classify',
          parameters: { threats: '${step_detect.threats}' },
          timeout: 15000,
          retryable: true,
          optional: false,
          estimatedDuration: 30,
        },
        {
          id: 'contain',
          name: 'Containment',
          description: 'Contain the threat to prevent spread',
          command: 'threat contain',
          parameters: { 
            threats: '${step_classify.classified_threats}',
            severity: '${step_classify.severity}'
          },
          condition: 'step_classify.severity !== "low"',
          timeout: 60000,
          retryable: true,
          optional: false,
          estimatedDuration: 180,
        },
        {
          id: 'investigate',
          name: 'Investigation',
          description: 'Investigate the incident scope and impact',
          command: 'threat investigate',
          parameters: { 
            incident_id: '${step_classify.incident_id}',
            scope: 'comprehensive'
          },
          timeout: 300000,
          retryable: true,
          optional: false,
          estimatedDuration: 600,
        },
        {
          id: 'eradicate',
          name: 'Eradication',
          description: 'Remove threats and vulnerabilities',
          command: 'threat eradicate',
          parameters: { 
            threats: '${step_investigate.confirmed_threats}',
            method: 'safe'
          },
          timeout: 180000,
          retryable: true,
          optional: false,
          estimatedDuration: 300,
        },
        {
          id: 'recover',
          name: 'Recovery',
          description: 'Restore systems to normal operation',
          command: 'system recover',
          parameters: { 
            affected_systems: '${step_investigate.affected_systems}',
            validation: true
          },
          timeout: 300000,
          retryable: true,
          optional: false,
          estimatedDuration: 420,
        },
        {
          id: 'report',
          name: 'Incident Report',
          description: 'Generate comprehensive incident report',
          command: 'incident report',
          parameters: { 
            incident_id: '${step_classify.incident_id}',
            format: 'comprehensive',
            include_timeline: true
          },
          timeout: 60000,
          retryable: true,
          optional: true,
          estimatedDuration: 120,
        }
      ],
      metadata: {
        author: 'ThreatGuard Security Team',
        created: new Date(),
        updated: new Date(),
        tags: ['incident', 'response', 'security', 'standard'],
        estimatedDuration: 1710, // ~28 minutes
        complexity: 'high',
        requiredPermissions: ['threat.scan', 'threat.contain', 'system.recover'],
      },
      variables: [
        {
          name: 'severity_threshold',
          type: 'string',
          description: 'Minimum severity level to trigger containment',
          defaultValue: 'medium',
          required: false,
          validation: { options: ['low', 'medium', 'high', 'critical'] },
        },
        {
          name: 'notification_email',
          type: 'string',
          description: 'Email for incident notifications',
          required: false,
        }
      ],
      triggers: [
        { type: 'manual' },
        { type: 'event', eventType: 'threat.detected.high' },
        { type: 'event', eventType: 'threat.detected.critical' },
      ],
    };
  }

  /**
   * Create Threat Hunting Workflow
   */
  private createThreatHuntingWorkflow(): WorkflowDefinition {
    return {
      id: 'threat_hunting_proactive',
      name: 'Proactive Threat Hunting',
      description: 'Systematic proactive threat hunting workflow',
      category: 'threat_hunting',
      version: '1.0.0',
      steps: [
        {
          id: 'baseline',
          name: 'Establish Baseline',
          description: 'Establish normal behavior baseline',
          command: 'behavior baseline',
          parameters: { timeframe: '7d', scope: 'comprehensive' },
          timeout: 120000,
          retryable: true,
          optional: false,
          estimatedDuration: 180,
        },
        {
          id: 'hypothesis',
          name: 'Generate Hypothesis',
          description: 'Generate threat hunting hypotheses',
          command: 'hunt generate-hypothesis',
          parameters: { 
            baseline: '${step_baseline.baseline_id}',
            threat_intelligence: true
          },
          timeout: 60000,
          retryable: true,
          optional: false,
          estimatedDuration: 120,
        },
        {
          id: 'search',
          name: 'Hunt for Threats',
          description: 'Execute hunting queries based on hypotheses',
          command: 'hunt search',
          parameters: { 
            hypotheses: '${step_hypothesis.hypotheses}',
            timeframe: '30d'
          },
          timeout: 300000,
          retryable: true,
          optional: false,
          estimatedDuration: 480,
        },
        {
          id: 'analyze',
          name: 'Analyze Findings',
          description: 'Analyze hunting results for threats',
          command: 'hunt analyze',
          parameters: { 
            results: '${step_search.results}',
            confidence_threshold: 0.7
          },
          timeout: 180000,
          retryable: true,
          optional: false,
          estimatedDuration: 300,
        },
        {
          id: 'validate',
          name: 'Validate Threats',
          description: 'Validate discovered threats',
          command: 'threat validate',
          parameters: { 
            findings: '${step_analyze.potential_threats}',
            validation_method: 'comprehensive'
          },
          timeout: 120000,
          retryable: true,
          optional: false,
          estimatedDuration: 240,
        },
        {
          id: 'document',
          name: 'Document Results',
          description: 'Document hunting session results',
          command: 'hunt document',
          parameters: { 
            session_id: '${execution_id}',
            findings: '${step_validate.validated_threats}',
            format: 'detailed'
          },
          timeout: 60000,
          retryable: true,
          optional: true,
          estimatedDuration: 90,
        }
      ],
      metadata: {
        author: 'ThreatGuard Security Team',
        created: new Date(),
        updated: new Date(),
        tags: ['hunting', 'proactive', 'analysis', 'detection'],
        estimatedDuration: 1410, // ~23 minutes
        complexity: 'high',
        requiredPermissions: ['behavior.baseline', 'hunt.search', 'threat.validate'],
      },
      variables: [
        {
          name: 'timeframe',
          type: 'string',
          description: 'Hunting timeframe',
          defaultValue: '30d',
          required: false,
        },
        {
          name: 'confidence_threshold',
          type: 'number',
          description: 'Minimum confidence for threat validation',
          defaultValue: 0.7,
          required: false,
          validation: { min: 0.1, max: 1.0 },
        }
      ],
      triggers: [
        { type: 'manual' },
        { type: 'schedule', schedule: '0 2 * * 1' }, // Weekly on Monday at 2 AM
      ],
    };
  }

  /**
   * Create Security Assessment Workflow
   */
  private createSecurityAssessmentWorkflow(): WorkflowDefinition {
    return {
      id: 'security_assessment_comprehensive',
      name: 'Comprehensive Security Assessment',
      description: 'Complete security posture assessment workflow',
      category: 'security_assessment',
      version: '1.0.0',
      steps: [
        {
          id: 'inventory',
          name: 'Asset Inventory',
          description: 'Discover and inventory assets',
          command: 'asset inventory',
          parameters: { scope: 'all', detailed: true },
          timeout: 180000,
          retryable: true,
          optional: false,
          estimatedDuration: 300,
        },
        {
          id: 'vulnerability_scan',
          name: 'Vulnerability Scanning',
          description: 'Scan for vulnerabilities',
          command: 'vuln scan',
          parameters: { 
            assets: '${step_inventory.assets}',
            comprehensive: true
          },
          timeout: 600000,
          retryable: true,
          optional: false,
          estimatedDuration: 900,
        },
        {
          id: 'configuration_audit',
          name: 'Configuration Audit',
          description: 'Audit security configurations',
          command: 'config audit',
          parameters: { 
            assets: '${step_inventory.assets}',
            standards: ['CIS', 'NIST']
          },
          timeout: 300000,
          retryable: true,
          optional: false,
          estimatedDuration: 420,
        },
        {
          id: 'privilege_review',
          name: 'Privilege Review',
          description: 'Review user privileges and access',
          command: 'access review',
          parameters: { 
            scope: 'comprehensive',
            include_stale: true
          },
          timeout: 240000,
          retryable: true,
          optional: false,
          estimatedDuration: 360,
        },
        {
          id: 'risk_assessment',
          name: 'Risk Assessment',
          description: 'Assess overall security risk',
          command: 'risk assess',
          parameters: { 
            vulnerabilities: '${step_vulnerability_scan.vulnerabilities}',
            configurations: '${step_configuration_audit.findings}',
            privileges: '${step_privilege_review.findings}'
          },
          timeout: 180000,
          retryable: true,
          optional: false,
          estimatedDuration: 240,
        },
        {
          id: 'report',
          name: 'Assessment Report',
          description: 'Generate security assessment report',
          command: 'assessment report',
          parameters: { 
            assessment_id: '${execution_id}',
            format: 'executive',
            include_remediation: true
          },
          timeout: 120000,
          retryable: true,
          optional: false,
          estimatedDuration: 180,
        }
      ],
      metadata: {
        author: 'ThreatGuard Security Team',
        created: new Date(),
        updated: new Date(),
        tags: ['assessment', 'vulnerability', 'audit', 'compliance'],
        estimatedDuration: 2400, // ~40 minutes
        complexity: 'medium',
        requiredPermissions: ['asset.inventory', 'vuln.scan', 'config.audit', 'access.review'],
      },
      variables: [],
      triggers: [
        { type: 'manual' },
        { type: 'schedule', schedule: '0 1 1 * *' }, // Monthly on 1st at 1 AM
      ],
    };
  }

  /**
   * Create Compliance Check Workflow
   */
  private createComplianceCheckWorkflow(): WorkflowDefinition {
    return {
      id: 'compliance_check_standard',
      name: 'Standard Compliance Check',
      description: 'Automated compliance validation workflow',
      category: 'compliance',
      version: '1.0.0',
      steps: [
        {
          id: 'framework_select',
          name: 'Select Framework',
          description: 'Select compliance framework',
          command: 'compliance select-framework',
          parameters: { framework: '${framework}' },
          timeout: 30000,
          retryable: true,
          optional: false,
          estimatedDuration: 30,
        },
        {
          id: 'evidence_collect',
          name: 'Collect Evidence',
          description: 'Collect compliance evidence',
          command: 'compliance collect-evidence',
          parameters: { 
            framework: '${step_framework_select.framework}',
            automated: true
          },
          timeout: 300000,
          retryable: true,
          optional: false,
          estimatedDuration: 480,
        },
        {
          id: 'controls_assess',
          name: 'Assess Controls',
          description: 'Assess compliance controls',
          command: 'compliance assess-controls',
          parameters: { 
            evidence: '${step_evidence_collect.evidence}',
            framework: '${step_framework_select.framework}'
          },
          timeout: 240000,
          retryable: true,
          optional: false,
          estimatedDuration: 360,
        },
        {
          id: 'gaps_identify',
          name: 'Identify Gaps',
          description: 'Identify compliance gaps',
          command: 'compliance identify-gaps',
          parameters: { 
            assessment: '${step_controls_assess.assessment}',
            threshold: 0.8
          },
          timeout: 120000,
          retryable: true,
          optional: false,
          estimatedDuration: 180,
        },
        {
          id: 'report',
          name: 'Compliance Report',
          description: 'Generate compliance report',
          command: 'compliance report',
          parameters: { 
            assessment: '${step_controls_assess.assessment}',
            gaps: '${step_gaps_identify.gaps}',
            format: 'detailed'
          },
          timeout: 90000,
          retryable: true,
          optional: false,
          estimatedDuration: 120,
        }
      ],
      metadata: {
        author: 'ThreatGuard Security Team',
        created: new Date(),
        updated: new Date(),
        tags: ['compliance', 'audit', 'framework', 'controls'],
        estimatedDuration: 1170, // ~19 minutes
        complexity: 'medium',
        requiredPermissions: ['compliance.assess', 'compliance.report'],
      },
      variables: [
        {
          name: 'framework',
          type: 'string',
          description: 'Compliance framework to assess',
          defaultValue: 'SOC2',
          required: true,
          validation: { options: ['SOC2', 'PCI-DSS', 'HIPAA', 'GDPR', 'NIST'] },
        }
      ],
      triggers: [
        { type: 'manual' },
        { type: 'schedule', schedule: '0 3 15 * *' }, // Monthly on 15th at 3 AM
      ],
    };
  }

  /**
   * Register a workflow definition
   */
  registerWorkflow(workflow: WorkflowDefinition): void {
    this.workflowDefinitions.set(workflow.id, workflow);
    this.logger.debug('Registered workflow', {
      id: workflow.id,
      name: workflow.name,
      category: workflow.category,
      stepCount: workflow.steps.length,
    });
  }

  /**
   * Get available workflows
   */
  getAvailableWorkflows(category?: string): WorkflowDefinition[] {
    const workflows = Array.from(this.workflowDefinitions.values());
    
    if (category) {
      return workflows.filter(w => w.category === category);
    }
    
    return workflows;
  }

  /**
   * Get workflow by ID
   */
  getWorkflow(workflowId: string): WorkflowDefinition | null {
    return this.workflowDefinitions.get(workflowId) || null;
  }

  /**
   * Generate dynamic workflow based on context
   */
  async generateDynamicWorkflow(
    context: ConversationContext,
    intent: string,
    parameters: Record<string, any> = {}
  ): Promise<WorkflowDefinition | null> {
    this.logger.debug('Generating dynamic workflow', {
      intent,
      contextTopic: context.session.currentTopic,
      recentCommands: context.recentCommands.slice(0, 3),
    });

    // Analyze context to determine appropriate workflow
    const workflowType = this.analyzeContextForWorkflow(context, intent);
    
    if (!workflowType) {
      return null;
    }

    // Generate workflow based on type and context
    return this.createDynamicWorkflow(workflowType, context, parameters);
  }

  /**
   * Analyze context to determine workflow type
   */
  private analyzeContextForWorkflow(context: ConversationContext, intent: string): string | null {
    // Check recent intents for workflow patterns
    const recentIntents = context.recentIntents.map(i => i.intent);
    
    // Incident response pattern
    if (recentIntents.includes('threat_detected') || intent.includes('incident')) {
      return 'incident_response';
    }
    
    // Threat hunting pattern
    if (recentIntents.includes('investigate') || intent.includes('hunt')) {
      return 'threat_hunting';
    }
    
    // Assessment pattern
    if (recentIntents.includes('assess') || intent.includes('audit')) {
      return 'security_assessment';
    }
    
    // Compliance pattern
    if (recentIntents.includes('compliance') || intent.includes('framework')) {
      return 'compliance';
    }
    
    return null;
  }

  /**
   * Create dynamic workflow based on type and context
   */
  private createDynamicWorkflow(
    type: string,
    context: ConversationContext,
    parameters: Record<string, any>
  ): WorkflowDefinition {
    const workflowId = `dynamic_${type}_${Date.now()}`;
    
    // Start with base workflow and customize based on context
    const baseWorkflow = this.getWorkflow(`${type}_standard`);
    
    if (!baseWorkflow) {
      // Create minimal workflow if no base found
      return this.createMinimalWorkflow(workflowId, type, context, parameters);
    }

    // Customize workflow based on context
    const customizedSteps = this.customizeWorkflowSteps(baseWorkflow.steps, context, parameters);
    
    return {
      ...baseWorkflow,
      id: workflowId,
      name: `Dynamic ${baseWorkflow.name}`,
      description: `Contextually generated workflow based on conversation`,
      steps: customizedSteps,
      metadata: {
        ...baseWorkflow.metadata,
        author: 'Dynamic Generation',
        created: new Date(),
        updated: new Date(),
        tags: [...baseWorkflow.metadata.tags, 'dynamic', 'generated'],
      },
    };
  }

  /**
   * Create minimal workflow for unknown types
   */
  private createMinimalWorkflow(
    workflowId: string,
    type: string,
    context: ConversationContext,
    parameters: Record<string, any>
  ): WorkflowDefinition {
    return {
      id: workflowId,
      name: `Dynamic ${type} Workflow`,
      description: 'Dynamically generated workflow',
      category: 'custom',
      version: '1.0.0',
      steps: [
        {
          id: 'analyze',
          name: 'Analyze Request',
          description: 'Analyze the current request',
          command: `${type} analyze`,
          parameters,
          timeout: 60000,
          retryable: true,
          optional: false,
          estimatedDuration: 120,
        },
        {
          id: 'execute',
          name: 'Execute Action',
          description: 'Execute the requested action',
          command: `${type} execute`,
          parameters: { analysis: '${step_analyze.result}' },
          timeout: 120000,
          retryable: true,
          optional: false,
          estimatedDuration: 240,
        }
      ],
      metadata: {
        author: 'Dynamic Generation',
        created: new Date(),
        updated: new Date(),
        tags: ['dynamic', 'generated', type],
        estimatedDuration: 360,
        complexity: 'low',
        requiredPermissions: [],
      },
      variables: [],
      triggers: [{ type: 'manual' }],
    };
  }

  /**
   * Customize workflow steps based on context
   */
  private customizeWorkflowSteps(
    steps: WorkflowStep[],
    context: ConversationContext,
    parameters: Record<string, any>
  ): WorkflowStep[] {
    return steps.map(step => {
      // Inject context-specific parameters
      const customizedParameters = {
        ...step.parameters,
        ...this.extractContextualParameters(context, step.command),
        ...parameters,
      };

      // Adjust timeouts based on context complexity
      const complexityMultiplier = this.calculateComplexityMultiplier(context);
      const adjustedTimeout = Math.round(step.timeout * complexityMultiplier);

      return {
        ...step,
        parameters: customizedParameters,
        timeout: adjustedTimeout,
      };
    });
  }

  /**
   * Extract contextual parameters for a command
   */
  private extractContextualParameters(context: ConversationContext, command: string): Record<string, any> {
    const params: Record<string, any> = {};
    
    // Add recent entities as context
    if (context.recentEntities.length > 0) {
      params.context_entities = context.recentEntities;
    }
    
    // Add session information
    params.session_id = context.session.sessionId;
    params.conversation_topic = context.session.currentTopic;
    
    return params;
  }

  /**
   * Calculate complexity multiplier based on context
   */
  private calculateComplexityMultiplier(context: ConversationContext): number {
    let multiplier = 1.0;
    
    // Increase for complex conversation history
    if (context.recentCommands.length > 10) {
      multiplier += 0.2;
    }
    
    // Increase for many entities
    if (context.recentEntities.length > 20) {
      multiplier += 0.3;
    }
    
    return Math.min(multiplier, 2.0); // Cap at 2x
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(
    workflowId: string,
    variables: Record<string, any> = {},
    context: Record<string, any> = {}
  ): Promise<string> {
    const workflow = this.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Check concurrent workflow limit
    if (this.activeExecutions.size >= this.maxConcurrentWorkflows) {
      throw new Error('Maximum concurrent workflows reached');
    }

    // Create execution
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const execution = this.createWorkflowExecution(executionId, workflow, variables, context);
    
    this.activeExecutions.set(executionId, execution);

    // Convert workflow to pipeline steps
    const pipelineSteps = this.convertWorkflowToPipelineSteps(workflow, variables);
    
    // Create and execute pipeline
    const pipelineId = await this.commandPipeline.createPipeline(
      workflow.name,
      workflow.description,
      pipelineSteps,
      { ...context, ...variables, execution_id: executionId }
    );

    // Start execution
    execution.status = 'running';
    execution.startTime = new Date();

    this.logger.info('Started workflow execution', {
      workflowId,
      executionId,
      pipelineId,
      stepCount: workflow.steps.length,
    });

    try {
      const pipelineResult = await this.commandPipeline.executePipeline(pipelineId);
      
      // Update execution with results
      execution.status = 'completed';
      execution.endTime = new Date();
      execution.progress.percentage = 100;
      
      // Convert pipeline results to workflow results
      for (const [stepId, result] of pipelineResult.results.entries()) {
        execution.results[stepId] = result;
        
        const stepExecution = execution.steps.find(s => s.stepId === stepId);
        if (stepExecution) {
          stepExecution.status = 'completed';
          stepExecution.result = result;
          stepExecution.endTime = new Date();
        }
      }

      this.logger.info('Workflow completed successfully', {
        workflowId,
        executionId,
        duration: execution.endTime.getTime() - execution.startTime!.getTime(),
      });

    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      
      this.logger.error('Workflow execution failed', {
        workflowId,
        executionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }

    return executionId;
  }

  /**
   * Create workflow execution
   */
  private createWorkflowExecution(
    executionId: string,
    workflow: WorkflowDefinition,
    variables: Record<string, any>,
    context: Record<string, any>
  ): WorkflowExecution {
    const stepExecutions: WorkflowStepExecution[] = workflow.steps.map(step => ({
      stepId: step.id,
      name: step.name,
      status: 'pending',
      attempts: 0,
    }));

    return {
      id: executionId,
      workflowId: workflow.id,
      name: workflow.name,
      status: 'pending',
      steps: stepExecutions,
      context,
      variables,
      progress: {
        completed: 0,
        total: workflow.steps.length,
        percentage: 0,
      },
      results: {},
      errors: [],
      metrics: {
        stepDurations: {},
        retryCount: 0,
        pauseCount: 0,
      },
    };
  }

  /**
   * Convert workflow steps to pipeline steps
   */
  private convertWorkflowToPipelineSteps(
    workflow: WorkflowDefinition,
    variables: Record<string, any>
  ) {
    return workflow.steps.map(step => ({
      id: step.id,
      command: step.command,
      parameters: { ...step.parameters, ...variables },
      dependencies: this.calculateStepDependencies(step, workflow.steps),
      optional: step.optional,
      timeout: step.timeout,
      retryCount: step.retryable ? 2 : 0,
      condition: step.condition,
    }));
  }

  /**
   * Calculate step dependencies
   */
  private calculateStepDependencies(step: WorkflowStep, allSteps: WorkflowStep[]): string[] {
    const dependencies: string[] = [];
    const stepIndex = allSteps.findIndex(s => s.id === step.id);
    
    // Add previous step as dependency (sequential execution)
    if (stepIndex > 0) {
      dependencies.push(allSteps[stepIndex - 1].id);
    }

    // Add specific dependencies based on parameter references
    const paramString = JSON.stringify(step.parameters);
    for (const otherStep of allSteps) {
      if (otherStep.id !== step.id && paramString.includes(`step_${otherStep.id}`)) {
        dependencies.push(otherStep.id);
      }
    }

    return [...new Set(dependencies)]; // Remove duplicates
  }

  /**
   * Get workflow execution status
   */
  getExecutionStatus(executionId: string): WorkflowExecution | null {
    return this.activeExecutions.get(executionId) || null;
  }

  /**
   * Pause workflow execution
   */
  async pauseWorkflow(executionId: string): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    if (execution.status === 'running') {
      execution.status = 'paused';
      execution.pausedAt = new Date();
      execution.metrics.pauseCount++;
      
      this.logger.info('Workflow paused', { executionId });
    }
  }

  /**
   * Resume workflow execution
   */
  async resumeWorkflow(executionId: string): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    if (execution.status === 'paused') {
      execution.status = 'running';
      execution.pausedAt = undefined;
      
      this.logger.info('Workflow resumed', { executionId });
    }
  }

  /**
   * Cancel workflow execution
   */
  async cancelWorkflow(executionId: string): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    execution.status = 'cancelled';
    execution.endTime = new Date();
    
    this.logger.info('Workflow cancelled', { executionId });
  }

  /**
   * Get workflow engine statistics
   */
  getStatistics(): {
    totalWorkflows: number;
    activeExecutions: number;
    completedWorkflows: number;
    failedWorkflows: number;
    averageExecutionTime: number;
  } {
    let completed = 0;
    let failed = 0;
    let totalExecutionTime = 0;
    let completedCount = 0;

    for (const execution of this.activeExecutions.values()) {
      if (execution.status === 'completed') {
        completed++;
        if (execution.startTime && execution.endTime) {
          totalExecutionTime += execution.endTime.getTime() - execution.startTime.getTime();
          completedCount++;
        }
      } else if (execution.status === 'failed') {
        failed++;
      }
    }

    return {
      totalWorkflows: this.workflowDefinitions.size,
      activeExecutions: this.activeExecutions.size,
      completedWorkflows: completed,
      failedWorkflows: failed,
      averageExecutionTime: completedCount > 0 ? totalExecutionTime / completedCount : 0,
    };
  }

  /**
   * Clean up completed executions
   */
  cleanupExecutions(maxAge: number = 3600000): void { // Default: 1 hour
    const cutoff = Date.now() - maxAge;
    
    for (const [id, execution] of this.activeExecutions.entries()) {
      if (execution.endTime && execution.endTime.getTime() < cutoff) {
        this.activeExecutions.delete(id);
        this.logger.debug('Cleaned up execution', { executionId: id });
      }
    }
  }
}