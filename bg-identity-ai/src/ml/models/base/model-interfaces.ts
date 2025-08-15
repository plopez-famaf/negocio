/**
 * Core interfaces for ML models and data structures
 */

// Base ML Model Interface
export interface IMLModel {
  modelId: string;
  modelName: string;
  version: string;
  isLoaded: boolean;
  
  initialize(): Promise<void>;
  predict(input: any): Promise<any>;
  evaluate(testData: any[]): Promise<ModelMetrics>;
  save(path: string): Promise<void>;
  load(path: string): Promise<void>;
  getModelInfo(): ModelInfo;
}

// Model Performance Metrics
export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auc?: number;
  confusionMatrix?: number[][];
  inferenceTime: number; // ms
  memoryUsage: number; // MB
  timestamp: string;
}

// Model Information
export interface ModelInfo {
  id: string;
  name: string;
  version: string;
  type: ModelType;
  description: string;
  features: string[];
  trainingData: {
    size: number;
    lastUpdated: string;
    sources: string[];
  };
  performance: ModelMetrics;
  status: ModelStatus;
  createdAt: string;
  updatedAt: string;
}

export enum ModelType {
  ANOMALY_DETECTION = 'anomaly-detection',
  BEHAVIORAL_ANALYSIS = 'behavioral-analysis',
  THREAT_CLASSIFICATION = 'threat-classification',
  SEQUENCE_ANALYSIS = 'sequence-analysis',
  STATISTICAL_ANALYSIS = 'statistical-analysis'
}

export enum ModelStatus {
  TRAINING = 'training',
  READY = 'ready',
  UPDATING = 'updating',
  ERROR = 'error',
  DEPRECATED = 'deprecated'
}

// Anomaly Detection Interfaces
export interface AnomalyDetectionInput {
  features: number[];
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface AnomalyResult {
  isAnomaly: boolean;
  anomalyScore: number; // 0-1, higher = more anomalous
  confidence: number; // 0-1, higher = more confident
  explanation?: string;
  affectedFeatures?: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

// Behavioral Analysis Interfaces  
export interface BehaviorAnalysisInput {
  userId: string;
  events: BehaviorEvent[];
  timeWindow: {
    start: string;
    end: string;
  };
  context?: Record<string, any>;
}

export interface BehaviorEvent {
  timestamp: string;
  eventType: string;
  properties: Record<string, any>;
  source: string;
}

export interface BehaviorAnalysisResult {
  userId: string;
  riskScore: number; // 0-1, higher = riskier
  anomalies: BehaviorAnomaly[];
  patterns: BehaviorPattern[];
  recommendations: string[];
  confidence: number;
  analysisTimestamp: string;
}

export interface BehaviorAnomaly {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  evidenceEvents: string[]; // Event IDs
  baseline?: Record<string, number>;
  observed?: Record<string, number>;
}

export interface BehaviorPattern {
  id: string;
  type: string;
  description: string;
  frequency: number;
  confidence: number;
  firstSeen: string;
  lastSeen: string;
  events: string[]; // Event IDs
}

// Threat Classification Interfaces
export interface ThreatClassificationInput {
  features: ThreatFeatures;
  context?: ThreatContext;
}

export interface ThreatFeatures {
  networkFeatures?: NetworkFeatures;
  behavioralFeatures?: BehavioralFeatures;
  temporalFeatures?: TemporalFeatures;
  entityFeatures?: EntityFeatures;
}

export interface NetworkFeatures {
  sourceIp?: string;
  destinationIp?: string;
  port?: number;
  protocol?: string;
  packetSize?: number;
  frequency?: number;
  geolocation?: {
    country: string;
    region: string;
    city: string;
  };
}

export interface BehavioralFeatures {
  deviation?: number;
  patternMatch?: number;
  historicalComparison?: number;
  riskIndicators?: string[];
}

export interface TemporalFeatures {
  timeOfDay?: number;
  dayOfWeek?: number;
  frequency?: number;
  duration?: number;
  sequence?: number[];
}

export interface EntityFeatures {
  entityType?: string;
  reputation?: number;
  age?: number;
  relationships?: string[];
}

export interface ThreatContext {
  source: string;
  timestamp: string;
  environment: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface ThreatClassificationResult {
  classification: ThreatClass;
  confidence: number;
  riskScore: number;
  explanation: string;
  recommendedActions: string[];
  relatedThreats?: string[];
  metadata?: Record<string, any>;
}

export enum ThreatClass {
  BENIGN = 'benign',
  SUSPICIOUS = 'suspicious',
  MALWARE = 'malware',
  INTRUSION = 'intrusion',
  DATA_EXFILTRATION = 'data-exfiltration',
  DENIAL_OF_SERVICE = 'denial-of-service',
  ADVANCED_PERSISTENT_THREAT = 'advanced-persistent-threat',
  UNKNOWN = 'unknown'
}

// Sequence Analysis Interfaces
export interface SequenceAnalysisInput {
  sequence: SequenceEvent[];
  windowSize?: number;
  lookAhead?: number;
}

export interface SequenceEvent {
  timestamp: string;
  eventType: string;
  properties: Record<string, any>;
  features: number[];
}

export interface SequenceAnalysisResult {
  patterns: SequencePattern[];
  anomalies: SequenceAnomaly[];
  predictions: SequencePrediction[];
  riskScore: number;
  confidence: number;
}

export interface SequencePattern {
  id: string;
  pattern: string[];
  confidence: number;
  occurrences: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface SequenceAnomaly {
  position: number;
  expected: string;
  observed: string;
  anomalyScore: number;
  context: SequenceEvent[];
}

export interface SequencePrediction {
  nextEvent: string;
  confidence: number;
  alternatives: Array<{
    event: string;
    probability: number;
  }>;
  timeframe: string;
}

// Training Interfaces
export interface TrainingData {
  features: any[];
  labels: any[];
  metadata: {
    size: number;
    source: string;
    version: string;
    createdAt: string;
  };
}

export interface TrainingConfig {
  algorithm: string;
  hyperparameters: Record<string, any>;
  validationSplit: number;
  epochs?: number;
  batchSize?: number;
  learningRate?: number;
  regularization?: Record<string, any>;
}

export interface TrainingResult {
  modelId: string;
  metrics: ModelMetrics;
  hyperparameters: Record<string, any>;
  trainingTime: number; // seconds
  iterations: number;
  convergence: boolean;
  losses: number[];
  validationLosses: number[];
}