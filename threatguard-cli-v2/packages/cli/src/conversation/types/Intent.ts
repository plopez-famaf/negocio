import { z } from 'zod';

// Core intent categories for cybersecurity domain
export const IntentTypeSchema = z.enum([
  // Authentication and access
  'auth_login',
  'auth_logout', 
  'auth_status',
  'auth_help',

  // Threat detection and analysis
  'threat_scan',
  'threat_list',
  'threat_watch',
  'threat_details',
  'threat_analyze',

  // Behavioral analysis
  'behavior_analyze',
  'behavior_patterns',
  'behavior_baseline',

  // Network monitoring
  'network_scan',
  'network_monitor',
  'network_status',

  // Threat intelligence
  'intel_query',
  'intel_feeds',
  'intel_ioc_lookup',

  // Configuration and settings
  'config_set',
  'config_get',
  'config_list',
  'config_profile',

  // System and status
  'system_status',
  'system_health',
  'system_metrics',

  // Interactive modes
  'interactive_start',
  'dashboard_open',

  // Help and guidance
  'help_general',
  'help_command',
  'help_workflow',

  // Conversational
  'conversation_continue',
  'conversation_clarify',
  'conversation_unknown',
]);

export type IntentType = z.infer<typeof IntentTypeSchema>;

// Confidence levels for intent classification
export const ConfidenceLevel = z.enum(['very_low', 'low', 'medium', 'high', 'very_high']);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevel>;

// Intent classification result
export const IntentSchema = z.object({
  type: IntentTypeSchema,
  confidence: ConfidenceLevel,
  entities: z.record(z.string(), z.any()).optional(),
  context: z.record(z.string(), z.any()).optional(),
  ambiguous: z.boolean().default(false),
  alternatives: z.array(IntentTypeSchema).optional(),
});

export type Intent = z.infer<typeof IntentSchema>;

// Entity types for extracting structured data from natural language
export const EntityTypeSchema = z.enum([
  'ip_address',
  'network_range',
  'domain',
  'url',
  'file_path',
  'hash',
  'severity',
  'time_range',
  'scan_type',
  'threat_type',
  'config_key',
  'profile_name',
  'target',
  'command',
]);

export type EntityType = z.infer<typeof EntityTypeSchema>;

export const EntitySchema = z.object({
  type: EntityTypeSchema,
  value: z.string(),
  confidence: ConfidenceLevel,
  start: z.number(),
  end: z.number(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type Entity = z.infer<typeof EntitySchema>;

// Natural language parsing result
export const NLParseResultSchema = z.object({
  originalText: z.string(),
  intent: IntentSchema,
  entities: z.array(EntitySchema),
  confidence: ConfidenceLevel,
  processingTime: z.number(),
  alternatives: z.array(IntentSchema).optional(),
  requiresClarification: z.boolean().default(false),
  clarificationPrompt: z.string().optional(),
});

export type NLParseResult = z.infer<typeof NLParseResultSchema>;

// Common cybersecurity patterns and keywords
export const ThreatKeywords = {
  SCAN_TYPES: ['quick', 'deep', 'full', 'comprehensive', 'basic'],
  SEVERITY_LEVELS: ['low', 'medium', 'high', 'critical', 'minor', 'major'],
  THREAT_TYPES: ['malware', 'phishing', 'intrusion', 'anomaly', 'vulnerability', 'suspicious'],
  TIME_RANGES: ['today', 'yesterday', 'last hour', 'last day', 'last week', 'last month'],
  ACTIONS: ['scan', 'monitor', 'analyze', 'check', 'watch', 'list', 'show', 'get', 'set'],
  TARGETS: ['network', 'system', 'host', 'endpoint', 'server', 'domain', 'ip'],
} as const;

// Intent pattern matching rules
export interface IntentPattern {
  intent: IntentType;
  patterns: string[];
  entities?: EntityType[];
  examples: string[];
  confidence: ConfidenceLevel;
}

export const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: 'threat_scan',
    patterns: [
      'scan.*threats?',
      'check.*vulnerabilities',
      'run.*security.*scan',
      'search.*malware',
      'threat.*detection',
    ],
    entities: ['ip_address', 'network_range', 'domain', 'scan_type'],
    examples: [
      'scan my network for threats',
      'run a quick security scan',
      'check 192.168.1.0/24 for vulnerabilities',
      'scan this domain for malware',
    ],
    confidence: 'high',
  },
  {
    intent: 'threat_list',
    patterns: [
      'show.*threats?',
      'list.*alerts?',
      'display.*incidents',
      'what.*threats?',
      'recent.*attacks?',
    ],
    entities: ['severity', 'time_range', 'threat_type'],
    examples: [
      'show me all critical threats',
      'list recent security alerts',
      'what threats were found today?',
      'display high severity incidents',
    ],
    confidence: 'high',
  },
  {
    intent: 'threat_watch',
    patterns: [
      'monitor.*threats?',
      'watch.*real.?time',
      'live.*monitoring',
      'stream.*events',
      'continuous.*scan',
    ],
    entities: ['threat_type', 'severity'],
    examples: [
      'monitor threats in real-time',
      'watch for critical alerts',
      'start live threat monitoring',
      'stream security events',
    ],
    confidence: 'high',
  },
  {
    intent: 'auth_status',
    patterns: [
      'auth.*status',
      'login.*status',
      'am.*authenticated',
      'check.*credentials',
      'who.*am.*i',
    ],
    entities: [],
    examples: [
      'what is my authentication status?',
      'am I logged in?',
      'check my credentials',
      'who am I authenticated as?',
    ],
    confidence: 'very_high',
  },
  {
    intent: 'system_status',
    patterns: [
      'system.*status',
      'health.*check',
      'platform.*status',
      'service.*status',
      'api.*status',
    ],
    entities: [],
    examples: [
      'check system status',
      'show platform health',
      'is the API working?',
      'system health check',
    ],
    confidence: 'very_high',
  },
  {
    intent: 'help_general',
    patterns: [
      'help',
      'how.*do.*i',
      'what.*can.*do',
      'commands?',
      'usage',
    ],
    entities: ['command'],
    examples: [
      'help',
      'how do I scan for threats?',
      'what can I do with this tool?',
      'show me available commands',
    ],
    confidence: 'high',
  },
];

// Conversation intent for maintaining context
export const ConversationIntentSchema = z.object({
  intent: IntentSchema,
  followUp: z.boolean().default(false),
  relatedContext: z.record(z.string(), z.any()).optional(),
  suggestedActions: z.array(z.string()).optional(),
});

export type ConversationIntent = z.infer<typeof ConversationIntentSchema>;