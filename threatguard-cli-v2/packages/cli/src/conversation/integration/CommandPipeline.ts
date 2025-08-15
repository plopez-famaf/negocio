import { Logger } from '@threatguard/core';
import type { ConversationContext } from '../types/Context.js';
import type { CommandResult, CommandExecution } from '../types/Command.js';
import { SafetyValidator } from '../safety/SafetyValidator.js';

export interface PipelineStep {
  id: string;
  command: string;
  parameters: Record<string, any>;
  dependencies: string[]; // IDs of steps that must complete first
  optional: boolean; // Can pipeline continue if this step fails
  timeout: number; // Maximum execution time in ms
  retryCount: number; // Number of retry attempts
  condition?: string; // Optional condition for execution
}

export interface PipelineExecution {
  id: string;
  name: string;
  description: string;
  steps: PipelineStep[];
  context: Record<string, any>; // Shared context between steps
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentStep?: string;
  results: Map<string, CommandResult>; // Results from completed steps
  errors: Array<{ stepId: string; error: string; timestamp: Date }>;
}

export interface CommandPipelineOptions {
  logger: Logger;
  safetyValidator: SafetyValidator;
  maxConcurrentSteps?: number;
  defaultTimeout?: number;
  enableRollback?: boolean;
}

/**
 * Advanced Command Pipeline Engine
 * Manages multi-step command execution with state management, error recovery, and workflow automation
 */
export class CommandPipeline {
  private logger: Logger;
  private safetyValidator: SafetyValidator;
  private maxConcurrentSteps: number;
  private defaultTimeout: number;
  private enableRollback: boolean;

  // Active pipeline executions
  private activePipelines = new Map<string, PipelineExecution>();
  private stepExecutors = new Map<string, (step: PipelineStep, context: Record<string, any>) => Promise<CommandResult>>();

  constructor(options: CommandPipelineOptions) {
    this.logger = options.logger;
    this.safetyValidator = options.safetyValidator;
    this.maxConcurrentSteps = options.maxConcurrentSteps || 5;
    this.defaultTimeout = options.defaultTimeout || 30000;
    this.enableRollback = options.enableRollback !== false;

    this.logger.debug('CommandPipeline initialized', {
      maxConcurrentSteps: this.maxConcurrentSteps,
      defaultTimeout: this.defaultTimeout,
      enableRollback: this.enableRollback,
    });
  }

  /**
   * Register a step executor for a specific command type
   */
  registerStepExecutor(
    commandType: string,
    executor: (step: PipelineStep, context: Record<string, any>) => Promise<CommandResult>
  ): void {
    this.stepExecutors.set(commandType, executor);
    this.logger.debug('Registered step executor', { commandType });
  }

