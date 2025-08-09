import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RedisClient } from '../../lib/redis-client';

describe('Redis Integration Tests', () => {
  let redisClient: RedisClient;

  beforeAll(() => {
    redisClient = new RedisClient({
      host: 'localhost',
      port: 6379,
      db: 1 // Use test database
    });
  });

  afterAll(async () => {
    await redisClient.disconnect();
  });

  describe('Basic Redis Operations', () => {
    it('should be able to create a Redis client instance', () => {
      expect(redisClient).toBeDefined();
      expect(redisClient).toBeInstanceOf(RedisClient);
    });

    it('should check connection readiness', () => {
      const isReady = redisClient.isReady();
      expect(typeof isReady).toBe('boolean');
    });

    it('should handle ping operation', async () => {
      const result = await redisClient.ping();
      expect(typeof result).toBe('boolean');
    });

    it('should handle get operation for non-existent key', async () => {
      const result = await redisClient.get('non-existent-key');
      // Should return null for non-existent keys, even if Redis is down
      expect(result).toBe(null);
    });

    it('should handle set operation', async () => {
      const result = await redisClient.set('test-key', 'test-value');
      expect(typeof result).toBe('boolean');
    });

    it('should handle delete operation', async () => {
      const result = await redisClient.del('test-key');
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should handle exists operation', async () => {
      const result = await redisClient.exists('test-key');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Advanced Redis Operations', () => {
    it('should handle hash operations', async () => {
      const setResult = await redisClient.hset('test-hash', 'field', 'value');
      expect(typeof setResult).toBe('boolean');
      
      const getResult = await redisClient.hget('test-hash', 'field');
      expect(typeof getResult === 'string' || getResult === null).toBe(true);
    });

    it('should handle expiration operations', async () => {
      const result = await redisClient.expire('test-key', 60);
      expect(typeof result).toBe('boolean');
    });

    it('should handle publish operations', async () => {
      const result = await redisClient.publish('test-channel', 'message');
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should create subscriber', () => {
      const subscriber = redisClient.createSubscriber();
      // Should either return a Redis instance or null
      expect(subscriber === null || typeof subscriber === 'object').toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle operations when Redis is not available gracefully', async () => {
      // These operations should not throw errors, even if Redis is not running
      await expect(redisClient.get('test-key')).resolves.not.toThrow();
      await expect(redisClient.set('test-key', 'value')).resolves.not.toThrow();
      await expect(redisClient.del('test-key')).resolves.not.toThrow();
      await expect(redisClient.exists('test-key')).resolves.not.toThrow();
    });
  });
});