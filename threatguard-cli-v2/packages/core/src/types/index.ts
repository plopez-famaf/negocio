import { z } from 'zod';

// Configuration Schemas
export const CLIConfigSchema = z.object({
  apiUrl: z.string().url(),
  token: z.string().optional(),
  userId: z.string().optional(),
  preferences: z.object({
    theme: z.enum(['dark', 'light']).default('dark'),
    outputFormat: z.enum(['json', 'table', 'text']).default('table'),
    realTimeUpdates: z.boolean().default(true),
    notifications: z.boolean().default(true),
  }),
});

export const AuthCredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const AuthTokenSchema = z.object({
  token: z.string(),
  expiresAt: z.string().datetime(),
  userId: z.string(),
  permissions: z.array(z.string()),
});

// Threat Detection Schemas
export const ThreatEventSchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  type: z.enum(['network', 'behavioral', 'malware', 'intrusion', 'anomaly']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  source: z.string(),
  target: z.string().optional(),
  description: z.string(),
  riskScore: z.number().min(0).max(100),
  status: z.enum(['active', 'investigating', 'resolved', 'false_positive']),
  metadata: z.record(z.any()),
});

export const ThreatScanResultSchema = z.object({
  scanId: z.string(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  status: z.enum(['running', 'completed', 'failed', 'cancelled']),
  targetsScanned: z.number().min(0),
  threatsFound: z.number().min(0),
  threats: z.array(ThreatEventSchema),
  summary: z.object({
    critical: z.number().min(0),
    high: z.number().min(0),
    medium: z.number().min(0),
    low: z.number().min(0),
  }),
});

// Behavioral Analysis Schemas
export const BehaviorAnalysisRequestSchema = z.object({
  target: z.string(),
  timeRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  analysisType: z.enum(['user', 'network', 'system', 'application']),
  metrics: z.array(z.string()),
});

export const BehaviorPatternSchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  target: z.string(),
  pattern: z.string(),
  confidence: z.number().min(0).max(1),
  anomalyScore: z.number().min(0).max(100),
  baseline: z.record(z.number()),
  current: z.record(z.number()),
  deviations: z.array(z.string()),
});

export const BehaviorAnalysisResultSchema = z.object({
  analysisId: z.string(),
  target: z.string(),
  timeRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  overallRiskScore: z.number().min(0).max(100),
  patterns: z.array(BehaviorPatternSchema),
  anomalies: z.number().min(0),
  recommendations: z.array(z.string()),
});

// Network Monitoring Schemas
export const NetworkEventSchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  eventType: z.enum(['connection', 'traffic', 'intrusion', 'port_scan', 'dns_query']),
  sourceIp: z.string().ip(),
  destIp: z.string().ip().optional(),
  sourcePort: z.number().min(1).max(65535).optional(),
  destPort: z.number().min(1).max(65535).optional(),
  protocol: z.string(),
  bytes: z.number().min(0),
  packets: z.number().min(0),
  flags: z.array(z.string()),
  severity: z.enum(['info', 'warning', 'critical']),
  blocked: z.boolean(),
});

export const NetworkScanTargetSchema = z.object({
  network: z.string(),
  ports: z.array(z.number().min(1).max(65535)).optional(),
  timeout: z.number().min(1).max(300).optional(),
  includePorts: z.boolean().optional(),
});

// Threat Intelligence Schemas
export const ThreatIntelligenceQuerySchema = z.object({
  type: z.enum(['ip', 'domain', 'hash', 'url']),
  value: z.string(),
  sources: z.array(z.string()).optional(),
});

export const ThreatIntelligenceResultSchema = z.object({
  query: z.string(),
  type: z.string(),
  reputation: z.enum(['clean', 'suspicious', 'malicious', 'unknown']),
  confidence: z.number().min(0).max(1),
  sources: z.array(z.object({
    name: z.string(),
    reputation: z.string(),
    lastSeen: z.string().datetime().optional(),
    tags: z.array(z.string()),
  })),
  context: z.object({
    country: z.string().optional(),
    asn: z.string().optional(),
    organization: z.string().optional(),
    category: z.array(z.string()).optional(),
  }),
});

// Real-time Streaming Schemas
export const StreamEventSchema = z.object({
  type: z.enum(['threat', 'behavior', 'network', 'system']),
  timestamp: z.string().datetime(),
  data: z.any(),
  metadata: z.object({
    source: z.string(),
    correlationId: z.string(),
  }),
});

