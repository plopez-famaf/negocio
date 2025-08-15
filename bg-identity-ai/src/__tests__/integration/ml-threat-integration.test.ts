import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThreatDetectionService } from '@/services/threat-detection-service';
import { mlThreatDetectionService } from '@/services/ml-threat-detection-service';
import { MLThreatAdapters } from '@/adapters/ml-threat-adapters';
import { logger } from '@/lib/logger';

// Mock dependencies
vi.mock('@/lib/logger');
vi.mock('@/lib/compliance/compliance-manager');
vi.mock('@/lib/bg-web-client');
vi.mock('@/lib/redis-client', () => ({
  redisClient: {
    isReady: () => true,
    set: vi.fn(),
    get: vi.fn(),
    disconnect: vi.fn()
  }
}));
vi.mock('@/lib/cache/threat-cache', () => ({
  threatCache: {
    cacheThreatEvent: vi.fn(),
    cacheBehaviorBaseline: vi.fn(),
    cacheNetworkConnection: vi.fn(),
    cacheThreatIntelligence: vi.fn(),
    cacheCorrelationPattern: vi.fn()
  }
}));

describe('ML Threat Integration Tests', () => {
  let threatDetectionService: ThreatDetectionService;
  
  beforeEach(() => {
    vi.clearAllMocks();
    threatDetectionService = new ThreatDetectionService();
  });
  
  afterEach(async () => {
    await threatDetectionService.cleanup();
  });

  describe('ML Service Integration', () => {
    it('should initialize ML service successfully', async () => {
      // Spy on ML service initialization
      const initializeSpy = vi.spyOn(mlThreatDetectionService, 'initialize');
      const healthCheckSpy = vi.spyOn(mlThreatDetectionService, 'healthCheck')
        .mockResolvedValue({
          healthy: true,
          models: [
            { name: 'isolation-forest-v1', available: true },
            { name: 'user-behavior-v1', available: true }
          ],
          fallbackMode: false
        });

      // Manually trigger ML initialization
      await (threatDetectionService as any).initializeMLService();

      expect(initializeSpy).toHaveBeenCalled();
      expect(healthCheckSpy).toHaveBeenCalled();
    });

    it('should handle ML service initialization failure gracefully', async () => {
      const initializeSpy = vi.spyOn(mlThreatDetectionService, 'initialize')
        .mockRejectedValue(new Error('ML models not available'));

      await (threatDetectionService as any).initializeMLService();

      expect(initializeSpy).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'ML service initialization failed, continuing in traditional mode',
        expect.objectContaining({
          error: 'ML models not available'
        })
      );
    });

    it('should report ML service health status', async () => {
      const healthCheckResult = {
        healthy: true,
        models: [
          { name: 'isolation-forest-v1', available: true },
          { name: 'user-behavior-v1', available: false }
        ],
        fallbackMode: false
      };

      // Mock both initialization and health check calls
      vi.spyOn(mlThreatDetectionService, 'initialize').mockResolvedValue();
      const healthCheckSpy = vi.spyOn(mlThreatDetectionService, 'healthCheck')
        .mockResolvedValue(healthCheckResult);

      // Enable ML first - this will call healthCheck during initialization
      await (threatDetectionService as any).initializeMLService();

      // Now call getMLServiceHealth which should call healthCheck again
      const healthStatus = await threatDetectionService.getMLServiceHealth();

      expect(healthCheckSpy).toHaveBeenCalledTimes(2); // Once during init, once during health check
      expect(healthStatus).toEqual({
        enabled: true, // Should be true since healthCheck.healthy is true
        healthy: true,
        models: [
          { name: 'isolation-forest-v1', available: true },
          { name: 'user-behavior-v1', available: false }
        ],
        fallbackMode: false
      });
    });
  });

  describe('ML-Enhanced Threat Detection', () => {
    const mockEvents = [
      {
        id: 'event_1',
        timestamp: '2024-01-01T10:00:00Z',
        type: 'network',
        sourceIp: '192.168.1.100',
        destIp: '10.0.0.1',
        port: 443,
        protocol: 'tcp',
        bytes: 1500,
        frequency: 10
      },
      {
        id: 'event_2',
        timestamp: '2024-01-01T10:01:00Z',
        type: 'behavioral',
        userId: 'user123',
        action: 'file_access',
        sourceIp: '192.168.1.100',
        success: true
      }
    ];

    it('should perform ML threat analysis when ML is enabled', async () => {
      // Mock ML service to be enabled and healthy
      vi.spyOn(mlThreatDetectionService, 'initialize').mockResolvedValue();
      vi.spyOn(mlThreatDetectionService, 'healthCheck').mockResolvedValue({
        healthy: true,
        models: [{ name: 'isolation-forest-v1', available: true }],
        fallbackMode: false
      });

      const mockMLResult = {
        analysisId: 'ml_analysis_123',
        timestamp: '2024-01-01T10:00:00Z',
        mlModelResults: {
          networkAnomaly: {
            isAnomalous: true,
            anomalyScore: 0.8,
            confidence: 0.9,
            severity: 'high' as const,
            explanation: 'Suspicious network activity detected',
            networkMetadata: {
              inferenceTime: 50,
              features: ['packet_size', 'frequency']
            }
          }
        },
        combinedThreatScore: 8.0,
        threatEvents: [{
          id: 'ml_threat_123',
          timestamp: '2024-01-01T10:00:00Z',
          type: 'network' as const,
          severity: 'high' as const,
          source: '192.168.1.100',
          target: '10.0.0.1',
          description: 'ML Network Anomaly: Suspicious network activity detected',
          riskScore: 8.0,
          status: 'active' as const,
          metadata: {
            correlationId: 'ml_corr_123',
            source: 'ml-isolation-forest'
          }
        }],
        mlMetadata: {
          modelsUsed: ['isolation-forest-v1'],
          processingTime: 150,
          confidence: 0.9,
          fallbackMode: false
        }
      };

      const analyzeSpy = vi.spyOn(mlThreatDetectionService, 'analyzeThreatEvents')
        .mockResolvedValue(mockMLResult);

      // Initialize ML service
      await (threatDetectionService as any).initializeMLService();

      const result = await threatDetectionService.detectThreatsRealtime(
        mockEvents,
        'test-source',
        'user123'
      );

      expect(analyzeSpy).toHaveBeenCalledWith(
        mockEvents,
        'user123',
        expect.objectContaining({
          includeNetworkFeatures: true,
          includeBehavioralFeatures: true,
          timeWindowMinutes: 60,
          maxEventsPerAnalysis: 1000
        })
      );

      expect(result.threatsDetected).toBe(1);
      expect(result.threats).toHaveLength(1);
      expect(result.threats[0].description).toBe('ML Network Anomaly: Suspicious network activity detected');
      expect(result.summary.high).toBe(1);
    });

    it('should fallback to traditional detection when ML fails', async () => {
      // Mock ML service to fail during analysis
      vi.spyOn(mlThreatDetectionService, 'initialize').mockResolvedValue();
      vi.spyOn(mlThreatDetectionService, 'healthCheck').mockResolvedValue({
        healthy: true,
        models: [{ name: 'isolation-forest-v1', available: true }],
        fallbackMode: false
      });
      vi.spyOn(mlThreatDetectionService, 'analyzeThreatEvents')
        .mockRejectedValue(new Error('ML model inference failed'));

      // Initialize ML service
      await (threatDetectionService as any).initializeMLService();

      const result = await threatDetectionService.detectThreatsRealtime(
        mockEvents,
        'test-source',
        'user123'
      );

      expect(logger.warn).toHaveBeenCalledWith(
        'ML threat analysis failed, falling back to traditional detection',
        expect.objectContaining({
          error: 'ML model inference failed'
        })
      );

      expect(result).toBeDefined();
      expect(result.detectionId).toBeDefined();
      expect(Array.isArray(result.threats)).toBe(true);
    });

    it('should use traditional detection when ML is disabled', async () => {
      // Mock ML service to be disabled
      vi.spyOn(mlThreatDetectionService, 'initialize')
        .mockRejectedValue(new Error('ML models not available'));

      // Initialize ML service (will fail and disable ML)
      await (threatDetectionService as any).initializeMLService();

      const result = await threatDetectionService.detectThreatsRealtime(
        mockEvents,
        'test-source',
        'user123'
      );

      expect(result).toBeDefined();
      expect(result.detectionId).toBeDefined();
      expect(Array.isArray(result.threats)).toBe(true);
    });
  });

  describe('ML-Enhanced Behavioral Analysis', () => {
    const mockBehaviorRequest = {
      target: 'user123',
      timeRange: {
        start: '2024-01-01T09:00:00Z',
        end: '2024-01-01T17:00:00Z'
      },
      analysisType: 'user' as const,
      metrics: ['login_frequency', 'access_patterns']
    };

    it('should perform ML behavioral analysis for user requests', async () => {
      // Mock ML service to be enabled
      vi.spyOn(mlThreatDetectionService, 'initialize').mockResolvedValue();
      vi.spyOn(mlThreatDetectionService, 'healthCheck').mockResolvedValue({
        healthy: true,
        models: [{ name: 'user-behavior-v1', available: true }],
        fallbackMode: false
      });

      const mockBehaviorAnalysis = {
        userId: 'user123',
        isAnomalous: true,
        anomalyScore: 0.7,
        confidence: 0.85,
        riskLevel: 'medium',
        behaviorPatterns: {
          loginFrequency: 15,
          locationVariability: 0.3,
          dataAccessPatterns: 0.6,
          timeVariability: 0.4,
          resourceAccessDiversity: 0.5
        },
        anomalies: [{
          type: 'unusual_access_time',
          description: 'User accessed system outside normal hours',
          severity: 'medium' as const,
          timestamp: '2024-01-01T02:00:00Z',
          evidence: ['access_time: 2:00 AM', 'normal_hours: 9 AM - 5 PM']
        }],
        recommendations: ['Monitor after-hours access patterns', 'Review access policies']
      };

      const mockMLResult = {
        analysisId: 'ml_analysis_behavior_123',
        timestamp: '2024-01-01T10:00:00Z',
        mlModelResults: {
          behaviorAnalysis: mockBehaviorAnalysis
        },
        combinedThreatScore: 7.0,
        threatEvents: [],
        mlMetadata: {
          modelsUsed: ['user-behavior-v1'],
          processingTime: 200,
          confidence: 0.85,
          fallbackMode: false
        }
      };

      vi.spyOn(mlThreatDetectionService, 'analyzeThreatEvents')
        .mockResolvedValue(mockMLResult);

      // Mock MLThreatAdapters transformation
      const mockPatterns = [{
        id: 'ml_pattern_123',
        timestamp: '2024-01-01T10:00:00Z',
        target: 'user123',
        pattern: 'login_frequency_pattern',
        confidence: 0.85,
        anomalyScore: 0.7,
        baseline: { value: 5 },
        current: { value: 15 },
        deviations: ['unusual_access_time']
      }];

      vi.spyOn(MLThreatAdapters, 'transformToBehaviorPatterns')
        .mockReturnValue(mockPatterns);

      // Initialize ML service
      await (threatDetectionService as any).initializeMLService();

      const result = await threatDetectionService.analyzeBehavior(mockBehaviorRequest);

      expect(result).toBeDefined();
      expect(result.analysisId).toBeDefined();
      expect(result.target).toBe('user123');
      expect(result.patterns).toHaveLength(1);
      expect(result.patterns[0].pattern).toBe('login_frequency_pattern');
      expect(result.overallRiskScore).toBe(7.0);
      expect(result.anomalies).toBe(1);
      expect(result.recommendations).toContain('Monitor after-hours access patterns');
    });

    it('should fallback to traditional analysis for non-user requests', async () => {
      const systemRequest = {
        ...mockBehaviorRequest,
        analysisType: 'system' as const
      };

      // Initialize ML service
      vi.spyOn(mlThreatDetectionService, 'initialize').mockResolvedValue();
      vi.spyOn(mlThreatDetectionService, 'healthCheck').mockResolvedValue({
        healthy: true,
        models: [{ name: 'user-behavior-v1', available: true }],
        fallbackMode: false
      });
      await (threatDetectionService as any).initializeMLService();

      const result = await threatDetectionService.analyzeBehavior(systemRequest);

      expect(result).toBeDefined();
      expect(result.analysisId).toBeDefined();
      expect(result.target).toBe('user123');
      expect(Array.isArray(result.patterns)).toBe(true);
      expect(typeof result.overallRiskScore).toBe('number');
    });

    it('should handle ML behavioral analysis failures gracefully', async () => {
      // Mock ML service to fail during behavioral analysis
      vi.spyOn(mlThreatDetectionService, 'initialize').mockResolvedValue();
      vi.spyOn(mlThreatDetectionService, 'healthCheck').mockResolvedValue({
        healthy: true,
        models: [{ name: 'user-behavior-v1', available: true }],
        fallbackMode: false
      });
      vi.spyOn(mlThreatDetectionService, 'analyzeThreatEvents')
        .mockRejectedValue(new Error('UBA model inference failed'));

      // Initialize ML service
      await (threatDetectionService as any).initializeMLService();

      const result = await threatDetectionService.analyzeBehavior(mockBehaviorRequest);

      expect(logger.warn).toHaveBeenCalledWith(
        'ML behavioral analysis failed, falling back to traditional analysis',
        expect.objectContaining({
          error: 'UBA model inference failed'
        })
      );

      expect(result).toBeDefined();
      expect(result.analysisId).toBeDefined();
      expect(Array.isArray(result.patterns)).toBe(true);
    });
  });

  describe('ML Event Transformation', () => {
    it('should generate appropriate mock events for behavioral analysis', () => {
      const userId = 'test-user';
      const timeRange = {
        start: '2024-01-01T09:00:00Z',
        end: '2024-01-01T17:00:00Z'
      };

      const events = (threatDetectionService as any).generateMockEventsForTimeRange(userId, timeRange);

      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThan(0);
      
      events.forEach((event: any) => {
        expect(event.id).toBeDefined();
        expect(event.timestamp).toBeDefined();
        expect(event.userId).toBe(userId);
        expect(event.type).toBe('behavioral');
        expect(['login', 'file_access', 'network_access', 'system_command', 'data_transfer'])
          .toContain(event.action);
        
        const eventTime = new Date(event.timestamp).getTime();
        const startTime = new Date(timeRange.start).getTime();
        const endTime = new Date(timeRange.end).getTime();
        expect(eventTime).toBeGreaterThanOrEqual(startTime);
        expect(eventTime).toBeLessThanOrEqual(endTime);
      });
    });

    it('should calculate time window correctly', () => {
      const timeRange = {
        start: '2024-01-01T09:00:00Z',
        end: '2024-01-01T17:00:00Z'
      };

      const timeWindowMinutes = (threatDetectionService as any).calculateTimeWindowMinutes(timeRange);

      expect(timeWindowMinutes).toBe(480); // 8 hours = 480 minutes
    });
  });

  describe('Service Cleanup', () => {
    it('should cleanup ML service during shutdown', async () => {
      const mlCleanupSpy = vi.spyOn(mlThreatDetectionService, 'cleanup').mockResolvedValue();

      // Mock ML service as enabled
      vi.spyOn(mlThreatDetectionService, 'initialize').mockResolvedValue();
      vi.spyOn(mlThreatDetectionService, 'healthCheck').mockResolvedValue({
        healthy: true,
        models: [{ name: 'isolation-forest-v1', available: true }],
        fallbackMode: false
      });
      await (threatDetectionService as any).initializeMLService();

      await threatDetectionService.cleanup();

      expect(mlCleanupSpy).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'ThreatDetectionService cleanup completed',
        expect.objectContaining({
          mlServiceCleaned: true
        })
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      const mlCleanupSpy = vi.spyOn(mlThreatDetectionService, 'cleanup')
        .mockRejectedValue(new Error('ML cleanup failed'));

      // Mock ML service as enabled
      vi.spyOn(mlThreatDetectionService, 'initialize').mockResolvedValue();
      vi.spyOn(mlThreatDetectionService, 'healthCheck').mockResolvedValue({
        healthy: true,
        models: [{ name: 'isolation-forest-v1', available: true }],
        fallbackMode: false
      });
      await (threatDetectionService as any).initializeMLService();

      await threatDetectionService.cleanup();

      expect(mlCleanupSpy).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'ThreatDetectionService cleanup encountered errors',
        expect.objectContaining({
          error: 'ML cleanup failed'
        })
      );
    });
  });
});