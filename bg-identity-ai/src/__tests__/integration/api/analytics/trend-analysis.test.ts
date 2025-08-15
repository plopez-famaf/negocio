import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createServer } from 'http';
import { parse } from 'url';
import { NextApiHandler } from 'next';

// Import API handlers
import trendAnalysisHandler from '@/pages/api/analytics/trend-analysis';
import { ThreatEvent } from '@/types/threat';

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

vi.mock('@/services/threat-detection-service', () => ({
  threatDetectionService: {
    getThreats: vi.fn().mockResolvedValue([
      {
        id: 'test_threat_1',
        timestamp: '2025-01-10T10:00:00.000Z',
        type: 'malware',
        severity: 'high',
        source: 'scanner_1',
        target: 'server_1',
        description: 'Test malware detection',
        riskScore: 8.5,
        status: 'active',
        metadata: { correlationId: 'test_corr_1' }
      },
      {
        id: 'test_threat_2',
        timestamp: '2025-01-10T11:00:00.000Z',
        type: 'intrusion',
        severity: 'critical',
        source: 'scanner_2',
        target: 'server_2',
        description: 'Test intrusion attempt',
        riskScore: 9.2,
        status: 'investigating',
        metadata: { correlationId: 'test_corr_2' }
      }
    ])
  }
}));

