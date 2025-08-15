import { logger } from '@/lib/logger';
import crypto from 'crypto';

export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  secret: string;
  eventTypes: WebhookEventType[];
  status: 'active' | 'disabled' | 'failed';
  retryConfig: {
    maxRetries: number;
    retryDelay: number; // milliseconds
    backoffMultiplier: number;
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
    lastDelivery?: string;
    failureCount: number;
    successCount: number;
  };
}

export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  timestamp: string;
  data: any;
  source: string;
  metadata: {
    correlationId?: string;
    userId?: string;
    severity?: string;
    category?: string;
  };
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventId: string;
  url: string;
  httpMethod: 'POST' | 'PUT';
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attempts: WebhookAttempt[];
  nextRetryAt?: string;
  createdAt: string;
  completedAt?: string;
}

export interface WebhookAttempt {
  attemptNumber: number;
  timestamp: string;
  httpStatus?: number;
  responseTime: number;
  errorMessage?: string;
  requestHeaders: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody: string;
  responseBody?: string;
}

export type WebhookEventType = 
  | 'threat.detected'
  | 'threat.resolved'
  | 'threat.escalated'
  | 'alert.created'
  | 'alert.acknowledged'
  | 'model.retrained'
  | 'model.drift_detected'
  | 'system.health_check'
  | 'user.action'
  | 'integration.test';

export interface WebhookConfig {
  enableSignatureValidation: boolean;
  defaultTimeout: number; // milliseconds
  maxPayloadSize: number; // bytes
  userAgent: string;
  customHeaders: Record<string, string>;
}

export interface WebhookStats {
  totalEndpoints: number;
  activeEndpoints: number;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  averageResponseTime: number;
  deliveryRate: {
    last24h: number;
    lastWeek: number;
    lastMonth: number;
  };
  topEventTypes: Array<{
    eventType: WebhookEventType;
    count: number;
    successRate: number;
  }>;
}

export class WebhookManager {
  private endpoints: Map<string, WebhookEndpoint> = new Map();
  private deliveries: Map<string, WebhookDelivery> = new Map();
  private eventQueue: WebhookEvent[] = [];
  private processingInterval?: NodeJS.Timeout;
  private config: WebhookConfig;
  private retryQueue: WebhookDelivery[] = [];

  constructor(config?: Partial<WebhookConfig>) {
    this.config = {
      enableSignatureValidation: true,
      defaultTimeout: 30000, // 30 seconds
      maxPayloadSize: 1024 * 1024, // 1MB
      userAgent: 'BG-ThreatAI-Webhooks/2.0',
      customHeaders: {
        'Content-Type': 'application/json',
        'X-Webhook-Source': 'bg-threat-ai'
      },
      ...config
    };

    this.startProcessing();
    
    logger.info('Webhook Manager initialized', {
      features: [
        'webhook_delivery',
        'signature_validation',
        'retry_mechanism',
        'event_filtering',
        'delivery_tracking',
        'failure_recovery'
      ],
      config: this.config
    });
  }

