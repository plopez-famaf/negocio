// Shared types across all AI services

export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  service: string;
  correlationId?: string;
}

export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'service';
  createdAt: string;
  updatedAt: string;
}

export interface ServiceMetrics {
  service: string;
  uptime: number;
  memory: NodeJS.MemoryUsage;
  cpu?: number;
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  timestamp: string;
}

export interface InterServiceRequest {
  correlationId: string;
  userId?: string;
  serviceSource: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface InterServiceEvent {
  type: string;
  source: string;
  target?: string;
  payload: any;
  correlationId: string;
  timestamp: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

// Identity AI Service Types
export interface BiometricVerificationRequest extends InterServiceRequest {
  type: 'face' | 'fingerprint';
  imageData: Buffer | string;
  templateId?: string;
}

export interface BiometricVerificationResponse {
  verified: boolean;
  confidence: number;
  templateId?: string;
  processingTime: number;
  metadata: Record<string, any>;
}

export interface DocumentVerificationRequest extends InterServiceRequest {
  documentType: 'passport' | 'driver_license' | 'id_card';
  documentData: Buffer | string;
  mimeType: string;
}

export interface DocumentVerificationResponse {
  verified: boolean;
  confidence: number;
  extractedData: Record<string, any>;
  securityFeatures: Record<string, boolean>;
  processingTime: number;
}

// Threat AI Service Types
export interface ThreatDetectionRequest extends InterServiceRequest {
  eventType: 'login_attempt' | 'data_access' | 'network_activity' | 'file_modification' | 'privilege_escalation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  eventData: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  location?: {
    country?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
}

export interface ThreatDetectionResponse {
  threatDetected: boolean;
  riskScore: number;
  confidence: number;
  threatType?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  indicators: string[];
  recommendations: string[];
  processingTime: number;
}

export interface BehaviorAnalysisRequest extends InterServiceRequest {
  sessionId: string;
  sessionDuration: number;
  actions: Array<{
    type: string;
    timestamp: string;
    metadata?: Record<string, any>;
  }>;
  deviceInfo?: {
    type: 'desktop' | 'mobile' | 'tablet';
    os?: string;
    browser?: string;
  };
}

export interface BehaviorAnalysisResponse {
  anomalyDetected: boolean;
  behaviorScore: number;
  baseline: {
    score: number;
    deviation: number;
  };
  riskFactors: Array<{
    factor: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
  patterns: Array<{
    type: string;
    confidence: number;
    description: string;
  }>;
}

// Real-time Events
export interface RealTimeEvent {
  type: 'threat_detected' | 'verification_completed' | 'system_alert' | 'user_activity';
  userId?: string;
  data: any;
  timestamp: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  source: string;
}

// API Gateway Types
export interface ServiceRegistration {
  serviceName: string;
  serviceUrl: string;
  healthEndpoint: string;
  version: string;
  capabilities: string[];
  registeredAt: string;
}

export interface LoadBalancerConfig {
  services: ServiceRegistration[];
  strategy: 'round_robin' | 'least_connections' | 'weighted';
  healthCheckInterval: number;
}

// Error Types
export interface ServiceError {
  code: string;
  message: string;
  details?: any;
  service: string;
  timestamp: string;
  correlationId?: string;
  userId?: string;
}

export const ServiceErrorCodes = {
  AUTHENTICATION_FAILED: 'AUTH_001',
  AUTHORIZATION_FAILED: 'AUTH_002',
  VALIDATION_ERROR: 'VAL_001',
  SERVICE_UNAVAILABLE: 'SVC_001',
  PROCESSING_ERROR: 'PROC_001',
  RATE_LIMIT_EXCEEDED: 'RATE_001',
  INTERNAL_ERROR: 'INT_001'
} as const;