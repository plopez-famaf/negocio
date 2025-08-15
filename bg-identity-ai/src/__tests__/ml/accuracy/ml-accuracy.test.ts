import { describe, it, expect, beforeAll } from 'vitest';
import { IsolationForestModel } from '@/ml/models/anomaly-detection/isolation-forest-model';
import { 
  AnomalyDetectionInput, 
  TrainingData, 
  TrainingConfig,
  ModelMetrics 
} from '@/ml/models/base/model-interfaces';

describe('ML Accuracy Tests', () => {
  let model: IsolationForestModel;

  beforeAll(async () => {
    model = new IsolationForestModel();
    await model.initialize();
  });

  describe('Anomaly Detection Accuracy', () => {
    it('should achieve target accuracy on synthetic dataset', async () => {
      // Generate synthetic dataset with known anomalies
      const { normalData, anomalousData, trainingData } = generateSyntheticDataset();

      // Train model on the synthetic data
      const config: TrainingConfig = {
        algorithm: 'isolation-forest',
        hyperparameters: {
          numTrees: 100,
          subsampleSize: 256
        },
        validationSplit: 0.2
      };

      await model.train(trainingData, config);

      // Test on normal data
      let correctNormal = 0;
      for (const sample of normalData) {
        const input: AnomalyDetectionInput = {
          features: sample,
          timestamp: new Date().toISOString()
        };
        
        const result = await model.predict(input);
        if (!result.isAnomaly) {
          correctNormal++;
        }
      }

      // Test on anomalous data
      let correctAnomalous = 0;
      for (const sample of anomalousData) {
        const input: AnomalyDetectionInput = {
          features: sample,
          timestamp: new Date().toISOString()
        };
        
        const result = await model.predict(input);
        if (result.isAnomaly) {
          correctAnomalous++;
        }
      }

      const normalAccuracy = correctNormal / normalData.length;
      const anomalyAccuracy = correctAnomalous / anomalousData.length;
      const overallAccuracy = (correctNormal + correctAnomalous) / (normalData.length + anomalousData.length);

      console.log(`Accuracy Results:
        Normal Classification: ${(normalAccuracy * 100).toFixed(1)}%
        Anomaly Detection: ${(anomalyAccuracy * 100).toFixed(1)}%
        Overall Accuracy: ${(overallAccuracy * 100).toFixed(1)}%
      `);

      // Targets for synthetic data
      expect(normalAccuracy).toBeGreaterThan(0.85); // Should correctly classify >85% of normal samples
      expect(anomalyAccuracy).toBeGreaterThan(0.70); // Should detect >70% of anomalies
      expect(overallAccuracy).toBeGreaterThan(0.75); // Overall accuracy should be >75%
    });

    it('should maintain consistent predictions with confidence scores', async () => {
      const testInputs: AnomalyDetectionInput[] = [
        // Normal network behavior
        {
          features: [1500, 10, 3, 1, 50000, 300, 0.8, 0.7, 14, 2],
          timestamp: new Date().toISOString()
        },
        // Suspicious but not extreme
        {
          features: [3000, 25, 5, 2, 80000, 600, 0.6, 0.6, 2, 1],
          timestamp: new Date().toISOString()
        },
        // Clearly anomalous
        {
          features: [50000, 1000, 50, 99, 1000000, 1, 0.1, 0.1, 25, 8],
          timestamp: new Date().toISOString()
        }
      ];

      const results = await Promise.all(
        testInputs.map(input => model.predict(input))
      );

      // Verify predictions are ordered by anomaly score
      expect(results[0].anomalyScore).toBeLessThan(results[1].anomalyScore);
      expect(results[1].anomalyScore).toBeLessThan(results[2].anomalyScore);

      // Verify confidence scores are reasonable
      results.forEach(result => {
        expect(result.confidence).toBeGreaterThan(0.1);
        expect(result.confidence).toBeLessThanOrEqual(1.0);
      });

      // The clearly anomalous sample should have high confidence
      expect(results[2].confidence).toBeGreaterThan(0.5);
      expect(results[2].isAnomaly).toBe(true);
    });

    it('should show improving accuracy with larger training sets', async () => {
      const smallDataset = generateTrainingDataset(200);
      const largeDataset = generateTrainingDataset(1000);

      const config: TrainingConfig = {
        algorithm: 'isolation-forest',
        hyperparameters: {
          numTrees: 50,
          subsampleSize: 100
        },
        validationSplit: 0.2
      };

      // Train on small dataset
      const smallModel = new IsolationForestModel();
      await smallModel.initialize();
      await smallModel.train(smallDataset, config);

      // Train on large dataset
      const largeModel = new IsolationForestModel();
      await largeModel.initialize();
      await largeModel.train(largeDataset, config);

      // Test both models on the same validation set
      const validationSet = generateValidationSet();
      
      const smallModelAccuracy = await calculateAccuracy(smallModel, validationSet);
      const largeModelAccuracy = await calculateAccuracy(largeModel, validationSet);

      console.log(`Training Set Size Comparison:
        Small dataset (200): ${(smallModelAccuracy * 100).toFixed(1)}%
        Large dataset (1000): ${(largeModelAccuracy * 100).toFixed(1)}%
      `);

      // Larger dataset should generally perform better or equal
      expect(largeModelAccuracy).toBeGreaterThanOrEqual(smallModelAccuracy - 0.05); // Allow 5% tolerance
    });
  });

  describe('False Positive/Negative Analysis', () => {
    it('should maintain acceptable false positive rate', async () => {
      // Generate large set of normal samples
      const normalSamples = generateNormalSamples(500);
      let falsePositives = 0;

      for (const sample of normalSamples) {
        const input: AnomalyDetectionInput = {
          features: sample,
          timestamp: new Date().toISOString()
        };

        const result = await model.predict(input);
        if (result.isAnomaly) {
          falsePositives++;
        }
      }

      const falsePositiveRate = falsePositives / normalSamples.length;
      
      console.log(`False Positive Analysis:
        Total normal samples: ${normalSamples.length}
        False positives: ${falsePositives}
        False positive rate: ${(falsePositiveRate * 100).toFixed(2)}%
      `);

      // Target: <15% false positive rate for normal traffic
      expect(falsePositiveRate).toBeLessThan(0.15);
    });

    it('should minimize false negatives for obvious anomalies', async () => {
      // Generate clear anomalies
      const obviousAnomalies = generateObviousAnomalies(100);
      let falseNegatives = 0;

      for (const sample of obviousAnomalies) {
        const input: AnomalyDetectionInput = {
          features: sample,
          timestamp: new Date().toISOString()
        };

        const result = await model.predict(input);
        if (!result.isAnomaly) {
          falseNegatives++;
        }
      }

      const falseNegativeRate = falseNegatives / obviousAnomalies.length;
      
      console.log(`False Negative Analysis:
        Total obvious anomalies: ${obviousAnomalies.length}
        False negatives: ${falseNegatives}
        False negative rate: ${(falseNegativeRate * 100).toFixed(2)}%
      `);

      // Target: <25% false negative rate for obvious anomalies
      expect(falseNegativeRate).toBeLessThan(0.25);
    });
  });

  describe('Boundary Case Accuracy', () => {
    it('should handle edge cases correctly', async () => {
      const edgeCases = [
        // Minimum values
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        // Maximum reasonable values
        [10000, 100, 20, 5, 1000000, 7200, 1.0, 1.0, 23, 6],
        // Mixed extreme values
        [100000, 1, 1, 0, 1, 1, 0, 1, 12, 3],
        // Typical but high-end values
        [5000, 50, 10, 2, 200000, 1800, 0.9, 0.8, 18, 4]
      ];

      for (const features of edgeCases) {
        const input: AnomalyDetectionInput = {
          features,
          timestamp: new Date().toISOString()
        };

        const result = await model.predict(input);
        
        // Should always return valid results
        expect(result.anomalyScore).toBeGreaterThanOrEqual(0);
        expect(result.anomalyScore).toBeLessThanOrEqual(1);
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
        expect(['low', 'medium', 'high', 'critical']).toContain(result.severity);
      }
    });
  });

  describe('Temporal Consistency', () => {
    it('should maintain consistent detection over time windows', async () => {
      // Generate time series of similar network behaviors
      const baseFeatures = [1500, 10, 3, 1, 50000, 300, 0.8, 0.7, 14, 2];
      const timeWindows = generateTimeWindows(24); // 24 hours

      const predictions: Array<{
        hour: number;
        result: any;
      }> = [];

      for (let hour = 0; hour < timeWindows.length; hour++) {
        const features = [...baseFeatures];
        features[8] = hour; // Update time_of_day

        const input: AnomalyDetectionInput = {
          features,
          timestamp: timeWindows[hour]
        };

        const result = await model.predict(input);
        predictions.push({ hour, result });
      }

      // Calculate variance in anomaly scores for similar behaviors
      const scores = predictions.map(p => p.result.anomalyScore);
      const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
      const standardDeviation = Math.sqrt(variance);

      console.log(`Temporal Consistency Analysis:
        Mean anomaly score: ${mean.toFixed(3)}
        Standard deviation: ${standardDeviation.toFixed(3)}
        Coefficient of variation: ${(standardDeviation / mean).toFixed(3)}
      `);

      // Similar behaviors should have consistent scores (low variance)
      expect(standardDeviation).toBeLessThan(0.2); // Low variance expected
    });
  });

  describe('Model Robustness', () => {
    it('should be robust to small input perturbations', async () => {
      const baseInput: AnomalyDetectionInput = {
        features: [1500, 10, 3, 1, 50000, 300, 0.8, 0.7, 14, 2],
        timestamp: new Date().toISOString()
      };

      const baseResult = await model.predict(baseInput);

      // Add small random perturbations
      const perturbationTests = [];
      for (let i = 0; i < 10; i++) {
        const perturbedFeatures = baseInput.features.map(feature => 
          feature + (Math.random() - 0.5) * feature * 0.05 // ±5% perturbation
        );

        const perturbedInput: AnomalyDetectionInput = {
          features: perturbedFeatures,
          timestamp: baseInput.timestamp
        };

        const result = await model.predict(perturbedInput);
        perturbationTests.push(result);
      }

      // Results should be similar to base result
      const scoreDifferences = perturbationTests.map(result => 
        Math.abs(result.anomalyScore - baseResult.anomalyScore)
      );

      const maxDifference = Math.max(...scoreDifferences);
      const avgDifference = scoreDifferences.reduce((sum, diff) => sum + diff, 0) / scoreDifferences.length;

      console.log(`Robustness Analysis:
        Base score: ${baseResult.anomalyScore.toFixed(3)}
        Max difference: ${maxDifference.toFixed(3)}
        Avg difference: ${avgDifference.toFixed(3)}
      `);

      // Small perturbations should not cause large changes
      expect(maxDifference).toBeLessThan(0.2);
      expect(avgDifference).toBeLessThan(0.1);
    });
  });
});

