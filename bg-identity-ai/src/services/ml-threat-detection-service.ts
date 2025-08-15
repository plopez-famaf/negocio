import { logger } from '@/lib/logger';
import { mlModelRegistry } from '@/ml/models/base/model-registry';
import { IsolationForestModel } from '@/ml/models/anomaly-detection/isolation-forest-model';
import { UserBehaviorModel, UserEvent, UserBehaviorInput, BehaviorAnalysisResult } from '@/ml/models/behavioral-analysis/user-behavior-model';
import { ModelType, AnomalyDetectionInput, AnomalyResult } from '@/ml/models/base/model-interfaces';
import { ThreatEvent, BehaviorPattern } from '@/types/threat';

/**
 * ML-enhanced threat analysis result
 */
export interface MLThreatAnalysisResult {
  analysisId: string;
  timestamp: string;
  mlModelResults: {
    networkAnomaly?: MLNetworkAnomalyResult;
    behaviorAnalysis?: BehaviorAnalysisResult;
  };
  combinedThreatScore: number;
  threatEvents: ThreatEvent[];
  mlMetadata: {
    modelsUsed: string[];
    processingTime: number;
    confidence: number;
    fallbackMode: boolean;
  };
}

/**
 * Network anomaly result from Isolation Forest
 */
export interface MLNetworkAnomalyResult {
  isAnomalous: boolean;
  anomalyScore: number;
  confidence: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  explanation: string;
  affectedFeatures?: string[];
  networkMetadata: {
    inferenceTime: number;
    features: string[];
    [key: string]: any;
  };
}

/**
 * Feature extraction configuration
 */
export interface FeatureExtractionConfig {
  includeNetworkFeatures: boolean;
  includeBehavioralFeatures: boolean;
  timeWindowMinutes: number;
  maxEventsPerAnalysis: number;
}

/**
 * ML Threat Detection Service
 * Orchestrates ML models for comprehensive threat analysis
 */
export class MLThreatDetectionService {
  private isolationForestModel: IsolationForestModel | null = null;
  private userBehaviorModel: UserBehaviorModel | null = null;
  private initialized: boolean = false;
  private fallbackMode: boolean = false;

  constructor() {
    logger.info('Initializing ML Threat Detection Service');
  }

