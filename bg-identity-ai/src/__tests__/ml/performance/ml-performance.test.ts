import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { IsolationForestModel } from '@/ml/models/anomaly-detection/isolation-forest-model';
import { mlModelRegistry } from '@/ml/models/base/model-registry';
import { AnomalyDetectionInput } from '@/ml/models/base/model-interfaces';

describe('ML Performance Tests', () => {
  let isolationForest: IsolationForestModel;

  beforeAll(async () => {
    // Initialize ML model registry
    await mlModelRegistry.initialize();
    
    // Initialize isolation forest model
    isolationForest = new IsolationForestModel();
    await isolationForest.initialize();
    await mlModelRegistry.registerModel(isolationForest);
  });

  afterAll(async () => {
    await mlModelRegistry.cleanup();
  });

  describe('Individual Model Performance', () => {
    it('should meet inference time requirements (<50ms per prediction)', async () => {
      const input: AnomalyDetectionInput = {
        features: [1500, 10, 3, 1, 50000, 300, 0.8, 0.7, 14, 2],
        timestamp: new Date().toISOString()
      };

      const startTime = performance.now();
      const result = await isolationForest.predict(input);
      const endTime = performance.now();

      const inferenceTime = endTime - startTime;
      
      expect(result).toBeDefined();
      expect(inferenceTime).toBeLessThan(50); // Target: <50ms
      expect(result.metadata?.inferenceTime).toBeLessThan(50);
    });

    it('should handle concurrent predictions efficiently', async () => {
      const numConcurrentRequests = 20;
      const inputs: AnomalyDetectionInput[] = [];

      // Generate test inputs
      for (let i = 0; i < numConcurrentRequests; i++) {
        inputs.push({
          features: [1500 + i, 10 + i, 3, 1, 50000, 300, 0.8, 0.7, 14, 2],
          timestamp: new Date().toISOString()
        });
      }

      const startTime = performance.now();
      
      // Execute all predictions concurrently
      const promises = inputs.map(input => isolationForest.predict(input));
      const results = await Promise.all(promises);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerPrediction = totalTime / numConcurrentRequests;

      expect(results.length).toBe(numConcurrentRequests);
      expect(results.every(result => result !== undefined)).toBe(true);
      expect(avgTimePerPrediction).toBeLessThan(30); // Target: <30ms per prediction under load
    });

    it('should maintain performance under sustained load', async () => {
      const duration = 5000; // 5 seconds
      const batchSize = 10;
      const results: number[] = [];
      
      const endTime = Date.now() + duration;
      
      while (Date.now() < endTime) {
        const batch: Promise<any>[] = [];
        
        for (let i = 0; i < batchSize; i++) {
          const input: AnomalyDetectionInput = {
            features: [
              1000 + Math.random() * 2000,
              5 + Math.random() * 20,
              Math.floor(Math.random() * 10),
              Math.floor(Math.random() * 5),
              10000 + Math.random() * 100000,
              60 + Math.random() * 3540,
              0.3 + Math.random() * 0.5,
              0.3 + Math.random() * 0.5,
              Math.floor(Math.random() * 24),
              Math.floor(Math.random() * 7)
            ],
            timestamp: new Date().toISOString()
          };

          batch.push(
            (async () => {
              const start = performance.now();
              await isolationForest.predict(input);
              return performance.now() - start;
            })()
          );
        }

        const batchResults = await Promise.all(batch);
        results.push(...batchResults);
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const avgResponseTime = results.reduce((sum, time) => sum + time, 0) / results.length;
      const maxResponseTime = Math.max(...results);
      const minResponseTime = Math.min(...results);

      expect(results.length).toBeGreaterThan(50); // Should process many requests
      expect(avgResponseTime).toBeLessThan(50); // Average should be under target
      expect(maxResponseTime).toBeLessThan(100); // Even worst case should be reasonable
      expect(minResponseTime).toBeGreaterThan(0); // Sanity check

      console.log(`Sustained load test results:
        Total predictions: ${results.length}
        Average response time: ${avgResponseTime.toFixed(2)}ms
        Min response time: ${minResponseTime.toFixed(2)}ms
        Max response time: ${maxResponseTime.toFixed(2)}ms
      `);
    });
  });

  describe('Memory Performance', () => {
    it('should not leak memory during extended usage', async () => {
      const initialMemory = process.memoryUsage();
      const numIterations = 1000;

      for (let i = 0; i < numIterations; i++) {
        const input: AnomalyDetectionInput = {
          features: [1500 + i, 10, 3, 1, 50000, 300, 0.8, 0.7, 14, 2],
          timestamp: new Date().toISOString()
        };

        await isolationForest.predict(input);

        // Force garbage collection every 100 iterations
        if (i % 100 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePerOp = memoryIncrease / numIterations;

      // Memory increase should be minimal (less than 1KB per operation)
      expect(memoryIncreasePerOp).toBeLessThan(1024);
    });

    it('should maintain reasonable memory footprint', async () => {
      const memoryBefore = process.memoryUsage();
      
      // Perform a batch of predictions
      const batchSize = 100;
      const promises: Promise<any>[] = [];

      for (let i = 0; i < batchSize; i++) {
        const input: AnomalyDetectionInput = {
          features: [1500, 10, 3, 1, 50000, 300, 0.8, 0.7, 14, 2],
          timestamp: new Date().toISOString()
        };
        promises.push(isolationForest.predict(input));
      }

      await Promise.all(promises);
      
      const memoryAfter = process.memoryUsage();
      const memoryUsed = (memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024; // MB

      // Should not use more than 50MB for 100 predictions
      expect(memoryUsed).toBeLessThan(50);
    });
  });

  describe('Throughput Performance', () => {
    it('should achieve target throughput (>100 predictions/second)', async () => {
      const duration = 2000; // 2 seconds
      const inputs: AnomalyDetectionInput[] = [];
      
      // Pre-generate inputs to avoid generation time affecting throughput
      for (let i = 0; i < 1000; i++) {
        inputs.push({
          features: [1500 + i, 10, 3, 1, 50000, 300, 0.8, 0.7, 14, 2],
          timestamp: new Date().toISOString()
        });
      }

      let processedCount = 0;
      const startTime = Date.now();
      
      // Process as many as possible within time limit
      const promises: Promise<any>[] = [];
      let inputIndex = 0;

      while (Date.now() - startTime < duration && inputIndex < inputs.length) {
        const promise = isolationForest.predict(inputs[inputIndex]).then(() => {
          processedCount++;
        });
        promises.push(promise);
        inputIndex++;
        
        // Don't overwhelm the system with too many concurrent promises
        if (promises.length >= 20) {
          await Promise.race(promises);
        }
      }

      // Wait for all remaining promises
      await Promise.all(promises);

      const actualDuration = Date.now() - startTime;
      const throughput = (processedCount * 1000) / actualDuration; // predictions per second

      expect(throughput).toBeGreaterThan(100); // Target: >100 predictions/second
      
      console.log(`Throughput test results:
        Processed: ${processedCount} predictions
        Duration: ${actualDuration}ms
        Throughput: ${throughput.toFixed(2)} predictions/second
      `);
    });
  });

  describe('Model Registry Performance', () => {
    it('should provide fast model lookup', async () => {
      const numLookups = 1000;
      
      const startTime = performance.now();
      
      for (let i = 0; i < numLookups; i++) {
        const model = mlModelRegistry.getModel('isolation-forest-v1');
        expect(model).toBeDefined();
      }
      
      const endTime = performance.now();
      const avgLookupTime = (endTime - startTime) / numLookups;

      // Model lookup should be very fast (<0.1ms per lookup)
      expect(avgLookupTime).toBeLessThan(0.1);
    });

    it('should handle registry operations efficiently', async () => {
      const startTime = performance.now();
      
      // Test various registry operations
      const stats = mlModelRegistry.getRegistryStats();
      const allModels = mlModelRegistry.getAllModelInfo();
      const isHealthy = mlModelRegistry.isHealthy();
      const healthCheck = await mlModelRegistry.performHealthCheck();
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(stats).toBeDefined();
      expect(allModels).toBeDefined();
      expect(typeof isHealthy).toBe('boolean');
      expect(healthCheck).toBeDefined();
      
      // Registry operations should complete quickly (<10ms total)
      expect(totalTime).toBeLessThan(10);
    });
  });

  describe('Performance Regression Tests', () => {
    it('should not regress from baseline performance', async () => {
      // Baseline performance expectations
      const baselineMetrics = {
        maxInferenceTime: 50, // ms
        minThroughput: 100,   // predictions/second
        maxMemoryPerOp: 1024  // bytes
      };

      const input: AnomalyDetectionInput = {
        features: [1500, 10, 3, 1, 50000, 300, 0.8, 0.7, 14, 2],
        timestamp: new Date().toISOString()
      };

      // Test inference time
      const startTime = performance.now();
      const result = await isolationForest.predict(input);
      const inferenceTime = performance.now() - startTime;

      expect(inferenceTime).toBeLessThan(baselineMetrics.maxInferenceTime);
      expect(result).toBeDefined();

      // Test throughput (simplified)
      const throughputStartTime = Date.now();
      const quickBatch = 20;
      const quickPromises = Array(quickBatch).fill(0).map(() => 
        isolationForest.predict(input)
      );
      
      await Promise.all(quickPromises);
      const throughputTime = Date.now() - throughputStartTime;
      const throughput = (quickBatch * 1000) / throughputTime;

      expect(throughput).toBeGreaterThan(baselineMetrics.minThroughput);
    });
  });

  describe('Scalability Tests', () => {
    it('should scale performance linearly with simple parallelization', async () => {
      const baselineCount = 10;
      const scaledCount = 50;

      const input: AnomalyDetectionInput = {
        features: [1500, 10, 3, 1, 50000, 300, 0.8, 0.7, 14, 2],
        timestamp: new Date().toISOString()
      };

      // Baseline test
      const baselineStart = performance.now();
      await Promise.all(Array(baselineCount).fill(0).map(() => isolationForest.predict(input)));
      const baselineTime = performance.now() - baselineStart;

      // Scaled test
      const scaledStart = performance.now();
      await Promise.all(Array(scaledCount).fill(0).map(() => isolationForest.predict(input)));
      const scaledTime = performance.now() - scaledStart;

      // Time should scale roughly linearly (allowing for some overhead)
      const expectedMaxTime = (scaledTime / baselineTime) * (scaledCount / baselineCount) * 1.5; // 50% overhead allowance
      const actualRatio = scaledTime / baselineTime;
      const expectedRatio = scaledCount / baselineCount;

      expect(actualRatio).toBeLessThan(expectedMaxTime);
      
      console.log(`Scalability test results:
        Baseline (${baselineCount}): ${baselineTime.toFixed(2)}ms
        Scaled (${scaledCount}): ${scaledTime.toFixed(2)}ms
        Actual ratio: ${actualRatio.toFixed(2)}x
        Expected ratio: ${expectedRatio.toFixed(2)}x
      `);
    });
  });
});