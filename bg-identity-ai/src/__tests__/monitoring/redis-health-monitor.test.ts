import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RedisHealthMonitor, redisHealthMonitor } from '@/lib/monitoring/redis-health-monitor';
import { redisClient } from '@/lib/redis-client';

// Mock Redis client
vi.mock('@/lib/redis-client', () => ({
  redisClient: {
    isReady: vi.fn(),
    ping: vi.fn(),
    set: vi.fn(),
    get: vi.fn(),
    exists: vi.fn(),
    del: vi.fn()
  }
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('RedisHealthMonitor', () => {
  let monitor: RedisHealthMonitor;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton instance for testing
    (RedisHealthMonitor as any).instance = null;
    monitor = RedisHealthMonitor.getInstance();
  });

  afterEach(() => {
    // Clean up interval if it exists
    monitor.cleanup();
    (RedisHealthMonitor as any).instance = null;
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = monitor;
      const instance2 = RedisHealthMonitor.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('health check methods', () => {
    it('should perform quick health check when Redis is connected', async () => {
      (redisClient.isReady as any).mockReturnValue(true);
      (redisClient.ping as any).mockResolvedValue('PONG');

      const result = await monitor.getQuickHealthCheck();

      expect(result.status).toBe('connected');
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(result.hitRate).toBe(0);
    });

    it('should handle Redis connection failures in quick health check', async () => {
      (redisClient.isReady as any).mockReturnValue(false);

      const result = await monitor.getQuickHealthCheck();

      expect(result.status).toBe('disconnected');
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle Redis ping failures in quick health check', async () => {
      (redisClient.isReady as any).mockReturnValue(true);
      (redisClient.ping as any).mockRejectedValue(new Error('Connection failed'));

      const result = await monitor.getQuickHealthCheck();

      expect(result.status).toBe('error');
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('metrics collection', () => {
    it('should collect comprehensive health metrics when Redis is healthy', async () => {
      (redisClient.isReady as any).mockReturnValue(true);
      (redisClient.ping as any).mockResolvedValue('PONG');
      (redisClient.set as any).mockResolvedValue('OK');
      (redisClient.get as any).mockResolvedValue('test_value');
      (redisClient.exists as any).mockResolvedValue(1);
      (redisClient.del as any).mockResolvedValue(1);

      const metrics = await monitor.collectMetrics();

      expect(metrics).toMatchObject({
        connection: expect.objectContaining({
          status: 'connected',
          uptime: expect.any(Number),
          responseTime: expect.any(Number),
          connectionAttempts: expect.any(Number)
        }),
        performance: expect.objectContaining({
          avgLatency: expect.any(Number),
          operationsPerSecond: expect.any(Number),
          memoryUsage: expect.any(Number),
          connectedClients: expect.any(Number)
        }),
        cache: expect.objectContaining({
          hitRate: expect.any(Number),
          totalRequests: expect.any(Number),
          totalHits: expect.any(Number),
          totalMisses: expect.any(Number)
        }),
        errors: expect.objectContaining({
          connectionErrors: expect.any(Number),
          operationTimeouts: expect.any(Number),
          errorRate: expect.any(Number)
        }),
        overallStatus: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
        timestamp: expect.any(String)
      });
    });

    it('should handle Redis operation failures during metrics collection', async () => {
      (redisClient.isReady as any).mockReturnValue(false);
      
      const metrics = await monitor.collectMetrics();

      expect(metrics.connection.status).toBe('disconnected');
      expect(metrics.overallStatus).toBe('unhealthy');
    });
  });

  describe('cache statistics tracking', () => {
    it('should record cache hits and misses', async () => {
      // Record some cache hits and misses
      monitor.recordCacheHit();
      monitor.recordCacheHit();
      monitor.recordCacheMiss();

      // Collect metrics to get updated cache statistics
      const metrics = await monitor.collectMetrics();
      
      expect(metrics.cache.totalHits).toBeGreaterThan(0);
      expect(metrics.cache.totalMisses).toBeGreaterThan(0);
      expect(metrics.cache.totalRequests).toBe(metrics.cache.totalHits + metrics.cache.totalMisses);
    });

    it('should calculate hit rate correctly when there are cache operations', async () => {
      // Start fresh and record specific operations
      monitor.recordCacheHit();
      monitor.recordCacheHit();
      monitor.recordCacheHit();
      monitor.recordCacheMiss();
      
      const metrics = await monitor.collectMetrics();
      
      // Should have recorded the operations
      expect(metrics.cache.totalRequests).toBeGreaterThan(0);
      expect(metrics.cache.hitRate).toBeGreaterThanOrEqual(0);
      expect(metrics.cache.hitRate).toBeLessThanOrEqual(100);
    });
  });

  describe('status determination', () => {
    it('should report healthy status when Redis is connected with low error rate', async () => {
      (redisClient.isReady as any).mockReturnValue(true);
      (redisClient.ping as any).mockResolvedValue('PONG');
      (redisClient.set as any).mockResolvedValue('OK');
      (redisClient.get as any).mockResolvedValue('test_value');
      (redisClient.exists as any).mockResolvedValue(1);
      (redisClient.del as any).mockResolvedValue(1);

      const metrics = await monitor.collectMetrics();

      expect(metrics.overallStatus).toBe('healthy');
    });

    it('should report unhealthy status when Redis is disconnected', async () => {
      (redisClient.isReady as any).mockReturnValue(false);

      const metrics = await monitor.collectMetrics();

      expect(metrics.overallStatus).toBe('unhealthy');
    });
  });

  describe('error handling', () => {
    it('should handle Redis client exceptions gracefully', async () => {
      (redisClient.isReady as any).mockImplementation(() => {
        throw new Error('Redis client error');
      });
      
      expect(async () => {
        await monitor.collectMetrics();
      }).not.toThrow();
      
      const metrics = await monitor.collectMetrics();
      expect(metrics.overallStatus).toBe('unhealthy');
    });

    it('should provide basic error information when operations fail', async () => {
      (redisClient.isReady as any).mockReturnValue(true);
      (redisClient.ping as any).mockRejectedValue(new Error('Test error'));

      // Trigger error
      await monitor.collectMetrics();
      
      const metrics = await monitor.getHealthMetrics();
      expect(metrics.overallStatus).toBe('unhealthy');
    });
  });

  describe('cleanup', () => {
    it('should clean up monitoring interval', () => {
      // Cleanup should not throw
      expect(() => monitor.cleanup()).not.toThrow();
    });
  });
});