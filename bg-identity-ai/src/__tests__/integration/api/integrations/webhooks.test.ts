import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createServer } from 'http';
import { parse } from 'url';
import { NextApiHandler } from 'next';

// Import API handlers
import webhooksHandler from '@/pages/api/integrations/webhooks';

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

describe('Integrations API Integration Tests - Webhooks', () => {
  let server: any;

  beforeEach(() => {
    // Create test server
    server = createServer((req, res) => {
      const { pathname } = parse(req.url || '', true);
      
      if (pathname === '/api/integrations/webhooks') {
        return webhooksHandler(req as any, res as any);
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

  describe('POST /api/integrations/webhooks - Register Webhook', () => {
    it('should register a new webhook successfully', async () => {
      const webhookData = {
        name: 'Test Security Webhook',
        url: 'https://example.com/webhook/security',
        eventTypes: ['threat.detected', 'threat.resolved'],
        retryConfig: {
          maxRetries: 3,
          retryDelay: 1000,
          backoffMultiplier: 2
        }
      };

      const response = await request(server)
        .post('/api/integrations/webhooks')
        .send(webhookData)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toMatch(/^webhook_/);
      expect(response.body.data.name).toBe('Test Security Webhook');
      expect(response.body.data.url).toBe('https://example.com/webhook/security');
      expect(response.body.data.eventTypes).toEqual(['threat.detected', 'threat.resolved']);
      expect(response.body.data.status).toBe('active');
      expect(response.body.data.secret).toBeDefined();
      expect(response.body.data.retryConfig).toBeDefined();
      expect(response.body.data.metadata).toBeDefined();
    });

    it('should use default retry configuration when not provided', async () => {
      const webhookData = {
        name: 'Simple Webhook',
        url: 'https://example.com/webhook',
        eventTypes: ['alert.created']
      };

      const response = await request(server)
        .post('/api/integrations/webhooks')
        .send(webhookData)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(201);

      expect(response.body.data.retryConfig.maxRetries).toBe(3);
      expect(response.body.data.retryConfig.retryDelay).toBe(1000);
      expect(response.body.data.retryConfig.backoffMultiplier).toBe(2);
    });

    it('should validate webhook URL format', async () => {
      const webhookData = {
        name: 'Invalid URL Webhook',
        url: 'not-a-valid-url',
        eventTypes: ['threat.detected']
      };

      const response = await request(server)
        .post('/api/integrations/webhooks')
        .send(webhookData)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid webhook URL');
    });

    it('should validate event types', async () => {
      const webhookData = {
        name: 'Invalid Events Webhook',
        url: 'https://example.com/webhook',
        eventTypes: ['invalid.event.type']
      };

      const response = await request(server)
        .post('/api/integrations/webhooks')
        .send(webhookData)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid event type');
    });

    it('should validate required fields', async () => {
      const webhookData = {
        name: '',
        url: 'https://example.com/webhook'
        // Missing eventTypes
      };

      const response = await request(server)
        .post('/api/integrations/webhooks')
        .send(webhookData)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/integrations/webhooks - List Webhooks', () => {
    it('should list all registered webhooks', async () => {
      const response = await request(server)
        .get('/api/integrations/webhooks')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      
      response.body.data.forEach((webhook: any) => {
        expect(webhook).toHaveProperty('id');
        expect(webhook).toHaveProperty('name');
        expect(webhook).toHaveProperty('url');
        expect(webhook).toHaveProperty('eventTypes');
        expect(webhook).toHaveProperty('status');
        expect(webhook).toHaveProperty('retryConfig');
        expect(webhook).toHaveProperty('metadata');
        expect(webhook.id).toMatch(/^webhook_/);
        expect(['active', 'inactive', 'error'].includes(webhook.status)).toBe(true);
      });
    });

    it('should handle empty webhook list', async () => {
      // Mock empty webhook list
      vi.doMock('@/services/integrations/webhook-manager', () => ({
        webhookManager: {
          getWebhooks: vi.fn().mockReturnValue([])
        }
      }));

      const response = await request(server)
        .get('/api/integrations/webhooks')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('GET /api/integrations/webhooks/:id - Get Specific Webhook', () => {
    it('should retrieve specific webhook by ID', async () => {
      const webhookId = 'webhook_test_123';
      
      const response = await request(server)
        .get(`/api/integrations/webhooks?id=${webhookId}`)
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(webhookId);
    });

    it('should handle non-existent webhook ID', async () => {
      const response = await request(server)
        .get('/api/integrations/webhooks?id=non_existent_webhook')
        .set('x-api-key', 'test-api-key')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Webhook not found');
    });
  });

  describe('PUT /api/integrations/webhooks/:id - Update Webhook', () => {
    it('should update existing webhook', async () => {
      const webhookId = 'webhook_test_123';
      const updateData = {
        name: 'Updated Webhook Name',
        url: 'https://updated.example.com/webhook',
        eventTypes: ['threat.detected', 'alert.created', 'alert.resolved']
      };

      const response = await request(server)
        .put(`/api/integrations/webhooks?id=${webhookId}`)
        .send(updateData)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Webhook Name');
      expect(response.body.data.url).toBe('https://updated.example.com/webhook');
      expect(response.body.data.eventTypes).toEqual(['threat.detected', 'alert.created', 'alert.resolved']);
    });

    it('should handle partial updates', async () => {
      const webhookId = 'webhook_test_123';
      const updateData = {
        name: 'Partially Updated Webhook'
        // Only updating name
      };

      const response = await request(server)
        .put(`/api/integrations/webhooks?id=${webhookId}`)
        .send(updateData)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Partially Updated Webhook');
    });

    it('should validate update data', async () => {
      const webhookId = 'webhook_test_123';
      const invalidUpdateData = {
        url: 'invalid-url'
      };

      const response = await request(server)
        .put(`/api/integrations/webhooks?id=${webhookId}`)
        .send(invalidUpdateData)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid webhook URL');
    });
  });

  describe('DELETE /api/integrations/webhooks/:id - Delete Webhook', () => {
    it('should delete existing webhook', async () => {
      const webhookId = 'webhook_test_123';

      const response = await request(server)
        .delete(`/api/integrations/webhooks?id=${webhookId}`)
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Webhook deleted successfully');
    });

    it('should handle non-existent webhook deletion', async () => {
      const response = await request(server)
        .delete('/api/integrations/webhooks?id=non_existent_webhook')
        .set('x-api-key', 'test-api-key')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Webhook not found');
    });
  });

  describe('POST /api/integrations/webhooks/test - Test Webhook', () => {
    it('should test webhook connectivity', async () => {
      const testData = {
        webhookId: 'webhook_test_123'
      };

      const response = await request(server)
        .post('/api/integrations/webhooks/test')
        .send(testData)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.success).toBeDefined();
      expect(response.body.data.responseTime).toBeGreaterThan(0);
      
      if (!response.body.data.success) {
        expect(response.body.data.error).toBeDefined();
      } else {
        expect(response.body.data.httpStatus).toBeDefined();
      }
    });

    it('should handle webhook test failures gracefully', async () => {
      const testData = {
        webhookId: 'webhook_unreachable'
      };

      const response = await request(server)
        .post('/api/integrations/webhooks/test')
        .send(testData)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBe(false);
      expect(response.body.data.error).toBeDefined();
    });
  });

  describe('GET /api/integrations/webhooks/deliveries - Delivery History', () => {
    it('should return delivery history for all webhooks', async () => {
      const response = await request(server)
        .get('/api/integrations/webhooks/deliveries')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      
      response.body.data.forEach((delivery: any) => {
        expect(delivery).toHaveProperty('id');
        expect(delivery).toHaveProperty('webhookId');
        expect(delivery).toHaveProperty('eventId');
        expect(delivery).toHaveProperty('url');
        expect(delivery).toHaveProperty('httpMethod');
        expect(delivery).toHaveProperty('status');
        expect(delivery).toHaveProperty('attempts');
        expect(delivery).toHaveProperty('createdAt');
        expect(['pending', 'delivered', 'failed', 'retrying'].includes(delivery.status)).toBe(true);
        expect(delivery.attempts).toBeInstanceOf(Array);
      });
    });

    it('should filter delivery history by webhook ID', async () => {
      const webhookId = 'webhook_test_123';
      
      const response = await request(server)
        .get(`/api/integrations/webhooks/deliveries?webhookId=${webhookId}`)
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      
      response.body.data.forEach((delivery: any) => {
        expect(delivery.webhookId).toBe(webhookId);
      });
    });

    it('should respect limit parameter', async () => {
      const limit = 5;
      
      const response = await request(server)
        .get(`/api/integrations/webhooks/deliveries?limit=${limit}`)
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(limit);
    });
  });

  describe('GET /api/integrations/webhooks/stats - Webhook Statistics', () => {
    it('should return comprehensive webhook statistics', async () => {
      const response = await request(server)
        .get('/api/integrations/webhooks/stats')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.totalEndpoints).toBeGreaterThanOrEqual(0);
      expect(response.body.data.activeEndpoints).toBeGreaterThanOrEqual(0);
      expect(response.body.data.totalDeliveries).toBeGreaterThanOrEqual(0);
      expect(response.body.data.successfulDeliveries).toBeGreaterThanOrEqual(0);
      expect(response.body.data.failedDeliveries).toBeGreaterThanOrEqual(0);
      expect(response.body.data.averageResponseTime).toBeGreaterThanOrEqual(0);
      expect(response.body.data.deliveryRate).toBeDefined();
      expect(response.body.data.topEventTypes).toBeInstanceOf(Array);

      // Delivery rate validation
      expect(response.body.data.deliveryRate.last24h).toBeGreaterThanOrEqual(0);
      expect(response.body.data.deliveryRate.lastWeek).toBeGreaterThanOrEqual(0);
      expect(response.body.data.deliveryRate.lastMonth).toBeGreaterThanOrEqual(0);

      // Event types validation
      response.body.data.topEventTypes.forEach((eventType: any) => {
        expect(eventType.eventType).toBeDefined();
        expect(eventType.count).toBeGreaterThanOrEqual(0);
        expect(eventType.successRate).toBeGreaterThanOrEqual(0);
        expect(eventType.successRate).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('POST /api/integrations/webhooks/retry - Retry Failed Deliveries', () => {
    it('should retry all failed deliveries', async () => {
      const response = await request(server)
        .post('/api/integrations/webhooks/retry')
        .send({})
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.retriedCount).toBeGreaterThanOrEqual(0);
      expect(response.body.data.results).toBeInstanceOf(Array);
    });

    it('should retry failed deliveries for specific webhook', async () => {
      const retryData = {
        webhookId: 'webhook_test_123'
      };

      const response = await request(server)
        .post('/api/integrations/webhooks/retry')
        .send(retryData)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.retriedCount).toBeGreaterThanOrEqual(0);
      expect(response.body.data.results).toBeInstanceOf(Array);
    });
  });

  describe('Authentication and Error Handling', () => {
    it('should require authentication for all endpoints', async () => {
      const response = await request(server)
        .get('/api/integrations/webhooks')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing API key');
    });

    it('should handle invalid JSON in request body', async () => {
      const response = await request(server)
        .post('/api/integrations/webhooks')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid request body');
    });

    it('should handle service errors gracefully', async () => {
      // Mock service error
      vi.doMock('@/services/integrations/webhook-manager', () => ({
        webhookManager: {
          getWebhooks: vi.fn().mockImplementation(() => {
            throw new Error('Service unavailable');
          })
        }
      }));

      const response = await request(server)
        .get('/api/integrations/webhooks')
        .set('x-api-key', 'test-api-key')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should include correlation ID in all responses', async () => {
      const response = await request(server)
        .get('/api/integrations/webhooks')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.correlationId).toBeDefined();
      expect(response.body.correlationId).toMatch(/^[a-f0-9-]{36}$/); // UUID format
    });
  });

  describe('Rate Limiting and Performance', () => {
    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = Array(10).fill(null).map(() =>
        request(server)
          .get('/api/integrations/webhooks')
          .set('x-api-key', 'test-api-key')
      );

      const responses = await Promise.all(concurrentRequests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it('should respond within acceptable time limits', async () => {
      const startTime = Date.now();
      
      const response = await request(server)
        .get('/api/integrations/webhooks')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });
  });
});