import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createServer } from 'http';
import { parse } from 'url';
import { NextApiHandler } from 'next';

// Import API handlers
import modelStatusHandler from '@/pages/api/ml/model-status';

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock('@/lib/auth/middleware', () => ({
  withAuth: (handler: NextApiHandler) => handler,
  validateApiKey: vi.fn().mockResolvedValue(true)
}));

vi.mock('@/ml/models/base/model-registry', () => ({
  mlModelRegistry: {
    getModel: vi.fn().mockResolvedValue({
      id: 'test_model_1',
      name: 'Test Isolation Forest',
      type: 'isolation_forest',
      version: '1.0.0',
      status: 'active',
      accuracy: 0.94,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }),
    listModels: vi.fn().mockResolvedValue([
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
    ])
  }
}));

describe('ML API Integration Tests - Model Status', () => {
  let server: any;

  beforeEach(() => {
    // Create test server
    server = createServer((req, res) => {
      const { pathname } = parse(req.url || '', true);
      
      if (pathname === '/api/ml/model-status') {
        return modelStatusHandler(req as any, res as any);
      }
      
      res.statusCode = 404;
      res.end('Not Found');
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (server) {
      server.close();
    }
  });

  describe('GET /api/ml/model-status', () => {
    it('should return all model statuses', async () => {
      const response = await request(server)
        .get('/api/ml/model-status')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);

      response.body.data.forEach((modelStatus: any) => {
        expect(modelStatus).toHaveProperty('modelId');
        expect(modelStatus).toHaveProperty('name');
        expect(modelStatus).toHaveProperty('type');
        expect(modelStatus).toHaveProperty('status');
        expect(modelStatus).toHaveProperty('health');
        expect(modelStatus).toHaveProperty('accuracy');
        expect(modelStatus).toHaveProperty('performance');
        expect(modelStatus).toHaveProperty('usage');
        expect(modelStatus).toHaveProperty('configuration');
        expect(modelStatus).toHaveProperty('capabilities');
      });
    });

    it('should return specific model status with modelId parameter', async () => {
      const modelId = 'test_model_1';
      
      const response = await request(server)
        .get(`/api/ml/model-status?modelId=${modelId}`)
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.modelId).toBe(modelId);
      expect(response.body.data.name).toBeDefined();
      expect(response.body.data.type).toBeDefined();
      expect(response.body.data.status).toBeDefined();
    });

    it('should validate model health metrics structure', async () => {
      const response = await request(server)
        .get('/api/ml/model-status?modelId=test_model_1')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      const health = response.body.data.health;
      expect(health.lastHealthCheck).toBeDefined();
      expect(['healthy', 'warning', 'critical'].includes(health.overallHealth)).toBe(true);
      expect(health.healthScore).toBeGreaterThanOrEqual(0);
      expect(health.healthScore).toBeLessThanOrEqual(100);
      expect(health.componentChecks).toBeInstanceOf(Array);
      expect(health.issues).toBeInstanceOf(Array);
      expect(health.uptime).toBeGreaterThan(0);

      // Component checks validation
      health.componentChecks.forEach((check: any) => {
        expect(check).toHaveProperty('component');
        expect(check).toHaveProperty('status');
        expect(check).toHaveProperty('lastCheck');
        expect(['healthy', 'warning', 'critical'].includes(check.status)).toBe(true);
      });
    });

    it('should validate accuracy metrics structure', async () => {
      const response = await request(server)
        .get('/api/ml/model-status?modelId=test_model_1')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      const accuracy = response.body.data.accuracy;
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

    it('should validate performance metrics structure', async () => {
      const response = await request(server)
        .get('/api/ml/model-status?modelId=test_model_1')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      const performance = response.body.data.performance;
      expect(performance.averageInferenceTime).toBeGreaterThan(0);
      expect(performance.throughput).toBeGreaterThan(0);
      expect(performance.errorRate).toBeGreaterThanOrEqual(0);
      expect(performance.memoryUsage).toBeGreaterThan(0);
      expect(performance.cpuUsage).toBeGreaterThan(0);
      expect(performance.diskUsage).toBeGreaterThan(0);
      expect(performance.lastBenchmark).toBeDefined();
    });

    it('should validate usage statistics structure', async () => {
      const response = await request(server)
        .get('/api/ml/model-status?modelId=test_model_1')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      const usage = response.body.data.usage;
      expect(usage.totalPredictions).toBeGreaterThanOrEqual(0);
      expect(usage.predictionsToday).toBeGreaterThanOrEqual(0);
      expect(usage.averagePredictionsPerDay).toBeGreaterThanOrEqual(0);
      expect(usage.lastPrediction).toBeDefined();
      expect(usage.activeSessions).toBeGreaterThanOrEqual(0);
      expect(usage.usagePattern).toBeDefined();
    });

    it('should handle non-existent model gracefully', async () => {
      // Mock non-existent model
      const mockModelRegistry = vi.mocked(require('@/ml/models/base/model-registry'));
      mockModelRegistry.mlModelRegistry.getModel.mockResolvedValueOnce(null);

      const response = await request(server)
        .get('/api/ml/model-status?modelId=non_existent_model')
        .set('x-api-key', 'test-api-key')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Model not found');
    });

    it('should handle registry errors gracefully', async () => {
      // Mock registry error
      const mockModelRegistry = vi.mocked(require('@/ml/models/base/model-registry'));
      mockModelRegistry.mlModelRegistry.getModel.mockRejectedValueOnce(
        new Error('Registry connection failed')
      );

      const response = await request(server)
        .get('/api/ml/model-status?modelId=test_model_1')
        .set('x-api-key', 'test-api-key')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should handle empty model registry', async () => {
      // Mock empty registry
      const mockModelRegistry = vi.mocked(require('@/ml/models/base/model-registry'));
      mockModelRegistry.mlModelRegistry.listModels.mockResolvedValueOnce([]);

      const response = await request(server)
        .get('/api/ml/model-status')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(0);
    });

    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = Array(8).fill(null).map((_, i) =>
        request(server)
          .get(`/api/ml/model-status${i % 2 === 0 ? '?modelId=test_model_1' : ''}`)
          .set('x-api-key', 'test-api-key')
      );

      const responses = await Promise.all(concurrentRequests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it('should return results within acceptable time limits', async () => {
      const startTime = Date.now();
      
      const response = await request(server)
        .get('/api/ml/model-status')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
      expect(response.body.data).toBeDefined();
    });
  });

  describe('Authentication and Authorization', () => {
    it('should reject requests without API key', async () => {
      const response = await request(server)
        .get('/api/ml/model-status')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing API key');
    });

    it('should reject requests with invalid API key', async () => {
      // Mock auth failure
      const mockAuth = vi.mocked(require('@/lib/auth/middleware'));
      mockAuth.validateApiKey.mockResolvedValueOnce(false);

      const response = await request(server)
        .get('/api/ml/model-status')
        .set('x-api-key', 'invalid-api-key')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid API key');
    });

    it('should handle API key validation errors', async () => {
      // Mock auth service error
      const mockAuth = vi.mocked(require('@/lib/auth/middleware'));
      mockAuth.validateApiKey.mockRejectedValueOnce(new Error('Auth service unavailable'));

      const response = await request(server)
        .get('/api/ml/model-status')
        .set('x-api-key', 'test-api-key')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Method validation', () => {
    it('should only accept GET requests', async () => {
      const response = await request(server)
        .post('/api/ml/model-status')
        .send({})
        .set('x-api-key', 'test-api-key')
        .expect(405);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Method not allowed');
    });

    it('should reject PUT requests', async () => {
      const response = await request(server)
        .put('/api/ml/model-status')
        .send({})
        .set('x-api-key', 'test-api-key')
        .expect(405);

      expect(response.body.success).toBe(false);
    });

    it('should reject DELETE requests', async () => {
      const response = await request(server)
        .delete('/api/ml/model-status')
        .set('x-api-key', 'test-api-key')
        .expect(405);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Response format validation', () => {
    it('should return consistent response structure', async () => {
      const response = await request(server)
        .get('/api/ml/model-status')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      // Validate response structure
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('correlationId');

      // Validate content type
      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should include proper CORS headers', async () => {
      const response = await request(server)
        .get('/api/ml/model-status')
        .set('x-api-key', 'test-api-key')
        .set('Origin', 'https://example.com')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });

    it('should validate correlation ID format', async () => {
      const response = await request(server)
        .get('/api/ml/model-status')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.correlationId).toMatch(/^[a-f0-9-]{36}$/); // UUID format
    });

    it('should validate timestamp format', async () => {
      const response = await request(server)
        .get('/api/ml/model-status')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.getTime()).toBeGreaterThan(0); // Valid date
      expect(Math.abs(Date.now() - timestamp.getTime())).toBeLessThan(5000); // Recent timestamp
    });
  });

  describe('Query parameter validation', () => {
    it('should handle invalid modelId parameter gracefully', async () => {
      const response = await request(server)
        .get('/api/ml/model-status?modelId=')
        .set('x-api-key', 'test-api-key')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid model ID');
    });

    it('should handle malformed query parameters', async () => {
      const response = await request(server)
        .get('/api/ml/model-status?modelId=%invalid%')
        .set('x-api-key', 'test-api-key')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should ignore unknown query parameters', async () => {
      const response = await request(server)
        .get('/api/ml/model-status?modelId=test_model_1&unknownParam=value')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.modelId).toBe('test_model_1');
    });
  });

  describe('Error handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      // Mock unexpected error
      const mockModelRegistry = vi.mocked(require('@/ml/models/base/model-registry'));
      mockModelRegistry.mlModelRegistry.getModel.mockImplementationOnce(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(server)
        .get('/api/ml/model-status?modelId=test_model_1')
        .set('x-api-key', 'test-api-key')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.correlationId).toBeDefined();
    });

    it('should handle timeout scenarios', async () => {
      // Mock slow response
      const mockModelRegistry = vi.mocked(require('@/ml/models/base/model-registry'));
      mockModelRegistry.mlModelRegistry.getModel.mockImplementationOnce(() => 
        new Promise((resolve) => setTimeout(() => resolve(null), 10000))
      );

      const response = await request(server)
        .get('/api/ml/model-status?modelId=test_model_1')
        .set('x-api-key', 'test-api-key')
        .timeout(2000); // 2 second timeout

      // The request should either complete or timeout gracefully
      expect([200, 404, 500, 408].includes(response.status)).toBe(true);
    });
  });
});