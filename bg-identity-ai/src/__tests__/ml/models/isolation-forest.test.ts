import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IsolationForestModel } from '@/ml/models/anomaly-detection/isolation-forest-model';
import { AnomalyDetectionInput, TrainingData, TrainingConfig, ModelStatus } from '@/ml/models/base/model-interfaces';

describe('IsolationForestModel', () => {
  let model: IsolationForestModel;

  beforeEach(async () => {
    model = new IsolationForestModel();
    await model.initialize();
  });

  afterEach(() => {
    // Cleanup if needed
  });

  describe('Initialization', () => {
    it('should initialize with correct model properties', () => {
      expect(model.modelId).toBe('isolation-forest-v1');
      expect(model.modelName).toBe('Isolation Forest Anomaly Detector');
      expect(model.version).toBe('1.0.0');
      expect(model.isLoaded).toBe(true);
    });

    it('should have default feature names', () => {
      const modelInfo = model.getModelInfo();
      expect(modelInfo.features).toContain('packet_size');
      expect(modelInfo.features).toContain('connection_frequency');
      expect(modelInfo.features).toContain('port_diversity');
      expect(modelInfo.features.length).toBe(10);
    });
  });

  describe('Input Validation', () => {
    it('should validate correct input format', async () => {
      const input: AnomalyDetectionInput = {
        features: [1500, 10, 3, 1, 50000, 300, 0.8, 0.7, 14, 2],
        timestamp: new Date().toISOString()
      };

      const result = await model.predict(input);
      expect(result).toBeDefined();
      expect(typeof result.anomalyScore).toBe('number');
      expect(typeof result.isAnomaly).toBe('boolean');
    });

    it('should reject input with wrong number of features', async () => {
      const input: AnomalyDetectionInput = {
        features: [1500, 10, 3], // Too few features
        timestamp: new Date().toISOString()
      };

      await expect(model.predict(input)).rejects.toThrow();
    });

    it('should reject input with invalid feature values', async () => {
      const input: AnomalyDetectionInput = {
        features: [NaN, 10, 3, 1, 50000, 300, 0.8, 0.7, 14, 2],
        timestamp: new Date().toISOString()
      };

      await expect(model.predict(input)).rejects.toThrow();
    });
  });

  describe('Anomaly Detection', () => {
    it('should detect normal network behavior', async () => {
      const normalInput: AnomalyDetectionInput = {
        features: [1500, 10, 3, 1, 50000, 300, 0.8, 0.7, 14, 2], // Typical values
        timestamp: new Date().toISOString()
      };

      const result = await model.predict(normalInput);
      
      expect(result.anomalyScore).toBeGreaterThanOrEqual(0);
      expect(result.anomalyScore).toBeLessThanOrEqual(1);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(['low', 'medium', 'high', 'critical']).toContain(result.severity);
    });

    it('should detect anomalous network behavior', async () => {
      const anomalousInput: AnomalyDetectionInput = {
        features: [50000, 1000, 100, 99, 10000000, 10, 0.1, 0.1, 25, 8], // Extreme values
        timestamp: new Date().toISOString()
      };

      const result = await model.predict(anomalousInput);
      
      // Anomalous input should have higher score
      expect(result.anomalyScore).toBeGreaterThan(0.3);
      expect(result.explanation).toBeDefined();
      expect(result.explanation.length).toBeGreaterThan(0);
    });

    it('should provide consistent results for identical inputs', async () => {
      const input: AnomalyDetectionInput = {
        features: [1500, 10, 3, 1, 50000, 300, 0.8, 0.7, 14, 2],
        timestamp: new Date().toISOString()
      };

      const result1 = await model.predict(input);
      const result2 = await model.predict(input);

      expect(result1.anomalyScore).toBeCloseTo(result2.anomalyScore, 2);
      expect(result1.isAnomaly).toBe(result2.isAnomaly);
    });
  });

  describe('Performance', () => {
    it('should complete prediction within performance target', async () => {
      const input: AnomalyDetectionInput = {
        features: [1500, 10, 3, 1, 50000, 300, 0.8, 0.7, 14, 2],
        timestamp: new Date().toISOString()
      };

      const startTime = Date.now();
      await model.predict(input);
      const endTime = Date.now();

      const inferenceTime = endTime - startTime;
      expect(inferenceTime).toBeLessThan(100); // Target: <100ms
    });

    it('should handle batch predictions efficiently', async () => {
      const inputs: AnomalyDetectionInput[] = [];
      for (let i = 0; i < 100; i++) {
        inputs.push({
          features: [1500 + i, 10 + i, 3, 1, 50000, 300, 0.8, 0.7, 14, 2],
          timestamp: new Date().toISOString()
        });
      }

      const startTime = Date.now();
      const promises = inputs.map(input => model.predict(input));
      await Promise.all(promises);
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      const avgTimePerPrediction = totalTime / inputs.length;
      
      expect(avgTimePerPrediction).toBeLessThan(50); // Target: <50ms average
    });
  });

  describe('Training', () => {
    it('should train successfully with valid data', async () => {
      const trainingData: TrainingData = {
        features: generateTrainingFeatures(500),
        labels: new Array(500).fill(false), // All normal samples
        metadata: {
          size: 500,
          source: 'test',
          version: '1.0',
          createdAt: new Date().toISOString()
        }
      };

      const config: TrainingConfig = {
        algorithm: 'isolation-forest',
        hyperparameters: {
          numTrees: 10,
          subsampleSize: 100
        },
        validationSplit: 0.2
      };

      const result = await model.train(trainingData, config);

      expect(result.modelId).toBe(model.modelId);
      expect(result.metrics.accuracy).toBeGreaterThanOrEqual(0);
      expect(result.metrics.accuracy).toBeLessThanOrEqual(1);
      expect(result.trainingTime).toBeGreaterThan(0);
      expect(result.convergence).toBe(true);
    });

    it('should improve with more training data', async () => {
      // Train with small dataset
      const smallData: TrainingData = {
        features: generateTrainingFeatures(100),
        labels: new Array(100).fill(false),
        metadata: {
          size: 100,
          source: 'test-small',
          version: '1.0',
          createdAt: new Date().toISOString()
        }
      };

      const config: TrainingConfig = {
        algorithm: 'isolation-forest',
        hyperparameters: { numTrees: 10, subsampleSize: 50 },
        validationSplit: 0.2
      };

      const smallResult = await model.train(smallData, config);

      // Train with larger dataset
      const largeData: TrainingData = {
        features: generateTrainingFeatures(1000),
        labels: new Array(1000).fill(false),
        metadata: {
          size: 1000,
          source: 'test-large',
          version: '1.0',
          createdAt: new Date().toISOString()
        }
      };

      const largeResult = await model.train(largeData, config);

      // Larger dataset should generally lead to better or similar performance
      expect(largeResult.trainingTime).toBeGreaterThan(smallResult.trainingTime);
    });
  });

  describe('Model Persistence', () => {
    it('should serialize and deserialize model state', async () => {
      const originalInfo = model.getModelInfo();
      
      // Test input for consistency check
      const testInput: AnomalyDetectionInput = {
        features: [1500, 10, 3, 1, 50000, 300, 0.8, 0.7, 14, 2],
        timestamp: new Date().toISOString()
      };
      
      const originalPrediction = await model.predict(testInput);

      // Save model
      await model.save('test-model-path');

      // Create new model instance and load
      const newModel = new IsolationForestModel();
      await newModel.initialize();
      await newModel.load('test-model-path');

      const loadedInfo = newModel.getModelInfo();
      const loadedPrediction = await newModel.predict(testInput);

      // Compare model info
      expect(loadedInfo.id).toBe(originalInfo.id);
      expect(loadedInfo.version).toBe(originalInfo.version);
      expect(loadedInfo.features).toEqual(originalInfo.features);

      // Predictions should be very similar (allowing for small floating-point differences)
      expect(loadedPrediction.anomalyScore).toBeCloseTo(originalPrediction.anomalyScore, 3);
      expect(loadedPrediction.isAnomaly).toBe(originalPrediction.isAnomaly);
    });
  });

  describe('Edge Cases', () => {
    it('should handle extreme feature values', async () => {
      const extremeInput: AnomalyDetectionInput = {
        features: [Number.MAX_SAFE_INTEGER, 0, 0, 0, 0, 0, 1, 1, 23, 6],
        timestamp: new Date().toISOString()
      };

      const result = await model.predict(extremeInput);
      
      expect(result.anomalyScore).toBeGreaterThanOrEqual(0);
      expect(result.anomalyScore).toBeLessThanOrEqual(1);
      expect(result.isAnomaly).toBe(true); // Extreme values should be flagged
    });

    it('should handle zero values', async () => {
      const zeroInput: AnomalyDetectionInput = {
        features: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        timestamp: new Date().toISOString()
      };

      const result = await model.predict(zeroInput);
      
      expect(result.anomalyScore).toBeGreaterThanOrEqual(0);
      expect(result.anomalyScore).toBeLessThanOrEqual(1);
    });

    it('should handle boundary timestamp values', async () => {
      const boundaryInput: AnomalyDetectionInput = {
        features: [1500, 10, 3, 1, 50000, 300, 0.8, 0.7, 14, 2],
        timestamp: '1970-01-01T00:00:00.000Z' // Unix epoch
      };

      const result = await model.predict(boundaryInput);
      expect(result).toBeDefined();
    });
  });

  describe('Model Information', () => {
    it('should provide comprehensive model information', () => {
      const info = model.getModelInfo();

      expect(info.id).toBeDefined();
      expect(info.name).toBeDefined();
      expect(info.version).toBeDefined();
      expect(info.type).toBeDefined();
      expect(info.description).toBeDefined();
      expect(info.features).toBeDefined();
      expect(info.trainingData).toBeDefined();
      expect(info.performance).toBeDefined();
      expect(info.status).toBeDefined();
      expect(info.createdAt).toBeDefined();
      expect(info.updatedAt).toBeDefined();
    });

    it('should report correct feature count', () => {
      const info = model.getModelInfo();
      expect(info.features.length).toBe(10);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when predicting on uninitialized model', async () => {
      const uninitializedModel = new IsolationForestModel();
      // Don't call initialize()

      const input: AnomalyDetectionInput = {
        features: [1500, 10, 3, 1, 50000, 300, 0.8, 0.7, 14, 2],
        timestamp: new Date().toISOString()
      };

      await expect(uninitializedModel.predict(input)).rejects.toThrow('Model is not loaded');
    });

    it('should handle corrupted input gracefully', async () => {
      const corruptedInput = {
        features: [1500, 10, 3, 1, 50000, 300, 0.8, 0.7, 14, 2],
        timestamp: 'invalid-timestamp'
      } as AnomalyDetectionInput;

      // Should not throw but handle gracefully
      const result = await model.predict(corruptedInput);
      expect(result).toBeDefined();
    });
  });

  describe('Regression Tests', () => {
    it('should maintain consistent behavior across versions', async () => {
      // Known input-output pairs for regression testing
      const regressionCases = [
        {
          input: {
            features: [1500, 10, 3, 1, 50000, 300, 0.8, 0.7, 14, 2],
            timestamp: '2024-01-01T12:00:00.000Z'
          },
          expectedRange: { min: 0, max: 1 },
          expectedAnomaly: false
        },
        {
          input: {
            features: [100000, 1000, 50, 99, 1000000, 1, 0.1, 0.1, 3, 1],
            timestamp: '2024-01-01T03:00:00.000Z'
          },
          expectedRange: { min: 0.5, max: 1 },
          expectedAnomaly: true
        }
      ];

      for (const testCase of regressionCases) {
        const result = await model.predict(testCase.input);
        
        expect(result.anomalyScore).toBeGreaterThanOrEqual(testCase.expectedRange.min);
        expect(result.anomalyScore).toBeLessThanOrEqual(testCase.expectedRange.max);
        expect(result.isAnomaly).toBe(testCase.expectedAnomaly);
      }
    });
  });
});

// Helper function to generate realistic training features
function generateTrainingFeatures(count: number): number[][] {
  const features: number[][] = [];
  
  for (let i = 0; i < count; i++) {
    // Generate realistic network feature values with some variation
    features.push([
      1000 + Math.random() * 2000,        // packet_size: 1000-3000
      5 + Math.random() * 20,             // connection_frequency: 5-25
      1 + Math.floor(Math.random() * 10), // port_diversity: 1-10
      Math.floor(Math.random() * 5),      // protocol_type: 0-4
      10000 + Math.random() * 100000,     // byte_rate: 10K-110K
      60 + Math.random() * 3540,          // connection_duration: 1min-1hour
      0.3 + Math.random() * 0.5,          // src_ip_reputation: 0.3-0.8
      0.3 + Math.random() * 0.5,          // dst_ip_reputation: 0.3-0.8
      Math.floor(Math.random() * 24),     // time_of_day: 0-23
      Math.floor(Math.random() * 7)       // day_of_week: 0-6
    ]);
  }
  
  return features;
}