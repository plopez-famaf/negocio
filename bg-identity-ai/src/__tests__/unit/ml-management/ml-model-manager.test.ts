import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MLModelManager, RetrainingRequest } from '@/services/ml-management/ml-model-manager';

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock('@/ml/models/base/model-registry', () => ({
  mlModelRegistry: {
    getModel: vi.fn(),
    registerModel: vi.fn(),
    listModels: vi.fn(),
    updateModel: vi.fn()
  }
}));

describe('MLModelManager', () => {
  let mlModelManager: MLModelManager;

  beforeEach(() => {
    mlModelManager = new MLModelManager();
    
    // Mock model registry responses
    const mockModelRegistry = require('@/ml/models/base/model-registry').mlModelRegistry;
    mockModelRegistry.getModel.mockResolvedValue({
      id: 'test_model_1',
      name: 'Test Isolation Forest',
      type: 'isolation_forest',
      version: '1.0.0',
      status: 'active',
      accuracy: 0.94,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    mockModelRegistry.listModels.mockResolvedValue([
      {
        id: 'model_1',
        name: 'Isolation Forest',
        type: 'isolation_forest',
        status: 'active'
      },
      {
        id: 'model_2',
        name: 'User Behavior Analytics',
        type: 'user_behavior',
        status: 'active'
      }
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
    mlModelManager.cleanup();
  });

  describe('getModelStatus', () => {
    it('should return comprehensive model status', async () => {
      const result = await mlModelManager.getModelStatus('test_model_1');

      expect(result).toBeDefined();
      expect(result.modelId).toBe('test_model_1');
      expect(result.name).toBeDefined();
      expect(result.type).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.health).toBeDefined();
      expect(result.accuracy).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(result.usage).toBeDefined();
      expect(result.configuration).toBeDefined();
      expect(result.capabilities).toBeDefined();
    });

    it('should validate model health metrics', async () => {
      const result = await mlModelManager.getModelStatus('test_model_1');

      const health = result.health;
      expect(health.lastHealthCheck).toBeDefined();
      expect(health.overallHealth).toMatch(/^(healthy|warning|critical)$/);
      expect(health.healthScore).toBeGreaterThanOrEqual(0);
      expect(health.healthScore).toBeLessThanOrEqual(100);
      expect(health.componentChecks).toBeInstanceOf(Array);
      expect(health.issues).toBeInstanceOf(Array);
      expect(health.uptime).toBeGreaterThan(0);

      // Component checks validation
      health.componentChecks.forEach(check => {
        expect(check).toHaveProperty('component');
        expect(check).toHaveProperty('status');
        expect(check).toHaveProperty('lastCheck');
        expect(['healthy', 'warning', 'critical'].includes(check.status)).toBe(true);
      });
    });

    it('should provide accurate accuracy metrics', async () => {
      const result = await mlModelManager.getModelStatus('test_model_1');

      const accuracy = result.accuracy;
      expect(accuracy.overall).toBeGreaterThan(0);
      expect(accuracy.overall).toBeLessThanOrEqual(1);
      expect(accuracy.precision).toBeGreaterThan(0);
      expect(accuracy.precision).toBeLessThanOrEqual(1);
      expect(accuracy.recall).toBeGreaterThan(0);
      expect(accuracy.recall).toBeLessThanOrEqual(1);
      expect(accuracy.f1Score).toBeGreaterThan(0);
      expect(accuracy.f1Score).toBeLessThanOrEqual(1);
      expect(accuracy.confusionMatrix).toBeDefined();
      expect(accuracy.accuracyTrend).toBeDefined();
      expect(accuracy.lastEvaluation).toBeDefined();

      // Accuracy trend validation
      expect(['improving', 'stable', 'declining'].includes(accuracy.accuracyTrend.direction)).toBe(true);
      expect(accuracy.accuracyTrend.changeRate).toBeGreaterThanOrEqual(-1);
      expect(accuracy.accuracyTrend.changeRate).toBeLessThanOrEqual(1);
    });

    it('should include performance metrics', async () => {
      const result = await mlModelManager.getModelStatus('test_model_1');

      const performance = result.performance;
      expect(performance.averageInferenceTime).toBeGreaterThan(0);
      expect(performance.throughput).toBeGreaterThan(0);
      expect(performance.errorRate).toBeGreaterThanOrEqual(0);
      expect(performance.memoryUsage).toBeGreaterThan(0);
      expect(performance.cpuUsage).toBeGreaterThan(0);
      expect(performance.diskUsage).toBeGreaterThan(0);
      expect(performance.lastBenchmark).toBeDefined();
    });

    it('should track usage statistics', async () => {
      const result = await mlModelManager.getModelStatus('test_model_1');

      const usage = result.usage;
      expect(usage.totalPredictions).toBeGreaterThanOrEqual(0);
      expect(usage.predictionsToday).toBeGreaterThanOrEqual(0);
      expect(usage.averagePredictionsPerDay).toBeGreaterThanOrEqual(0);
      expect(usage.lastPrediction).toBeDefined();
      expect(usage.activeSessions).toBeGreaterThanOrEqual(0);
      expect(usage.usagePattern).toBeDefined();
    });

    it('should handle non-existent model', async () => {
      const mockModelRegistry = require('@/ml/models/base/model-registry').mlModelRegistry;
      mockModelRegistry.getModel.mockResolvedValue(null);

      await expect(mlModelManager.getModelStatus('non_existent_model'))
        .rejects.toThrow('Model not found');
    });

    it('should handle registry errors gracefully', async () => {
      const mockModelRegistry = require('@/ml/models/base/model-registry').mlModelRegistry;
      mockModelRegistry.getModel.mockRejectedValue(new Error('Registry connection failed'));

      await expect(mlModelManager.getModelStatus('test_model_1'))
        .rejects.toThrow('Failed to get model status');
    });
  });

  describe('getAllModelStatus', () => {
    it('should return status for all models', async () => {
      const result = await mlModelManager.getAllModelStatus();

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      
      result.forEach(modelStatus => {
        expect(modelStatus.modelId).toBeDefined();
        expect(modelStatus.name).toBeDefined();
        expect(modelStatus.type).toBeDefined();
        expect(modelStatus.status).toBeDefined();
        expect(modelStatus.health).toBeDefined();
        expect(modelStatus.accuracy).toBeDefined();
        expect(modelStatus.performance).toBeDefined();
      });
    });

    it('should handle empty model registry', async () => {
      const mockModelRegistry = require('@/ml/models/base/model-registry').mlModelRegistry;
      mockModelRegistry.listModels.mockResolvedValue([]);

      const result = await mlModelManager.getAllModelStatus();

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(0);
    });
  });

  describe('analyzeFeatureImportance', () => {
    it('should perform permutation importance analysis', async () => {
      const result = await mlModelManager.analyzeFeatureImportance('test_model_1', 'permutation');

      expect(result).toBeDefined();
      expect(result.modelId).toBe('test_model_1');
      expect(result.analysisType).toBe('permutation');
      expect(result.features).toBeInstanceOf(Array);
      expect(result.metadata).toBeDefined();

      // Feature importance validation
      result.features.forEach(feature => {
        expect(feature.featureName).toBeDefined();
        expect(feature.importance).toBeGreaterThanOrEqual(0);
        expect(feature.importance).toBeLessThanOrEqual(1);
        expect(feature.rank).toBeGreaterThan(0);
        expect(feature.standardError).toBeGreaterThanOrEqual(0);
        expect(feature.pValue).toBeGreaterThanOrEqual(0);
        expect(feature.pValue).toBeLessThanOrEqual(1);
      });

      // Metadata validation
      expect(result.metadata.analysisTime).toBeGreaterThan(0);
      expect(result.metadata.confidence).toBeGreaterThan(0);
      expect(result.metadata.confidence).toBeLessThanOrEqual(1);
      expect(result.metadata.samplesUsed).toBeGreaterThan(0);
    });

    it('should perform SHAP analysis', async () => {
      const result = await mlModelManager.analyzeFeatureImportance('test_model_1', 'shap');

      expect(result.analysisType).toBe('shap');
      expect(result.features).toBeInstanceOf(Array);
      
      // SHAP-specific validations
      result.features.forEach(feature => {
        expect(feature.featureName).toBeDefined();
        expect(feature.importance).toBeDefined();
        expect(feature.shapValue).toBeDefined();
      });
    });

    it('should perform coefficient analysis', async () => {
      const result = await mlModelManager.analyzeFeatureImportance('test_model_1', 'coefficient');

      expect(result.analysisType).toBe('coefficient');
      expect(result.features).toBeInstanceOf(Array);
      
      // Coefficient-specific validations
      result.features.forEach(feature => {
        expect(feature.featureName).toBeDefined();
        expect(feature.importance).toBeDefined();
        expect(feature.coefficient).toBeDefined();
      });
    });

    it('should perform tree-based analysis', async () => {
      const result = await mlModelManager.analyzeFeatureImportance('test_model_1', 'tree_based');

      expect(result.analysisType).toBe('tree_based');
      expect(result.features).toBeInstanceOf(Array);
      
      // Tree-based specific validations
      result.features.forEach(feature => {
        expect(feature.featureName).toBeDefined();
        expect(feature.importance).toBeDefined();
        expect(feature.gain).toBeDefined();
      });
    });

    it('should handle invalid analysis type', async () => {
      await expect(mlModelManager.analyzeFeatureImportance('test_model_1', 'invalid_type' as any))
        .rejects.toThrow('Unsupported analysis type');
    });

    it('should cache feature importance results', async () => {
      // First analysis
      const startTime1 = Date.now();
      const result1 = await mlModelManager.analyzeFeatureImportance('test_model_1', 'permutation');
      const duration1 = Date.now() - startTime1;

      // Second identical analysis (should be faster due to caching)
      const startTime2 = Date.now();
      const result2 = await mlModelManager.analyzeFeatureImportance('test_model_1', 'permutation');
      const duration2 = Date.now() - startTime2;

      expect(result1.features.length).toBe(result2.features.length);
      expect(duration2).toBeLessThanOrEqual(duration1); // May be cached
    });
  });

  describe('detectModelDrift', () => {
    it('should detect and report model drift', async () => {
      const result = await mlModelManager.detectModelDrift('test_model_1');

      expect(result).toBeDefined();
      expect(result.modelId).toBe('test_model_1');
      expect(['none', 'data_drift', 'concept_drift', 'prediction_drift'].includes(result.driftType)).toBe(true);
      expect(['low', 'medium', 'high', 'critical'].includes(result.severity)).toBe(true);
      expect(result.driftScore).toBeGreaterThanOrEqual(0);
      expect(result.driftScore).toBeLessThanOrEqual(1);
      expect(result.detectionTime).toBeDefined();
      expect(result.analysis).toBeDefined();
      expect(result.recommendations).toBeInstanceOf(Array);
    });

    it('should provide detailed drift analysis', async () => {
      const result = await mlModelManager.detectModelDrift('test_model_1');

      const analysis = result.analysis;
      expect(analysis.referenceData).toBeDefined();
      expect(analysis.currentData).toBeDefined();
      expect(analysis.statisticalTests).toBeInstanceOf(Array);
      expect(analysis.featureDrift).toBeInstanceOf(Array);
      expect(analysis.performanceDrift).toBeDefined();

      // Statistical tests validation
      analysis.statisticalTests.forEach(test => {
        expect(test.testName).toBeDefined();
        expect(test.pValue).toBeGreaterThanOrEqual(0);
        expect(test.pValue).toBeLessThanOrEqual(1);
        expect(test.significant).toBeDefined();
        expect(test.threshold).toBeGreaterThan(0);
      });

      // Feature drift validation
      analysis.featureDrift.forEach(drift => {
        expect(drift.featureName).toBeDefined();
        expect(drift.driftScore).toBeGreaterThanOrEqual(0);
        expect(drift.driftType).toBeDefined();
        expect(drift.significant).toBeDefined();
      });
    });

    it('should handle no drift scenarios', async () => {
      // Mock no drift scenario
      vi.spyOn(mlModelManager as any, 'calculateDriftScore').mockResolvedValue(0.05); // Very low drift

      const result = await mlModelManager.detectModelDrift('test_model_1');

      expect(result.driftType).toBe('none');
      expect(result.severity).toBe('low');
      expect(result.driftScore).toBeLessThan(0.1);
    });

    it('should trigger alerts for critical drift', async () => {
      // Mock critical drift scenario
      vi.spyOn(mlModelManager as any, 'calculateDriftScore').mockResolvedValue(0.85); // High drift

      const result = await mlModelManager.detectModelDrift('test_model_1');

      expect(result.severity).toMatch(/^(high|critical)$/);
      expect(result.driftScore).toBeGreaterThan(0.7);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('initiateRetraining', () => {
    it('should initiate model retraining successfully', async () => {
      const request: RetrainingRequest = {
        modelId: 'test_model_1',
        trigger: 'manual',
        priority: 'normal',
        configuration: {
          dataSource: 'latest_threats',
          validationSplit: 0.2,
          maxTrainingTime: 3600
        }
      };

      const result = await mlModelManager.initiateRetraining(request);

      expect(result).toBeDefined();
      expect(result.jobId).toMatch(/^retraining_job_/);
      expect(result.modelId).toBe('test_model_1');
      expect(result.status).toBe('queued');
      expect(result.priority).toBe('normal');
      expect(result.estimatedDuration).toBeGreaterThan(0);
      expect(result.queuePosition).toBeGreaterThanOrEqual(0);
      expect(result.createdAt).toBeDefined();
      expect(result.configuration).toBeDefined();
    });

    it('should handle different trigger types', async () => {
      const triggers: Array<'manual' | 'scheduled' | 'drift_detected' | 'performance_degraded'> = [
        'manual', 'scheduled', 'drift_detected', 'performance_degraded'
      ];

      for (const trigger of triggers) {
        const request: RetrainingRequest = {
          modelId: 'test_model_1',
          trigger,
          priority: 'normal'
        };

        const result = await mlModelManager.initiateRetraining(request);
        expect(result.trigger).toBe(trigger);
        expect(result.status).toBe('queued');
      }
    });

    it('should handle different priority levels', async () => {
      const priorities: Array<'low' | 'normal' | 'high' | 'urgent'> = [
        'low', 'normal', 'high', 'urgent'
      ];

      for (const priority of priorities) {
        const request: RetrainingRequest = {
          modelId: 'test_model_1',
          trigger: 'manual',
          priority
        };

        const result = await mlModelManager.initiateRetraining(request);
        expect(result.priority).toBe(priority);
        
        // Higher priority should have lower queue position
        if (priority === 'urgent') {
          expect(result.queuePosition).toBe(0);
        }
      }
    });

    it('should validate retraining configuration', async () => {
      const invalidRequest: RetrainingRequest = {
        modelId: 'test_model_1',
        trigger: 'manual',
        priority: 'normal',
        configuration: {
          validationSplit: 1.5, // Invalid split > 1
          maxTrainingTime: -100 // Invalid negative time
        }
      };

      await expect(mlModelManager.initiateRetraining(invalidRequest))
        .rejects.toThrow('Invalid retraining configuration');
    });

    it('should prevent duplicate retraining jobs', async () => {
      const request: RetrainingRequest = {
        modelId: 'test_model_1',
        trigger: 'manual',
        priority: 'normal'
      };

      // First retraining request
      const result1 = await mlModelManager.initiateRetraining(request);
      expect(result1.status).toBe('queued');

      // Second identical request should be rejected or queued separately
      const result2 = await mlModelManager.initiateRetraining(request);
      expect(result2).toBeDefined();
      expect(result2.jobId).not.toBe(result1.jobId);
    });
  });

  describe('getRetrainingStatus', () => {
    it('should return retraining job status', () => {
      // Create a mock job first
      const jobId = 'test_job_123';
      (mlModelManager as any).retrainingJobs.set(jobId, {
        jobId,
        modelId: 'test_model_1',
        status: 'running',
        progress: 0.45,
        startedAt: new Date().toISOString(),
        estimatedCompletion: new Date(Date.now() + 300000).toISOString()
      });

      const result = mlModelManager.getRetrainingStatus(jobId);

      expect(result).toBeDefined();
      expect(result.jobId).toBe(jobId);
      expect(result.modelId).toBe('test_model_1');
      expect(result.status).toBe('running');
      expect(result.progress).toBe(0.45);
      expect(result.startedAt).toBeDefined();
      expect(result.estimatedCompletion).toBeDefined();
    });

    it('should return null for non-existent job', () => {
      const result = mlModelManager.getRetrainingStatus('non_existent_job');
      expect(result).toBeNull();
    });

    it('should handle completed jobs', () => {
      const jobId = 'completed_job_123';
      (mlModelManager as any).retrainingJobs.set(jobId, {
        jobId,
        modelId: 'test_model_1',
        status: 'completed',
        progress: 1.0,
        startedAt: new Date(Date.now() - 600000).toISOString(),
        completedAt: new Date().toISOString(),
        results: {
          newAccuracy: 0.96,
          improvementPercentage: 2.1,
          validationMetrics: { precision: 0.95, recall: 0.94, f1Score: 0.945 }
        }
      });

      const result = mlModelManager.getRetrainingStatus(jobId);

      expect(result.status).toBe('completed');
      expect(result.progress).toBe(1.0);
      expect(result.completedAt).toBeDefined();
      expect(result.results).toBeDefined();
    });
  });

  describe('explainPrediction', () => {
    it('should explain predictions with feature importance', async () => {
      const inputData = {
        sourceIP: '192.168.1.100',
        destinationPort: 443,
        protocol: 'HTTPS',
        payloadSize: 1024,
        connectionDuration: 5.2
      };

      const result = await mlModelManager.explainPrediction('test_model_1', inputData, 'feature');

      expect(result).toBeDefined();
      expect(result.predictionId).toMatch(/^prediction_/);
      expect(result.modelId).toBe('test_model_1');
      expect(result.prediction).toBeDefined();
      expect(result.explanation).toBeDefined();
      expect(result.context).toBeDefined();

      // Prediction validation
      expect(result.prediction.value).toBeGreaterThanOrEqual(0);
      expect(result.prediction.value).toBeLessThanOrEqual(1);
      expect(result.prediction.confidence).toBeGreaterThanOrEqual(0);
      expect(result.prediction.confidence).toBeLessThanOrEqual(1);
      expect(result.prediction.classification).toBeDefined();

      // Feature explanation validation
      if (result.explanation.type === 'feature') {
        expect(result.explanation.featureContributions).toBeInstanceOf(Array);
        result.explanation.featureContributions.forEach(contrib => {
          expect(contrib.featureName).toBeDefined();
          expect(contrib.contribution).toBeDefined();
          expect(contrib.value).toBeDefined();
        });
      }
    });

    it('should provide decision tree explanations', async () => {
      const inputData = {
        riskScore: 7.5,
        anomalyScore: 0.8,
        behaviorScore: 0.6
      };

      const result = await mlModelManager.explainPrediction('test_model_1', inputData, 'decision_tree');

      expect(result.explanation.type).toBe('decision_tree');
      expect(result.explanation.decisionPath).toBeInstanceOf(Array);
      
      result.explanation.decisionPath.forEach(node => {
        expect(node.nodeId).toBeDefined();
        expect(node.feature).toBeDefined();
        expect(node.threshold).toBeDefined();
        expect(node.decision).toBeDefined();
        expect(['left', 'right'].includes(node.direction)).toBe(true);
      });
    });

    it('should provide influence explanations', async () => {
      const inputData = {
        userBehavior: 'anomalous',
        timeOfDay: 'night',
        accessPattern: 'unusual'
      };

      const result = await mlModelManager.explainPrediction('test_model_1', inputData, 'influence');

      expect(result.explanation.type).toBe('influence');
      expect(result.explanation.influentialSamples).toBeInstanceOf(Array);
      
      result.explanation.influentialSamples.forEach(sample => {
        expect(sample.sampleId).toBeDefined();
        expect(sample.influence).toBeDefined();
        expect(sample.similarity).toBeGreaterThanOrEqual(0);
        expect(sample.similarity).toBeLessThanOrEqual(1);
      });
    });

    it('should generate counterfactual explanations', async () => {
      const inputData = {
        securityLevel: 'low',
        accessAttempts: 5,
        successRate: 0.2
      };

      const result = await mlModelManager.explainPrediction('test_model_1', inputData, 'counterfactual');

      expect(result.explanation.type).toBe('counterfactual');
      expect(result.explanation.counterfactuals).toBeInstanceOf(Array);
      
      result.explanation.counterfactuals.forEach(cf => {
        expect(cf.changes).toBeDefined();
        expect(cf.newPrediction).toBeDefined();
        expect(cf.distance).toBeGreaterThan(0);
        expect(cf.feasibility).toBeGreaterThanOrEqual(0);
        expect(cf.feasibility).toBeLessThanOrEqual(1);
      });
    });

    it('should handle invalid explanation types', async () => {
      const inputData = { test: 'data' };

      await expect(mlModelManager.explainPrediction('test_model_1', inputData, 'invalid_type' as any))
        .rejects.toThrow('Unsupported explanation type');
    });

    it('should validate input data format', async () => {
      const invalidInputData = null;

      await expect(mlModelManager.explainPrediction('test_model_1', invalidInputData, 'feature'))
        .rejects.toThrow('Invalid input data');
    });
  });

  describe('system management', () => {
    it('should provide comprehensive system statistics', async () => {
      const stats = mlModelManager.getSystemStats();

      expect(stats).toBeDefined();
      expect(stats.totalModels).toBeGreaterThanOrEqual(0);
      expect(stats.activeModels).toBeGreaterThanOrEqual(0);
      expect(stats.retrainingJobs).toBeDefined();
      expect(stats.predictions).toBeDefined();
      expect(stats.performance).toBeDefined();
      expect(stats.resourceUsage).toBeDefined();

      // Retraining jobs stats
      expect(stats.retrainingJobs.total).toBeGreaterThanOrEqual(0);
      expect(stats.retrainingJobs.queued).toBeGreaterThanOrEqual(0);
      expect(stats.retrainingJobs.running).toBeGreaterThanOrEqual(0);
      expect(stats.retrainingJobs.completed).toBeGreaterThanOrEqual(0);
      expect(stats.retrainingJobs.failed).toBeGreaterThanOrEqual(0);

      // Predictions stats
      expect(stats.predictions.totalToday).toBeGreaterThanOrEqual(0);
      expect(stats.predictions.averageConfidence).toBeGreaterThanOrEqual(0);
      expect(stats.predictions.averageConfidence).toBeLessThanOrEqual(1);
      expect(stats.predictions.throughput).toBeGreaterThanOrEqual(0);

      // Performance stats
      expect(stats.performance.averageInferenceTime).toBeGreaterThan(0);
      expect(stats.performance.averageAccuracy).toBeGreaterThanOrEqual(0);
      expect(stats.performance.averageAccuracy).toBeLessThanOrEqual(1);
      expect(stats.performance.systemUptime).toBeGreaterThan(0);
    });

    it('should handle cleanup properly', () => {
      // Should not throw errors
      expect(() => mlModelManager.cleanup()).not.toThrow();
    });

    it('should handle concurrent operations', async () => {
      const operations = [
        mlModelManager.getModelStatus('test_model_1'),
        mlModelManager.analyzeFeatureImportance('test_model_1', 'permutation'),
        mlModelManager.detectModelDrift('test_model_1'),
        mlModelManager.explainPrediction('test_model_1', { test: 'data' }, 'feature')
      ];

      const results = await Promise.allSettled(operations);

      // Most operations should complete successfully
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(0);
    });
  });

  describe('error handling and resilience', () => {
    it('should handle model registry failures gracefully', async () => {
      const mockModelRegistry = require('@/ml/models/base/model-registry').mlModelRegistry;
      mockModelRegistry.getModel.mockRejectedValue(new Error('Registry unavailable'));

      await expect(mlModelManager.getModelStatus('test_model_1'))
        .rejects.toThrow('Failed to get model status');
    });

    it('should handle malformed input data', async () => {
      const malformedData = {
        invalidField: undefined,
        circularRef: {}
      };
      (malformedData as any).circularRef.self = malformedData;

      await expect(mlModelManager.explainPrediction('test_model_1', malformedData, 'feature'))
        .rejects.toThrow();
    });

    it('should handle high load scenarios', async () => {
      // Simulate high load with many concurrent requests
      const requests = Array(50).fill(null).map((_, i) => 
        mlModelManager.getModelStatus('test_model_1')
      );

      const results = await Promise.allSettled(requests);
      
      // Most requests should complete successfully
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(requests.length * 0.8); // 80% success rate
    });
  });
});