import { logger } from '@/lib/logger';
import { ThreatEvent, BehaviorPattern } from '@/types/threat';
import { AnomalyResult, AnomalyDetectionInput } from '@/ml/models/base/model-interfaces';
import { BehaviorAnalysisResult, UserEvent } from '@/ml/models/behavioral-analysis/user-behavior-model';
import { MLThreatAnalysisResult, MLNetworkAnomalyResult } from '@/services/ml-threat-detection-service';

/**
 * Event transformation configuration
 */
export interface TransformationConfig {
  includeMLMetadata: boolean;
  enrichWithContext: boolean;
  correlationIdPrefix: string;
  defaultSeverityThreshold: number;
  riskScoreMultiplier: number;
}

/**
 * Network event input for transformation
 */
export interface NetworkEventInput {
  id?: string;
  timestamp?: string;
  sourceIp?: string;
  destIp?: string;
  port?: number;
  protocol?: string;
  bytes?: number;
  packets?: number;
  duration?: number;
  frequency?: number;
  reputation?: number;
  type?: string;
  metadata?: Record<string, any>;
}

/**
 * User activity input for transformation
 */
export interface UserActivityInput {
  userId: string;
  sessionId?: string;
  timestamp?: string;
  action?: string;
  resource?: string;
  sourceIp?: string;
  userAgent?: string;
  location?: {
    country: string;
    city: string;
  };
  success?: boolean;
  metadata?: Record<string, any>;
}

/**
 * ML Threat Event Adapters
 * Transforms between ML model inputs/outputs and threat detection events
 */
export class MLThreatAdapters {
  private static readonly DEFAULT_CONFIG: TransformationConfig = {
    includeMLMetadata: true,
    enrichWithContext: true,
    correlationIdPrefix: 'ml_threat',
    defaultSeverityThreshold: 0.7,
    riskScoreMultiplier: 10
  };

