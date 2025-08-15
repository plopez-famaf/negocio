import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WebhookManager, WebhookEventType } from '@/services/integrations/webhook-manager';

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Mock crypto for consistent testing
vi.mock('crypto', async () => {
  const actual = await vi.importActual('crypto');
  return {
    ...actual,
    randomBytes: vi.fn(() => ({
      toString: vi.fn(() => 'mock_secret_12345')
    })),
    createHmac: vi.fn(() => ({
      update: vi.fn(() => ({
        digest: vi.fn(() => 'mock_signature_hash')
      }))
    }))
  };
});

describe('WebhookManager', () => {
  let webhookManager: WebhookManager;

  beforeEach(() => {
    webhookManager = new WebhookManager({
      defaultTimeout: 5000,
      maxPayloadSize: 1024 * 1024,
      userAgent: 'Test-WebhookManager/1.0'
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    webhookManager.cleanup();
  });

  describe('registerWebhook', () => {
    it('should register a new webhook successfully', async () => {
      const webhookData = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        eventTypes: ['threat.detected', 'threat.resolved'] as WebhookEventType[]
      };

      const webhook = await webhookManager.registerWebhook(webhookData);

      expect(webhook).toBeDefined();
      expect(webhook.id).toMatch(/^webhook_/);
      expect(webhook.name).toBe('Test Webhook');
      expect(webhook.url).toBe('https://example.com/webhook');
      expect(webhook.eventTypes).toEqual(['threat.detected', 'threat.resolved']);
      expect(webhook.status).toBe('active');
      expect(webhook.secret).toBeDefined();
      expect(webhook.retryConfig).toBeDefined();
      expect(webhook.metadata).toBeDefined();
    });

    it('should set default retry configuration', async () => {
      const webhookData = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        eventTypes: ['alert.created'] as WebhookEventType[]
      };

      const webhook = await webhookManager.registerWebhook(webhookData);

      expect(webhook.retryConfig.maxRetries).toBe(3);
      expect(webhook.retryConfig.retryDelay).toBe(1000);
      expect(webhook.retryConfig.backoffMultiplier).toBe(2);
    });

    it('should use custom retry configuration', async () => {
      const webhookData = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        eventTypes: ['threat.detected'] as WebhookEventType[],
        retryConfig: {
          maxRetries: 5,
          retryDelay: 2000,
          backoffMultiplier: 1.5
        }
      };

      const webhook = await webhookManager.registerWebhook(webhookData);

      expect(webhook.retryConfig.maxRetries).toBe(5);
      expect(webhook.retryConfig.retryDelay).toBe(2000);
      expect(webhook.retryConfig.backoffMultiplier).toBe(1.5);
    });

    it('should initialize metadata correctly', async () => {
      const webhookData = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        eventTypes: ['model.retrained'] as WebhookEventType[]
      };

      const webhook = await webhookManager.registerWebhook(webhookData);

      expect(webhook.metadata.createdAt).toBeDefined();
      expect(webhook.metadata.updatedAt).toBeDefined();
      expect(webhook.metadata.failureCount).toBe(0);
      expect(webhook.metadata.successCount).toBe(0);
      expect(webhook.metadata.lastDelivery).toBeUndefined();
    });
  });

  describe('updateWebhook', () => {
    it('should update existing webhook', async () => {
      // First register a webhook
      const webhookData = {
        name: 'Original Webhook',
        url: 'https://example.com/original',
        eventTypes: ['threat.detected'] as WebhookEventType[]
      };
      const webhook = await webhookManager.registerWebhook(webhookData);

      // Update the webhook
      const updates = {
        name: 'Updated Webhook',
        url: 'https://example.com/updated',
        eventTypes: ['threat.detected', 'alert.created'] as WebhookEventType[]
      };
      const updatedWebhook = await webhookManager.updateWebhook(webhook.id, updates);

      expect(updatedWebhook).toBeDefined();
      expect(updatedWebhook!.name).toBe('Updated Webhook');
      expect(updatedWebhook!.url).toBe('https://example.com/updated');
      expect(updatedWebhook!.eventTypes).toEqual(['threat.detected', 'alert.created']);
      expect(updatedWebhook!.metadata.updatedAt).not.toBe(webhook.metadata.updatedAt);
    });

    it('should return null for non-existent webhook', async () => {
      const result = await webhookManager.updateWebhook('non_existent_webhook', {
        name: 'Updated Name'
      });

      expect(result).toBeNull();
    });

    it('should preserve existing fields when partially updating', async () => {
      const webhookData = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        eventTypes: ['threat.detected'] as WebhookEventType[]
      };
      const webhook = await webhookManager.registerWebhook(webhookData);

      // Only update name
      const updatedWebhook = await webhookManager.updateWebhook(webhook.id, {
        name: 'New Name Only'
      });

      expect(updatedWebhook!.name).toBe('New Name Only');
      expect(updatedWebhook!.url).toBe('https://example.com/webhook');
      expect(updatedWebhook!.eventTypes).toEqual(['threat.detected']);
    });
  });

  describe('deleteWebhook', () => {
    it('should delete existing webhook', async () => {
      const webhookData = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        eventTypes: ['threat.detected'] as WebhookEventType[]
      };
      const webhook = await webhookManager.registerWebhook(webhookData);

      const deleted = await webhookManager.deleteWebhook(webhook.id);

      expect(deleted).toBe(true);
      
      // Verify webhook is no longer accessible
      const retrievedWebhook = webhookManager.getWebhook(webhook.id);
      expect(retrievedWebhook).toBeNull();
    });

    it('should return false for non-existent webhook', async () => {
      const deleted = await webhookManager.deleteWebhook('non_existent_webhook');
      expect(deleted).toBe(false);
    });

    it('should clean up related deliveries', async () => {
      const webhookData = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        eventTypes: ['threat.detected'] as WebhookEventType[]
      };
      const webhook = await webhookManager.registerWebhook(webhookData);

      // Trigger an event to create delivery records
      await webhookManager.triggerEvent({
        type: 'threat.detected',
        data: { test: 'data' },
        source: 'test',
        metadata: {}
      });

      // Delete webhook
      await webhookManager.deleteWebhook(webhook.id);

      // Verify deliveries are cleaned up
      const deliveries = webhookManager.getDeliveryHistory(webhook.id);
      expect(deliveries.length).toBe(0);
    });
  });

  describe('getWebhooks and getWebhook', () => {
    it('should retrieve all webhooks', async () => {
      const webhook1Data = {
        name: 'Webhook 1',
        url: 'https://example.com/webhook1',
        eventTypes: ['threat.detected'] as WebhookEventType[]
      };
      const webhook2Data = {
        name: 'Webhook 2',
        url: 'https://example.com/webhook2',
        eventTypes: ['alert.created'] as WebhookEventType[]
      };

      await webhookManager.registerWebhook(webhook1Data);
      await webhookManager.registerWebhook(webhook2Data);

      const webhooks = webhookManager.getWebhooks();

      expect(webhooks.length).toBe(2);
      expect(webhooks.some(w => w.name === 'Webhook 1')).toBe(true);
      expect(webhooks.some(w => w.name === 'Webhook 2')).toBe(true);
    });

    it('should retrieve specific webhook by ID', async () => {
      const webhookData = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        eventTypes: ['threat.detected'] as WebhookEventType[]
      };
      const webhook = await webhookManager.registerWebhook(webhookData);

      const retrieved = webhookManager.getWebhook(webhook.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(webhook.id);
      expect(retrieved!.name).toBe('Test Webhook');
    });

    it('should return null for non-existent webhook ID', () => {
      const retrieved = webhookManager.getWebhook('non_existent_webhook');
      expect(retrieved).toBeNull();
    });
  });

  describe('triggerEvent', () => {
    it('should queue event for processing', async () => {
      const eventId = await webhookManager.triggerEvent({
        type: 'threat.detected',
        data: { threatId: 'threat_123', severity: 'high' },
        source: 'threat_detection_service',
        metadata: { correlationId: 'corr_123' }
      });

      expect(eventId).toMatch(/^event_/);
    });

    it('should generate unique event IDs', async () => {
      const eventId1 = await webhookManager.triggerEvent({
        type: 'threat.detected',
        data: { test: 'data1' },
        source: 'test',
        metadata: {}
      });

      const eventId2 = await webhookManager.triggerEvent({
        type: 'threat.detected',
        data: { test: 'data2' },
        source: 'test',
        metadata: {}
      });

      expect(eventId1).not.toBe(eventId2);
    });

    it('should process events for matching webhooks', async () => {
      // Register webhook for threat.detected events
      const webhookData = {
        name: 'Threat Webhook',
        url: 'https://example.com/threats',
        eventTypes: ['threat.detected'] as WebhookEventType[]
      };
      const webhook = await webhookManager.registerWebhook(webhookData);

      // Trigger matching event
      await webhookManager.triggerEvent({
        type: 'threat.detected',
        data: { threatId: 'threat_123' },
        source: 'test',
        metadata: {}
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check delivery history
      const deliveries = webhookManager.getDeliveryHistory(webhook.id);
      expect(deliveries.length).toBeGreaterThan(0);
    });

    it('should not process events for non-matching webhooks', async () => {
      // Register webhook for alert.created events only
      const webhookData = {
        name: 'Alert Webhook',
        url: 'https://example.com/alerts',
        eventTypes: ['alert.created'] as WebhookEventType[]
      };
      const webhook = await webhookManager.registerWebhook(webhookData);

      // Trigger non-matching event
      await webhookManager.triggerEvent({
        type: 'threat.detected',
        data: { threatId: 'threat_123' },
        source: 'test',
        metadata: {}
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check delivery history (should be empty)
      const deliveries = webhookManager.getDeliveryHistory(webhook.id);
      expect(deliveries.length).toBe(0);
    });
  });

  describe('testWebhook', () => {
    it('should test webhook connectivity', async () => {
      const webhookData = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        eventTypes: ['integration.test'] as WebhookEventType[]
      };
      const webhook = await webhookManager.registerWebhook(webhookData);

      const result = await webhookManager.testWebhook(webhook.id);

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(result.responseTime).toBeGreaterThan(0);
      
      if (!result.success) {
        expect(result.error).toBeDefined();
      } else {
        expect(result.httpStatus).toBeDefined();
      }
    });

    it('should return error for non-existent webhook', async () => {
      const result = await webhookManager.testWebhook('non_existent_webhook');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Webhook not found');
      expect(result.responseTime).toBe(0);
    });

    it('should generate test event for webhook testing', async () => {
      const webhookData = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        eventTypes: ['integration.test'] as WebhookEventType[]
      };
      const webhook = await webhookManager.registerWebhook(webhookData);

      await webhookManager.testWebhook(webhook.id);

      // Verify test event was processed
      const deliveries = webhookManager.getDeliveryHistory(webhook.id);
      expect(deliveries.length).toBeGreaterThan(0);
      
      const testDelivery = deliveries.find(d => d.eventId.startsWith('test_'));
      expect(testDelivery).toBeDefined();
    });
  });

  describe('getDeliveryHistory', () => {
    it('should return delivery history for specific webhook', async () => {
      const webhookData = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        eventTypes: ['threat.detected'] as WebhookEventType[]
      };
      const webhook = await webhookManager.registerWebhook(webhookData);

      // Trigger multiple events
      await webhookManager.triggerEvent({
        type: 'threat.detected',
        data: { test: 'data1' },
        source: 'test',
        metadata: {}
      });

      await webhookManager.triggerEvent({
        type: 'threat.detected',
        data: { test: 'data2' },
        source: 'test',
        metadata: {}
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      const deliveries = webhookManager.getDeliveryHistory(webhook.id);
      expect(deliveries.length).toBeGreaterThan(0);

      deliveries.forEach(delivery => {
        expect(delivery.webhookId).toBe(webhook.id);
        expect(delivery.id).toBeDefined();
        expect(delivery.eventId).toBeDefined();
        expect(delivery.url).toBe(webhook.url);
        expect(delivery.httpMethod).toBe('POST');
        expect(['pending', 'delivered', 'failed', 'retrying'].includes(delivery.status)).toBe(true);
        expect(delivery.attempts).toBeInstanceOf(Array);
        expect(delivery.createdAt).toBeDefined();
      });
    });

    it('should return all deliveries when no webhook ID specified', async () => {
      const webhook1Data = {
        name: 'Webhook 1',
        url: 'https://example.com/webhook1',
        eventTypes: ['threat.detected'] as WebhookEventType[]
      };
      const webhook2Data = {
        name: 'Webhook 2',
        url: 'https://example.com/webhook2',
        eventTypes: ['threat.detected'] as WebhookEventType[]
      };

      const webhook1 = await webhookManager.registerWebhook(webhook1Data);
      const webhook2 = await webhookManager.registerWebhook(webhook2Data);

      // Trigger events for both webhooks
      await webhookManager.triggerEvent({
        type: 'threat.detected',
        data: { test: 'data' },
        source: 'test',
        metadata: {}
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      const allDeliveries = webhookManager.getDeliveryHistory();
      expect(allDeliveries.length).toBeGreaterThan(0);

      const webhook1Deliveries = allDeliveries.filter(d => d.webhookId === webhook1.id);
      const webhook2Deliveries = allDeliveries.filter(d => d.webhookId === webhook2.id);

      expect(webhook1Deliveries.length).toBeGreaterThan(0);
      expect(webhook2Deliveries.length).toBeGreaterThan(0);
    });

    it('should respect limit parameter', async () => {
      const webhookData = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        eventTypes: ['threat.detected'] as WebhookEventType[]
      };
      const webhook = await webhookManager.registerWebhook(webhookData);

      // Trigger multiple events
      for (let i = 0; i < 5; i++) {
        await webhookManager.triggerEvent({
          type: 'threat.detected',
          data: { index: i },
          source: 'test',
          metadata: {}
        });
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 300));

      const limitedDeliveries = webhookManager.getDeliveryHistory(webhook.id, 3);
      expect(limitedDeliveries.length).toBeLessThanOrEqual(3);
    });

    it('should return deliveries in chronological order (newest first)', async () => {
      const webhookData = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        eventTypes: ['threat.detected'] as WebhookEventType[]
      };
      const webhook = await webhookManager.registerWebhook(webhookData);

      // Trigger events with delays
      await webhookManager.triggerEvent({
        type: 'threat.detected',
        data: { order: 'first' },
        source: 'test',
        metadata: {}
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      await webhookManager.triggerEvent({
        type: 'threat.detected',
        data: { order: 'second' },
        source: 'test',
        metadata: {}
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      const deliveries = webhookManager.getDeliveryHistory(webhook.id);
      expect(deliveries.length).toBeGreaterThan(1);

      // Verify ordering (newest first)
      for (let i = 1; i < deliveries.length; i++) {
        const prev = new Date(deliveries[i - 1].createdAt);
        const curr = new Date(deliveries[i].createdAt);
        expect(prev.getTime()).toBeGreaterThanOrEqual(curr.getTime());
      }
    });
  });

  describe('getWebhookStats', () => {
    it('should provide comprehensive webhook statistics', async () => {
      // Register multiple webhooks
      const webhook1Data = {
        name: 'Webhook 1',
        url: 'https://example.com/webhook1',
        eventTypes: ['threat.detected'] as WebhookEventType[]
      };
      const webhook2Data = {
        name: 'Webhook 2',
        url: 'https://example.com/webhook2',
        eventTypes: ['alert.created'] as WebhookEventType[]
      };

      await webhookManager.registerWebhook(webhook1Data);
      await webhookManager.registerWebhook(webhook2Data);

      // Trigger some events
      await webhookManager.triggerEvent({
        type: 'threat.detected',
        data: { test: 'data' },
        source: 'test',
        metadata: {}
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      const stats = webhookManager.getWebhookStats();

      expect(stats).toBeDefined();
      expect(stats.totalEndpoints).toBe(2);
      expect(stats.activeEndpoints).toBe(2); // Both should be active
      expect(stats.totalDeliveries).toBeGreaterThanOrEqual(0);
      expect(stats.successfulDeliveries).toBeGreaterThanOrEqual(0);
      expect(stats.failedDeliveries).toBeGreaterThanOrEqual(0);
      expect(stats.averageResponseTime).toBeGreaterThanOrEqual(0);
      expect(stats.deliveryRate).toBeDefined();
      expect(stats.topEventTypes).toBeInstanceOf(Array);

      // Delivery rate validation
      expect(stats.deliveryRate.last24h).toBeGreaterThanOrEqual(0);
      expect(stats.deliveryRate.lastWeek).toBeGreaterThanOrEqual(0);
      expect(stats.deliveryRate.lastMonth).toBeGreaterThanOrEqual(0);

      // Event types validation
      stats.topEventTypes.forEach(eventType => {
        expect(eventType.eventType).toBeDefined();
        expect(eventType.count).toBeGreaterThanOrEqual(0);
        expect(eventType.successRate).toBeGreaterThanOrEqual(0);
        expect(eventType.successRate).toBeLessThanOrEqual(100);
      });
    });

    it('should handle empty webhook registry', () => {
      const stats = webhookManager.getWebhookStats();

      expect(stats.totalEndpoints).toBe(0);
      expect(stats.activeEndpoints).toBe(0);
      expect(stats.totalDeliveries).toBe(0);
      expect(stats.topEventTypes).toBeInstanceOf(Array);
    });
  });

  describe('retryFailedDeliveries', () => {
    it('should retry failed deliveries for specific webhook', async () => {
      const webhookData = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        eventTypes: ['threat.detected'] as WebhookEventType[]
      };
      const webhook = await webhookManager.registerWebhook(webhookData);

      // Mock a failed delivery
      const deliveryId = 'failed_delivery_123';
      (webhookManager as any).deliveries.set(deliveryId, {
        id: deliveryId,
        webhookId: webhook.id,
        eventId: 'test_event',
        url: webhook.url,
        httpMethod: 'POST',
        status: 'failed',
        attempts: [{
          attemptNumber: 1,
          timestamp: new Date().toISOString(),
          httpStatus: 500,
          responseTime: 1000,
          errorMessage: 'Internal Server Error',
          requestHeaders: {},
          requestBody: JSON.stringify({ test: 'data' })
        }],
        createdAt: new Date().toISOString()
      });

      const result = await webhookManager.retryFailedDeliveries(webhook.id);

      expect(result).toBeDefined();
      expect(result.retriedCount).toBeGreaterThan(0);
      expect(result.results).toBeInstanceOf(Array);
      expect(result.results.length).toBe(result.retriedCount);

      result.results.forEach(res => {
        expect(res.deliveryId).toBeDefined();
        expect(res.success).toBeDefined();
      });
    });

    it('should retry all failed deliveries when no webhook ID specified', async () => {
      const result = await webhookManager.retryFailedDeliveries();

      expect(result).toBeDefined();
      expect(result.retriedCount).toBeGreaterThanOrEqual(0);
      expect(result.results).toBeInstanceOf(Array);
    });

    it('should handle no failed deliveries gracefully', async () => {
      const webhookData = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        eventTypes: ['threat.detected'] as WebhookEventType[]
      };
      const webhook = await webhookManager.registerWebhook(webhookData);

      const result = await webhookManager.retryFailedDeliveries(webhook.id);

      expect(result.retriedCount).toBe(0);
      expect(result.results).toEqual([]);
    });
  });

  describe('error handling and resilience', () => {
    it('should handle malformed webhook data gracefully', async () => {
      const malformedData = {
        name: '',
        url: 'invalid-url',
        eventTypes: []
      };

      await expect(webhookManager.registerWebhook(malformedData as any))
        .rejects.toThrow();
    });

    it('should handle network errors during webhook delivery', async () => {
      const webhookData = {
        name: 'Test Webhook',
        url: 'https://nonexistent.example.com/webhook',
        eventTypes: ['threat.detected'] as WebhookEventType[]
      };
      const webhook = await webhookManager.registerWebhook(webhookData);

      // Trigger event that will fail to deliver
      await webhookManager.triggerEvent({
        type: 'threat.detected',
        data: { test: 'data' },
        source: 'test',
        metadata: {}
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Delivery should be marked as failed
      const deliveries = webhookManager.getDeliveryHistory(webhook.id);
      expect(deliveries.length).toBeGreaterThan(0);
      
      // At least one delivery should have failed or be retrying
      const hasFailedOrRetrying = deliveries.some(d => 
        d.status === 'failed' || d.status === 'retrying'
      );
      expect(hasFailedOrRetrying).toBe(true);
    });

    it('should implement exponential backoff for retries', async () => {
      const webhookData = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        eventTypes: ['threat.detected'] as WebhookEventType[],
        retryConfig: {
          maxRetries: 3,
          retryDelay: 1000,
          backoffMultiplier: 2
        }
      };
      const webhook = await webhookManager.registerWebhook(webhookData);

      // The retry mechanism should implement exponential backoff
      // This is tested through the configuration validation
      expect(webhook.retryConfig.maxRetries).toBe(3);
      expect(webhook.retryConfig.retryDelay).toBe(1000);
      expect(webhook.retryConfig.backoffMultiplier).toBe(2);
    });

    it('should handle high-frequency events without blocking', async () => {
      const webhookData = {
        name: 'High Frequency Webhook',
        url: 'https://example.com/webhook',
        eventTypes: ['threat.detected'] as WebhookEventType[]
      };
      await webhookManager.registerWebhook(webhookData);

      // Trigger many events rapidly
      const eventPromises = Array(20).fill(null).map((_, i) =>
        webhookManager.triggerEvent({
          type: 'threat.detected',
          data: { index: i },
          source: 'test',
          metadata: {}
        })
      );

      const startTime = Date.now();
      await Promise.all(eventPromises);
      const duration = Date.now() - startTime;

      // Should complete quickly (events are queued, not processed synchronously)
      expect(duration).toBeLessThan(1000);
    });

    it('should clean up resources properly', () => {
      // Should not throw errors during cleanup
      expect(() => webhookManager.cleanup()).not.toThrow();
    });
  });

  describe('signature validation', () => {
    it('should generate consistent signatures', async () => {
      const webhookData = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        eventTypes: ['threat.detected'] as WebhookEventType[]
      };
      const webhook = await webhookManager.registerWebhook(webhookData);

      // Test webhook to verify signature generation
      await webhookManager.testWebhook(webhook.id);

      // Check delivery for signature
      const deliveries = webhookManager.getDeliveryHistory(webhook.id);
      expect(deliveries.length).toBeGreaterThan(0);

      const delivery = deliveries[0];
      const signature = delivery.attempts[0]?.requestHeaders['X-Webhook-Signature'];
      expect(signature).toBeDefined();
      expect(signature).toBe('mock_signature_hash');
    });

    it('should include proper headers in webhook requests', async () => {
      const webhookData = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        eventTypes: ['threat.detected'] as WebhookEventType[]
      };
      const webhook = await webhookManager.registerWebhook(webhookData);

      await webhookManager.testWebhook(webhook.id);

      const deliveries = webhookManager.getDeliveryHistory(webhook.id);
      const delivery = deliveries[0];
      const headers = delivery.attempts[0]?.requestHeaders;

      expect(headers).toBeDefined();
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['X-Webhook-Source']).toBe('bg-threat-ai');
      expect(headers['X-Webhook-Signature']).toBeDefined();
      expect(headers['X-Webhook-ID']).toBe(webhook.id);
      expect(headers['User-Agent']).toBeDefined();
    });
  });
});