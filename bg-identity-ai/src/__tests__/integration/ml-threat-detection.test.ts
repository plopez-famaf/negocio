import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { IsolationForestModel } from '@/ml/models/anomaly-detection/isolation-forest-model';
import { mlModelRegistry } from '@/ml/models/base/model-registry';
import { ThreatDetectionService } from '@/services/threat-detection-service';
import { AnomalyDetectionInput, ModelType } from '@/ml/models/base/model-interfaces';

describe('ML Threat Detection Integration', () => {
  let isolationForest: IsolationForestModel;
  let threatService: ThreatDetectionService;

  beforeAll(async () => {
    // Initialize ML components
    await mlModelRegistry.initialize();
    
    isolationForest = new IsolationForestModel();
    await isolationForest.initialize();
    await mlModelRegistry.registerModel(isolationForest);

    threatService = new ThreatDetectionService();
  });

  afterAll(async () => {
    await mlModelRegistry.cleanup();
  });

  describe('Model Registry Integration', () => {
    it('should register and retrieve ML models correctly', async () => {
      // Verify model is registered
      const registeredModel = mlModelRegistry.getModel('isolation-forest-v1');
      expect(registeredModel).toBeDefined();
      expect(registeredModel?.modelId).toBe('isolation-forest-v1');

      // Verify model can be retrieved by type
      const anomalyModels = mlModelRegistry.getModelsByType(ModelType.ANOMALY_DETECTION);
      expect(anomalyModels.length).toBeGreaterThan(0);
      expect(anomalyModels.some(model => model.modelId === 'isolation-forest-v1')).toBe(true);
    });

    it('should provide accurate registry statistics', async () => {
      const stats = mlModelRegistry.getRegistryStats();

      expect(stats.totalModels).toBeGreaterThan(0);
      expect(stats.modelsByType[ModelType.ANOMALY_DETECTION]).toBeGreaterThan(0);
      expect(stats.averageAccuracy).toBeGreaterThanOrEqual(0);
      expect(stats.averageAccuracy).toBeLessThanOrEqual(1);
    });

    it('should perform comprehensive health checks', async () => {
      const healthCheck = await mlModelRegistry.performHealthCheck();

      expect(healthCheck.healthy).toBeDefined();
      expect(healthCheck.models).toBeDefined();
      expect(healthCheck.models.length).toBeGreaterThan(0);

      const isolationForestHealth = healthCheck.models.find(
        model => model.modelId === 'isolation-forest-v1'
      );

      expect(isolationForestHealth).toBeDefined();
      expect(isolationForestHealth?.isLoaded).toBe(true);
    });
  });

  describe('End-to-End ML Pipeline', () => {
    it('should process network events through ML pipeline', async () => {
      const networkEvents = [
        {
          id: 'ml-test-1',
          timestamp: new Date().toISOString(),
          type: 'network' as const,
          severity: 'medium' as const,
          source: 'firewall',
          target: '192.168.1.100',
          description: 'Suspicious network activity',
          riskScore: 0.6,
          status: 'active' as const,
          metadata: {
            packetSize: 5000,
            connectionFrequency: 50,
            portDiversity: 15,
            protocol: 'tcp',
            byteRate: 500000,
            connectionDuration: 30,
            srcIpReputation: 0.3,
            dstIpReputation: 0.8
          }
        }
      ];

      // Process events through threat detection service
      const detectionResult = await threatService.detectThreatsRealtime(
        networkEvents,
        'ml-integration-test',
        'test-user'
      );

      expect(detectionResult).toBeDefined();
      expect(detectionResult.detectionId).toBeDefined();
      expect(detectionResult.threatsDetected).toBeGreaterThanOrEqual(0);
      expect(detectionResult.threats).toBeDefined();
      expect(Array.isArray(detectionResult.threats)).toBe(true);

      // Verify ML processing occurred
      if (detectionResult.threats.length > 0) {
        const threat = detectionResult.threats[0];
        expect(threat.riskScore).toBeGreaterThanOrEqual(0);
        expect(threat.riskScore).toBeLessThanOrEqual(10);
        expect(threat.metadata).toBeDefined();
      }
    });

    it('should handle batch processing of multiple events', async () => {
      const batchEvents = Array.from({ length: 20 }, (_, index) => ({
        id: `ml-batch-test-${index}`,
        timestamp: new Date().toISOString(),
        type: 'network' as const,
        severity: 'medium' as const,
        source: 'batch-test',
        description: `Batch test event ${index}`,
        riskScore: Math.random(),
        status: 'active' as const,
        metadata: {
          packetSize: 1000 + index * 100,
          connectionFrequency: 10 + index,
          portDiversity: Math.floor(index / 3),
          protocol: index % 2 === 0 ? 'tcp' : 'udp',
          byteRate: 50000 + index * 1000,
          connectionDuration: 100 + index * 10,
          srcIpReputation: 0.5 + (index % 10) * 0.05,
          dstIpReputation: 0.4 + (index % 8) * 0.075
        }
      }));

      const startTime = Date.now();
      
      const results = await Promise.all(
        batchEvents.map(event => 
          threatService.detectThreatsRealtime([event], 'ml-batch-test', 'test-user')
        )
      );

      const endTime = Date.now();
      const processingTime = endTime - startTime;
      const avgTimePerEvent = processingTime / batchEvents.length;

      expect(results.length).toBe(batchEvents.length);
      expect(results.every(result => result.detectionId)).toBe(true);
      expect(avgTimePerEvent).toBeLessThan(200); // Target: <200ms per event including ML

      console.log(`Batch Processing Results:
        Events processed: ${batchEvents.length}
        Total time: ${processingTime}ms
        Average time per event: ${avgTimePerEvent.toFixed(2)}ms
      `);
    });
  });

  describe('ML-Enhanced Threat Detection', () => {
    it('should detect anomalous patterns in network behavior', async () => {
      // Create obviously anomalous network event
      const anomalousEvent = {
        id: 'anomaly-test-1',
        timestamp: new Date().toISOString(),
        type: 'network' as const,
        severity: 'high' as const,
        source: 'ml-anomaly-test',
        description: 'Highly suspicious network activity',
        riskScore: 0.9,
        status: 'active' as const,
        metadata: {
          packetSize: 100000,    // Very large packets
          connectionFrequency: 1000, // Very high frequency
          portDiversity: 50,     // Many different ports
          protocol: 'unknown',   // Unknown protocol
          byteRate: 10000000,    // Very high byte rate
          connectionDuration: 1, // Very short duration
          srcIpReputation: 0.1,  // Poor reputation
          dstIpReputation: 0.1   // Poor reputation
        }
      };

      const result = await threatService.detectThreatsRealtime(
        [anomalousEvent],
        'anomaly-detection-test',
        'test-user'
      );

      expect(result.threatsDetected).toBeGreaterThan(0);
      expect(result.overallRiskScore).toBeGreaterThan(0.7);

      if (result.threats.length > 0) {
        const detectedThreat = result.threats[0];
        expect(detectedThreat.severity).toMatch(/high|critical/);
        expect(detectedThreat.riskScore).toBeGreaterThan(7);
      }
    });

    it('should handle normal traffic without false alarms', async () => {
      // Create normal network events
      const normalEvents = Array.from({ length: 10 }, (_, index) => ({
        id: `normal-test-${index}`,
        timestamp: new Date().toISOString(),
        type: 'network' as const,
        severity: 'low' as const,
        source: 'ml-normal-test',
        description: 'Normal network activity',
        riskScore: 0.2,
        status: 'active' as const,
        metadata: {
          packetSize: 1400 + Math.random() * 200,    // Normal packet sizes
          connectionFrequency: 8 + Math.random() * 4, // Normal frequency
          portDiversity: 2 + Math.floor(Math.random() * 3), // Normal diversity
          protocol: 'tcp',
          byteRate: 45000 + Math.random() * 10000,   // Normal byte rate
          connectionDuration: 250 + Math.random() * 100, // Normal duration
          srcIpReputation: 0.7 + Math.random() * 0.2, // Good reputation
          dstIpReputation: 0.6 + Math.random() * 0.3  // Good reputation
        }
      }));

      const results = await Promise.all(
        normalEvents.map(event => 
          threatService.detectThreatsRealtime([event], 'normal-traffic-test', 'test-user')
        )
      );

      // Most normal events should not trigger high-risk alerts
      const highRiskDetections = results.filter(result => result.overallRiskScore > 0.8);
      const falseAlarmRate = highRiskDetections.length / results.length;

      console.log(`Normal Traffic Analysis:
        Total events: ${normalEvents.length}
        High-risk detections: ${highRiskDetections.length}
        False alarm rate: ${(falseAlarmRate * 100).toFixed(1)}%
      `);

      expect(falseAlarmRate).toBeLessThan(0.2); // <20% false alarm rate for normal traffic
    });
  });

  describe('ML Model Performance Integration', () => {
    it('should maintain performance targets in integrated environment', async () => {
      const testEvent = {
        id: 'performance-test',
        timestamp: new Date().toISOString(),
        type: 'network' as const,
        severity: 'medium' as const,
        source: 'performance-test',
        description: 'Performance test event',
        riskScore: 0.5,
        status: 'active' as const,
        metadata: {
          packetSize: 1500,
          connectionFrequency: 10,
          portDiversity: 3,
          protocol: 'tcp',
          byteRate: 50000,
          connectionDuration: 300,
          srcIpReputation: 0.7,
          dstIpReputation: 0.8
        }
      };

      // Test performance under load
      const concurrent = 50;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrent }, () =>
        threatService.detectThreatsRealtime([testEvent], 'performance-test', 'test-user')
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      const avgResponseTime = totalTime / concurrent;

      expect(results.length).toBe(concurrent);
      expect(results.every(result => result.detectionId)).toBe(true);
      expect(avgResponseTime).toBeLessThan(300); // Target: <300ms including all processing

      console.log(`Integrated Performance Test:
        Concurrent requests: ${concurrent}
        Total time: ${totalTime}ms
        Average response time: ${avgResponseTime.toFixed(2)}ms
      `);
    });

    it('should handle ML model failures gracefully', async () => {
      // Simulate model unavailability by unregistering
      const originalModel = mlModelRegistry.getModel('isolation-forest-v1');
      mlModelRegistry.unregisterModel('isolation-forest-v1');

      try {
        const testEvent = {
          id: 'fallback-test',
          timestamp: new Date().toISOString(),
          type: 'network' as const,
          severity: 'medium' as const,
          source: 'fallback-test',
          description: 'Testing fallback when ML unavailable',
          riskScore: 0.5,
          status: 'active' as const,
          metadata: {}
        };

        // Should still work with fallback logic
        const result = await threatService.detectThreatsRealtime(
          [testEvent],
          'fallback-test',
          'test-user'
        );

        expect(result).toBeDefined();
        expect(result.detectionId).toBeDefined();
        // Should fallback to rule-based detection

      } finally {
        // Restore the model
        if (originalModel) {
          await mlModelRegistry.registerModel(originalModel);
        }
      }
    });
  });

  describe('ML Data Pipeline Integration', () => {
    it('should properly extract features from threat events', async () => {
      const eventWithRichMetadata = {
        id: 'feature-extraction-test',
        timestamp: new Date().toISOString(),
        type: 'network' as const,
        severity: 'medium' as const,
        source: 'feature-test',
        description: 'Testing feature extraction',
        riskScore: 0.5,
        status: 'active' as const,
        metadata: {
          // Network features
          packetSize: 2048,
          connectionFrequency: 25,
          portDiversity: 5,
          protocol: 'https',
          byteRate: 75000,
          connectionDuration: 450,
          srcIpReputation: 0.6,
          dstIpReputation: 0.9,
          
          // Additional metadata
          sourceIp: '192.168.1.100',
          destinationIp: '10.0.0.50',
          port: 443,
          userAgent: 'Mozilla/5.0...',
          geo: {
            country: 'US',
            region: 'CA',
            city: 'San Francisco'
          }
        }
      };

      const result = await threatService.detectThreatsRealtime(
        [eventWithRichMetadata],
        'feature-extraction-test',
        'test-user'
      );

      expect(result).toBeDefined();
      expect(result.detectionId).toBeDefined();

      // Verify that rich metadata was processed
      if (result.threats.length > 0) {
        const threat = result.threats[0];
        expect(threat.metadata).toBeDefined();
        expect(threat.description).toBeDefined();
      }
    });

    it('should handle missing or incomplete metadata gracefully', async () => {
      const incompleteEvent = {
        id: 'incomplete-metadata-test',
        timestamp: new Date().toISOString(),
        type: 'network' as const,
        severity: 'medium' as const,
        source: 'incomplete-test',
        description: 'Testing with incomplete metadata',
        riskScore: 0.3,
        status: 'active' as const,
        metadata: {
          // Only partial data
          packetSize: 1024,
          protocol: 'tcp'
          // Missing most fields
        }
      };

      // Should not throw error and should provide reasonable results
      const result = await threatService.detectThreatsRealtime(
        [incompleteEvent],
        'incomplete-metadata-test',
        'test-user'
      );

      expect(result).toBeDefined();
      expect(result.detectionId).toBeDefined();
      expect(result.threatsDetected).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cross-Model Validation', () => {
    it('should produce consistent results across model reloads', async () => {
      const testInput: AnomalyDetectionInput = {
        features: [1500, 10, 3, 1, 50000, 300, 0.8, 0.7, 14, 2],
        timestamp: new Date().toISOString()
      };

      // Get prediction from current model
      const model1 = mlModelRegistry.getModel('isolation-forest-v1');
      expect(model1).toBeDefined();
      
      const result1 = await model1!.predict(testInput);

      // Unregister and re-register model to simulate reload
      mlModelRegistry.unregisterModel('isolation-forest-v1');
      
      const reloadedModel = new IsolationForestModel();
      await reloadedModel.initialize();
      await mlModelRegistry.registerModel(reloadedModel);

      const model2 = mlModelRegistry.getModel('isolation-forest-v1');
      expect(model2).toBeDefined();
      
      const result2 = await model2!.predict(testInput);

      // Results should be very similar (allowing for small differences in random initialization)
      expect(Math.abs(result1.anomalyScore - result2.anomalyScore)).toBeLessThan(0.1);
      expect(result1.isAnomaly).toBe(result2.isAnomaly);
    });
  });
});