// Report Generation Schemas
export const ReportRequestSchema = z.object({
  type: z.enum(['threats', 'behavior', 'network', 'intelligence', 'summary']),
  timeRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  format: z.enum(['json', 'csv', 'pdf', 'html']),
  filters: z.record(z.any()).optional(),
  includeCharts: z.boolean().optional(),
});

export const ReportResultSchema = z.object({
  reportId: z.string(),
  type: z.string(),
  generatedAt: z.string().datetime(),
  timeRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  format: z.string(),
  size: z.number().min(0),
  downloadUrl: z.string().url().optional(),
  data: z.any().optional(),
});

// Terminal UI Schemas
export const TerminalMetricsSchema = z.object({
  threatsActive: z.number().min(0),
  riskScore: z.number().min(0).max(100),
  systemStatus: z.enum(['healthy', 'warning', 'critical']),
  lastUpdate: z.string().datetime(),
  uptime: z.string(),
});

export const DashboardWidgetSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['metric', 'chart', 'log', 'table']),
  position: z.object({
    x: z.number().min(0),
    y: z.number().min(0),
    width: z.number().min(1),
    height: z.number().min(1),
  }),
  data: z.any(),
  updateInterval: z.number().min(1000).optional(),
});

// API Response Schema
export const APIResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }).optional(),
  pagination: z.object({
    page: z.number().min(1),
    limit: z.number().min(1),
    total: z.number().min(0),
    totalPages: z.number().min(0),
  }).optional(),
});

// Command Types (no schemas needed for these interfaces)
export interface CommandContext {
  config: CLIConfig;
  output: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  spinner: (text: string) => { stop: (symbol?: string) => void };
}

export interface CommandOptions {
  [key: string]: any;
}

// Type inference from schemas
export type CLIConfig = z.infer<typeof CLIConfigSchema>;
export type AuthCredentials = z.infer<typeof AuthCredentialsSchema>;
export type AuthToken = z.infer<typeof AuthTokenSchema>;
export type ThreatEvent = z.infer<typeof ThreatEventSchema>;
export type ThreatScanResult = z.infer<typeof ThreatScanResultSchema>;
export type BehaviorAnalysisRequest = z.infer<typeof BehaviorAnalysisRequestSchema>;
export type BehaviorPattern = z.infer<typeof BehaviorPatternSchema>;
export type BehaviorAnalysisResult = z.infer<typeof BehaviorAnalysisResultSchema>;
export type NetworkEvent = z.infer<typeof NetworkEventSchema>;
export type NetworkScanTarget = z.infer<typeof NetworkScanTargetSchema>;
export type ThreatIntelligenceQuery = z.infer<typeof ThreatIntelligenceQuerySchema>;
export type ThreatIntelligenceResult = z.infer<typeof ThreatIntelligenceResultSchema>;
export type StreamEvent = z.infer<typeof StreamEventSchema>;
export type ReportRequest = z.infer<typeof ReportRequestSchema>;
export type ReportResult = z.infer<typeof ReportResultSchema>;
export type TerminalMetrics = z.infer<typeof TerminalMetricsSchema>;
export type DashboardWidget = z.infer<typeof DashboardWidgetSchema>;
export type APIResponse<T = any> = z.infer<typeof APIResponseSchema> & {
  data?: T;
};

// Export all schemas for validation
export const schemas = {
  CLIConfig: CLIConfigSchema,
  AuthCredentials: AuthCredentialsSchema,
  AuthToken: AuthTokenSchema,
  ThreatEvent: ThreatEventSchema,
  ThreatScanResult: ThreatScanResultSchema,
  BehaviorAnalysisRequest: BehaviorAnalysisRequestSchema,
  BehaviorPattern: BehaviorPatternSchema,
  BehaviorAnalysisResult: BehaviorAnalysisResultSchema,
  NetworkEvent: NetworkEventSchema,
  NetworkScanTarget: NetworkScanTargetSchema,
  ThreatIntelligenceQuery: ThreatIntelligenceQuerySchema,
  ThreatIntelligenceResult: ThreatIntelligenceResultSchema,
  StreamEvent: StreamEventSchema,
  ReportRequest: ReportRequestSchema,
  ReportResult: ReportResultSchema,
  TerminalMetrics: TerminalMetricsSchema,
  DashboardWidget: DashboardWidgetSchema,
  APIResponse: APIResponseSchema,
} as const;