describe('Analytics API Integration Tests - Trend Analysis', () => {
  let server: any;

  beforeEach(() => {
    // Create test server
    server = createServer((req, res) => {
      const { pathname } = parse(req.url || '', true);
      
      if (pathname === '/api/analytics/trend-analysis') {
        return trendAnalysisHandler(req as any, res as any);
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

  describe('POST /api/analytics/trend-analysis', () => {
    it('should analyze trends with valid request', async () => {
      const requestBody = {
        timeRange: {
          start: '2025-01-10T09:00:00.000Z',
          end: '2025-01-10T15:00:00.000Z'
        },
        granularity: 'hourly',
        categories: ['malware', 'intrusion']
      };

      const response = await request(server)
        .post('/api/analytics/trend-analysis')
        .send(requestBody)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.analysisId).toMatch(/^trend_analysis_/);
      expect(response.body.data.trends).toBeInstanceOf(Array);
      expect(response.body.data.metadata).toBeDefined();
      expect(response.body.data.metadata.processingTime).toBeGreaterThan(0);
    });

    it('should handle trend analysis with forecasting', async () => {
      const requestBody = {
        timeRange: {
          start: '2025-01-10T09:00:00.000Z',
          end: '2025-01-10T15:00:00.000Z'
        },
        granularity: 'hourly',
        categories: ['malware'],
        includeForecasting: true,
        forecastPeriods: 5
      };

      const response = await request(server)
        .post('/api/analytics/trend-analysis')
        .send(requestBody)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.data.forecasting).toBeDefined();
      expect(response.body.data.forecasting.predictions).toBeInstanceOf(Array);
      expect(response.body.data.forecasting.predictions.length).toBe(5);
      expect(response.body.data.forecasting.confidence_intervals).toBeDefined();
    });

    it('should validate request parameters', async () => {
      const invalidRequestBody = {
        timeRange: {
          start: '2025-01-10T15:00:00.000Z', // End before start
          end: '2025-01-10T09:00:00.000Z'
        },
        granularity: 'invalid_granularity',
        categories: []
      };

      const response = await request(server)
        .post('/api/analytics/trend-analysis')
        .send(invalidRequestBody)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should handle different granularity options', async () => {
      const granularities = ['hourly', 'daily', 'weekly'];

      for (const granularity of granularities) {
        const requestBody = {
          timeRange: {
            start: '2025-01-01T00:00:00.000Z',
            end: '2025-01-15T23:59:59.000Z'
          },
          granularity,
          categories: ['malware']
        };

        const response = await request(server)
          .post('/api/analytics/trend-analysis')
          .send(requestBody)
          .set('Content-Type', 'application/json')
          .set('x-api-key', 'test-api-key')
          .expect(200);

        expect(response.body.data.trends).toBeInstanceOf(Array);
        if (response.body.data.trends.length > 0) {
          expect(response.body.data.trends[0].granularity).toBe(granularity);
        }
      }
    });

    it('should handle concurrent requests efficiently', async () => {
      const requestBody = {
        timeRange: {
          start: '2025-01-10T09:00:00.000Z',
          end: '2025-01-10T15:00:00.000Z'
        },
        granularity: 'hourly',
        categories: ['malware']
      };

      const concurrentRequests = Array(5).fill(null).map(() =>
        request(server)
          .post('/api/analytics/trend-analysis')
          .send(requestBody)
          .set('Content-Type', 'application/json')
          .set('x-api-key', 'test-api-key')
      );

      const responses = await Promise.all(concurrentRequests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.analysisId).toMatch(/^trend_analysis_/);
      });

      // All analysis IDs should be unique
      const analysisIds = responses.map(r => r.body.data.analysisId);
      const uniqueIds = new Set(analysisIds);
      expect(uniqueIds.size).toBe(5);
    });

    it('should return proper error for missing authentication', async () => {
      const requestBody = {
        timeRange: {
          start: '2025-01-10T09:00:00.000Z',
          end: '2025-01-10T15:00:00.000Z'
        },
        granularity: 'hourly',
        categories: ['malware']
      };

      // Mock auth failure
      const mockAuth = vi.mocked(require('@/lib/auth/middleware'));
      mockAuth.validateApiKey.mockResolvedValueOnce(false);

      const response = await request(server)
        .post('/api/analytics/trend-analysis')
        .send(requestBody)
        .set('Content-Type', 'application/json')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Unauthorized');
    });

    it('should handle large time ranges appropriately', async () => {
      const requestBody = {
        timeRange: {
          start: '2024-01-01T00:00:00.000Z',
          end: '2025-01-15T23:59:59.000Z'
        },
        granularity: 'weekly',
        categories: ['malware', 'intrusion', 'anomaly']
      };

      const response = await request(server)
        .post('/api/analytics/trend-analysis')
        .send(requestBody)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(response.body.data.metadata.processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should validate JSON request body format', async () => {
      const response = await request(server)
        .post('/api/analytics/trend-analysis')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid request body');
    });

    it('should handle service errors gracefully', async () => {
      // Mock service error
      const mockThreatService = vi.mocked(require('@/services/threat-detection-service'));
      mockThreatService.threatDetectionService.getThreats.mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const requestBody = {
        timeRange: {
          start: '2025-01-10T09:00:00.000Z',
          end: '2025-01-10T15:00:00.000Z'
        },
        granularity: 'hourly',
        categories: ['malware']
      };

      const response = await request(server)
        .post('/api/analytics/trend-analysis')
        .send(requestBody)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Method validation', () => {
    it('should reject non-POST requests', async () => {
      const response = await request(server)
        .get('/api/analytics/trend-analysis')
        .set('x-api-key', 'test-api-key')
        .expect(405);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Method not allowed');
    });

    it('should reject PUT requests', async () => {
      const response = await request(server)
        .put('/api/analytics/trend-analysis')
        .send({})
        .set('x-api-key', 'test-api-key')
        .expect(405);

      expect(response.body.success).toBe(false);
    });

    it('should reject DELETE requests', async () => {
      const response = await request(server)
        .delete('/api/analytics/trend-analysis')
        .set('x-api-key', 'test-api-key')
        .expect(405);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Response format validation', () => {
    it('should return consistent response structure', async () => {
      const requestBody = {
        timeRange: {
          start: '2025-01-10T09:00:00.000Z',
          end: '2025-01-10T15:00:00.000Z'
        },
        granularity: 'hourly',
        categories: ['malware']
      };

      const response = await request(server)
        .post('/api/analytics/trend-analysis')
        .send(requestBody)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      // Validate response structure
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('correlationId');

      // Validate data structure
      const data = response.body.data;
      expect(data).toHaveProperty('analysisId');
      expect(data).toHaveProperty('trends');
      expect(data).toHaveProperty('insights');
      expect(data).toHaveProperty('metadata');

      // Validate metadata structure
      expect(data.metadata).toHaveProperty('processingTime');
      expect(data.metadata).toHaveProperty('dataPoints');
      expect(data.metadata).toHaveProperty('timeRange');
    });

    it('should include proper CORS headers', async () => {
      const requestBody = {
        timeRange: {
          start: '2025-01-10T09:00:00.000Z',
          end: '2025-01-10T15:00:00.000Z'
        },
        granularity: 'hourly',
        categories: ['malware']
      };

      const response = await request(server)
        .post('/api/analytics/trend-analysis')
        .send(requestBody)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .set('Origin', 'https://example.com')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });
  });
});