// Helper functions for generating test data

function generateSyntheticDataset() {
  const normalData: number[][] = [];
  const anomalousData: number[][] = [];

  // Generate normal network traffic patterns
  for (let i = 0; i < 300; i++) {
    normalData.push([
      1000 + Math.random() * 3000,      // Normal packet sizes
      5 + Math.random() * 30,           // Normal connection frequency
      1 + Math.floor(Math.random() * 8), // Normal port diversity
      Math.floor(Math.random() * 3),    // Common protocols
      10000 + Math.random() * 200000,   // Normal byte rates
      60 + Math.random() * 3600,        // Normal connection duration
      0.4 + Math.random() * 0.4,        // Good reputation ranges
      0.4 + Math.random() * 0.4,
      Math.floor(Math.random() * 24),   // Any time of day
      Math.floor(Math.random() * 7)     // Any day of week
    ]);
  }

  // Generate anomalous patterns
  for (let i = 0; i < 100; i++) {
    anomalousData.push([
      Math.random() < 0.5 ? 
        Math.random() * 500 :           // Very small packets
        20000 + Math.random() * 80000,  // Very large packets
      Math.random() < 0.5 ?
        Math.random() * 2 :             // Very low frequency
        100 + Math.random() * 900,      // Very high frequency
      Math.random() < 0.5 ? 0 : 20 + Math.random() * 80, // Extreme port diversity
      Math.floor(Math.random() * 2) === 0 ? 99 : Math.floor(Math.random() * 5), // Unusual protocols
      Math.random() < 0.5 ?
        Math.random() * 1000 :          // Very low byte rate
        1000000 + Math.random() * 9000000, // Very high byte rate
      Math.random() < 0.5 ?
        Math.random() * 10 :            // Very short duration
        7200 + Math.random() * 86400,   // Very long duration
      Math.random() * 0.3,              // Poor reputation
      Math.random() * 0.3,
      Math.floor(Math.random() * 24),
      Math.floor(Math.random() * 7)
    ]);
  }

  const allFeatures = [...normalData, ...anomalousData];
  const allLabels = [
    ...new Array(normalData.length).fill(false),
    ...new Array(anomalousData.length).fill(true)
  ];

  const trainingData: TrainingData = {
    features: allFeatures,
    labels: allLabels,
    metadata: {
      size: allFeatures.length,
      source: 'synthetic-accuracy-test',
      version: '1.0',
      createdAt: new Date().toISOString()
    }
  };

  return { normalData, anomalousData, trainingData };
}

