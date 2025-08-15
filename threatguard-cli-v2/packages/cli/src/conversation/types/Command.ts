/**
 * Command execution types for the conversational AI system
 * Provides type definitions for command pipeline and execution engine
 */

export interface CommandResult {
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
  metadata?: {
    executionTime: number;
    command: string;
    parameters?: Record<string, any>;
    timestamp: Date;
    correlationId?: string;
  };
}

export interface CommandExecution {
  id: string;
  command: string;
  parameters: Record<string, any>;
  context: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  result?: CommandResult;
  startTime?: Date;
  endTime?: Date;
  timeout: number;
  retryCount: number;
  maxRetries: number;
}

export interface CommandValidationResult {
  allowed: boolean;
  reason?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiredApproval: boolean;
  warnings: string[];
}

export interface SafetyValidationRequest {
  command: string;
  parameters: Record<string, any>;
  context: Record<string, any>;
  stepId?: string;
  pipelineId?: string;
  workflowId?: string;
  userId?: string;
  environment?: string;
}

export interface SafetyValidationResult {
  allowed: boolean;
  reason?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiresApproval: boolean;
  warnings: string[];
  recommendations: string[];
  mitigations: string[];
  approvalRequired: boolean;
  approvalLevel: 'user' | 'supervisor' | 'admin' | 'security_team';
}

// Utility types for command pipeline operations
export type CommandExecutor = (
  command: string,
  parameters: Record<string, any>,
  context: Record<string, any>
) => Promise<CommandResult>;

export type CommandValidator = (
  request: SafetyValidationRequest
) => Promise<SafetyValidationResult>;

// Error types for command execution
export class CommandExecutionError extends Error {
  constructor(
    message: string,
    public readonly commandId: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'CommandExecutionError';
  }
}

export class SafetyValidationError extends Error {
  constructor(
    message: string,
    public readonly riskLevel: string,
    public readonly violations: string[]
  ) {
    super(message);
    this.name = 'SafetyValidationError';
  }
}

export class PipelineExecutionError extends Error {
  constructor(
    message: string,
    public readonly pipelineId: string,
    public readonly stepId?: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'PipelineExecutionError';
  }
}