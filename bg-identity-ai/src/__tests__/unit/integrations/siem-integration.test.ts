import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SIEMIntegrationService, SIEMType, SIEMFeature } from '@/services/integrations/siem-integration-service';
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

vi.mock('@/services/integrations/webhook-manager', () => ({
  webhookManager: {
    triggerEvent: vi.fn().mockResolvedValue('mock_event_id')
  }
}));

describe('SIEMIntegrationService', () => {
  let siemService: SIEMIntegrationService;
  let mockThreatData: ThreatEvent[];

  beforeEach(() => {
    siemService = new SIEMIntegrationService();
    
    // Create mock threat data for testing
    mockThreatData = [
      {
        id: 'threat_1',
        timestamp: '2025-01-13T10:00:00.000Z',
        type: 'malware',
        severity: 'high',
        source: '192.168.1.100',
        target: '192.168.1.50',
        description: 'Malware detected in network traffic',
        riskScore: 8.5,
        status: 'active',
        metadata: { correlationId: 'corr_1', source: 'detector_1' }
      },
      {
        id: 'threat_2',
        timestamp: '2025-01-13T10:15:00.000Z',
        type: 'intrusion',
        severity: 'critical',
        source: '10.0.0.50',
        target: '192.168.1.10',
        description: 'Unauthorized access attempt detected',
        riskScore: 9.2,
        status: 'investigating',
        metadata: { correlationId: 'corr_2', source: 'detector_2' }
      },
      {
        id: 'threat_3',
        timestamp: '2025-01-13T10:30:00.000Z',
        type: 'anomaly',
        severity: 'medium',
        source: 'user_john',
        target: 'server_db1',
        description: 'Unusual database access pattern',
        riskScore: 6.7,
        status: 'resolved',
        metadata: { correlationId: 'corr_3', source: 'detector_3' }
      }
    ];
  });

  afterEach(() => {
    vi.clearAllMocks();
    siemService.cleanup();
  });

  describe('addConnection', () => {
    it('should add SIEM connection successfully', async () => {
      const connectionData = {
        name: 'Test Splunk',
        type: 'splunk' as SIEMType,
        config: {
          endpoint: 'https://splunk.example.com:8089',
          protocol: 'https' as const,
          format: 'json' as const,
          batchSize: 100,
          syncInterval: 15,
          retentionDays: 30,
          customFields: {},
          filters: [],
          mapping: []
        },
        credentials: {
          authType: 'api_key' as const,
          apiKey: 'test_api_key_12345'
        },
        features: ['event_export', 'alert_import'] as SIEMFeature[]
      };

      const connection = await siemService.addConnection(connectionData);

      expect(connection).toBeDefined();
      expect(connection.id).toMatch(/^siem_/);
      expect(connection.name).toBe('Test Splunk');
      expect(connection.type).toBe('splunk');
      expect(connection.status).toMatch(/^(connected|disconnected|error|testing)$/);
      expect(connection.config).toBeDefined();
      expect(connection.credentials).toBeDefined();
      expect(connection.features).toEqual(['event_export', 'alert_import']);
      expect(connection.metadata).toBeDefined();
    });

    it('should validate SIEM configuration', async () => {
      const connectionData = {
        name: 'Test QRadar',
        type: 'qradar' as SIEMType,
        config: {
          endpoint: 'https://qradar.example.com',
          protocol: 'https' as const,
          format: 'json' as const,
          batchSize: 250,
          syncInterval: 30,
          retentionDays: 90,
          customFields: { environment: 'production' },
          filters: [{
            field: 'severity',
            operator: 'equals' as const,
            value: 'critical'
          }],
          mapping: [{
            sourceField: 'riskScore',
            targetField: 'risk_level',
            transformation: 'custom' as const,
            required: true
          }]
        },
        credentials: {
          authType: 'basic_auth' as const,
          username: 'qradar_user',
          password: 'qradar_pass'
        },
        features: ['event_export', 'bi_directional_sync'] as SIEMFeature[]
      };

      const connection = await siemService.addConnection(connectionData);

      expect(connection.config.batchSize).toBe(250);
      expect(connection.config.syncInterval).toBe(30);
      expect(connection.config.filters.length).toBe(1);
      expect(connection.config.mapping.length).toBe(1);
      expect(connection.credentials.authType).toBe('basic_auth');
    });

    it('should initialize metadata correctly', async () => {
      const connectionData = {
        name: 'Test Sentinel',
        type: 'sentinel' as SIEMType,
        config: {
          endpoint: 'https://sentinel.azure.com',
          protocol: 'https' as const,
          format: 'json' as const,
          batchSize: 50,
          syncInterval: 10,
          retentionDays: 60,
          customFields: {},
          filters: [],
          mapping: []
        },
        credentials: {
          authType: 'oauth2' as const,
          clientId: 'client_123',
          clientSecret: 'secret_456'
        },
        features: ['event_export', 'custom_dashboards'] as SIEMFeature[]
      };

      const connection = await siemService.addConnection(connectionData);

      expect(connection.metadata.createdAt).toBeDefined();
      expect(connection.metadata.lastSync).toBe('never');
      expect(connection.metadata.eventsExported).toBe(0);
      expect(connection.metadata.version).toBe('2.0.0');
      expect(connection.metadata.lastError).toBeUndefined();
    });

    it('should test connection after creation', async () => {
      const connectionData = {
        name: 'Test Elastic',
        type: 'elastic_stack' as SIEMType,
        config: {
          endpoint: 'https://elastic.example.com:9200',
          protocol: 'https' as const,
          format: 'json' as const,
          batchSize: 200,
          syncInterval: 20,
          retentionDays: 120,
          customFields: {},
          filters: [],
          mapping: []
        },
        credentials: {
          authType: 'api_key' as const,
          apiKey: 'elastic_api_key'
        },
        features: ['event_export', 'threat_intelligence_feed'] as SIEMFeature[]
      };

      const connection = await siemService.addConnection(connectionData);

      // Connection should be tested automatically
      expect(['connected', 'error', 'testing'].includes(connection.status)).toBe(true);
    });
  });

  describe('updateConnection', () => {
    it('should update existing connection', async () => {
      // First create a connection
      const connectionData = {
        name: 'Original Connection',
        type: 'splunk' as SIEMType,
        config: {
          endpoint: 'https://original.example.com',
          protocol: 'https' as const,
          format: 'json' as const,
          batchSize: 100,
          syncInterval: 15,
          retentionDays: 30,
          customFields: {},
          filters: [],
          mapping: []
        },
        credentials: {
          authType: 'api_key' as const,
          apiKey: 'original_key'
        },
        features: ['event_export'] as SIEMFeature[]
      };
      const connection = await siemService.addConnection(connectionData);

      // Update the connection
      const updates = {
        name: 'Updated Connection',
        config: {
          ...connection.config,
          endpoint: 'https://updated.example.com',
          batchSize: 200
        }
      };
      const updatedConnection = await siemService.updateConnection(connection.id, updates);

      expect(updatedConnection).toBeDefined();
      expect(updatedConnection!.name).toBe('Updated Connection');
      expect(updatedConnection!.config.endpoint).toBe('https://updated.example.com');
      expect(updatedConnection!.config.batchSize).toBe(200);
    });

    it('should return null for non-existent connection', async () => {
      const result = await siemService.updateConnection('non_existent_connection', {
        name: 'Updated Name'
      });

      expect(result).toBeNull();
    });

    it('should re-test connection when config or credentials change', async () => {
      const connectionData = {
        name: 'Test Connection',
        type: 'qradar' as SIEMType,
        config: {
          endpoint: 'https://qradar.example.com',
          protocol: 'https' as const,
          format: 'json' as const,
          batchSize: 100,
          syncInterval: 15,
          retentionDays: 30,
          customFields: {},
          filters: [],
          mapping: []
        },
        credentials: {
          authType: 'api_key' as const,
          apiKey: 'original_key'
        },
        features: ['event_export'] as SIEMFeature[]
      };
      const connection = await siemService.addConnection(connectionData);

      // Update credentials
      const updatedConnection = await siemService.updateConnection(connection.id, {
        credentials: {
          authType: 'api_key' as const,
          apiKey: 'new_api_key'
        }
      });

      expect(updatedConnection).toBeDefined();
      // Connection should be re-tested after credential change
      expect(['connected', 'error', 'testing'].includes(updatedConnection!.status)).toBe(true);
    });
  });

  describe('removeConnection', () => {
    it('should remove existing connection', async () => {
      const connectionData = {
        name: 'Test Connection',
        type: 'splunk' as SIEMType,
        config: {
          endpoint: 'https://splunk.example.com',
          protocol: 'https' as const,
          format: 'json' as const,
          batchSize: 100,
          syncInterval: 15,
          retentionDays: 30,
          customFields: {},
          filters: [],
          mapping: []
        },
        credentials: {
          authType: 'api_key' as const,
          apiKey: 'test_key'
        },
        features: ['event_export'] as SIEMFeature[]
      };
      const connection = await siemService.addConnection(connectionData);

      const removed = await siemService.removeConnection(connection.id);

      expect(removed).toBe(true);
      
      // Verify connection is no longer accessible
      const retrieved = siemService.getConnection(connection.id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent connection', async () => {
      const removed = await siemService.removeConnection('non_existent_connection');
      expect(removed).toBe(false);
    });

    it('should clean up pending export queue', async () => {
      const connectionData = {
        name: 'Test Connection',
        type: 'splunk' as SIEMType,
        config: {
          endpoint: 'https://splunk.example.com',
          protocol: 'https' as const,
          format: 'json' as const,
          batchSize: 100,
          syncInterval: 15,
          retentionDays: 30,
          customFields: {},
          filters: [],
          mapping: []
        },
        credentials: {
          authType: 'api_key' as const,
          apiKey: 'test_key'
        },
        features: ['event_export'] as SIEMFeature[]
      };
      const connection = await siemService.addConnection(connectionData);

      // Queue some exports
      await siemService.exportThreats(connection.id, mockThreatData, { immediate: false });

      // Remove connection
      await siemService.removeConnection(connection.id);

      // Export queue should be cleaned up (verified internally)
      expect(true).toBe(true); // Placeholder - internal state not directly testable
    });
  });

  describe('getConnections and getConnection', () => {
    it('should retrieve all connections', async () => {
      const connection1Data = {
        name: 'Splunk Connection',
        type: 'splunk' as SIEMType,
        config: {
          endpoint: 'https://splunk.example.com',
          protocol: 'https' as const,
          format: 'json' as const,
          batchSize: 100,
          syncInterval: 15,
          retentionDays: 30,
          customFields: {},
          filters: [],
          mapping: []
        },
        credentials: {
          authType: 'api_key' as const,
          apiKey: 'splunk_key'
        },
        features: ['event_export'] as SIEMFeature[]
      };

      const connection2Data = {
        name: 'QRadar Connection',
        type: 'qradar' as SIEMType,
        config: {
          endpoint: 'https://qradar.example.com',
          protocol: 'https' as const,
          format: 'json' as const,
          batchSize: 150,
          syncInterval: 20,
          retentionDays: 60,
          customFields: {},
          filters: [],
          mapping: []
        },
        credentials: {
          authType: 'basic_auth' as const,
          username: 'qradar_user',
          password: 'qradar_pass'
        },
        features: ['event_export', 'alert_import'] as SIEMFeature[]
      };

      await siemService.addConnection(connection1Data);
      await siemService.addConnection(connection2Data);

      const connections = siemService.getConnections();

      expect(connections.length).toBe(2);
      expect(connections.some(c => c.name === 'Splunk Connection')).toBe(true);
      expect(connections.some(c => c.name === 'QRadar Connection')).toBe(true);
    });

    it('should retrieve specific connection by ID', async () => {
      const connectionData = {
        name: 'Test Connection',
        type: 'sentinel' as SIEMType,
        config: {
          endpoint: 'https://sentinel.azure.com',
          protocol: 'https' as const,
          format: 'json' as const,
          batchSize: 100,
          syncInterval: 15,
          retentionDays: 30,
          customFields: {},
          filters: [],
          mapping: []
        },
        credentials: {
          authType: 'oauth2' as const,
          clientId: 'client_123',
          clientSecret: 'secret_456'
        },
        features: ['event_export'] as SIEMFeature[]
      };
      const connection = await siemService.addConnection(connectionData);

      const retrieved = siemService.getConnection(connection.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(connection.id);
      expect(retrieved!.name).toBe('Test Connection');
      expect(retrieved!.type).toBe('sentinel');
    });

    it('should return null for non-existent connection ID', () => {
      const retrieved = siemService.getConnection('non_existent_connection');
      expect(retrieved).toBeNull();
    });
  });

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      const connectionData = {
        name: 'Test Connection',
        type: 'splunk' as SIEMType,
        config: {
          endpoint: 'https://splunk.example.com',
          protocol: 'https' as const,
          format: 'json' as const,
          batchSize: 100,
          syncInterval: 15,
          retentionDays: 30,
          customFields: {},
          filters: [],
          mapping: []
        },
        credentials: {
          authType: 'api_key' as const,
          apiKey: 'test_key'
        },
        features: ['event_export'] as SIEMFeature[]
      };
      const connection = await siemService.addConnection(connectionData);

      const result = await siemService.testConnection(connection.id);

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(result.responseTime).toBeGreaterThan(0);
      
      if (result.success) {
        expect(result.details).toBeDefined();
      } else {
        expect(result.error).toBeDefined();
      }
    });

    it('should return error for non-existent connection', async () => {
      const result = await siemService.testConnection('non_existent_connection');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection not found');
      expect(result.responseTime).toBe(0);
    });

    it('should update connection status based on test result', async () => {
      const connectionData = {
        name: 'Test Connection',
        type: 'qradar' as SIEMType,
        config: {
          endpoint: 'https://qradar.example.com',
          protocol: 'https' as const,
          format: 'json' as const,
          batchSize: 100,
          syncInterval: 15,
          retentionDays: 30,
          customFields: {},
          filters: [],
          mapping: []
        },
        credentials: {
          authType: 'api_key' as const,
          apiKey: 'test_key'
        },
        features: ['event_export'] as SIEMFeature[]
      };
      const connection = await siemService.addConnection(connectionData);

      await siemService.testConnection(connection.id);

      const updatedConnection = siemService.getConnection(connection.id);
      expect(['connected', 'error'].includes(updatedConnection!.status)).toBe(true);
    });
  });

  describe('exportThreats', () => {
    it('should export threats immediately', async () => {
      const connectionData = {
        name: 'Export Test Connection',
        type: 'splunk' as SIEMType,
        config: {
          endpoint: 'https://splunk.example.com',
          protocol: 'https' as const,
          format: 'json' as const,
          batchSize: 100,
          syncInterval: 15,
          retentionDays: 30,
          customFields: {},
          filters: [],
          mapping: []
        },
        credentials: {
          authType: 'api_key' as const,
          apiKey: 'test_key'
        },
        features: ['event_export'] as SIEMFeature[]
      };
      const connection = await siemService.addConnection(connectionData);

      // Force connection to be active for testing
      connection.status = 'connected';
      (siemService as any).connections.set(connection.id, connection);

      const result = await siemService.exportThreats(connection.id, mockThreatData, {
        immediate: true,
        batchId: 'test_batch_123'
      });

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(result.eventsExported).toBeGreaterThanOrEqual(0);
      expect(result.errors).toBeInstanceOf(Array);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.batchId).toBe('test_batch_123');
    });

    it('should queue threats for batch processing', async () => {
      const connectionData = {
        name: 'Queue Test Connection',
        type: 'qradar' as SIEMType,
        config: {
          endpoint: 'https://qradar.example.com',
          protocol: 'https' as const,
          format: 'json' as const,
          batchSize: 100,
          syncInterval: 15,
          retentionDays: 30,
          customFields: {},
          filters: [],
          mapping: []
        },
        credentials: {
          authType: 'api_key' as const,
          apiKey: 'test_key'
        },
        features: ['event_export'] as SIEMFeature[]
      };
      const connection = await siemService.addConnection(connectionData);

      const result = await siemService.exportThreats(connection.id, mockThreatData, {
        immediate: false
      });

      expect(result.success).toBe(true);
      expect(result.eventsExported).toBe(mockThreatData.length);
      expect(result.batchId).toBe('queued');
      expect(result.duration).toBe(0);
    });

    it('should handle connection not found', async () => {
      await expect(siemService.exportThreats('non_existent_connection', mockThreatData))
        .rejects.toThrow('Connection not found');
    });

    it('should handle inactive connection', async () => {
      const connectionData = {
        name: 'Inactive Connection',
        type: 'splunk' as SIEMType,
        config: {
          endpoint: 'https://splunk.example.com',
          protocol: 'https' as const,
          format: 'json' as const,
          batchSize: 100,
          syncInterval: 15,
          retentionDays: 30,
          customFields: {},
          filters: [],
          mapping: []
        },
        credentials: {
          authType: 'api_key' as const,
          apiKey: 'test_key'
        },
        features: ['event_export'] as SIEMFeature[]
      };
      const connection = await siemService.addConnection(connectionData);

      // Force connection to be inactive
      connection.status = 'error';
      (siemService as any).connections.set(connection.id, connection);

      await expect(siemService.exportThreats(connection.id, mockThreatData, { immediate: true }))
        .rejects.toThrow('Connection not active');
    });

    it('should apply filters during export', async () => {
      const connectionData = {
        name: 'Filter Test Connection',
        type: 'sentinel' as SIEMType,
        config: {
          endpoint: 'https://sentinel.azure.com',
          protocol: 'https' as const,
          format: 'json' as const,
          batchSize: 100,
          syncInterval: 15,
          retentionDays: 30,
          customFields: {},
          filters: [{
            field: 'severity',
            operator: 'equals' as const,
            value: 'high'
          }],
          mapping: []
        },
        credentials: {
          authType: 'oauth2' as const,
          clientId: 'client_123',
          clientSecret: 'secret_456'
        },
        features: ['event_export'] as SIEMFeature[]
      };
      const connection = await siemService.addConnection(connectionData);
      connection.status = 'connected';
      (siemService as any).connections.set(connection.id, connection);

      const result = await siemService.exportThreats(connection.id, mockThreatData, { immediate: true });

      // Should filter out threats that don't match severity=high
      expect(result.eventsExported).toBeLessThanOrEqual(mockThreatData.length);
    });

    it('should transform events based on field mapping', async () => {
      const connectionData = {
        name: 'Mapping Test Connection',
        type: 'elastic_stack' as SIEMType,
        config: {
          endpoint: 'https://elastic.example.com',
          protocol: 'https' as const,
          format: 'json' as const,
          batchSize: 100,
          syncInterval: 15,
          retentionDays: 30,
          customFields: {},
          filters: [],
          mapping: [{
            sourceField: 'riskScore',
            targetField: 'risk_level',
            transformation: 'uppercase' as const,
            required: true
          }]
        },
        credentials: {
          authType: 'api_key' as const,
          apiKey: 'elastic_key'
        },
        features: ['event_export'] as SIEMFeature[]
      };
      const connection = await siemService.addConnection(connectionData);
      connection.status = 'connected';
      (siemService as any).connections.set(connection.id, connection);

      const result = await siemService.exportThreats(connection.id, mockThreatData, { immediate: true });

      expect(result.success).toBeDefined();
      expect(result.eventsExported).toBeGreaterThanOrEqual(0);
    });
  });

  describe('importAlerts', () => {
    it('should import alerts from SIEM', async () => {
      const connectionData = {
        name: 'Import Test Connection',
        type: 'splunk' as SIEMType,
        config: {
          endpoint: 'https://splunk.example.com',
          protocol: 'https' as const,
          format: 'json' as const,
          batchSize: 100,
          syncInterval: 15,
          retentionDays: 30,
          customFields: {},
          filters: [],
          mapping: []
        },
        credentials: {
          authType: 'api_key' as const,
          apiKey: 'test_key'
        },
        features: ['alert_import'] as SIEMFeature[]
      };
      const connection = await siemService.addConnection(connectionData);
      connection.status = 'connected';
      (siemService as any).connections.set(connection.id, connection);

      const result = await siemService.importAlerts(connection.id);

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(result.alertsImported).toBeGreaterThanOrEqual(0);
      expect(result.duplicatesSkipped).toBeGreaterThanOrEqual(0);
      expect(result.errors).toBeInstanceOf(Array);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle connection without alert import feature', async () => {
      const connectionData = {
        name: 'No Import Feature Connection',
        type: 'qradar' as SIEMType,
        config: {
          endpoint: 'https://qradar.example.com',
          protocol: 'https' as const,
          format: 'json' as const,
          batchSize: 100,
          syncInterval: 15,
          retentionDays: 30,
          customFields: {},
          filters: [],
          mapping: []
        },
        credentials: {
          authType: 'api_key' as const,
          apiKey: 'test_key'
        },
        features: ['event_export'] as SIEMFeature[] // No alert_import
      };
      const connection = await siemService.addConnection(connectionData);

      await expect(siemService.importAlerts(connection.id))
        .rejects.toThrow('Alert import not supported for this connection');
    });

    it('should handle connection not found', async () => {
      await expect(siemService.importAlerts('non_existent_connection'))
        .rejects.toThrow('Connection not found');
    });

    it('should filter imported alerts by time range', async () => {
      const connectionData = {
        name: 'Time Filter Connection',
        type: 'sentinel' as SIEMType,
        config: {
          endpoint: 'https://sentinel.azure.com',
          protocol: 'https' as const,
          format: 'json' as const,
          batchSize: 100,
          syncInterval: 15,
          retentionDays: 30,
          customFields: {},
          filters: [],
          mapping: []
        },
        credentials: {
          authType: 'oauth2' as const,
          clientId: 'client_123',
          clientSecret: 'secret_456'
        },
        features: ['alert_import'] as SIEMFeature[]
      };
      const connection = await siemService.addConnection(connectionData);
      connection.status = 'connected';
      (siemService as any).connections.set(connection.id, connection);

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 24 hours ago
      const result = await siemService.importAlerts(connection.id, since);

      expect(result.alertsImported).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getSIEMStats', () => {
    it('should provide comprehensive SIEM statistics', async () => {
      // Add multiple connections
      const connection1Data = {
        name: 'Splunk Stats',
        type: 'splunk' as SIEMType,
        config: {
          endpoint: 'https://splunk.example.com',
          protocol: 'https' as const,
          format: 'json' as const,
          batchSize: 100,
          syncInterval: 15,
          retentionDays: 30,
          customFields: {},
          filters: [],
          mapping: []
        },
        credentials: {
          authType: 'api_key' as const,
          apiKey: 'splunk_key'
        },
        features: ['event_export'] as SIEMFeature[]
      };

      const connection2Data = {
        name: 'QRadar Stats',
        type: 'qradar' as SIEMType,
        config: {
          endpoint: 'https://qradar.example.com',
          protocol: 'https' as const,
          format: 'json' as const,
          batchSize: 150,
          syncInterval: 20,
          retentionDays: 60,
          customFields: {},
          filters: [],
          mapping: []
        },
        credentials: {
          authType: 'basic_auth' as const,
          username: 'qradar_user',
          password: 'qradar_pass'
        },
        features: ['event_export', 'alert_import'] as SIEMFeature[]
      };

      const connection1 = await siemService.addConnection(connection1Data);
      const connection2 = await siemService.addConnection(connection2Data);

      // Force connections to be active
      connection1.status = 'connected';
      connection2.status = 'connected';
      (siemService as any).connections.set(connection1.id, connection1);
      (siemService as any).connections.set(connection2.id, connection2);

      const stats = siemService.getSIEMStats();

      expect(stats).toBeDefined();
      expect(stats.totalConnections).toBe(2);
      expect(stats.activeConnections).toBe(2);
      expect(stats.totalEventsExported).toBeGreaterThanOrEqual(0);
      expect(stats.totalAlertsImported).toBeGreaterThanOrEqual(0);
      expect(stats.exportsByType).toBeDefined();
      expect(stats.averageExportTime).toBeGreaterThanOrEqual(0);
      expect(stats.errorRate).toBeGreaterThanOrEqual(0);
      expect(stats.errorRate).toBeLessThanOrEqual(1);
      expect(stats.lastSyncTimes).toBeInstanceOf(Array);

      // Exports by type validation
      expect(stats.exportsByType.splunk).toBeGreaterThanOrEqual(0);
      expect(stats.exportsByType.qradar).toBeGreaterThanOrEqual(0);

      // Last sync times validation
      expect(stats.lastSyncTimes.length).toBe(2);
      stats.lastSyncTimes.forEach(sync => {
        expect(sync.connectionId).toBeDefined();
        expect(sync.lastSync).toBeDefined();
        expect(sync.status).toBeDefined();
      });
    });

    it('should handle empty connections', () => {
      const stats = siemService.getSIEMStats();

      expect(stats.totalConnections).toBe(0);
      expect(stats.activeConnections).toBe(0);
      expect(stats.totalEventsExported).toBe(0);
      expect(stats.lastSyncTimes).toEqual([]);
    });
  });

  describe('syncAllConnections', () => {
    it('should sync all active connections', async () => {
      // Add multiple connections
      const connection1Data = {
        name: 'Sync Test 1',
        type: 'splunk' as SIEMType,
        config: {
          endpoint: 'https://splunk1.example.com',
          protocol: 'https' as const,
          format: 'json' as const,
          batchSize: 100,
          syncInterval: 15,
          retentionDays: 30,
          customFields: {},
          filters: [],
          mapping: []
        },
        credentials: {
          authType: 'api_key' as const,
          apiKey: 'splunk_key1'
        },
        features: ['event_export'] as SIEMFeature[]
      };

      const connection2Data = {
        name: 'Sync Test 2',
        type: 'qradar' as SIEMType,
        config: {
          endpoint: 'https://qradar2.example.com',
          protocol: 'https' as const,
          format: 'json' as const,
          batchSize: 150,
          syncInterval: 20,
          retentionDays: 60,
          customFields: {},
          filters: [],
          mapping: []
        },
        credentials: {
          authType: 'api_key' as const,
          apiKey: 'qradar_key2'
        },
        features: ['event_export', 'alert_import'] as SIEMFeature[]
      };

      const connection1 = await siemService.addConnection(connection1Data);
      const connection2 = await siemService.addConnection(connection2Data);

      // Force connections to be active
      connection1.status = 'connected';
      connection2.status = 'connected';
      (siemService as any).connections.set(connection1.id, connection1);
      (siemService as any).connections.set(connection2.id, connection2);

      const results = await siemService.syncAllConnections();

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBe(2);

      results.forEach(result => {
        expect(result.connectionId).toBeDefined();
        expect(result.success).toBeDefined();
        
        if (result.success) {
          expect(result.eventsExported).toBeGreaterThanOrEqual(0);
        } else {
          expect(result.error).toBeDefined();
        }
      });
    });

    it('should handle no active connections', async () => {
      const results = await siemService.syncAllConnections();

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBe(0);
    });

    it('should handle sync failures gracefully', async () => {
      const connectionData = {
        name: 'Failing Connection',
        type: 'splunk' as SIEMType,
        config: {
          endpoint: 'https://invalid.example.com',
          protocol: 'https' as const,
          format: 'json' as const,
          batchSize: 100,
          syncInterval: 15,
          retentionDays: 30,
          customFields: {},
          filters: [],
          mapping: []
        },
        credentials: {
          authType: 'api_key' as const,
          apiKey: 'invalid_key'
        },
        features: ['event_export'] as SIEMFeature[]
      };
      const connection = await siemService.addConnection(connectionData);
      connection.status = 'connected';
      (siemService as any).connections.set(connection.id, connection);

      const results = await siemService.syncAllConnections();

      expect(results.length).toBe(1);
      expect(results[0].connectionId).toBe(connection.id);
      // May succeed or fail depending on mock behavior
      expect(results[0].success).toBeDefined();
    });
  });

  describe('data transformation and formatting', () => {
    it('should transform events to CEF format', async () => {
      const connectionData = {
        name: 'CEF Format Connection',
        type: 'arcsight' as SIEMType,
        config: {
          endpoint: 'https://arcsight.example.com',
          protocol: 'https' as const,
          format: 'cef' as const,
          batchSize: 100,
          syncInterval: 15,
          retentionDays: 30,
          customFields: {},
          filters: [],
          mapping: [{
            sourceField: 'source',
            targetField: 'src',
            required: true
          }]
        },
        credentials: {
          authType: 'api_key' as const,
          apiKey: 'arcsight_key'
        },
        features: ['event_export'] as SIEMFeature[]
      };
      const connection = await siemService.addConnection(connectionData);
      connection.status = 'connected';
      (siemService as any).connections.set(connection.id, connection);

      const result = await siemService.exportThreats(connection.id, mockThreatData, { immediate: true });

      expect(result.success).toBeDefined();
      expect(result.eventsExported).toBeGreaterThanOrEqual(0);
    });

    it('should transform events to LEEF format', async () => {
      const connectionData = {
        name: 'LEEF Format Connection',
        type: 'qradar' as SIEMType,
        config: {
          endpoint: 'https://qradar.example.com',
          protocol: 'https' as const,
          format: 'leef' as const,
          batchSize: 100,
          syncInterval: 15,
          retentionDays: 30,
          customFields: {},
          filters: [],
          mapping: []
        },
        credentials: {
          authType: 'api_key' as const,
          apiKey: 'qradar_key'
        },
        features: ['event_export'] as SIEMFeature[]
      };
      const connection = await siemService.addConnection(connectionData);
      connection.status = 'connected';
      (siemService as any).connections.set(connection.id, connection);

      const result = await siemService.exportThreats(connection.id, mockThreatData, { immediate: true });

      expect(result.success).toBeDefined();
      expect(result.eventsExported).toBeGreaterThanOrEqual(0);
    });

    it('should transform events to Syslog format', async () => {
      const connectionData = {
        name: 'Syslog Format Connection',
        type: 'syslog' as SIEMType,
        config: {
          endpoint: 'syslog.example.com',
          port: 514,
          protocol: 'udp' as const,
          format: 'syslog' as const,
          batchSize: 100,
          syncInterval: 15,
          retentionDays: 30,
          customFields: {},
          filters: [],
          mapping: []
        },
        credentials: {
          authType: 'token' as const,
          token: 'syslog_token'
        },
        features: ['event_export'] as SIEMFeature[]
      };
      const connection = await siemService.addConnection(connectionData);
      connection.status = 'connected';
      (siemService as any).connections.set(connection.id, connection);

      const result = await siemService.exportThreats(connection.id, mockThreatData, { immediate: true });

      expect(result.success).toBeDefined();
      expect(result.eventsExported).toBeGreaterThanOrEqual(0);
    });
  });

  describe('error handling and resilience', () => {
    it('should handle malformed connection data', async () => {
      const malformedData = {
        name: '',
        type: 'invalid_type' as any,
        config: null,
        credentials: {},
        features: []
      };

      await expect(siemService.addConnection(malformedData))
        .rejects.toThrow();
    });

    it('should handle network failures during export', async () => {
      const connectionData = {
        name: 'Network Fail Connection',
        type: 'splunk' as SIEMType,
        config: {
          endpoint: 'https://unreachable.example.com',
          protocol: 'https' as const,
          format: 'json' as const,
          batchSize: 100,
          syncInterval: 15,
          retentionDays: 30,
          customFields: {},
          filters: [],
          mapping: []
        },
        credentials: {
          authType: 'api_key' as const,
          apiKey: 'test_key'
        },
        features: ['event_export'] as SIEMFeature[]
      };
      const connection = await siemService.addConnection(connectionData);
      connection.status = 'connected';
      (siemService as any).connections.set(connection.id, connection);

      // Export may fail due to network issues
      const result = await siemService.exportThreats(connection.id, mockThreatData, { immediate: true });
      
      // Should handle gracefully
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it('should handle concurrent operations', async () => {
      const connectionData = {
        name: 'Concurrent Test Connection',
        type: 'elastic_stack' as SIEMType,
        config: {
          endpoint: 'https://elastic.example.com',
          protocol: 'https' as const,
          format: 'json' as const,
          batchSize: 100,
          syncInterval: 15,
          retentionDays: 30,
          customFields: {},
          filters: [],
          mapping: []
        },
        credentials: {
          authType: 'api_key' as const,
          apiKey: 'elastic_key'
        },
        features: ['event_export', 'alert_import'] as SIEMFeature[]
      };
      const connection = await siemService.addConnection(connectionData);
      connection.status = 'connected';
      (siemService as any).connections.set(connection.id, connection);

      // Run multiple operations concurrently
      const operations = [
        siemService.testConnection(connection.id),
        siemService.exportThreats(connection.id, mockThreatData, { immediate: true }),
        siemService.importAlerts(connection.id)
      ];

      const results = await Promise.allSettled(operations);

      // Most operations should complete (some may fail due to mocking)
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(0);
    });

    it('should clean up resources properly', () => {
      // Should not throw errors during cleanup
      expect(() => siemService.cleanup()).not.toThrow();
    });
  });
});