function generateTrainingDataset(size: number): TrainingData {
  const features: number[][] = [];
  const labels: boolean[] = [];

  const anomalyRatio = 0.1; // 10% anomalies
  const numAnomalies = Math.floor(size * anomalyRatio);

  // Generate normal samples
  for (let i = 0; i < size - numAnomalies; i++) {
    features.push([
      1000 + Math.random() * 3000,
      5 + Math.random() * 30,
      1 + Math.floor(Math.random() * 8),
      Math.floor(Math.random() * 3),
      10000 + Math.random() * 200000,
      60 + Math.random() * 3600,
      0.4 + Math.random() * 0.4,
      0.4 + Math.random() * 0.4,
      Math.floor(Math.random() * 24),
      Math.floor(Math.random() * 7)
    ]);
    labels.push(false);
  }

  // Generate anomalous samples
  for (let i = 0; i < numAnomalies; i++) {
    features.push([
      Math.random() < 0.5 ? Math.random() * 500 : 20000 + Math.random() * 80000,
      Math.random() < 0.5 ? Math.random() * 2 : 100 + Math.random() * 900,
      Math.random() < 0.5 ? 0 : 20 + Math.random() * 80,
      99,
      Math.random() < 0.5 ? Math.random() * 1000 : 1000000 + Math.random() * 9000000,
      Math.random() < 0.5 ? Math.random() * 10 : 7200 + Math.random() * 86400,
      Math.random() * 0.3,
      Math.random() * 0.3,
      Math.floor(Math.random() * 24),
      Math.floor(Math.random() * 7)
    ]);
    labels.push(true);
  }

  return {
    features,
    labels,
    metadata: {
      size: features.length,
      source: 'synthetic-training',
      version: '1.0',
      createdAt: new Date().toISOString()
    }
  };
}