  /**
   * Register a new webhook endpoint
   */
  async registerWebhook(webhookData: {
    name: string;
    url: string;
    eventTypes: WebhookEventType[];
    retryConfig?: Partial<WebhookEndpoint['retryConfig']>;
  }): Promise<WebhookEndpoint> {
    const webhookId = `webhook_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const secret = this.generateSecret();

    const webhook: WebhookEndpoint = {
      id: webhookId,
      name: webhookData.name,
      url: webhookData.url,
      secret,
      eventTypes: webhookData.eventTypes,
      status: 'active',
      retryConfig: {
        maxRetries: 3,
        retryDelay: 1000, // 1 second
        backoffMultiplier: 2,
        ...webhookData.retryConfig
      },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        failureCount: 0,
        successCount: 0
      }
    };

    this.endpoints.set(webhookId, webhook);

    logger.info('Webhook endpoint registered', {
      webhookId,
      name: webhook.name,
      url: webhook.url,
      eventTypes: webhook.eventTypes
    });

    return webhook;
  }

  /**
   * Update webhook endpoint
   */
  async updateWebhook(webhookId: string, updates: Partial<WebhookEndpoint>): Promise<WebhookEndpoint | null> {
    const webhook = this.endpoints.get(webhookId);
    if (!webhook) {
      return null;
    }

    const updatedWebhook = {
      ...webhook,
      ...updates,
      metadata: {
        ...webhook.metadata,
        updatedAt: new Date().toISOString()
      }
    };

    this.endpoints.set(webhookId, updatedWebhook);

    logger.info('Webhook endpoint updated', {
      webhookId,
      updates: Object.keys(updates)
    });

    return updatedWebhook;
  }

  /**
   * Delete webhook endpoint
   */
  async deleteWebhook(webhookId: string): Promise<boolean> {
    const deleted = this.endpoints.delete(webhookId);
    
    if (deleted) {
      // Remove related deliveries
      for (const [deliveryId, delivery] of this.deliveries) {
        if (delivery.webhookId === webhookId) {
          this.deliveries.delete(deliveryId);
        }
      }

      logger.info('Webhook endpoint deleted', { webhookId });
    }

    return deleted;
  }

  /**
   * Get all webhook endpoints
   */
  getWebhooks(): WebhookEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  /**
   * Get webhook by ID
   */
  getWebhook(webhookId: string): WebhookEndpoint | null {
    return this.endpoints.get(webhookId) || null;
  }

  /**
   * Trigger webhook event
   */
  async triggerEvent(event: Omit<WebhookEvent, 'id' | 'timestamp'>): Promise<string> {
    const webhookEvent: WebhookEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: new Date().toISOString(),
      ...event
    };

    this.eventQueue.push(webhookEvent);

    logger.debug('Webhook event queued', {
      eventId: webhookEvent.id,
      eventType: webhookEvent.type,
      queueSize: this.eventQueue.length
    });

    return webhookEvent.id;
  }

  /**
   * Test webhook endpoint
   */
  async testWebhook(webhookId: string): Promise<{
    success: boolean;
    responseTime: number;
    httpStatus?: number;
    error?: string;
  }> {
    const webhook = this.endpoints.get(webhookId);
    if (!webhook) {
      return { success: false, responseTime: 0, error: 'Webhook not found' };
    }

    const testEvent: WebhookEvent = {
      id: `test_${Date.now()}`,
      type: 'integration.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook delivery',
        webhookId: webhook.id,
        webhookName: webhook.name
      },
      source: 'webhook_manager',
      metadata: {
        correlationId: `test_${webhookId}`
      }
    };

    try {
      const result = await this.deliverWebhook(webhook, testEvent);
      return {
        success: result.httpStatus ? result.httpStatus >= 200 && result.httpStatus < 300 : false,
        responseTime: result.responseTime,
        httpStatus: result.httpStatus,
        error: result.errorMessage
      };
    } catch (error) {
      return {
        success: false,
        responseTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get webhook delivery history
   */
  getDeliveryHistory(webhookId?: string, limit: number = 100): WebhookDelivery[] {
    let deliveries = Array.from(this.deliveries.values());
    
    if (webhookId) {
      deliveries = deliveries.filter(d => d.webhookId === webhookId);
    }

    return deliveries
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  /**
   * Get webhook statistics
   */
  getWebhookStats(): WebhookStats {
    const endpoints = Array.from(this.endpoints.values());
    const deliveries = Array.from(this.deliveries.values());

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const successfulDeliveries = deliveries.filter(d => d.status === 'delivered').length;
    const failedDeliveries = deliveries.filter(d => d.status === 'failed').length;

    // Calculate average response time
    const completedDeliveries = deliveries.filter(d => d.status === 'delivered' || d.status === 'failed');
    const totalResponseTime = completedDeliveries.reduce((sum, delivery) => {
      const lastAttempt = delivery.attempts[delivery.attempts.length - 1];
      return sum + (lastAttempt?.responseTime || 0);
    }, 0);
    const averageResponseTime = completedDeliveries.length > 0 ? totalResponseTime / completedDeliveries.length : 0;

    // Event type statistics
    const eventTypeMap = new Map<WebhookEventType, { count: number; successful: number }>();
    
    // This would be calculated from actual event data in production
    const mockEventTypes: WebhookEventType[] = ['threat.detected', 'threat.resolved', 'alert.created'];
    mockEventTypes.forEach(eventType => {
      eventTypeMap.set(eventType, {
        count: Math.floor(Math.random() * 100),
        successful: Math.floor(Math.random() * 80)
      });
    });

    const topEventTypes = Array.from(eventTypeMap.entries()).map(([eventType, stats]) => ({
      eventType,
      count: stats.count,
      successRate: stats.count > 0 ? (stats.successful / stats.count) * 100 : 0
    })).sort((a, b) => b.count - a.count);

    return {
      totalEndpoints: endpoints.length,
      activeEndpoints: endpoints.filter(e => e.status === 'active').length,
      totalDeliveries: deliveries.length,
      successfulDeliveries,
      failedDeliveries,
      averageResponseTime,
      deliveryRate: {
        last24h: deliveries.filter(d => new Date(d.createdAt) >= last24h).length,
        lastWeek: deliveries.filter(d => new Date(d.createdAt) >= lastWeek).length,
        lastMonth: deliveries.filter(d => new Date(d.createdAt) >= lastMonth).length
      },
      topEventTypes
    };
  }

  /**
   * Retry failed webhook deliveries
   */
  async retryFailedDeliveries(webhookId?: string): Promise<{ retriedCount: number; results: Array<{ deliveryId: string; success: boolean }> }> {
    let failedDeliveries = Array.from(this.deliveries.values())
      .filter(d => d.status === 'failed');

    if (webhookId) {
      failedDeliveries = failedDeliveries.filter(d => d.webhookId === webhookId);
    }

    const results: Array<{ deliveryId: string; success: boolean }> = [];

    for (const delivery of failedDeliveries) {
      const webhook = this.endpoints.get(delivery.webhookId);
      if (!webhook) continue;

      try {
        // Reset delivery status for retry
        delivery.status = 'retrying';
        delivery.nextRetryAt = undefined;

        const event = this.reconstructEventFromDelivery(delivery);
        const result = await this.deliverWebhook(webhook, event);
        
        results.push({
          deliveryId: delivery.id,
          success: result.httpStatus ? result.httpStatus >= 200 && result.httpStatus < 300 : false
        });
      } catch (error) {
        results.push({
          deliveryId: delivery.id,
          success: false
        });
      }
    }

    logger.info('Failed webhook deliveries retried', {
      webhookId,
      retriedCount: failedDeliveries.length,
      successfulRetries: results.filter(r => r.success).length
    });

    return {
      retriedCount: failedDeliveries.length,
      results
    };
  }

  /**
   * Private methods
   */
  private startProcessing(): void {
    this.processingInterval = setInterval(() => {
      this.processEventQueue();
      this.processRetryQueue();
    }, 1000); // Process every second
  }

  private async processEventQueue(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = this.eventQueue.splice(0, 10); // Process up to 10 events at once

    for (const event of events) {
      await this.processEvent(event);
    }
  }

  private async processEvent(event: WebhookEvent): Promise<void> {
    const relevantWebhooks = Array.from(this.endpoints.values())
      .filter(webhook => 
        webhook.status === 'active' && 
        webhook.eventTypes.includes(event.type)
      );

    for (const webhook of relevantWebhooks) {
      try {
        await this.deliverWebhook(webhook, event);
      } catch (error) {
        logger.error('Webhook delivery failed', {
          webhookId: webhook.id,
          eventId: event.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  private async deliverWebhook(webhook: WebhookEndpoint, event: WebhookEvent): Promise<WebhookAttempt> {
    const deliveryId = `delivery_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    const delivery: WebhookDelivery = {
      id: deliveryId,
      webhookId: webhook.id,
      eventId: event.id,
      url: webhook.url,
      httpMethod: 'POST',
      status: 'pending',
      attempts: [],
      createdAt: new Date().toISOString()
    };

    this.deliveries.set(deliveryId, delivery);

    const payload = {
      event: event,
      webhook: {
        id: webhook.id,
        name: webhook.name
      },
      timestamp: new Date().toISOString()
    };

    const signature = this.generateSignature(JSON.stringify(payload), webhook.secret);
    
    const headers = {
      ...this.config.customHeaders,
      'X-Webhook-Signature': signature,
      'X-Webhook-ID': webhook.id,
      'X-Webhook-Event-Type': event.type,
      'X-Webhook-Event-ID': event.id,
      'User-Agent': this.config.userAgent
    };

    const attempt = await this.makeHttpRequest(webhook.url, payload, headers);
    delivery.attempts.push(attempt);

    if (attempt.httpStatus && attempt.httpStatus >= 200 && attempt.httpStatus < 300) {
      delivery.status = 'delivered';
      delivery.completedAt = new Date().toISOString();
      webhook.metadata.successCount++;
      webhook.metadata.lastDelivery = new Date().toISOString();
    } else {
      delivery.status = 'failed';
      webhook.metadata.failureCount++;
      
      // Schedule retry if within retry limits
      if (delivery.attempts.length < webhook.retryConfig.maxRetries) {
        const retryDelay = webhook.retryConfig.retryDelay * 
          Math.pow(webhook.retryConfig.backoffMultiplier, delivery.attempts.length - 1);
        delivery.nextRetryAt = new Date(Date.now() + retryDelay).toISOString();
        delivery.status = 'retrying';
        this.retryQueue.push(delivery);
      }
    }

    this.deliveries.set(deliveryId, delivery);
    this.endpoints.set(webhook.id, webhook);

    return attempt;
  }