  /**
   * Create a new pipeline execution
   */
  async createPipeline(
    name: string,
    description: string,
    steps: PipelineStep[],
    initialContext: Record<string, any> = {}
  ): Promise<string> {
    const pipelineId = `pipeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Validate pipeline structure
    const validation = this.validatePipeline(steps);
    if (!validation.valid) {
      throw new Error(`Invalid pipeline: ${validation.errors.join(', ')}`);
    }

    // Create pipeline execution
    const pipeline: PipelineExecution = {
      id: pipelineId,
      name,
      description,
      steps: steps.map(step => ({
        ...step,
        timeout: step.timeout || this.defaultTimeout,
        retryCount: step.retryCount || 0,
      })),
      context: { ...initialContext },
      createdAt: new Date(),
      status: 'pending',
      results: new Map(),
      errors: [],
    };

    this.activePipelines.set(pipelineId, pipeline);

    this.logger.info('Created pipeline', {
      pipelineId,
      name,
      stepCount: steps.length,
      context: Object.keys(initialContext),
    });

    return pipelineId;
  }

  /**
   * Execute a pipeline
   */
  async executePipeline(pipelineId: string): Promise<PipelineExecution> {
    const pipeline = this.activePipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline not found: ${pipelineId}`);
    }

    if (pipeline.status !== 'pending') {
      throw new Error(`Pipeline already executed: ${pipelineId}`);
    }

    pipeline.status = 'running';
    pipeline.startedAt = new Date();

    this.logger.info('Starting pipeline execution', {
      pipelineId: pipeline.id,
      name: pipeline.name,
      stepCount: pipeline.steps.length,
    });

    try {
      await this.executeSteps(pipeline);
      
      pipeline.status = 'completed';
      pipeline.completedAt = new Date();

      this.logger.info('Pipeline completed successfully', {
        pipelineId: pipeline.id,
        duration: pipeline.completedAt.getTime() - pipeline.startedAt!.getTime(),
        completedSteps: pipeline.results.size,
      });

    } catch (error) {
      pipeline.status = 'failed';
      pipeline.completedAt = new Date();

      this.logger.error('Pipeline execution failed', {
        pipelineId: pipeline.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        completedSteps: pipeline.results.size,
        totalSteps: pipeline.steps.length,
      });

      // Attempt rollback if enabled
      if (this.enableRollback) {
        await this.rollbackPipeline(pipeline);
      }

      throw error;
    }

    return pipeline;
  }

  /**
   * Execute pipeline steps with dependency resolution
   */
  private async executeSteps(pipeline: PipelineExecution): Promise<void> {
    const completedSteps = new Set<string>();
    const runningSteps = new Map<string, Promise<CommandResult>>();
    const stepQueue = [...pipeline.steps];

    while (stepQueue.length > 0 || runningSteps.size > 0) {
      // Find steps that can be executed (dependencies satisfied)
      const readySteps = stepQueue.filter(step =>
        step.dependencies.every(dep => completedSteps.has(dep)) &&
        !runningSteps.has(step.id) &&
        this.evaluateCondition(step.condition, pipeline.context)
      );

      // Start execution of ready steps (up to concurrency limit)
      const slotsAvailable = this.maxConcurrentSteps - runningSteps.size;
      const stepsToStart = readySteps.slice(0, slotsAvailable);

      for (const step of stepsToStart) {
        stepQueue.splice(stepQueue.indexOf(step), 1);
        pipeline.currentStep = step.id;

        const executionPromise = this.executeStep(step, pipeline);
        runningSteps.set(step.id, executionPromise);

        this.logger.debug('Started step execution', {
          pipelineId: pipeline.id,
          stepId: step.id,
          command: step.command,
          runningSteps: runningSteps.size,
        });
      }

      // Wait for at least one step to complete
      if (runningSteps.size > 0) {
        const stepId = await Promise.race(
          Array.from(runningSteps.entries()).map(async ([id, promise]) => {
            try {
              const result = await promise;
              return { id, result, error: null };
            } catch (error) {
              return { id, result: null, error };
            }
          })
        );

        runningSteps.delete(stepId.id);

        if (stepId.error) {
          const step = pipeline.steps.find(s => s.id === stepId.id)!;
          
          pipeline.errors.push({
            stepId: stepId.id,
            error: stepId.error instanceof Error ? stepId.error.message : 'Unknown error',
            timestamp: new Date(),
          });

          this.logger.error('Step execution failed', {
            pipelineId: pipeline.id,
            stepId: stepId.id,
            error: stepId.error instanceof Error ? stepId.error.message : 'Unknown error',
            optional: step.optional,
          });

          if (!step.optional) {
            // Cancel all running steps and fail pipeline
            await this.cancelRunningSteps(runningSteps);
            throw stepId.error;
          }
        } else {
          pipeline.results.set(stepId.id, stepId.result!);
          completedSteps.add(stepId.id);

          // Update pipeline context with step results
          this.updatePipelineContext(pipeline, stepId.id, stepId.result!);

          this.logger.debug('Step completed successfully', {
            pipelineId: pipeline.id,
            stepId: stepId.id,
            completedSteps: completedSteps.size,
            totalSteps: pipeline.steps.length,
          });
        }
      }

      // Check if we're stuck (no ready steps and nothing running)
      if (readySteps.length === 0 && runningSteps.size === 0 && stepQueue.length > 0) {
        const remainingSteps = stepQueue.map(s => s.id);
        throw new Error(`Pipeline deadlock: unable to execute remaining steps: ${remainingSteps.join(', ')}`);
      }
    }
  }

  /**
   * Execute a single pipeline step
   */
  private async executeStep(step: PipelineStep, pipeline: PipelineExecution): Promise<CommandResult> {
    const startTime = Date.now();

    // Safety validation
    const safetyCheck = await this.safetyValidator.validateCommand({
      command: step.command,
      parameters: step.parameters,
      context: pipeline.context,
      stepId: step.id,
      pipelineId: pipeline.id,
    });

    if (!safetyCheck.allowed) {
      throw new Error(`Safety validation failed for step ${step.id}: ${safetyCheck.reason}`);
    }

    // Find appropriate executor
    const commandType = this.extractCommandType(step.command);
    const executor = this.stepExecutors.get(commandType);
    
    if (!executor) {
      throw new Error(`No executor found for command type: ${commandType}`);
    }

    // Execute with timeout and retry logic
    let lastError: Error | null = null;
    let attempt = 0;
    const maxAttempts = step.retryCount + 1;

    while (attempt < maxAttempts) {
      try {
        this.logger.debug('Executing step', {
          pipelineId: pipeline.id,
          stepId: step.id,
          attempt: attempt + 1,
          maxAttempts,
          timeout: step.timeout,
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Step execution timeout')), step.timeout)
        );

        const result = await Promise.race([
          executor(step, pipeline.context),
          timeoutPromise,
        ]);

        const duration = Date.now() - startTime;
        
        this.logger.info('Step executed successfully', {
          pipelineId: pipeline.id,
          stepId: step.id,
          command: step.command,
          duration,
          attempt: attempt + 1,
        });

        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        attempt++;

        this.logger.warn('Step execution failed', {
          pipelineId: pipeline.id,
          stepId: step.id,
          attempt,
          maxAttempts,
          error: lastError.message,
          willRetry: attempt < maxAttempts,
        });

        if (attempt < maxAttempts) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError;
  }

  /**
   * Update pipeline context with step results
   */
  private updatePipelineContext(pipeline: PipelineExecution, stepId: string, result: CommandResult): void {
    // Store step result in context
    pipeline.context[`step_${stepId}`] = result;

    // Extract and store commonly used values
    if (result.data) {
      // Store specific data fields based on command type
      const step = pipeline.steps.find(s => s.id === stepId);
      if (step) {
        const commandType = this.extractCommandType(step.command);
        this.extractContextualData(commandType, result.data, pipeline.context);
      }
    }

    this.logger.debug('Updated pipeline context', {
      pipelineId: pipeline.id,
      stepId,
      contextKeys: Object.keys(pipeline.context),
    });
  }

  /**
   * Extract contextual data based on command type
   */
  private extractContextualData(commandType: string, data: any, context: Record<string, any>): void {
    switch (commandType) {
      case 'scan':
        if (data.threats) context.lastThreats = data.threats;
        if (data.vulnerabilities) context.lastVulnerabilities = data.vulnerabilities;
        break;
      
      case 'auth':
        if (data.token) context.authToken = data.token;
        if (data.user) context.currentUser = data.user;
        break;
      
      case 'threat':
        if (data.events) context.threatEvents = data.events;
        if (data.indicators) context.threatIndicators = data.indicators;
        break;
      
      default:
        // Store generic data
        if (typeof data === 'object' && data !== null) {
          Object.assign(context, data);
        }
    }
  }

  /**
   * Evaluate step condition
   */
  private evaluateCondition(condition: string | undefined, context: Record<string, any>): boolean {
    if (!condition) return true;

    try {
      // Simple condition evaluation (can be enhanced with a proper expression parser)
      // For now, support basic comparisons like "threats.length > 0"
      const func = new Function('context', `with(context) { return ${condition}; }`);
      return Boolean(func(context));
    } catch (error) {
      this.logger.warn('Failed to evaluate condition', {
        condition,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Extract command type from command string
   */
  private extractCommandType(command: string): string {
    // Extract the main command (first word)
    return command.split(' ')[0];
  }

  /**
   * Validate pipeline structure
   */
  private validatePipeline(steps: PipelineStep[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const stepIds = new Set(steps.map(s => s.id));

    // Check for duplicate step IDs
    if (stepIds.size !== steps.length) {
      errors.push('Duplicate step IDs found');
    }

    // Check dependencies
    for (const step of steps) {
      for (const dep of step.dependencies) {
        if (!stepIds.has(dep)) {
          errors.push(`Step ${step.id} depends on non-existent step ${dep}`);
        }
      }
    }

    // Check for circular dependencies
    if (this.hasCircularDependencies(steps)) {
      errors.push('Circular dependencies detected');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Check for circular dependencies using topological sort
   */
  private hasCircularDependencies(steps: PipelineStep[]): boolean {
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (stepId: string): boolean => {
      if (visiting.has(stepId)) return true; // Circular dependency
      if (visited.has(stepId)) return false;

      visiting.add(stepId);
      
      const step = steps.find(s => s.id === stepId);
      if (step) {
        for (const dep of step.dependencies) {
          if (visit(dep)) return true;
        }
      }

      visiting.delete(stepId);
      visited.add(stepId);
      return false;
    };

    for (const step of steps) {
      if (visit(step.id)) return true;
    }

    return false;
  }

  /**
   * Cancel running steps
   */
  private async cancelRunningSteps(runningSteps: Map<string, Promise<CommandResult>>): Promise<void> {
    this.logger.info('Cancelling running steps', { count: runningSteps.size });
    
    // Note: In a full implementation, we would need to add cancellation support
    // to the step executors. For now, we just log the cancellation.
    runningSteps.clear();
  }

  /**
   * Rollback pipeline (attempt to undo completed steps)
   */
  private async rollbackPipeline(pipeline: PipelineExecution): Promise<void> {
    this.logger.info('Attempting pipeline rollback', {
      pipelineId: pipeline.id,
      completedSteps: pipeline.results.size,
    });

    // Rollback steps in reverse order
    const completedSteps = Array.from(pipeline.results.keys()).reverse();
    
    for (const stepId of completedSteps) {
      try {
        await this.rollbackStep(stepId, pipeline);
        this.logger.debug('Rolled back step', { pipelineId: pipeline.id, stepId });
      } catch (error) {
        this.logger.error('Failed to rollback step', {
          pipelineId: pipeline.id,
          stepId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Rollback a single step (placeholder - would need command-specific rollback logic)
   */
  private async rollbackStep(stepId: string, pipeline: PipelineExecution): Promise<void> {
    // This is a placeholder - actual rollback would depend on the command type
    // For example:
    // - File operations: delete created files
    // - Database operations: reverse transactions
    // - API calls: send compensating requests
    
    this.logger.debug('Rollback step placeholder', { stepId, pipelineId: pipeline.id });
  }

  /**
   * Get pipeline status
   */
  getPipelineStatus(pipelineId: string): PipelineExecution | null {
    return this.activePipelines.get(pipelineId) || null;
  }

  /**
   * Cancel pipeline execution
   */
  async cancelPipeline(pipelineId: string): Promise<void> {
    const pipeline = this.activePipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline not found: ${pipelineId}`);
    }

    if (pipeline.status === 'running') {
      pipeline.status = 'cancelled';
      pipeline.completedAt = new Date();
      
      this.logger.info('Pipeline cancelled', { pipelineId });
    }
  }

  /**
   * Clean up completed pipelines
   */
  cleanupPipelines(maxAge: number = 3600000): void { // Default: 1 hour
    const cutoff = Date.now() - maxAge;
    
    for (const [id, pipeline] of this.activePipelines.entries()) {
      if (pipeline.completedAt && pipeline.completedAt.getTime() < cutoff) {
        this.activePipelines.delete(id);
        this.logger.debug('Cleaned up pipeline', { pipelineId: id });
      }
    }
  }

  /**
   * Get pipeline statistics
   */
  getStatistics(): {
    activePipelines: number;
    completedPipelines: number;
    failedPipelines: number;
    totalSteps: number;
  } {
    let completed = 0;
    let failed = 0;
    let totalSteps = 0;

    for (const pipeline of this.activePipelines.values()) {
      totalSteps += pipeline.steps.length;
      
      if (pipeline.status === 'completed') completed++;
      else if (pipeline.status === 'failed') failed++;
    }

    return {
      activePipelines: this.activePipelines.size,
      completedPipelines: completed,
      failedPipelines: failed,
      totalSteps,
    };
  }
}