function generateValidationSet(): Array<{ features: number[]; label: boolean }> {
  const validationSet: Array<{ features: number[]; label: boolean }> = [];

  // Add normal samples
  for (let i = 0; i < 80; i++) {
    validationSet.push({
      features: [
        1000 + Math.random() * 3000,
        5 + Math.random() * 30,
        1 + Math.floor(Math.random() * 8),
        Math.floor(Math.random() * 3),
        10000 + Math.random() * 200000,
        60 + Math.random() * 3600,
        0.4 + Math.random() * 0.4,
        0.4 + Math.random() * 0.4,
        Math.floor(Math.random() * 24),
        Math.floor(Math.random() * 7)
      ],
      label: false
    });
  }

  // Add anomalous samples
  for (let i = 0; i < 20; i++) {
    validationSet.push({
      features: [
        Math.random() < 0.5 ? Math.random() * 500 : 20000 + Math.random() * 80000,
        Math.random() < 0.5 ? Math.random() * 2 : 100 + Math.random() * 900,
        Math.random() < 0.5 ? 0 : 20 + Math.random() * 80,
        99,
        Math.random() < 0.5 ? Math.random() * 1000 : 1000000 + Math.random() * 9000000,
        Math.random() < 0.5 ? Math.random() * 10 : 7200 + Math.random() * 86400,
        Math.random() * 0.3,
        Math.random() * 0.3,
        Math.floor(Math.random() * 24),
        Math.floor(Math.random() * 7)
      ],
      label: true
    });
  }

  return validationSet;
}

async function calculateAccuracy(
  model: IsolationForestModel, 
  validationSet: Array<{ features: number[]; label: boolean }>
): Promise<number> {
  let correct = 0;

  for (const sample of validationSet) {
    const input: AnomalyDetectionInput = {
      features: sample.features,
      timestamp: new Date().toISOString()
    };

    const result = await model.predict(input);
    if (result.isAnomaly === sample.label) {
      correct++;
    }
  }

  return correct / validationSet.length;
}

function generateNormalSamples(count: number): number[][] {
  const samples: number[][] = [];
  
  for (let i = 0; i < count; i++) {
    samples.push([
      1000 + Math.random() * 3000,
      5 + Math.random() * 30,
      1 + Math.floor(Math.random() * 8),
      Math.floor(Math.random() * 3),
      10000 + Math.random() * 200000,
      60 + Math.random() * 3600,
      0.4 + Math.random() * 0.4,
      0.4 + Math.random() * 0.4,
      Math.floor(Math.random() * 24),
      Math.floor(Math.random() * 7)
    ]);
  }
  
  return samples;
}

function generateObviousAnomalies(count: number): number[][] {
  const anomalies: number[][] = [];
  
  for (let i = 0; i < count; i++) {
    anomalies.push([
      Math.random() < 0.5 ? 50 : 100000,           // Extreme packet sizes
      Math.random() < 0.5 ? 0.1 : 2000,           // Extreme frequencies
      Math.random() < 0.5 ? 0 : 100,              // Extreme port diversity
      99,                                          // Unknown protocol
      Math.random() < 0.5 ? 1 : 50000000,         // Extreme byte rates
      Math.random() < 0.5 ? 0.1 : 172800,         // Extreme durations
      Math.random() * 0.1,                        // Very poor reputation
      Math.random() * 0.1,
      Math.floor(Math.random() * 24),
      Math.floor(Math.random() * 7)
    ]);
  }
  
  return anomalies;
}

function generateTimeWindows(hours: number): string[] {
  const windows: string[] = [];
  const baseTime = new Date('2024-01-01T00:00:00Z');
  
  for (let i = 0; i < hours; i++) {
    const time = new Date(baseTime.getTime() + i * 60 * 60 * 1000);
    windows.push(time.toISOString());
  }
  
  return windows;
}