  /**
   * Transform network events to Isolation Forest input format
   */
  static transformToNetworkAnomalyInput(
    events: NetworkEventInput[],
    config: Partial<TransformationConfig> = {}
  ): AnomalyDetectionInput[] {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const inputs: AnomalyDetectionInput[] = [];

    for (const event of events) {
      try {
        // Extract and normalize network features
        const features = this.extractNetworkFeatures(event);
        
        if (features.length === 10) { // Ensure we have all required features
          const input: AnomalyDetectionInput = {
            features,
            timestamp: event.timestamp || new Date().toISOString(),
            metadata: finalConfig.includeMLMetadata ? {
              originalEventId: event.id,
              sourceIp: event.sourceIp,
              destinationIp: event.destIp,
              protocol: event.protocol,
              transformedAt: new Date().toISOString(),
              ...event.metadata
            } : undefined
          };

          inputs.push(input);
        } else {
          logger.warn('Incomplete network features extracted, skipping event', {
            eventId: event.id,
            featuresCount: features.length,
            requiredCount: 10
          });
        }

      } catch (error) {
        logger.error('Failed to transform network event to ML input', {
          eventId: event.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    logger.debug('Transformed network events to ML input', {
      originalCount: events.length,
      transformedCount: inputs.length
    });

    return inputs;
  }

  /**
   * Transform user activities to UBA input format
   */
  static transformToUserBehaviorInput(
    userId: string,
    activities: UserActivityInput[],
    timeWindow: { start: string; end: string },
    config: Partial<TransformationConfig> = {}
  ): { userId: string; events: UserEvent[]; timeWindow: { start: string; end: string } } {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const userEvents: UserEvent[] = [];

    for (const activity of activities) {
      try {
        const userEvent: UserEvent = {
          userId,
          sessionId: activity.sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          eventType: this.mapToUserEventType(activity.action || 'system_command'),
          timestamp: activity.timestamp || new Date().toISOString(),
          sourceIp: activity.sourceIp || '127.0.0.1',
          userAgent: activity.userAgent,
          location: activity.location,
          resource: activity.resource,
          action: activity.action,
          success: activity.success !== undefined ? activity.success : true,
          metadata: finalConfig.includeMLMetadata ? {
            transformedAt: new Date().toISOString(),
            ...activity.metadata
          } : activity.metadata
        };

        userEvents.push(userEvent);

      } catch (error) {
        logger.error('Failed to transform user activity to ML input', {
          userId,
          activity: activity.action,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    logger.debug('Transformed user activities to ML input', {
      userId,
      originalCount: activities.length,
      transformedCount: userEvents.length
    });

    return {
      userId,
      events: userEvents,
      timeWindow
    };
  }

  /**
   * Transform ML anomaly result to threat event
   */
  static transformAnomalyToThreatEvent(
    anomalyResult: AnomalyResult,
    originalEvent?: NetworkEventInput,
    config: Partial<TransformationConfig> = {}
  ): ThreatEvent {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };

    const threatEvent: ThreatEvent = {
      id: `${finalConfig.correlationIdPrefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: anomalyResult.metadata?.timestamp || new Date().toISOString(),
      type: 'network',
      severity: anomalyResult.severity,
      source: originalEvent?.sourceIp || anomalyResult.metadata?.sourceIp || 'ml-detection',
      target: originalEvent?.destIp || anomalyResult.metadata?.destinationIp,
      description: this.generateThreatDescription(anomalyResult, 'network'),
      riskScore: anomalyResult.anomalyScore * finalConfig.riskScoreMultiplier,
      status: 'active',
      metadata: {
        correlationId: `${finalConfig.correlationIdPrefix}_${Date.now()}`,
        source: 'ml-isolation-forest',
        mlModel: 'isolation-forest-v1',
        confidence: anomalyResult.confidence,
        isMLGenerated: true,
        ...(finalConfig.includeMLMetadata && {
          mlMetadata: {
            anomalyScore: anomalyResult.anomalyScore,
            affectedFeatures: anomalyResult.affectedFeatures,
            explanation: anomalyResult.explanation,
            originalMetadata: anomalyResult.metadata
          }
        }),
        ...(originalEvent && {
          originalEvent: {
            id: originalEvent.id,
            protocol: originalEvent.protocol,
            bytes: originalEvent.bytes
          }
        })
      }
    };

    return threatEvent;
  }

  /**
   * Transform behavior analysis result to threat events
   */
  static transformBehaviorToThreatEvents(
    behaviorResult: BehaviorAnalysisResult,
    config: Partial<TransformationConfig> = {}
  ): ThreatEvent[] {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const threatEvents: ThreatEvent[] = [];

    // Create threat events for each behavioral anomaly
    for (const anomaly of behaviorResult.anomalies) {
      const threatEvent: ThreatEvent = {
        id: `${finalConfig.correlationIdPrefix}_behavior_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: anomaly.timestamp,
        type: 'behavioral',
        severity: anomaly.severity,
        source: behaviorResult.userId,
        target: behaviorResult.userId,
        description: this.generateThreatDescription(anomaly, 'behavioral'),
        riskScore: behaviorResult.anomalyScore * finalConfig.riskScoreMultiplier,
        status: 'active',
        metadata: {
          correlationId: `${finalConfig.correlationIdPrefix}_${Date.now()}`,
          source: 'ml-user-behavior-analytics',
          mlModel: 'user-behavior-v1',
          confidence: behaviorResult.confidence,
          isMLGenerated: true,
          anomalyType: anomaly.type,
          evidence: anomaly.evidence,
          ...(finalConfig.includeMLMetadata && {
            mlMetadata: {
              behaviorPatterns: behaviorResult.behaviorPatterns,
              recommendations: behaviorResult.recommendations,
              riskLevel: behaviorResult.riskLevel
            }
          })
        }
      };

      threatEvents.push(threatEvent);
    }

    // If overall behavior is anomalous but no specific anomalies, create general threat event
    if (behaviorResult.isAnomalous && behaviorResult.anomalies.length === 0) {
      const generalThreat: ThreatEvent = {
        id: `${finalConfig.correlationIdPrefix}_behavior_general_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        type: 'behavioral',
        severity: this.mapRiskLevelToSeverity(behaviorResult.riskLevel),
        source: behaviorResult.userId,
        target: behaviorResult.userId,
        description: `General behavioral anomaly detected for user ${behaviorResult.userId}`,
        riskScore: behaviorResult.anomalyScore * finalConfig.riskScoreMultiplier,
        status: 'active',
        metadata: {
          correlationId: `${finalConfig.correlationIdPrefix}_${Date.now()}`,
          source: 'ml-user-behavior-analytics',
          mlModel: 'user-behavior-v1',
          confidence: behaviorResult.confidence,
          isMLGenerated: true,
          ...(finalConfig.includeMLMetadata && {
            mlMetadata: {
              behaviorPatterns: behaviorResult.behaviorPatterns,
              recommendations: behaviorResult.recommendations,
              riskLevel: behaviorResult.riskLevel
            }
          })
        }
      };

      threatEvents.push(generalThreat);
    }

    logger.debug('Transformed behavior analysis to threat events', {
      userId: behaviorResult.userId,
      anomaliesCount: behaviorResult.anomalies.length,
      threatEventsGenerated: threatEvents.length
    });

    return threatEvents;
  }

  /**
   * Transform ML analysis result to behavior patterns for existing API compatibility
   */
  static transformToBehaviorPatterns(
    behaviorResult: BehaviorAnalysisResult
  ): BehaviorPattern[] {
    const patterns: BehaviorPattern[] = [];

    // Create patterns from behavioral insights
    const patternTypes = [
      {
        type: 'login_frequency_pattern',
        metric: behaviorResult.behaviorPatterns.loginFrequency,
        baseline: 5, // Default baseline
        description: 'User login frequency analysis'
      },
      {
        type: 'location_variability_pattern',
        metric: behaviorResult.behaviorPatterns.locationVariability,
        baseline: 0.5,
        description: 'User location access pattern analysis'
      }
    ];

    for (const patternType of patternTypes) {
      if (patternType.metric > 0) {
        const pattern: BehaviorPattern = {
          id: `ml_pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
          target: behaviorResult.userId,
          pattern: patternType.type,
          confidence: behaviorResult.confidence,
          anomalyScore: behaviorResult.anomalyScore,
          baseline: { value: patternType.baseline },
          current: { value: patternType.metric },
          deviations: behaviorResult.anomalies.map(a => a.type)
        };

        patterns.push(pattern);
      }
    }

    return patterns;
  }

  /**
   * Create enriched ML analysis summary for API responses
   */
  static createMLAnalysisSummary(
    mlResult: MLThreatAnalysisResult,
    config: Partial<TransformationConfig> = {}
  ): {
    mlSummary: {
      modelsUsed: string[];
      combinedScore: number;
      confidence: number;
      processingTime: number;
      insights: string[];
    };
    enhancedMetadata: Record<string, any>;
  } {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    
    const insights: string[] = [];
    
    // Generate insights from ML results
    if (mlResult.mlModelResults.networkAnomaly?.isAnomalous) {
      insights.push(`Network anomaly detected with ${(mlResult.mlModelResults.networkAnomaly.confidence * 100).toFixed(1)}% confidence`);
    }
    
    if (mlResult.mlModelResults.behaviorAnalysis?.isAnomalous) {
      insights.push(`Behavioral anomaly detected: ${mlResult.mlModelResults.behaviorAnalysis.riskLevel} risk level`);
    }

    if (mlResult.mlMetadata.fallbackMode) {
      insights.push('Analysis performed in fallback mode - limited ML capabilities');
    }

    return {
      mlSummary: {
        modelsUsed: mlResult.mlMetadata.modelsUsed,
        combinedScore: mlResult.combinedThreatScore,
        confidence: mlResult.mlMetadata.confidence,
        processingTime: mlResult.mlMetadata.processingTime,
        insights
      },
      enhancedMetadata: finalConfig.includeMLMetadata ? {
        mlAnalysisId: mlResult.analysisId,
        mlTimestamp: mlResult.timestamp,
        networkAnomalyResult: mlResult.mlModelResults.networkAnomaly,
        behaviorAnalysisResult: mlResult.mlModelResults.behaviorAnalysis,
        fallbackMode: mlResult.mlMetadata.fallbackMode
      } : {}
    };
  }

  // Private helper methods

  /**
   * Extract normalized network features for ML analysis
   */
  private static extractNetworkFeatures(event: NetworkEventInput): number[] {
    return [
      this.normalizeFeature(event.bytes || 1500, 0, 100000), // packet_size
      this.normalizeFeature(event.frequency || 10, 0, 1000), // connection_frequency  
      this.normalizeFeature(this.extractPortDiversity(event), 0, 100), // port_diversity
      this.encodeProtocol(event.protocol || 'tcp'), // protocol_type
      this.normalizeFeature(this.calculateByteRate(event), 0, 10000000), // byte_rate
      this.normalizeFeature(event.duration || 300, 0, 7200), // connection_duration
      this.normalizeFeature(event.reputation || 0.5, 0, 1), // src_ip_reputation
      this.normalizeFeature(event.reputation || 0.5, 0, 1), // dst_ip_reputation
      this.extractTimeOfDay(event.timestamp), // time_of_day
      this.extractDayOfWeek(event.timestamp) // day_of_week
    ];
  }

  private static normalizeFeature(value: number, min: number, max: number): number {
    if (max === min) return 0;
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }

  private static encodeProtocol(protocol: string): number {
    const protocolMap: Record<string, number> = {
      'tcp': 1, 'udp': 2, 'icmp': 3, 'http': 4, 'https': 5
    };
    return protocolMap[protocol?.toLowerCase()] || 0;
  }

  private static extractPortDiversity(event: NetworkEventInput): number {
    // Simple heuristic - in real implementation this would analyze connection patterns
    return event.port ? 1 : 0;
  }

  private static calculateByteRate(event: NetworkEventInput): number {
    if (event.bytes && event.duration && event.duration > 0) {
      return event.bytes / event.duration;
    }
    return event.bytes || 50000;
  }

  private static extractTimeOfDay(timestamp?: string): number {
    const date = timestamp ? new Date(timestamp) : new Date();
    return date.getHours() / 23; // Normalize to 0-1
  }

  private static extractDayOfWeek(timestamp?: string): number {
    const date = timestamp ? new Date(timestamp) : new Date();
    return date.getDay() / 6; // Normalize to 0-1
  }

  private static mapToUserEventType(action: string): UserEvent['eventType'] {
    const actionMap: Record<string, UserEvent['eventType']> = {
      'login': 'login',
      'logout': 'logout',
      'authenticate': 'login',
      'file_access': 'file_access',
      'read_file': 'file_access',
      'write_file': 'file_access',
      'network_access': 'network_access',
      'http_request': 'network_access',
      'system_command': 'system_command',
      'execute_command': 'system_command',
      'data_transfer': 'data_transfer',
      'upload': 'data_transfer',
      'download': 'data_transfer',
      'permission_change': 'permission_change',
      'privilege_escalation': 'permission_change'
    };

    return actionMap[action?.toLowerCase()] || 'system_command';
  }

  private static mapRiskLevelToSeverity(riskLevel: string): ThreatEvent['severity'] {
    const severityMap: Record<string, ThreatEvent['severity']> = {
      'low': 'low',
      'medium': 'medium', 
      'high': 'high',
      'critical': 'critical'
    };
    return severityMap[riskLevel] || 'medium';
  }

  private static generateThreatDescription(
    result: AnomalyResult | { type: string; description: string },
    type: 'network' | 'behavioral'
  ): string {
    const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
    
    if ('explanation' in result && result.explanation) {
      return `ML ${capitalizedType} Anomaly: ${result.explanation}`;
    }
    
    if ('description' in result) {
      return `ML ${capitalizedType} Anomaly: ${result.description}`;
    }
    
    return `ML-detected ${type} threat requiring investigation`;
  }
}

/**
 * Event enrichment utilities
 */
export class EventEnrichmentUtils {
  /**
   * Enrich threat event with additional context
   */
  static enrichThreatEvent(
    event: ThreatEvent,
    context: {
      userInfo?: any;
      networkContext?: any;
      historicalData?: any;
    }
  ): ThreatEvent {
    const enrichedEvent = { ...event };

    // Add user context if available
    if (context.userInfo) {
      enrichedEvent.metadata = {
        ...enrichedEvent.metadata,
        userContext: {
          department: context.userInfo.department,
          role: context.userInfo.role,
          lastLogin: context.userInfo.lastLogin,
          riskProfile: context.userInfo.riskProfile
        }
      };
    }

    // Add network context
    if (context.networkContext) {
      enrichedEvent.metadata = {
        ...enrichedEvent.metadata,
        networkContext: {
          subnet: context.networkContext.subnet,
          vlan: context.networkContext.vlan,
          gateway: context.networkContext.gateway,
          asn: context.networkContext.asn
        }
      };
    }

    // Add historical context
    if (context.historicalData) {
      enrichedEvent.metadata = {
        ...enrichedEvent.metadata,
        historicalContext: {
          similarThreats: context.historicalData.similarThreats,
          userHistory: context.historicalData.userHistory,
          trendAnalysis: context.historicalData.trendAnalysis
        }
      };
    }

    return enrichedEvent;
  }

  /**
   * Calculate event correlation score between two events
   */
  static calculateCorrelationScore(event1: ThreatEvent, event2: ThreatEvent): number {
    let score = 0;

    // Same source
    if (event1.source === event2.source) score += 0.3;
    
    // Same target
    if (event1.target === event2.target) score += 0.3;
    
    // Similar severity
    if (event1.severity === event2.severity) score += 0.2;
    
    // Time proximity (within 1 hour)
    const timeDiff = Math.abs(
      new Date(event1.timestamp).getTime() - new Date(event2.timestamp).getTime()
    );
    if (timeDiff < 60 * 60 * 1000) score += 0.2;

    return Math.min(score, 1.0);
  }
}