  private async makeHttpRequest(url: string, payload: any, headers: Record<string, string>): Promise<WebhookAttempt> {
    const startTime = Date.now();
    const requestBody = JSON.stringify(payload);
    let httpStatus: number | undefined;
    let errorMessage: string | undefined;
    let responseHeaders: Record<string, string> = {};
    let responseBody: string | undefined;

    try {
      // Mock HTTP request - in production, use fetch() or axios
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50)); // Simulate network delay
      
      // Mock response
      const success = Math.random() > 0.1; // 90% success rate
      httpStatus = success ? 200 : 500;
      responseHeaders = { 'Content-Type': 'application/json' };
      responseBody = success ? '{"status":"ok"}' : '{"error":"Internal server error"}';
      
      if (!success) {
        errorMessage = 'HTTP request failed';
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      httpStatus = 0;
    }

    const responseTime = Date.now() - startTime;

    return {
      attemptNumber: 1, // This would be incremented for retries
      timestamp: new Date().toISOString(),
      httpStatus,
      responseTime,
      errorMessage,
      requestHeaders: headers,
      responseHeaders,
      requestBody,
      responseBody
    };
  }

  private async processRetryQueue(): Promise<void> {
    const now = new Date();
    const readyForRetry = this.retryQueue.filter(delivery => 
      delivery.nextRetryAt && new Date(delivery.nextRetryAt) <= now
    );

    for (const delivery of readyForRetry) {
      const webhook = this.endpoints.get(delivery.webhookId);
      if (!webhook) continue;

      const event = this.reconstructEventFromDelivery(delivery);
      try {
        await this.deliverWebhook(webhook, event);
      } catch (error) {
        logger.error('Webhook retry failed', {
          deliveryId: delivery.id,
          webhookId: delivery.webhookId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Remove from retry queue
      this.retryQueue = this.retryQueue.filter(d => d.id !== delivery.id);
    }
  }

  private reconstructEventFromDelivery(delivery: WebhookDelivery): WebhookEvent {
    // In production, store the original event or reconstruct from delivery data
    return {
      id: delivery.eventId,
      type: 'integration.test', // Would be stored in delivery
      timestamp: delivery.createdAt,
      data: { reconstructed: true },
      source: 'webhook_manager',
      metadata: {}
    };
  }

  private generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }

    this.endpoints.clear();
    this.deliveries.clear();
    this.eventQueue = [];
    this.retryQueue = [];

    logger.info('Webhook Manager cleaned up');
  }
}

// Singleton instance
export const webhookManager = new WebhookManager();