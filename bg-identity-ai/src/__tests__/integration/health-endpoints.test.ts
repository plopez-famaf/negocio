import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '@/index';
import { redisClient } from '@/lib/redis-client';

describe('Health Endpoints Integration Tests', () => {
  beforeAll(async () => {
    // Wait for Redis connection if needed
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Clean up connections
    if (redisClient && typeof redisClient.quit === 'function') {
      try {
        await redisClient.quit();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('GET /health', () => {
    it('should return basic health status with Redis info', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        service: 'bg-identity-ai',
        status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        memory: expect.objectContaining({
          rss: expect.any(Number),
          heapTotal: expect.any(Number),
          heapUsed: expect.any(Number)
        }),
        version: expect.any(String),
        redis: expect.objectContaining({
          status: expect.stringMatching(/^(connected|disconnected|connecting|error)$/),
          responseTime: expect.any(Number),
          uptime: expect.any(Number),
          hitRate: expect.any(Number)
        })
      });
    });

    it('should return healthy status when Redis is connected', async () => {
      // Assuming Redis is running for integration tests
      const response = await request(app)
        .get('/health')
        .expect(200);

      // If Redis is connected, overall status should be healthy
      if (response.body.redis.status === 'connected') {
        expect(response.body.status).toBe('healthy');
      }
    });
  });

  describe('GET /health/ready', () => {
    it('should return readiness status', async () => {
      const response = await request(app)
        .get('/health/ready')
        .expect((res) => {
          expect([200, 503]).toContain(res.status);
        });

      expect(response.body).toMatchObject({
        service: 'bg-identity-ai',
        ready: expect.any(Boolean),
        timestamp: expect.any(String),
        checks: expect.objectContaining({
          redis: expect.objectContaining({
            ready: expect.any(Boolean),
            status: expect.stringMatching(/^(connected|disconnected|connecting|error)$/),
            responseTime: expect.any(Number)
          })
        })
      });
    });

    it('should return 200 when Redis is ready', async () => {
      const response = await request(app)
        .get('/health/ready');

      // If Redis is connected, should return 200
      if (response.body.checks.redis.status === 'connected') {
        expect(response.status).toBe(200);
        expect(response.body.ready).toBe(true);
      }
    });
  });

  describe('GET /health/redis', () => {
    it('should return detailed Redis health metrics', async () => {
      const response = await request(app)
        .get('/health/redis')
        .expect((res) => {
          expect([200, 503]).toContain(res.status);
        });

      expect(response.body).toMatchObject({
        service: 'bg-identity-ai',
        component: 'redis',
        timestamp: expect.any(String),
        connection: expect.objectContaining({
          status: expect.stringMatching(/^(connected|disconnected|connecting|error)$/),
          uptime: expect.any(Number),
          lastCheck: expect.any(String),
          responseTime: expect.any(Number),
          connectionAttempts: expect.any(Number)
        }),
        performance: expect.objectContaining({
          avgLatency: expect.any(Number),
          operationsPerSecond: expect.any(Number),
          memoryUsage: expect.any(Number),
          connectedClients: expect.any(Number),
          totalConnectionsReceived: expect.any(Number),
          keyspaceHits: expect.any(Number),
          keyspaceMisses: expect.any(Number)
        }),
        cache: expect.objectContaining({
          hitRate: expect.any(Number),
          totalRequests: expect.any(Number),
          totalHits: expect.any(Number),
          totalMisses: expect.any(Number),
          evictedKeys: expect.any(Number),
          expiredKeys: expect.any(Number),
          keysCount: expect.any(Number)
        }),
        errors: expect.objectContaining({
          connectionErrors: expect.any(Number),
          operationTimeouts: expect.any(Number),
          errorRate: expect.any(Number)
        }),
        overallStatus: expect.stringMatching(/^(healthy|degraded|unhealthy)$/)
      });
    });

    it('should return 200 for healthy Redis status', async () => {
      const response = await request(app)
        .get('/health/redis');

      if (response.body.overallStatus === 'healthy') {
        expect(response.status).toBe(200);
      }
    });

    it('should return 503 for unhealthy Redis status', async () => {
      const response = await request(app)
        .get('/health/redis');

      if (response.body.overallStatus === 'unhealthy') {
        expect(response.status).toBe(503);
      }
    });
  });

  describe('GET /health/detailed', () => {
    it('should return comprehensive system health', async () => {
      const response = await request(app)
        .get('/health/detailed')
        .expect((res) => {
          expect([200, 503]).toContain(res.status);
        });

      expect(response.body).toMatchObject({
        service: 'bg-identity-ai',
        timestamp: expect.any(String),
        overallStatus: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
        uptime: expect.any(Number),
        memory: expect.objectContaining({
          rss: expect.any(Number),
          heapTotal: expect.any(Number),
          heapUsed: expect.any(Number)
        }),
        version: expect.any(String),
        components: expect.objectContaining({
          redis: expect.objectContaining({
            connection: expect.any(Object),
            performance: expect.any(Object),
            cache: expect.any(Object),
            errors: expect.any(Object),
            overallStatus: expect.stringMatching(/^(healthy|degraded|unhealthy)$/)
          }),
          node: expect.objectContaining({
            version: expect.any(String),
            platform: expect.any(String),
            arch: expect.any(String),
            pid: expect.any(Number)
          })
        })
      });
    });

    it('should correlate overall status with Redis status', async () => {
      const response = await request(app)
        .get('/health/detailed');

      // If Redis is healthy, overall status should be healthy
      if (response.body.components.redis.overallStatus === 'healthy') {
        expect(response.body.overallStatus).toBe('healthy');
      }

      // If Redis is unhealthy, overall status should not be healthy
      if (response.body.components.redis.overallStatus === 'unhealthy') {
        expect(response.body.overallStatus).not.toBe('healthy');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection failures gracefully', async () => {
      // This test assumes Redis might be down
      const response = await request(app)
        .get('/health')
        .expect((res) => {
          expect([200, 503]).toContain(res.status);
        });

      // Even if Redis is down, the endpoint should respond
      expect(response.body).toHaveProperty('service', 'bg-identity-ai');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should provide error information when health checks fail', async () => {
      // Test endpoint error handling
      const response = await request(app)
        .get('/health/redis')
        .expect((res) => {
          expect([200, 503]).toContain(res.status);
        });

      if (response.status === 503) {
        expect(response.body.overallStatus).toBe('unhealthy');
      }
    });
  });

  describe('Performance', () => {
    it('should respond to health checks within reasonable time', async () => {
      const start = Date.now();
      
      await request(app)
        .get('/health')
        .expect(200);
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should respond to detailed health checks within reasonable time', async () => {
      const start = Date.now();
      
      await request(app)
        .get('/health/detailed')
        .expect((res) => {
          expect([200, 503]).toContain(res.status);
        });
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2000); // Should respond within 2 seconds
    });
  });
});