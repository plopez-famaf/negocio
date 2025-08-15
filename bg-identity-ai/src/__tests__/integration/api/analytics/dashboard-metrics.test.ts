import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createServer } from 'http';
import { parse } from 'url';
import { NextApiHandler } from 'next';

// Import API handlers
import dashboardMetricsHandler from '@/pages/api/analytics/dashboard-metrics';

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

vi.mock('@/services/enhanced-stream-manager', () => ({
  enhancedStreamManager: {
    getSystemMetrics: vi.fn(() => ({
      activeChannels: 45,
      totalThroughput: 850,
      averageLatency: 25,
      connectedClients: 123,
      messagesSent: 5432,
      messagesReceived: 4321
    }))
  }
}));

vi.mock('@/services/adaptive-throttling-service', () => ({
  adaptiveThrottlingService: {
    getSystemStats: vi.fn(() => ({
      throttleEvents: 12,
      averageThrottleRate: 0.15,
      activeThrottles: 3
    }))
  }
}));

vi.mock('@/services/smart-filtering-service', () => ({
  smartFilteringService: {
    getStatistics: vi.fn(() => ({
      filteredEvents: 234,
      filterEfficiency: 0.87,
      averageRelevanceScore: 0.73
    }))
  }
}));

describe('Analytics API Integration Tests - Dashboard Metrics', () => {
  let server: any;

  beforeEach(() => {
    // Create test server
    server = createServer((req, res) => {
      const { pathname } = parse(req.url || '', true);
      
      if (pathname === '/api/analytics/dashboard-metrics') {
        return dashboardMetricsHandler(req as any, res as any);
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

  describe('GET /api/analytics/dashboard-metrics', () => {
    it('should return dashboard metrics with default parameters', async () => {
      const response = await request(server)
        .get('/api/analytics/dashboard-metrics')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.timestamp).toBeDefined();
      expect(response.body.data.realTimeStats).toBeDefined();
      expect(response.body.data.topThreats).toBeInstanceOf(Array);
      expect(response.body.data.performanceMetrics).toBeDefined();
      expect(response.body.data.alertSummary).toBeDefined();
      expect(response.body.data.trendSummary).toBeDefined();
      expect(response.body.data.systemHealth).toBeDefined();
      expect(response.body.data.metadata).toBeDefined();
    });

    it('should handle realtime parameter correctly', async () => {
      const response = await request(server)
        .get('/api/analytics/dashboard-metrics?includeRealtime=true')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.data.realTimeStats).toBeDefined();
      expect(response.body.data.realTimeStats.currentPeriod).toBeDefined();
      expect(response.body.data.realTimeStats.lastHour).toBeDefined();
      expect(response.body.data.realTimeStats.last24Hours).toBeDefined();
    });

    it('should handle predictions parameter correctly', async () => {
      const response = await request(server)
        .get('/api/analytics/dashboard-metrics?includePredictions=true')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.data.trendSummary).toBeDefined();
      expect(response.body.data.trendSummary.forecastNext24h).toBeDefined();
    });

    it('should handle time range parameters', async () => {
      const timeRange = {
        start: '2025-01-10T00:00:00.000Z',
        end: '2025-01-10T23:59:59.000Z'
      };

      const response = await request(server)
        .get(`/api/analytics/dashboard-metrics?timeRangeStart=${encodeURIComponent(timeRange.start)}&timeRangeEnd=${encodeURIComponent(timeRange.end)}`)
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.data.metadata.coverage.timeRange.start).toBe(timeRange.start);
      expect(response.body.data.metadata.coverage.timeRange.end).toBe(timeRange.end);
    });

    it('should handle refresh interval parameter', async () => {
      const response = await request(server)
        .get('/api/analytics/dashboard-metrics?refreshInterval=30')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(response.body.data.metadata.generationTime).toBeGreaterThan(0);
    });

    it('should validate real-time statistics structure', async () => {
      const response = await request(server)
        .get('/api/analytics/dashboard-metrics?includeRealtime=true')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      const stats = response.body.data.realTimeStats;
      
      // Current period validation
      expect(stats.currentPeriod.totalThreats).toBeGreaterThanOrEqual(0);
      expect(stats.currentPeriod.criticalThreats).toBeGreaterThanOrEqual(0);
      expect(stats.currentPeriod.highThreats).toBeGreaterThanOrEqual(0);
      expect(stats.currentPeriod.mediumThreats).toBeGreaterThanOrEqual(0);
      expect(stats.currentPeriod.lowThreats).toBeGreaterThanOrEqual(0);
      expect(stats.currentPeriod.resolvedThreats).toBeGreaterThanOrEqual(0);
      expect(stats.currentPeriod.falsePositives).toBeGreaterThanOrEqual(0);

      // Last hour validation
      expect(stats.lastHour.totalThreats).toBeGreaterThanOrEqual(0);
      expect(stats.lastHour.averageRiskScore).toBeGreaterThanOrEqual(0);
      expect(stats.lastHour.topCategory).toBeDefined();

      // Comparison validation
      expect(stats.comparison.hourOverHour).toBeDefined();
      expect(stats.comparison.dayOverDay).toBeDefined();
      expect(stats.comparison.weekOverWeek).toBeDefined();
    });

    it('should validate top threats structure', async () => {
      const response = await request(server)
        .get('/api/analytics/dashboard-metrics')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      const topThreats = response.body.data.topThreats;
      expect(topThreats).toBeInstanceOf(Array);

      topThreats.forEach((threat: any) => {
        expect(threat).toHaveProperty('id');
        expect(threat).toHaveProperty('type');
        expect(threat).toHaveProperty('severity');
        expect(threat).toHaveProperty('riskScore');
        expect(threat).toHaveProperty('source');
        expect(threat).toHaveProperty('target');
        expect(threat).toHaveProperty('timestamp');
        expect(threat).toHaveProperty('description');
        expect(threat).toHaveProperty('status');
        expect(threat).toHaveProperty('tags');
        expect(threat).toHaveProperty('impactScore');
        expect(threat).toHaveProperty('urgencyScore');

        // Validate ranges
        expect(threat.riskScore).toBeGreaterThanOrEqual(0);
        expect(threat.riskScore).toBeLessThanOrEqual(10);
        expect(['low', 'medium', 'high', 'critical'].includes(threat.severity)).toBe(true);
        expect(['active', 'investigating', 'resolved', 'false_positive'].includes(threat.status)).toBe(true);
      });
    });

    it('should validate performance metrics structure', async () => {
      const response = await request(server)
        .get('/api/analytics/dashboard-metrics')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      const perf = response.body.data.performanceMetrics;

      // API metrics
      expect(perf.api.averageResponseTime).toBeGreaterThan(0);
      expect(perf.api.requestsPerSecond).toBeGreaterThan(0);
      expect(perf.api.errorRate).toBeGreaterThanOrEqual(0);
      expect(perf.api.uptime).toBeGreaterThan(0);
      expect(perf.api.activeConnections).toBeGreaterThan(0);

      // Streaming metrics
      expect(perf.streaming.activeStreams).toBeGreaterThanOrEqual(0);
      expect(perf.streaming.eventsPerSecond).toBeGreaterThanOrEqual(0);
      expect(perf.streaming.streamLatency).toBeGreaterThanOrEqual(0);

      // ML metrics
      expect(perf.ml.modelsActive).toBeGreaterThan(0);
      expect(perf.ml.averageInferenceTime).toBeGreaterThan(0);
      expect(perf.ml.modelAccuracy).toBeGreaterThan(0);
      expect(perf.ml.predictionConfidence).toBeGreaterThan(0);

      // Resource metrics
      expect(perf.resources.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(perf.resources.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(perf.resources.diskUsage).toBeGreaterThanOrEqual(0);
      expect(perf.resources.networkBandwidth).toBeGreaterThanOrEqual(0);
    });

    it('should validate alert summary structure', async () => {
      const response = await request(server)
        .get('/api/analytics/dashboard-metrics')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      const alerts = response.body.data.alertSummary;
      expect(alerts.activeAlerts).toBeGreaterThanOrEqual(0);
      expect(alerts.criticalAlerts).toBeGreaterThanOrEqual(0);
      expect(alerts.acknowledgedAlerts).toBeGreaterThanOrEqual(0);
      expect(alerts.recentAlerts).toBeInstanceOf(Array);
      expect(alerts.alertsByCategory).toBeInstanceOf(Array);
      expect(alerts.escalationQueue).toBeGreaterThanOrEqual(0);
      expect(alerts.averageResolutionTime).toBeGreaterThan(0);
      expect(alerts.slaCompliance).toBeGreaterThan(0);
      expect(alerts.slaCompliance).toBeLessThanOrEqual(100);

      // Recent alerts structure
      alerts.recentAlerts.forEach((alert: any) => {
        expect(alert).toHaveProperty('id');
        expect(alert).toHaveProperty('type');
        expect(alert).toHaveProperty('severity');
        expect(alert).toHaveProperty('message');
        expect(alert).toHaveProperty('timestamp');
        expect(alert).toHaveProperty('acknowledged');
        expect(alert).toHaveProperty('source');
      });
    });

    it('should validate system health structure', async () => {
      const response = await request(server)
        .get('/api/analytics/dashboard-metrics')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      const health = response.body.data.systemHealth;
      expect(['healthy', 'warning', 'critical'].includes(health.overallHealth)).toBe(true);
      expect(health.healthScore).toBeGreaterThanOrEqual(0);
      expect(health.healthScore).toBeLessThanOrEqual(100);
      expect(health.components).toBeInstanceOf(Array);
      expect(health.lastHealthCheck).toBeDefined();
      expect(health.uptime).toBeGreaterThan(0);
      expect(health.diagnostics).toBeDefined();

      // Components validation
      health.components.forEach((component: any) => {
        expect(component).toHaveProperty('component');
        expect(['healthy', 'warning', 'critical'].includes(component.status)).toBe(true);
        expect(component.uptime).toBeGreaterThan(0);
        expect(component.lastCheck).toBeDefined();
        expect(component.metrics).toBeDefined();
      });
    });

    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = Array(10).fill(null).map(() =>
        request(server)
          .get('/api/analytics/dashboard-metrics?includeRealtime=true')
          .set('x-api-key', 'test-api-key')
      );

      const responses = await Promise.all(concurrentRequests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.realTimeStats).toBeDefined();
      });

      // All responses should have unique timestamps
      const timestamps = responses.map(r => r.body.data.timestamp);
      const uniqueTimestamps = new Set(timestamps);
      expect(uniqueTimestamps.size).toBe(10);
    });

    it('should handle authentication errors', async () => {
      // Mock auth failure
      const mockAuth = vi.mocked(require('@/lib/auth/middleware'));
      mockAuth.validateApiKey.mockResolvedValueOnce(false);

      const response = await request(server)
        .get('/api/analytics/dashboard-metrics')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Unauthorized');
    });

    it('should handle service errors gracefully', async () => {
      // Mock service error
      const mockStreamManager = vi.mocked(require('@/services/enhanced-stream-manager'));
      mockStreamManager.enhancedStreamManager.getSystemMetrics.mockImplementationOnce(() => {
        throw new Error('Stream manager unavailable');
      });

      const response = await request(server)
        .get('/api/analytics/dashboard-metrics')
        .set('x-api-key', 'test-api-key')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should respond within acceptable time limits', async () => {
      const startTime = Date.now();
      
      const response = await request(server)
        .get('/api/analytics/dashboard-metrics?includeRealtime=true&includePredictions=true')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
      expect(response.body.data.metadata.generationTime).toBeLessThan(2000);
    });

    it('should cache results for identical requests', async () => {
      const endpoint = '/api/analytics/dashboard-metrics?includeRealtime=false';

      // First request
      const startTime1 = Date.now();
      const response1 = await request(server)
        .get(endpoint)
        .set('x-api-key', 'test-api-key')
        .expect(200);
      const duration1 = Date.now() - startTime1;

      // Second identical request (should be faster due to caching)
      const startTime2 = Date.now();
      const response2 = await request(server)
        .get(endpoint)
        .set('x-api-key', 'test-api-key')
        .expect(200);
      const duration2 = Date.now() - startTime2;

      expect(response1.body.data.realTimeStats.currentPeriod.totalThreats)
        .toBe(response2.body.data.realTimeStats.currentPeriod.totalThreats);
      
      // Second request should be faster due to caching
      expect(duration2).toBeLessThan(duration1);
    });
  });

  describe('POST /api/analytics/dashboard-metrics', () => {
    it('should handle POST requests with request body', async () => {
      const requestBody = {
        includeRealtime: true,
        includePredictions: true,
        timeRange: {
          start: '2025-01-10T00:00:00.000Z',
          end: '2025-01-10T23:59:59.000Z'
        },
        refreshInterval: 30
      };

      const response = await request(server)
        .post('/api/analytics/dashboard-metrics')
        .send(requestBody)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.realTimeStats).toBeDefined();
      expect(response.body.data.trendSummary.forecastNext24h).toBeDefined();
    });

    it('should validate POST request body', async () => {
      const invalidRequestBody = {
        includeRealtime: 'invalid_boolean',
        timeRange: {
          start: 'invalid_date',
          end: 'invalid_date'
        }
      };

      const response = await request(server)
        .post('/api/analytics/dashboard-metrics')
        .send(invalidRequestBody)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Method validation', () => {
    it('should reject unsupported HTTP methods', async () => {
      const response = await request(server)
        .delete('/api/analytics/dashboard-metrics')
        .set('x-api-key', 'test-api-key')
        .expect(405);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Method not allowed');
    });

    it('should reject PUT requests', async () => {
      const response = await request(server)
        .put('/api/analytics/dashboard-metrics')
        .send({})
        .set('x-api-key', 'test-api-key')
        .expect(405);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Response format validation', () => {
    it('should return consistent response structure', async () => {
      const response = await request(server)
        .get('/api/analytics/dashboard-metrics')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      // Validate response structure
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('correlationId');

      // Validate CORS headers
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });
});