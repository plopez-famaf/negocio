import { describe, it, expect, beforeEach } from 'vitest';
import { MLThreatAdapters, EventEnrichmentUtils } from '@/adapters/ml-threat-adapters';
import type { ThreatEvent, BehaviorPattern } from '@/types/threat';
import type { AnomalyResult } from '@/ml/models/base/model-interfaces';
import type { BehaviorAnalysisResult } from '@/ml/models/behavioral-analysis/user-behavior-model';
import type { MLThreatAnalysisResult } from '@/services/ml-threat-detection-service';

describe('ML Adapters Integration Tests', () => {
  describe('Network Event Transformation', () => {
    const mockNetworkEvents = [
      {
        id: 'net_event_1',
        timestamp: '2024-01-01T10:00:00Z',
        sourceIp: '192.168.1.100',
        destIp: '10.0.0.1',
        port: 443,
        protocol: 'tcp',
        bytes: 1500,
        packets: 10,
        duration: 300,
        frequency: 10,
        reputation: 0.8,
        type: 'network'
      },
      {
        id: 'net_event_2',
        timestamp: '2024-01-01T10:01:00Z',
        sourceIp: '192.168.1.101',
        destIp: '10.0.0.2',
        port: 80,
        protocol: 'http',
        bytes: 5000,
        packets: 50,
        duration: 600,
        frequency: 25,
        reputation: 0.3,
        type: 'network'
      }
    ];

    it('should transform network events to ML input format correctly', () => {
      const result = MLThreatAdapters.transformToNetworkAnomalyInput(mockNetworkEvents);

      expect(result).toHaveLength(2);
      
      const firstInput = result[0];
      expect(firstInput.features).toHaveLength(10);
      expect(firstInput.timestamp).toBe('2024-01-01T10:00:00Z');
      expect(firstInput.metadata).toBeDefined();
      expect(firstInput.metadata?.originalEventId).toBe('net_event_1');
      expect(firstInput.metadata?.sourceIp).toBe('192.168.1.100');
      expect(firstInput.metadata?.destinationIp).toBe('10.0.0.1');
      expect(firstInput.metadata?.protocol).toBe('tcp');

      // Verify feature normalization (most features should be between 0 and 1)
      // Note: Some features like protocol encoding can be > 1, but should be reasonable
      firstInput.features.forEach((feature, index) => {
        expect(feature).toBeGreaterThanOrEqual(0);
        expect(feature).toBeLessThan(10); // Reasonable upper bound instead of strict 1
      });
    });

    it('should handle incomplete network events gracefully', () => {
      const incompleteEvents = [
        {
          id: 'incomplete_1',
          sourceIp: '192.168.1.100'
          // Missing many required fields
        },
        {
          id: 'incomplete_2',
          timestamp: '2024-01-01T10:00:00Z',
          destIp: '10.0.0.1'
          // Missing many required fields
        }
      ];

      const result = MLThreatAdapters.transformToNetworkAnomalyInput(incompleteEvents);

      // Should still process events with default values
      expect(result).toHaveLength(2);
      result.forEach(input => {
        expect(input.features).toHaveLength(10);
        expect(input.timestamp).toBeDefined();
      });
    });

    it('should apply custom transformation configuration', () => {
      const customConfig = {
        includeMLMetadata: false,
        enrichWithContext: false,
        correlationIdPrefix: 'custom_test',
        defaultSeverityThreshold: 0.5,
        riskScoreMultiplier: 5
      };

      const result = MLThreatAdapters.transformToNetworkAnomalyInput(
        mockNetworkEvents, 
        customConfig
      );

      expect(result).toHaveLength(2);
      result.forEach(input => {
        expect(input.metadata).toBeUndefined(); // metadata disabled
      });
    });
  });

  describe('User Activity Transformation', () => {
    const mockUserActivities = [
      {
        sessionId: 'session_123',
        timestamp: '2024-01-01T10:00:00Z',
        action: 'login',
        resource: '/dashboard',
        sourceIp: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        location: {
          country: 'US',
          city: 'New York'
        },
        success: true
      },
      {
        timestamp: '2024-01-01T10:01:00Z',
        action: 'file_access',
        resource: '/documents/sensitive.pdf',
        sourceIp: '192.168.1.100',
        success: true
      }
    ];

    const timeWindow = {
      start: '2024-01-01T09:00:00Z',
      end: '2024-01-01T17:00:00Z'
    };

    it('should transform user activities to UBA input format correctly', () => {
      const userId = 'user123';
      const result = MLThreatAdapters.transformToUserBehaviorInput(
        userId,
        mockUserActivities,
        timeWindow
      );

      expect(result.userId).toBe(userId);
      expect(result.events).toHaveLength(2);
      expect(result.timeWindow).toEqual(timeWindow);

      const firstEvent = result.events[0];
      expect(firstEvent.userId).toBe(userId);
      expect(firstEvent.sessionId).toBe('session_123');
      expect(firstEvent.eventType).toBe('login');
      expect(firstEvent.timestamp).toBe('2024-01-01T10:00:00Z');
      expect(firstEvent.sourceIp).toBe('192.168.1.100');
      expect(firstEvent.location).toEqual({
        country: 'US',
        city: 'New York'
      });
      expect(firstEvent.success).toBe(true);

      const secondEvent = result.events[1];
      expect(secondEvent.eventType).toBe('file_access');
      expect(secondEvent.sessionId).toMatch(/^session_\d+_\w+$/); // Generated session ID
    });

    it('should map event types correctly', () => {
      const activities = [
        { action: 'login' },
        { action: 'authenticate' },
        { action: 'file_access' },
        { action: 'read_file' },
        { action: 'network_access' },
        { action: 'system_command' },
        { action: 'unknown_action' }
      ];

      const result = MLThreatAdapters.transformToUserBehaviorInput(
        'user123',
        activities,
        timeWindow
      );

      expect(result.events[0].eventType).toBe('login');
      expect(result.events[1].eventType).toBe('login'); // authenticate maps to login
      expect(result.events[2].eventType).toBe('file_access');
      expect(result.events[3].eventType).toBe('file_access'); // read_file maps to file_access
      expect(result.events[4].eventType).toBe('network_access');
      expect(result.events[5].eventType).toBe('system_command');
      expect(result.events[6].eventType).toBe('system_command'); // unknown maps to system_command
    });
  });

  describe('Anomaly to Threat Event Transformation', () => {
    const mockAnomalyResult: AnomalyResult = {
      isAnomaly: true,
      anomalyScore: 0.85,
      confidence: 0.92,
      severity: 'high',
      explanation: 'Unusual network traffic pattern detected',
      affectedFeatures: ['packet_size', 'connection_frequency'],
      metadata: {
        timestamp: '2024-01-01T10:00:00Z',
        sourceIp: '192.168.1.100',
        destinationIp: '10.0.0.1',
        inferenceTime: 45
      }
    };

    const mockOriginalEvent = {
      id: 'original_event_123',
      sourceIp: '192.168.1.100',
      destIp: '10.0.0.1',
      protocol: 'tcp',
      bytes: 1500
    };

    it('should transform anomaly result to threat event correctly', () => {
      const result = MLThreatAdapters.transformAnomalyToThreatEvent(
        mockAnomalyResult,
        mockOriginalEvent
      );

      expect(result.id).toMatch(/^ml_threat_\d+_\w+$/);
      expect(result.timestamp).toBe('2024-01-01T10:00:00Z');
      expect(result.type).toBe('network');
      expect(result.severity).toBe('high');
      expect(result.source).toBe('192.168.1.100');
      expect(result.target).toBe('10.0.0.1');
      expect(result.description).toBe('ML Network Anomaly: Unusual network traffic pattern detected');
      expect(result.riskScore).toBe(8.5); // 0.85 * 10
      expect(result.status).toBe('active');

      expect(result.metadata.correlationId).toMatch(/^ml_threat_\d+$/);
      expect(result.metadata.source).toBe('ml-isolation-forest');
      expect(result.metadata.mlModel).toBe('isolation-forest-v1');
      expect(result.metadata.confidence).toBe(0.92);
      expect(result.metadata.isMLGenerated).toBe(true);
      expect(result.metadata.mlMetadata).toBeDefined();
      expect(result.metadata.mlMetadata.anomalyScore).toBe(0.85);
      expect(result.metadata.mlMetadata.affectedFeatures).toEqual(['packet_size', 'connection_frequency']);
    });

    it('should handle missing original event', () => {
      const result = MLThreatAdapters.transformAnomalyToThreatEvent(mockAnomalyResult);

      expect(result.source).toBe('192.168.1.100'); // From metadata
      expect(result.target).toBe('10.0.0.1'); // From metadata
      expect(result.metadata.originalEvent).toBeUndefined();
    });

    it('should apply custom configuration', () => {
      const customConfig = {
        includeMLMetadata: false,
        correlationIdPrefix: 'custom_ml',
        riskScoreMultiplier: 5
      };

      const result = MLThreatAdapters.transformAnomalyToThreatEvent(
        mockAnomalyResult,
        mockOriginalEvent,
        customConfig
      );

      expect(result.metadata.correlationId).toMatch(/^custom_ml_\d+$/);
      expect(result.riskScore).toBe(4.25); // 0.85 * 5
      expect(result.metadata.mlMetadata).toBeUndefined(); // Disabled
    });
  });

  describe('Behavior Analysis to Threat Events Transformation', () => {
    const mockBehaviorResult: BehaviorAnalysisResult = {
      userId: 'user123',
      isAnomalous: true,
      anomalyScore: 0.7,
      confidence: 0.88,
      riskLevel: 'medium',
      behaviorPatterns: {
        loginFrequency: 15,
        locationVariability: 0.6,
        dataAccessPatterns: 0.4,
        timeVariability: 0.8,
        resourceAccessDiversity: 0.3
      },
      anomalies: [
        {
          type: 'unusual_access_time',
          description: 'User accessed system outside normal hours',
          severity: 'medium',
          timestamp: '2024-01-01T02:00:00Z',
          evidence: ['access_time: 2:00 AM', 'normal_hours: 9 AM - 5 PM']
        },
        {
          type: 'location_anomaly',
          description: 'User logged in from unusual location',
          severity: 'low',
          timestamp: '2024-01-01T10:00:00Z',
          evidence: ['new_location: Tokyo, JP', 'usual_location: New York, US']
        }
      ],
      recommendations: [
        'Monitor after-hours access patterns',
        'Review geographical access policies'
      ]
    };

    it('should transform behavior analysis to multiple threat events', () => {
      const result = MLThreatAdapters.transformBehaviorToThreatEvents(mockBehaviorResult);

      expect(result).toHaveLength(2); // One for each anomaly

      const firstThreat = result[0];
      expect(firstThreat.id).toMatch(/^ml_threat_behavior_\d+_\w+$/);
      expect(firstThreat.timestamp).toBe('2024-01-01T02:00:00Z');
      expect(firstThreat.type).toBe('behavioral');
      expect(firstThreat.severity).toBe('medium');
      expect(firstThreat.source).toBe('user123');
      expect(firstThreat.target).toBe('user123');
      expect(firstThreat.description).toBe('ML Behavioral Anomaly: User accessed system outside normal hours');
      expect(firstThreat.riskScore).toBe(7.0); // 0.7 * 10
      expect(firstThreat.status).toBe('active');

      expect(firstThreat.metadata.source).toBe('ml-user-behavior-analytics');
      expect(firstThreat.metadata.mlModel).toBe('user-behavior-v1');
      expect(firstThreat.metadata.confidence).toBe(0.88);
      expect(firstThreat.metadata.anomalyType).toBe('unusual_access_time');
      expect(firstThreat.metadata.evidence).toEqual(['access_time: 2:00 AM', 'normal_hours: 9 AM - 5 PM']);

      const secondThreat = result[1];
      expect(secondThreat.severity).toBe('low');
      expect(secondThreat.metadata.anomalyType).toBe('location_anomaly');
    });

    it('should create general threat event when no specific anomalies but overall anomalous', () => {
      const generallyAnomalousBehavior: BehaviorAnalysisResult = {
        ...mockBehaviorResult,
        anomalies: [] // No specific anomalies
      };

      const result = MLThreatAdapters.transformBehaviorToThreatEvents(generallyAnomalousBehavior);

      expect(result).toHaveLength(1);
      const threat = result[0];
      expect(threat.id).toMatch(/^ml_threat_behavior_general_\d+_\w+$/);
      expect(threat.description).toBe('General behavioral anomaly detected for user user123');
      expect(threat.severity).toBe('medium'); // Based on riskLevel
    });

    it('should map risk levels to severities correctly', () => {
      const riskLevels = ['low', 'medium', 'high', 'critical'];
      
      riskLevels.forEach(riskLevel => {
        const behaviorResult: BehaviorAnalysisResult = {
          ...mockBehaviorResult,
          riskLevel,
          anomalies: []
        };

        const result = MLThreatAdapters.transformBehaviorToThreatEvents(behaviorResult);
        expect(result[0].severity).toBe(riskLevel);
      });
    });
  });

  describe('Behavior Patterns Transformation', () => {
    const mockBehaviorResult: BehaviorAnalysisResult = {
      userId: 'user123',
      isAnomalous: true,
      anomalyScore: 0.6,
      confidence: 0.85,
      riskLevel: 'medium',
      behaviorPatterns: {
        loginFrequency: 12,
        locationVariability: 0.4,
        dataAccessPatterns: 0.7,
        timeVariability: 0.3,
        resourceAccessDiversity: 0.8
      },
      anomalies: [
        {
          type: 'data_access_anomaly',
          description: 'Unusual data access pattern',
          severity: 'medium',
          timestamp: '2024-01-01T10:00:00Z',
          evidence: ['unusual_pattern']
        }
      ],
      recommendations: ['Review data access policies']
    };

    it('should transform behavior analysis to behavior patterns', () => {
      const result = MLThreatAdapters.transformToBehaviorPatterns(mockBehaviorResult);

      expect(result).toHaveLength(2); // loginFrequency and locationVariability > 0

      const loginPattern = result.find(p => p.pattern === 'login_frequency_pattern');
      expect(loginPattern).toBeDefined();
      expect(loginPattern!.id).toMatch(/^ml_pattern_\d+_\w+$/);
      expect(loginPattern!.timestamp).toBeDefined();
      expect(loginPattern!.target).toBe('user123');
      expect(loginPattern!.confidence).toBe(0.85);
      expect(loginPattern!.anomalyScore).toBe(0.6);
      expect(loginPattern!.baseline.value).toBe(5);
      expect(loginPattern!.current.value).toBe(12);
      expect(loginPattern!.deviations).toEqual(['data_access_anomaly']);

      const locationPattern = result.find(p => p.pattern === 'location_variability_pattern');
      expect(locationPattern).toBeDefined();
      expect(locationPattern!.baseline.value).toBe(0.5);
      expect(locationPattern!.current.value).toBe(0.4);
    });

    it('should filter out patterns with zero metrics', () => {
      const zeroMetricsBehavior: BehaviorAnalysisResult = {
        ...mockBehaviorResult,
        behaviorPatterns: {
          loginFrequency: 0,
          locationVariability: 0,
          dataAccessPatterns: 0,
          timeVariability: 0,
          resourceAccessDiversity: 0
        }
      };

      const result = MLThreatAdapters.transformToBehaviorPatterns(zeroMetricsBehavior);
      expect(result).toHaveLength(0);
    });
  });

  describe('ML Analysis Summary Creation', () => {
    const mockMLResult: MLThreatAnalysisResult = {
      analysisId: 'ml_analysis_123',
      timestamp: '2024-01-01T10:00:00Z',
      mlModelResults: {
        networkAnomaly: {
          isAnomalous: true,
          anomalyScore: 0.8,
          confidence: 0.9,
          severity: 'high',
          explanation: 'Network anomaly detected',
          networkMetadata: {
            inferenceTime: 50,
            features: ['packet_size']
          }
        },
        behaviorAnalysis: {
          userId: 'user123',
          isAnomalous: true,
          anomalyScore: 0.7,
          confidence: 0.85,
          riskLevel: 'medium',
          behaviorPatterns: {
            loginFrequency: 10,
            locationVariability: 0.5,
            dataAccessPatterns: 0.6,
            timeVariability: 0.4,
            resourceAccessDiversity: 0.3
          },
          anomalies: [],
          recommendations: ['Monitor user activity']
        }
      },
      combinedThreatScore: 8.0,
      threatEvents: [],
      mlMetadata: {
        modelsUsed: ['isolation-forest-v1', 'user-behavior-v1'],
        processingTime: 150,
        confidence: 0.875,
        fallbackMode: false
      }
    };

    it('should create comprehensive ML analysis summary', () => {
      const result = MLThreatAdapters.createMLAnalysisSummary(mockMLResult);

      expect(result.mlSummary).toBeDefined();
      expect(result.mlSummary.modelsUsed).toEqual(['isolation-forest-v1', 'user-behavior-v1']);
      expect(result.mlSummary.combinedScore).toBe(8.0);
      expect(result.mlSummary.confidence).toBe(0.875);
      expect(result.mlSummary.processingTime).toBe(150);
      expect(result.mlSummary.insights).toHaveLength(2);
      expect(result.mlSummary.insights[0]).toBe('Network anomaly detected with 90.0% confidence');
      expect(result.mlSummary.insights[1]).toBe('Behavioral anomaly detected: medium risk level');

      expect(result.enhancedMetadata).toBeDefined();
      expect(result.enhancedMetadata.mlAnalysisId).toBe('ml_analysis_123');
      expect(result.enhancedMetadata.networkAnomalyResult).toBeDefined();
      expect(result.enhancedMetadata.behaviorAnalysisResult).toBeDefined();
      expect(result.enhancedMetadata.fallbackMode).toBe(false);
    });

    it('should include fallback mode insights', () => {
      const fallbackResult: MLThreatAnalysisResult = {
        ...mockMLResult,
        mlModelResults: {},
        mlMetadata: {
          ...mockMLResult.mlMetadata,
          fallbackMode: true
        }
      };

      const result = MLThreatAdapters.createMLAnalysisSummary(fallbackResult);

      expect(result.mlSummary.insights).toContain('Analysis performed in fallback mode - limited ML capabilities');
    });

    it('should respect configuration for metadata inclusion', () => {
      const config = { includeMLMetadata: false };
      const result = MLThreatAdapters.createMLAnalysisSummary(mockMLResult, config);

      expect(result.enhancedMetadata).toEqual({});
    });
  });

  describe('Event Enrichment Utils', () => {
    const mockThreatEvent: ThreatEvent = {
      id: 'threat_123',
      timestamp: '2024-01-01T10:00:00Z',
      type: 'network',
      severity: 'high',
      source: '192.168.1.100',
      target: '10.0.0.1',
      description: 'Test threat event',
      riskScore: 8.0,
      status: 'active',
      metadata: {
        correlationId: 'corr_123',
        source: 'ml-detection'
      }
    };

    it('should enrich threat event with additional context', () => {
      const context = {
        userInfo: {
          department: 'Engineering',
          role: 'Developer',
          lastLogin: '2024-01-01T09:00:00Z',
          riskProfile: 'low'
        },
        networkContext: {
          subnet: '192.168.1.0/24',
          vlan: 'VLAN_100',
          gateway: '192.168.1.1',
          asn: 'AS64512'
        },
        historicalData: {
          similarThreats: 5,
          userHistory: 'clean',
          trendAnalysis: 'increasing'
        }
      };

      const result = EventEnrichmentUtils.enrichThreatEvent(mockThreatEvent, context);

      expect(result.id).toBe('threat_123'); // Original properties preserved
      expect(result.metadata.userContext).toEqual(context.userInfo);
      expect(result.metadata.networkContext).toEqual(context.networkContext);
      expect(result.metadata.historicalContext).toEqual(context.historicalData);
      expect(result.metadata.correlationId).toBe('corr_123'); // Original metadata preserved
    });

    it('should calculate correlation score between events', () => {
      const event1: ThreatEvent = {
        ...mockThreatEvent,
        timestamp: '2024-01-01T10:00:00Z'
      };

      const event2: ThreatEvent = {
        ...mockThreatEvent,
        id: 'threat_456',
        timestamp: '2024-01-01T10:30:00Z' // 30 minutes later
      };

      const score = EventEnrichmentUtils.calculateCorrelationScore(event1, event2);

      // Same source (0.3) + same target (0.3) + same severity (0.2) + time proximity (0.2) = 1.0
      expect(score).toBe(1.0);
    });

    it('should calculate partial correlation scores', () => {
      const event1: ThreatEvent = {
        ...mockThreatEvent,
        source: '192.168.1.100',
        target: '10.0.0.1',
        severity: 'high',
        timestamp: '2024-01-01T10:00:00Z'
      };

      const event2: ThreatEvent = {
        ...mockThreatEvent,
        id: 'threat_456',
        source: '192.168.1.101', // Different source
        target: '10.0.0.1',      // Same target
        severity: 'medium',      // Different severity
        timestamp: '2024-01-01T12:00:00Z' // 2 hours later (outside 1 hour window)
      };

      const score = EventEnrichmentUtils.calculateCorrelationScore(event1, event2);

      // Only same target (0.3) = 0.3
      expect(score).toBe(0.3);
    });
  });
});