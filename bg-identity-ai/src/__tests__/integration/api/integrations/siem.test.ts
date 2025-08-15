import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createServer } from 'http';
import { parse } from 'url';
import { NextApiHandler } from 'next';

// Import API handlers
import siemHandler from '@/pages/api/integrations/siem';

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

describe('Integrations API Integration Tests - SIEM', () => {
  let server: any;

  beforeEach(() => {
    // Create test server
    server = createServer((req, res) => {
      const { pathname } = parse(req.url || '', true);
      
      if (pathname === '/api/integrations/siem') {
        return siemHandler(req as any, res as any);
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

  describe('POST /api/integrations/siem - Add SIEM Connection', () => {
    it('should add Splunk SIEM connection successfully', async () => {
      const siemData = {
        name: 'Production Splunk',
        type: 'splunk',
        config: {
          endpoint: 'https://splunk.company.com:8089',
          username: 'api_user',
          password: 'secure_password',
          index: 'security_events',
          protocol: 'https',
          format: 'json'
        },
        features: ['event_export', 'alert_import', 'query']
      };

      const response = await request(server)
        .post('/api/integrations/siem')
        .send(siemData)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toMatch(/^siem_/);
      expect(response.body.data.name).toBe('Production Splunk');
      expect(response.body.data.type).toBe('splunk');
      expect(response.body.data.status).toBe('active');
      expect(response.body.data.features).toEqual(['event_export', 'alert_import', 'query']);
      expect(response.body.data.config).toBeDefined();
      expect(response.body.data.metadata).toBeDefined();
    });

    it('should add QRadar SIEM connection successfully', async () => {
      const siemData = {
        name: 'QRadar Security Intelligence',
        type: 'qradar',
        config: {
          endpoint: 'https://qradar.security.local',
          apiToken: 'qradar_api_token_12345',
          version: '14.0',
          protocol: 'https',
          format: 'json'
        },
        features: ['event_export', 'alert_import']
      };

      const response = await request(server)
        .post('/api/integrations/siem')
        .send(siemData)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(201);

      expect(response.body.data.type).toBe('qradar');
      expect(response.body.data.config.version).toBe('14.0');
    });

    it('should add Sentinel SIEM connection successfully', async () => {
      const siemData = {
        name: 'Azure Sentinel',
        type: 'sentinel',
        config: {
          endpoint: 'https://management.azure.com',
          tenantId: 'azure-tenant-id',
          clientId: 'azure-client-id',
          clientSecret: 'azure-client-secret',
          workspaceId: 'sentinel-workspace-id',
          protocol: 'https',
          format: 'json'
        },
        features: ['event_export', 'alert_import', 'query', 'analytics']
      };

      const response = await request(server)
        .post('/api/integrations/siem')
        .send(siemData)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(201);

      expect(response.body.data.type).toBe('sentinel');
      expect(response.body.data.features).toContain('analytics');
    });

    it('should add Elastic Stack SIEM connection successfully', async () => {
      const siemData = {
        name: 'Elastic Security',
        type: 'elastic',
        config: {
          endpoint: 'https://elasticsearch.company.com:9200',
          username: 'elastic_user',
          password: 'elastic_password',
          index: 'security-*',
          kibanaEndpoint: 'https://kibana.company.com:5601',
          protocol: 'https',
          format: 'json'
        },
        features: ['event_export', 'alert_import', 'query', 'visualization']
      };

      const response = await request(server)
        .post('/api/integrations/siem')
        .send(siemData)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(201);

      expect(response.body.data.type).toBe('elastic');
      expect(response.body.data.config.kibanaEndpoint).toBe('https://kibana.company.com:5601');
    });

    it('should validate SIEM type', async () => {
      const siemData = {
        name: 'Invalid SIEM',
        type: 'invalid_siem_type',
        config: {
          endpoint: 'https://example.com'
        },
        features: ['event_export']
      };

      const response = await request(server)
        .post('/api/integrations/siem')
        .send(siemData)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Unsupported SIEM type');
    });

    it('should validate required configuration fields', async () => {
      const siemData = {
        name: 'Incomplete Splunk',
        type: 'splunk',
        config: {
          // Missing required endpoint
          username: 'user'
        },
        features: ['event_export']
      };

      const response = await request(server)
        .post('/api/integrations/siem')
        .send(siemData)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required configuration');
    });

    it('should validate endpoint URL format', async () => {
      const siemData = {
        name: 'Invalid URL SIEM',
        type: 'splunk',
        config: {
          endpoint: 'not-a-valid-url',
          username: 'user',
          password: 'pass'
        },
        features: ['event_export']
      };

      const response = await request(server)
        .post('/api/integrations/siem')
        .send(siemData)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid endpoint URL');
    });
  });

  describe('GET /api/integrations/siem - List SIEM Connections', () => {
    it('should list all SIEM connections', async () => {
      const response = await request(server)
        .get('/api/integrations/siem')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      
      response.body.data.forEach((connection: any) => {
        expect(connection).toHaveProperty('id');
        expect(connection).toHaveProperty('name');
        expect(connection).toHaveProperty('type');
        expect(connection).toHaveProperty('status');
        expect(connection).toHaveProperty('features');
        expect(connection).toHaveProperty('metadata');
        expect(connection.id).toMatch(/^siem_/);
        expect(['splunk', 'qradar', 'sentinel', 'elastic', 'arcsight', 'logrhythm'].includes(connection.type)).toBe(true);
        expect(['active', 'inactive', 'error', 'testing'].includes(connection.status)).toBe(true);
      });
    });

    it('should filter connections by SIEM type', async () => {
      const response = await request(server)
        .get('/api/integrations/siem?type=splunk')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach((connection: any) => {
        expect(connection.type).toBe('splunk');
      });
    });

    it('should filter connections by status', async () => {
      const response = await request(server)
        .get('/api/integrations/siem?status=active')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach((connection: any) => {
        expect(connection.status).toBe('active');
      });
    });
  });

  describe('GET /api/integrations/siem/:id - Get Specific SIEM Connection', () => {
    it('should retrieve specific SIEM connection by ID', async () => {
      const siemId = 'siem_test_123';
      
      const response = await request(server)
        .get(`/api/integrations/siem?id=${siemId}`)
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(siemId);
      expect(response.body.data.config).toBeDefined();
      expect(response.body.data.capabilities).toBeDefined();
    });

    it('should handle non-existent SIEM connection', async () => {
      const response = await request(server)
        .get('/api/integrations/siem?id=non_existent_siem')
        .set('x-api-key', 'test-api-key')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('SIEM connection not found');
    });
  });

  describe('PUT /api/integrations/siem/:id - Update SIEM Connection', () => {
    it('should update existing SIEM connection', async () => {
      const siemId = 'siem_test_123';
      const updateData = {
        name: 'Updated Splunk Connection',
        config: {
          endpoint: 'https://new-splunk.company.com:8089',
          index: 'updated_security_events'
        },
        features: ['event_export', 'alert_import', 'query', 'analytics']
      };

      const response = await request(server)
        .put(`/api/integrations/siem?id=${siemId}`)
        .send(updateData)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Splunk Connection');
      expect(response.body.data.features).toContain('analytics');
    });

    it('should validate update data', async () => {
      const siemId = 'siem_test_123';
      const invalidUpdateData = {
        config: {
          endpoint: 'invalid-url'
        }
      };

      const response = await request(server)
        .put(`/api/integrations/siem?id=${siemId}`)
        .send(invalidUpdateData)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid endpoint URL');
    });
  });

  describe('DELETE /api/integrations/siem/:id - Delete SIEM Connection', () => {
    it('should delete existing SIEM connection', async () => {
      const siemId = 'siem_test_123';

      const response = await request(server)
        .delete(`/api/integrations/siem?id=${siemId}`)
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('SIEM connection deleted successfully');
    });

    it('should handle non-existent SIEM connection deletion', async () => {
      const response = await request(server)
        .delete('/api/integrations/siem?id=non_existent_siem')
        .set('x-api-key', 'test-api-key')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('SIEM connection not found');
    });
  });

  describe('POST /api/integrations/siem/test - Test SIEM Connection', () => {
    it('should test SIEM connection successfully', async () => {
      const testData = {
        siemId: 'siem_test_123'
      };

      const response = await request(server)
        .post('/api/integrations/siem/test')
        .send(testData)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.connectionTest).toBeDefined();
      expect(response.body.data.capabilities).toBeInstanceOf(Array);
      expect(response.body.data.responseTime).toBeGreaterThan(0);
      expect(response.body.data.version).toBeDefined();
      
      if (response.body.data.connectionTest.success) {
        expect(response.body.data.connectionTest.status).toBeDefined();
      } else {
        expect(response.body.data.connectionTest.error).toBeDefined();
      }
    });

    it('should handle connection test failures gracefully', async () => {
      const testData = {
        siemId: 'siem_unreachable'
      };

      const response = await request(server)
        .post('/api/integrations/siem/test')
        .send(testData)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.connectionTest.success).toBe(false);
      expect(response.body.data.connectionTest.error).toBeDefined();
    });
  });

  describe('POST /api/integrations/siem/export - Export Events to SIEM', () => {
    it('should export threat events to SIEM successfully', async () => {
      const exportData = {
        siemId: 'siem_test_123',
        events: [
          {
            id: 'threat_001',
            timestamp: '2025-01-15T10:00:00.000Z',
            type: 'malware',
            severity: 'high',
            source: 'endpoint_scanner',
            target: 'workstation_001',
            description: 'Malware detected on workstation',
            riskScore: 8.5
          },
          {
            id: 'threat_002',
            timestamp: '2025-01-15T10:05:00.000Z',
            type: 'intrusion',
            severity: 'critical',
            source: 'network_monitor',
            target: 'server_001',
            description: 'Unauthorized access attempt',
            riskScore: 9.2
          }
        ],
        format: 'cef',
        batchSize: 100
      };

      const response = await request(server)
        .post('/api/integrations/siem/export')
        .send(exportData)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.exportId).toMatch(/^export_/);
      expect(response.body.data.totalEvents).toBe(2);
      expect(response.body.data.successfulEvents).toBeGreaterThanOrEqual(0);
      expect(response.body.data.failedEvents).toBeGreaterThanOrEqual(0);
      expect(response.body.data.processingTime).toBeGreaterThan(0);
      expect(response.body.data.format).toBe('cef');
    });

    it('should handle different export formats', async () => {
      const formats = ['cef', 'json', 'leef', 'syslog'];

      for (const format of formats) {
        const exportData = {
          siemId: 'siem_test_123',
          events: [
            {
              id: 'threat_format_test',
              timestamp: '2025-01-15T10:00:00.000Z',
              type: 'anomaly',
              severity: 'medium',
              description: `Test event for ${format} format`
            }
          ],
          format
        };

        const response = await request(server)
          .post('/api/integrations/siem/export')
          .send(exportData)
          .set('Content-Type', 'application/json')
          .set('x-api-key', 'test-api-key')
          .expect(200);

        expect(response.body.data.format).toBe(format);
      }
    });

    it('should validate export data', async () => {
      const invalidExportData = {
        siemId: 'siem_test_123',
        events: [], // Empty events array
        format: 'invalid_format'
      };

      const response = await request(server)
        .post('/api/integrations/siem/export')
        .send(invalidExportData)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/integrations/siem/sync-status - Get Sync Status', () => {
    it('should return sync status for all SIEM connections', async () => {
      const response = await request(server)
        .get('/api/integrations/siem/sync-status')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      
      response.body.data.forEach((status: any) => {
        expect(status).toHaveProperty('siemId');
        expect(status).toHaveProperty('lastSync');
        expect(status).toHaveProperty('syncStatus');
        expect(status).toHaveProperty('eventsProcessed');
        expect(status).toHaveProperty('errorCount');
        expect(['idle', 'syncing', 'error', 'completed'].includes(status.syncStatus)).toBe(true);
        expect(status.eventsProcessed).toBeGreaterThanOrEqual(0);
        expect(status.errorCount).toBeGreaterThanOrEqual(0);
      });
    });

    it('should return sync status for specific SIEM connection', async () => {
      const siemId = 'siem_test_123';
      
      const response = await request(server)
        .get(`/api/integrations/siem/sync-status?siemId=${siemId}`)
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.siemId).toBe(siemId);
    });
  });

  describe('Authentication and Error Handling', () => {
    it('should require authentication for all endpoints', async () => {
      const response = await request(server)
        .get('/api/integrations/siem')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing API key');
    });

    it('should handle invalid authentication', async () => {
      // Mock auth failure
      const mockAuth = vi.mocked(require('@/lib/auth/middleware'));
      mockAuth.validateApiKey.mockResolvedValueOnce(false);

      const response = await request(server)
        .get('/api/integrations/siem')
        .set('x-api-key', 'invalid-api-key')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid API key');
    });

    it('should handle service errors gracefully', async () => {
      // Mock service error
      vi.doMock('@/services/integrations/siem-integration-service', () => ({
        siemIntegrationService: {
          getConnections: vi.fn().mockImplementation(() => {
            throw new Error('SIEM service unavailable');
          })
        }
      }));

      const response = await request(server)
        .get('/api/integrations/siem')
        .set('x-api-key', 'test-api-key')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should include correlation ID in all responses', async () => {
      const response = await request(server)
        .get('/api/integrations/siem')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expect(response.body.correlationId).toBeDefined();
      expect(response.body.correlationId).toMatch(/^[a-f0-9-]{36}$/); // UUID format
    });
  });

  describe('Rate Limiting and Performance', () => {
    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = Array(8).fill(null).map(() =>
        request(server)
          .get('/api/integrations/siem')
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
        .get('/api/integrations/siem')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
    });

    it('should handle large export operations efficiently', async () => {
      // Create large export data
      const largeEvents = Array(1000).fill(null).map((_, i) => ({
        id: `threat_${i}`,
        timestamp: new Date().toISOString(),
        type: 'test',
        severity: 'low',
        description: `Test event ${i}`
      }));

      const exportData = {
        siemId: 'siem_test_123',
        events: largeEvents,
        format: 'json',
        batchSize: 100
      };

      const startTime = Date.now();
      const response = await request(server)
        .post('/api/integrations/siem/export')
        .send(exportData)
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(response.body.data.totalEvents).toBe(1000);
    });
  });
});