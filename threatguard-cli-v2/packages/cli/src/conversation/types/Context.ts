import { z } from 'zod';
import type { Intent } from './Intent.js';
import type { ParsedCommand } from './Command.js';

// Message types in conversation
export const MessageTypeSchema = z.enum([
  'user_input',
  'assistant_response', 
  'system_message',
  'command_execution',
  'error_message',
  'confirmation_request',
  'suggestion',
]);

export type MessageType = z.infer<typeof MessageTypeSchema>;

// Individual conversation message
export const MessageSchema = z.object({
  id: z.string(),
  type: MessageTypeSchema,
  content: z.string(),
  timestamp: z.string(),
  metadata: z.record(z.string(), z.any()).optional(),
  
  // Associated data
  intent: z.any().optional(), // Intent type
  command: z.any().optional(), // ParsedCommand type
  executionResult: z.any().optional(),
  
  // Message relationships
  replyTo: z.string().optional(),
  threadId: z.string().optional(),
});

export type Message = z.infer<typeof MessageSchema>;

// Conversation session state
export const SessionStateSchema = z.object({
  sessionId: z.string(),
  userId: z.string().optional(),
  startTime: z.string(),
  lastActivity: z.string(),
  isActive: z.boolean().default(true),
  
  // Current context
  currentTopic: z.string().optional(),
  activeCommand: z.string().optional(),
  pendingConfirmation: z.any().optional(), // ParsedCommand type
  
  // User preferences for this session
  preferences: z.object({
    outputFormat: z.enum(['table', 'json', 'yaml', 'text']).default('table'),
    verboseMode: z.boolean().default(false),
    confirmDestructive: z.boolean().default(true),
    suggestCommands: z.boolean().default(true),
    explainCommands: z.boolean().default(true),
  }).default({}),
  
  // Context tracking
  entities: z.record(z.string(), z.any()).default({}), // Extracted entities from conversation
  variables: z.record(z.string(), z.any()).default({}), // Session variables
  
  // Security context
  authenticationStatus: z.enum(['authenticated', 'unauthenticated', 'expired']).default('unauthenticated'),
  permissions: z.array(z.string()).default([]),
  lastAuthCheck: z.string().optional(),
});

export type SessionState = z.infer<typeof SessionStateSchema>;

// Complete conversation context
export const ConversationContextSchema = z.object({
  session: SessionStateSchema,
  messages: z.array(MessageSchema).default([]),
  
  // Recent context for NLP processing
  recentIntents: z.array(z.string()).default([]), // Last 5 intents
  recentEntities: z.array(z.any()).default([]), // Recently extracted entities
  recentCommands: z.array(z.string()).default([]), // Last executed commands
  
  // Workflow context
  currentWorkflow: z.string().optional(),
  workflowStep: z.number().optional(),
  workflowData: z.record(z.string(), z.any()).optional(),
  
  // Error context
  lastError: z.string().optional(),
  errorCount: z.number().default(0),
  
  // Performance tracking
  averageResponseTime: z.number().default(0),
  totalInteractions: z.number().default(0),
});

export type ConversationContext = z.infer<typeof ConversationContextSchema>;

// Context store operations
export interface ContextStore {
  // Session management
  createSession(userId?: string): Promise<SessionState>;
  getSession(sessionId: string): Promise<SessionState | null>;
  updateSession(sessionId: string, updates: Partial<SessionState>): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  
  // Message history
  addMessage(sessionId: string, message: Omit<Message, 'id' | 'timestamp'>): Promise<Message>;
  getMessages(sessionId: string, limit?: number): Promise<Message[]>;
  searchMessages(sessionId: string, query: string): Promise<Message[]>;
  
  // Context management
  getContext(sessionId: string): Promise<ConversationContext | null>;
  updateContext(sessionId: string, updates: Partial<ConversationContext>): Promise<void>;
  
  // Entity and variable management
  setEntity(sessionId: string, key: string, value: any): Promise<void>;
  getEntity(sessionId: string, key: string): Promise<any>;
  setVariable(sessionId: string, key: string, value: any): Promise<void>;
  getVariable(sessionId: string, key: string): Promise<any>;
  