  /**
   * Initialize the ML service and load models
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Loading ML models for threat detection');

      // Initialize the model registry
      await mlModelRegistry.initialize();

      // Load Isolation Forest model for network anomaly detection
      try {
        this.isolationForestModel = mlModelRegistry.getModel('isolation-forest-v1') as IsolationForestModel;
        if (!this.isolationForestModel) {
          // Create and register new model if not found
          this.isolationForestModel = new IsolationForestModel();
          await this.isolationForestModel.initialize();
          await mlModelRegistry.registerModel(this.isolationForestModel);
          logger.info('Isolation Forest model created and registered');
        }
      } catch (error) {
        logger.warn('Failed to load Isolation Forest model, will use fallback', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        this.isolationForestModel = null;
      }

      // Load UBA model for behavioral analysis
      try {
        this.userBehaviorModel = mlModelRegistry.getModel('user-behavior-v1') as UserBehaviorModel;
        if (!this.userBehaviorModel) {
          // Create and register new model if not found
          this.userBehaviorModel = new UserBehaviorModel();
          await this.userBehaviorModel.initialize();
          await mlModelRegistry.registerModel(this.userBehaviorModel);
          logger.info('User Behavior Analytics model created and registered');
        }
      } catch (error) {
        logger.warn('Failed to load UBA model, will use fallback', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        this.userBehaviorModel = null;
      }

      // Check if we're in fallback mode
      this.fallbackMode = !this.isolationForestModel && !this.userBehaviorModel;
      
      if (this.fallbackMode) {
        logger.warn('ML Threat Detection Service initialized in fallback mode - no ML models available');
      } else {
        const modelsLoaded = [
          this.isolationForestModel ? 'Isolation Forest' : null,
          this.userBehaviorModel ? 'User Behavior Analytics' : null
        ].filter(Boolean);

        logger.info('ML Threat Detection Service initialized successfully', {
          modelsLoaded,
          fallbackMode: this.fallbackMode
        });
      }

      this.initialized = true;

    } catch (error) {
      logger.error('Failed to initialize ML Threat Detection Service', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      this.fallbackMode = true;
      this.initialized = true; // Still mark as initialized for graceful operation
    }
  }

  /**
   * Analyze events for threats using ML models
   */
  async analyzeThreatEvents(
    events: any[], 
    userId?: string,
    config: FeatureExtractionConfig = {
      includeNetworkFeatures: true,
      includeBehavioralFeatures: true,
      timeWindowMinutes: 60,
      maxEventsPerAnalysis: 1000
    }
  ): Promise<MLThreatAnalysisResult> {
    const analysisId = `ml_analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      logger.info('Starting ML threat analysis', {
        analysisId,
        eventCount: events.length,
        userId,
        modelsAvailable: {
          isolationForest: !!this.isolationForestModel,
          userBehavior: !!this.userBehaviorModel
        }
      });

      // Ensure models are initialized
      if (!this.initialized) {
        await this.initialize();
      }

      const mlModelResults: MLThreatAnalysisResult['mlModelResults'] = {};
      const modelsUsed: string[] = [];
      let combinedThreatScore = 0;
      let combinedConfidence = 0;
      const threatEvents: ThreatEvent[] = [];

      // Network anomaly detection using Isolation Forest
      if (config.includeNetworkFeatures && this.isolationForestModel) {
        try {
          const networkFeatures = this.extractNetworkFeatures(events);
          if (networkFeatures.length > 0) {
            const networkResult = await this.analyzeNetworkAnomalies(networkFeatures);
            mlModelResults.networkAnomaly = networkResult;
            modelsUsed.push('isolation-forest-v1');
            
            // Create threat events from network anomalies
            if (networkResult.isAnomalous) {
              threatEvents.push(this.createThreatEventFromNetworkAnomaly(networkResult, events[0] || {}));
              combinedThreatScore = Math.max(combinedThreatScore, networkResult.anomalyScore);
            }
            
            combinedConfidence += networkResult.confidence;
          }
        } catch (error) {
          logger.warn('Network anomaly detection failed', {
            analysisId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Behavioral analysis using UBA model
      if (config.includeBehavioralFeatures && this.userBehaviorModel && userId) {
        try {
          const behaviorInput = this.extractBehavioralFeatures(events, userId, config);
          if (behaviorInput.events.length > 0) {
            const behaviorResult = await this.userBehaviorModel.analyzeUserBehavior(behaviorInput);
            mlModelResults.behaviorAnalysis = behaviorResult;
            modelsUsed.push('user-behavior-v1');
            
            // Create threat events from behavioral anomalies
            for (const anomaly of behaviorResult.anomalies) {
              threatEvents.push(this.createThreatEventFromBehaviorAnomaly(anomaly, behaviorResult, userId));
            }
            
            if (behaviorResult.isAnomalous) {
              combinedThreatScore = Math.max(combinedThreatScore, behaviorResult.anomalyScore);
            }
            
            combinedConfidence += behaviorResult.confidence;
          }
        } catch (error) {
          logger.warn('Behavioral analysis failed', {
            analysisId,
            userId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Calculate final combined confidence
      const modelCount = modelsUsed.length;
      if (modelCount > 0) {
        combinedConfidence = combinedConfidence / modelCount;
      }

      const processingTime = Date.now() - startTime;

      const result: MLThreatAnalysisResult = {
        analysisId,
        timestamp: new Date().toISOString(),
        mlModelResults,
        combinedThreatScore,
        threatEvents,
        mlMetadata: {
          modelsUsed,
          processingTime,
          confidence: combinedConfidence,
          fallbackMode: this.fallbackMode
        }
      };

      logger.info('ML threat analysis completed', {
        analysisId,
        modelsUsed,
        threatEventsGenerated: threatEvents.length,
        combinedThreatScore,
        processingTime
      });

      return result;

    } catch (error) {
      logger.error('ML threat analysis failed', {
        analysisId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Return empty result in case of complete failure
      return {
        analysisId,
        timestamp: new Date().toISOString(),
        mlModelResults: {},
        combinedThreatScore: 0,
        threatEvents: [],
        mlMetadata: {
          modelsUsed: [],
          processingTime: Date.now() - startTime,
          confidence: 0,
          fallbackMode: true
        }
      };
    }
  }

  /**
   * Analyze network anomalies using Isolation Forest
   */
  private async analyzeNetworkAnomalies(networkFeatures: AnomalyDetectionInput[]): Promise<MLNetworkAnomalyResult> {
    if (!this.isolationForestModel) {
      throw new Error('Isolation Forest model not available');
    }

    // For multiple network events, analyze each and return the most anomalous result
    let mostAnomalousResult: AnomalyResult | null = null;
    let highestScore = 0;

    for (const feature of networkFeatures) {
      const result = await this.isolationForestModel.predict(feature);
      if (result.anomalyScore > highestScore) {
        highestScore = result.anomalyScore;
        mostAnomalousResult = result;
      }
    }

    if (!mostAnomalousResult) {
      throw new Error('No network anomaly results generated');
    }

    return {
      isAnomalous: mostAnomalousResult.isAnomaly,
      anomalyScore: mostAnomalousResult.anomalyScore,
      confidence: mostAnomalousResult.confidence,
      severity: mostAnomalousResult.severity,
      explanation: mostAnomalousResult.explanation || 'Network anomaly detected through ML analysis',
      affectedFeatures: mostAnomalousResult.affectedFeatures,
      networkMetadata: {
        inferenceTime: mostAnomalousResult.metadata?.inferenceTime || 0,
        features: mostAnomalousResult.metadata?.features || [],
        ...mostAnomalousResult.metadata
      }
    };
  }

  /**
   * Extract network features for Isolation Forest analysis
   */
  private extractNetworkFeatures(events: any[]): AnomalyDetectionInput[] {
    const networkFeatures: AnomalyDetectionInput[] = [];

    for (const event of events) {
      try {
        // Skip non-network events
        if (event.type && event.type !== 'network') {
          continue;
        }

        // Extract network features based on event structure
        const features: number[] = [
          this.normalizeFeature(event.packetSize || event.bytes || 1500, 0, 100000), // 0
          this.normalizeFeature(event.connectionFrequency || event.frequency || 10, 0, 1000), // 1
          this.normalizeFeature(event.portDiversity || event.portCount || 1, 0, 100), // 2
          this.encodeProtocol(event.protocol || 'tcp'), // 3
          this.normalizeFeature(event.byteRate || event.dataRate || 50000, 0, 10000000), // 4
          this.normalizeFeature(event.connectionDuration || event.duration || 300, 0, 7200), // 5
          this.normalizeFeature(event.srcIpReputation || 0.5, 0, 1), // 6
          this.normalizeFeature(event.dstIpReputation || 0.5, 0, 1), // 7
          this.extractTimeOfDay(event.timestamp), // 8
          this.extractDayOfWeek(event.timestamp) // 9
        ];

        const networkInput: AnomalyDetectionInput = {
          features,
          timestamp: event.timestamp || new Date().toISOString(),
          metadata: {
            eventId: event.id,
            sourceIp: event.sourceIp || event.source,
            destinationIp: event.destIp || event.target,
            protocol: event.protocol
          }
        };

        networkFeatures.push(networkInput);

      } catch (error) {
        logger.warn('Failed to extract network features from event', {
          eventId: event.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return networkFeatures;
  }

  /**
   * Extract behavioral features for UBA analysis
   */
  private extractBehavioralFeatures(events: any[], userId: string, config: FeatureExtractionConfig): UserBehaviorInput {
    const userEvents: UserEvent[] = [];
    const timeWindow = config.timeWindowMinutes * 60 * 1000; // Convert to ms
    const now = Date.now();

    for (const event of events) {
      try {
        // Skip events outside time window
        const eventTime = new Date(event.timestamp || Date.now()).getTime();
        if (now - eventTime > timeWindow) {
          continue;
        }

        // Map generic events to UBA user events
        const userEvent: UserEvent = {
          userId: userId,
          sessionId: event.sessionId || `session_${Date.now()}`,
          eventType: this.mapEventTypeToUBA(event.type || event.eventType || 'system_command'),
          timestamp: event.timestamp || new Date().toISOString(),
          sourceIp: event.sourceIp || event.source || '127.0.0.1',
          userAgent: event.userAgent,
          location: event.location,
          resource: event.resource || event.target,
          action: event.action || event.description,
          dataSize: event.dataSize || event.bytes,
          duration: event.duration || event.connectionDuration,
          success: event.success !== undefined ? event.success : true,
          riskScore: event.riskScore,
          metadata: event.metadata || {}
        };

        userEvents.push(userEvent);

        // Limit events per analysis
        if (userEvents.length >= config.maxEventsPerAnalysis) {
          break;
        }

      } catch (error) {
        logger.warn('Failed to extract behavioral features from event', {
          eventId: event.id,
          userId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return {
      userId,
      events: userEvents,
      timeWindow: {
        start: new Date(now - timeWindow).toISOString(),
        end: new Date(now).toISOString()
      },
      contextMetadata: {
        extractedAt: new Date().toISOString(),
        originalEventCount: events.length,
        processedEventCount: userEvents.length
      }
    };
  }

  /**
   * Create threat event from network anomaly
   */
  private createThreatEventFromNetworkAnomaly(anomaly: MLNetworkAnomalyResult, originalEvent: any): ThreatEvent {
    return {
      id: `ml_network_threat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: 'network',
      severity: anomaly.severity,
      source: originalEvent.sourceIp || originalEvent.source || 'ml-detection',
      target: originalEvent.destIp || originalEvent.target,
      description: `ML Network Anomaly: ${anomaly.explanation}`,
      riskScore: anomaly.anomalyScore * 10,
      status: 'active',
      metadata: {
        correlationId: `ml_corr_${Date.now()}`,
        source: 'ml-isolation-forest',
        mlModel: 'isolation-forest-v1',
        confidence: anomaly.confidence,
        originalEventId: originalEvent.id,
        mlMetadata: anomaly.networkMetadata,
        affectedFeatures: anomaly.affectedFeatures
      }
    };
  }

  /**
   * Create threat event from behavioral anomaly
   */
  private createThreatEventFromBehaviorAnomaly(
    anomaly: BehaviorAnalysisResult['anomalies'][0], 
    behaviorResult: BehaviorAnalysisResult, 
    userId: string
  ): ThreatEvent {
    return {
      id: `ml_behavior_threat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: anomaly.timestamp,
      type: 'behavioral',
      severity: anomaly.severity,
      source: userId,
      target: behaviorResult.userId,
      description: `ML Behavioral Anomaly: ${anomaly.description}`,
      riskScore: behaviorResult.anomalyScore * 10,
      status: 'active',
      metadata: {
        correlationId: `ml_corr_${Date.now()}`,
        source: 'ml-user-behavior-analytics',
        mlModel: 'user-behavior-v1',
        confidence: behaviorResult.confidence,
        anomalyType: anomaly.type,
        evidence: anomaly.evidence,
        behaviorPatterns: behaviorResult.behaviorPatterns,
        recommendations: behaviorResult.recommendations
      }
    };
  }

  // Utility methods for feature extraction and normalization

  private normalizeFeature(value: number, min: number, max: number): number {
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }

  private encodeProtocol(protocol: string): number {
    const protocolMap: Record<string, number> = {
      'tcp': 1, 'udp': 2, 'icmp': 3, 'http': 4, 'https': 5
    };
    return protocolMap[protocol?.toLowerCase()] || 0;
  }

  private extractTimeOfDay(timestamp?: string): number {
    const date = timestamp ? new Date(timestamp) : new Date();
    return date.getHours();
  }

  private extractDayOfWeek(timestamp?: string): number {
    const date = timestamp ? new Date(timestamp) : new Date();
    return date.getDay();
  }

  private mapEventTypeToUBA(eventType: string): UserEvent['eventType'] {
    const typeMap: Record<string, UserEvent['eventType']> = {
      'login': 'login',
      'logout': 'logout',
      'authentication': 'login',
      'file_access': 'file_access',
      'network_access': 'network_access',
      'network': 'network_access',
      'system_command': 'system_command',
      'data_transfer': 'data_transfer',
      'permission_change': 'permission_change',
      'behavioral': 'system_command'
    };
    return typeMap[eventType?.toLowerCase()] || 'system_command';
  }

  /**
   * Check if ML models are available and healthy
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    models: Array<{
      name: string;
      available: boolean;
      lastUsed?: string;
    }>;
    fallbackMode: boolean;
  }> {
    const models = [
      {
        name: 'isolation-forest-v1',
        available: !!this.isolationForestModel?.isLoaded,
        lastUsed: this.isolationForestModel ? new Date().toISOString() : undefined
      },
      {
        name: 'user-behavior-v1',
        available: !!this.userBehaviorModel?.isLoaded,
        lastUsed: this.userBehaviorModel ? new Date().toISOString() : undefined
      }
    ];

    const healthy = models.some(model => model.available);

    return {
      healthy,
      models,
      fallbackMode: this.fallbackMode
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up ML Threat Detection Service');
    
    try {
      await mlModelRegistry.cleanup();
    } catch (error) {
      logger.warn('Error during ML service cleanup', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

// Export singleton instance
export const mlThreatDetectionService = new MLThreatDetectionService();