  // Cleanup
  cleanup(olderThan: Date): Promise<number>;
}

// Conversation memory patterns
export interface ConversationMemory {
  // Short-term memory (current session)
  shortTerm: {
    lastIntent: string;
    lastEntities: Record<string, any>;
    lastCommand: string;
    conversationFlow: string[];
  };
  
  // Medium-term memory (recent sessions)
  mediumTerm: {
    commonCommands: string[];
    preferredTargets: string[];
    typicalWorkflows: string[];
    userPreferences: Record<string, any>;
  };
  
  // Long-term memory (user profile)
  longTerm: {
    expertiseLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    commandPatterns: Record<string, number>;
    domainFocus: string[];
    securityClearance: string[];
  };
}

// Context-aware suggestions
export interface ContextualSuggestion {
  type: 'command' | 'workflow' | 'help' | 'clarification';
  content: string;
  reasoning: string;
  confidence: number;
  actionable: boolean;
  followUp?: string[];
}

// Workflow state for multi-step operations
export const WorkflowStateSchema = z.object({
  workflowId: z.string(),
  name: z.string(),
  description: z.string(),
  currentStep: z.number(),
  totalSteps: z.number(),
  stepData: z.array(z.object({
    stepId: z.string(),
    name: z.string(),
    description: z.string(),
    command: z.string().optional(),
    completed: z.boolean().default(false),
    result: z.any().optional(),
    skipped: z.boolean().default(false),
  })),
  startTime: z.string(),
  estimatedDuration: z.number().optional(),
  variables: z.record(z.string(), z.any()).default({}),
});

export type WorkflowState = z.infer<typeof WorkflowStateSchema>;

// Common cybersecurity workflows
export const SECURITY_WORKFLOWS = {
  INCIDENT_RESPONSE: {
    id: 'incident_response',
    name: 'Security Incident Response',
    description: 'Structured approach to handling security incidents',
    steps: [
      { id: 'identify', name: 'Identify Threat', description: 'Scan and identify the security threat' },
      { id: 'contain', name: 'Contain Threat', description: 'Isolate and contain the threat' },
      { id: 'analyze', name: 'Analyze Impact', description: 'Assess the scope and impact' },
      { id: 'remediate', name: 'Remediate', description: 'Remove threat and restore systems' },
      { id: 'recover', name: 'Recovery', description: 'Restore normal operations' },
      { id: 'lessons', name: 'Lessons Learned', description: 'Document and improve procedures' },
    ],
  },
  THREAT_HUNTING: {
    id: 'threat_hunting',
    name: 'Proactive Threat Hunting',
    description: 'Systematic search for threats in the environment',
    steps: [
      { id: 'hypothesis', name: 'Develop Hypothesis', description: 'Form threat hypothesis based on intelligence' },
      { id: 'collect', name: 'Data Collection', description: 'Gather relevant security data' },
      { id: 'analyze', name: 'Data Analysis', description: 'Analyze data for threat indicators' },
      { id: 'investigate', name: 'Investigation', description: 'Deep dive into suspicious activities' },
      { id: 'document', name: 'Documentation', description: 'Document findings and update defenses' },
    ],
  },
  VULNERABILITY_ASSESSMENT: {
    id: 'vulnerability_assessment',
    name: 'Comprehensive Vulnerability Assessment',
    description: 'Systematic evaluation of security vulnerabilities',
    steps: [
      { id: 'scope', name: 'Define Scope', description: 'Identify systems and networks to assess' },
      { id: 'discovery', name: 'Asset Discovery', description: 'Discover and inventory assets' },
      { id: 'scan', name: 'Vulnerability Scanning', description: 'Scan for known vulnerabilities' },
      { id: 'analyze', name: 'Risk Analysis', description: 'Analyze and prioritize vulnerabilities' },
      { id: 'report', name: 'Reporting', description: 'Generate comprehensive vulnerability report' },
    ],
  },
} as const;

// Context-aware command completion
export interface CommandCompletion {
  suggestion: string;
  confidence: number;
  reasoning: string;
  category: 'command' | 'option' | 'value' | 'workflow';
  examples: string[];
}