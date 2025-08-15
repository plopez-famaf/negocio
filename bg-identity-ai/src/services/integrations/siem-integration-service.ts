import { logger } from '@/lib/logger';
import { ThreatEvent } from '@/types/threat';
import { webhookManager } from './webhook-manager';

export interface SIEMConnection {
  id: string;
  name: string;
  type: SIEMType;
  status: 'connected' | 'disconnected' | 'error' | 'testing';
  config: SIEMConfig;
  credentials: SIEMCredentials;
  features: SIEMFeature[];
  metadata: {
    createdAt: string;
    lastSync: string;
    lastError?: string;
    eventsExported: number;
    version: string;
  };
}

export type SIEMType = 
  | 'splunk'
  | 'elastic_stack'
  | 'qradar'
  | 'sentinel'
  | 'sumo_logic'
  | 'chronicle'
  | 'arcsight'
  | 'logrhythm'
  | 'securonix'
  | 'exabeam'
  | 'generic_api'
  | 'syslog';

export type SIEMFeature = 
  | 'event_export'
  | 'alert_import'
  | 'bi_directional_sync'
  | 'custom_dashboards'
  | 'automated_response'
  | 'correlation_rules'
  | 'threat_intelligence_feed'
  | 'user_behavior_analytics';

export interface SIEMConfig {
  endpoint: string;
  port?: number;
  protocol: 'https' | 'http' | 'tcp' | 'udp';
  format: 'json' | 'cef' | 'leef' | 'syslog' | 'custom';
  batchSize: number;
  syncInterval: number; // minutes
  retentionDays: number;
  customFields: Record<string, any>;
  filters: SIEMFilter[];
  mapping: FieldMapping[];
}

export interface SIEMCredentials {
  authType: 'api_key' | 'oauth2' | 'basic_auth' | 'certificate' | 'token';
  apiKey?: string;
  username?: string;
  password?: string;
  token?: string;
  clientId?: string;
  clientSecret?: string;
  certificatePath?: string;
  additionalHeaders?: Record<string, string>;
}

export interface SIEMFilter {
  field: string;
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'regex' | 'range';
  value: any;
  negate?: boolean;
}

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  transformation?: 'lowercase' | 'uppercase' | 'hash' | 'timestamp' | 'custom';
  defaultValue?: any;
  required: boolean;
}

export interface SIEMExportResult {
  success: boolean;
  eventsExported: number;
  errors: Array<{
    eventId: string;
    error: string;
  }>;
  duration: number;
  batchId: string;
}

export interface SIEMImportResult {
  success: boolean;
  alertsImported: number;
  duplicatesSkipped: number;
  errors: Array<{
    alert: any;
    error: string;
  }>;
  duration: number;
}

export interface SIEMStats {
  totalConnections: number;
  activeConnections: number;
  totalEventsExported: number;
  totalAlertsImported: number;
  exportsByType: Record<SIEMType, number>;
  averageExportTime: number;
  errorRate: number;
  lastSyncTimes: Array<{
    connectionId: string;
    lastSync: string;
    status: string;
  }>;
}

export interface ExternalAlert {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  timestamp: string;
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  indicators: AlertIndicator[];
  metadata: Record<string, any>;
}

export interface AlertIndicator {
  type: 'ip' | 'domain' | 'hash' | 'url' | 'email' | 'file_path' | 'registry_key';
  value: string;
  confidence: number;
  context?: string;
}

export class SIEMIntegrationService {
  private connections: Map<string, SIEMConnection> = new Map();
  private exportQueue: Array<{ connectionId: string; events: ThreatEvent[] }> = [];
  private syncInterval?: NodeJS.Timeout;
  private processingInterval?: NodeJS.Timeout;

  constructor() {
    this.startSyncProcess();
    this.startQueueProcessing();

    logger.info('SIEM Integration Service initialized', {
      features: [
        'multi_siem_support',
        'bidirectional_sync',
        'custom_field_mapping',
        'automated_export',
        'alert_import',
        'connection_monitoring',
        'error_recovery',
        'batch_processing'
      ],
      supportedSiems: [
        'splunk', 'elastic_stack', 'qradar', 'sentinel',
        'sumo_logic', 'chronicle', 'arcsight', 'logrhythm'
      ]
    });
  }

  /**
   * Add SIEM connection
   */
  async addConnection(connectionData: {
    name: string;
    type: SIEMType;
    config: SIEMConfig;
    credentials: SIEMCredentials;
    features: SIEMFeature[];
  }): Promise<SIEMConnection> {
    const connectionId = `siem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const connection: SIEMConnection = {
      id: connectionId,
      name: connectionData.name,
      type: connectionData.type,
      status: 'disconnected',
      config: connectionData.config,
      credentials: connectionData.credentials,
      features: connectionData.features,
      metadata: {
        createdAt: new Date().toISOString(),
        lastSync: 'never',
        eventsExported: 0,
        version: '2.0.0'
      }
    };

    this.connections.set(connectionId, connection);

    // Test connection
    await this.testConnection(connectionId);

    logger.info('SIEM connection added', {
      connectionId,
      name: connection.name,
      type: connection.type,
      features: connection.features
    });

    return connection;
  }

  /**
   * Update SIEM connection
   */
  async updateConnection(connectionId: string, updates: Partial<SIEMConnection>): Promise<SIEMConnection | null> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return null;
    }

    const updatedConnection = {
      ...connection,
      ...updates
    };

    this.connections.set(connectionId, updatedConnection);

    // Re-test connection if config changed
    if (updates.config || updates.credentials) {
      await this.testConnection(connectionId);
    }

    logger.info('SIEM connection updated', {
      connectionId,
      updates: Object.keys(updates)
    });

    return updatedConnection;
  }

  /**
   * Remove SIEM connection
   */
  async removeConnection(connectionId: string): Promise<boolean> {
    const deleted = this.connections.delete(connectionId);
    
    if (deleted) {
      // Remove any pending exports for this connection
      this.exportQueue = this.exportQueue.filter(item => item.connectionId !== connectionId);
      
      logger.info('SIEM connection removed', { connectionId });
    }

    return deleted;
  }

  /**
   * Get all SIEM connections
   */
  getConnections(): SIEMConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get specific SIEM connection
   */
  getConnection(connectionId: string): SIEMConnection | null {
    return this.connections.get(connectionId) || null;
  }

  /**
   * Test SIEM connection
   */
  async testConnection(connectionId: string): Promise<{
    success: boolean;
    responseTime: number;
    error?: string;
    details?: any;
  }> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return { success: false, responseTime: 0, error: 'Connection not found' };
    }

    connection.status = 'testing';
    this.connections.set(connectionId, connection);

    const startTime = Date.now();

    try {
      // Perform connection-specific test
      const testResult = await this.performConnectionTest(connection);
      const responseTime = Date.now() - startTime;

      if (testResult.success) {
        connection.status = 'connected';
        connection.metadata.lastError = undefined;
      } else {
        connection.status = 'error';
        connection.metadata.lastError = testResult.error;
      }

      this.connections.set(connectionId, connection);

      logger.info('SIEM connection test completed', {
        connectionId,
        success: testResult.success,
        responseTime,
        error: testResult.error
      });

      return {
        success: testResult.success,
        responseTime,
        error: testResult.error,
        details: testResult.details
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      connection.status = 'error';
      connection.metadata.lastError = error instanceof Error ? error.message : 'Unknown error';
      this.connections.set(connectionId, connection);

      return {
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Export threats to SIEM
   */
  async exportThreats(
    connectionId: string,
    threats: ThreatEvent[],
    options?: {
      immediate?: boolean;
      batchId?: string;
    }
  ): Promise<SIEMExportResult> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    if (connection.status !== 'connected') {
      throw new Error('Connection not active');
    }

    if (options?.immediate) {
      return await this.performExport(connection, threats, options.batchId);
    } else {
      // Add to queue for batch processing
      this.exportQueue.push({ connectionId, events: threats });
      
      return {
        success: true,
        eventsExported: threats.length,
        errors: [],
        duration: 0,
        batchId: 'queued'
      };
    }
  }

  /**
   * Import alerts from SIEM
   */
  async importAlerts(connectionId: string, since?: string): Promise<SIEMImportResult> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    if (!connection.features.includes('alert_import')) {
      throw new Error('Alert import not supported for this connection');
    }

    if (connection.status !== 'connected') {
      throw new Error('Connection not active');
    }

    const startTime = Date.now();

    try {
      // Perform SIEM-specific alert import
      const alerts = await this.performAlertImport(connection, since);
      
      // Process imported alerts
      const processedAlerts = await this.processImportedAlerts(alerts);
      
      const result: SIEMImportResult = {
        success: true,
        alertsImported: processedAlerts.imported,
        duplicatesSkipped: processedAlerts.duplicates,
        errors: processedAlerts.errors,
        duration: Date.now() - startTime
      };

      logger.info('SIEM alerts imported', {
        connectionId,
        alertsImported: result.alertsImported,
        duplicatesSkipped: result.duplicatesSkipped,
        duration: result.duration
      });

      return result;

    } catch (error) {
      logger.error('SIEM alert import failed', {
        connectionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        alertsImported: 0,
        duplicatesSkipped: 0,
        errors: [{ alert: {}, error: error instanceof Error ? error.message : 'Unknown error' }],
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Get SIEM integration statistics
   */
  getSIEMStats(): SIEMStats {
    const connections = Array.from(this.connections.values());
    const activeConnections = connections.filter(c => c.status === 'connected');

    const exportsByType: Record<SIEMType, number> = {} as Record<SIEMType, number>;
    let totalEventsExported = 0;

    connections.forEach(connection => {
      exportsByType[connection.type] = (exportsByType[connection.type] || 0) + connection.metadata.eventsExported;
      totalEventsExported += connection.metadata.eventsExported;
    });

    const lastSyncTimes = connections.map(c => ({
      connectionId: c.id,
      lastSync: c.metadata.lastSync,
      status: c.status
    }));

    return {
      totalConnections: connections.length,
      activeConnections: activeConnections.length,
      totalEventsExported,
      totalAlertsImported: 0, // Would track from actual imports
      exportsByType,
      averageExportTime: Math.random() * 1000 + 500, // Mock average
      errorRate: connections.filter(c => c.status === 'error').length / Math.max(connections.length, 1),
      lastSyncTimes
    };
  }

  /**
   * Trigger manual sync for all connections
   */
  async syncAllConnections(): Promise<Array<{
    connectionId: string;
    success: boolean;
    eventsExported?: number;
    alertsImported?: number;
    error?: string;
  }>> {
    const connections = Array.from(this.connections.values())
      .filter(c => c.status === 'connected');

    const results = [];

    for (const connection of connections) {
      try {
        // Mock recent threats for export
        const mockThreats = this.generateMockThreats(10);
        const exportResult = await this.exportThreats(connection.id, mockThreats, { immediate: true });
        
        let importResult: SIEMImportResult | undefined;
        if (connection.features.includes('alert_import')) {
          importResult = await this.importAlerts(connection.id);
        }

        results.push({
          connectionId: connection.id,
          success: true,
          eventsExported: exportResult.eventsExported,
          alertsImported: importResult?.alertsImported
        });

      } catch (error) {
        results.push({
          connectionId: connection.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    logger.info('Manual SIEM sync completed', {
      totalConnections: connections.length,
      successfulSyncs: results.filter(r => r.success).length
    });

    return results;
  }

  /**
   * Private methods
   */
  private async performConnectionTest(connection: SIEMConnection): Promise<{
    success: boolean;
    error?: string;
    details?: any;
  }> {
    // Mock connection test based on SIEM type
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 200));

    const success = Math.random() > 0.1; // 90% success rate
    
    if (success) {
      return {
        success: true,
        details: {
          version: '2.0.0',
          features: connection.features,
          endpoint: connection.config.endpoint
        }
      };
    } else {
      return {
        success: false,
        error: 'Connection timeout or authentication failed'
      };
    }
  }

  private async performExport(connection: SIEMConnection, threats: ThreatEvent[], batchId?: string): Promise<SIEMExportResult> {
    const startTime = Date.now();
    const actualBatchId = batchId || `batch_${Date.now()}`;

    try {
      // Apply filters
      const filteredThreats = this.applyFilters(threats, connection.config.filters);
      
      // Transform threats based on field mapping
      const transformedEvents = this.transformEvents(filteredThreats, connection.config.mapping);
      
      // Format for SIEM
      const formattedEvents = this.formatForSIEM(transformedEvents, connection.config.format, connection.type);
      
      // Mock export process
      await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
      
      // Mock some failures
      const failures = formattedEvents.filter(() => Math.random() < 0.05); // 5% failure rate
      const successes = formattedEvents.filter(event => !failures.includes(event));

      // Update connection metadata
      connection.metadata.eventsExported += successes.length;
      connection.metadata.lastSync = new Date().toISOString();
      this.connections.set(connection.id, connection);

      const result: SIEMExportResult = {
        success: failures.length === 0,
        eventsExported: successes.length,
        errors: failures.map((event, index) => ({
          eventId: event.id || `event_${index}`,
          error: 'Export validation failed'
        })),
        duration: Date.now() - startTime,
        batchId: actualBatchId
      };

      logger.info('SIEM export completed', {
        connectionId: connection.id,
        batchId: actualBatchId,
        eventsExported: result.eventsExported,
        errors: result.errors.length,
        duration: result.duration
      });

      return result;

    } catch (error) {
      return {
        success: false,
        eventsExported: 0,
        errors: [{ eventId: 'unknown', error: error instanceof Error ? error.message : 'Unknown error' }],
        duration: Date.now() - startTime,
        batchId: actualBatchId
      };
    }
  }

  private async performAlertImport(connection: SIEMConnection, since?: string): Promise<ExternalAlert[]> {
    // Mock SIEM alert import
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1500 + 300));

    const alertCount = Math.floor(Math.random() * 20 + 5);
    const alerts: ExternalAlert[] = [];

    for (let i = 0; i < alertCount; i++) {
      alerts.push({
        id: `external_alert_${i}_${Date.now()}`,
        title: `External Alert ${i}`,
        description: `Alert imported from ${connection.name}`,
        severity: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)] as any,
        source: connection.name,
        timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
        status: 'open',
        indicators: [
          {
            type: 'ip',
            value: `192.168.1.${Math.floor(Math.random() * 255)}`,
            confidence: Math.random()
          }
        ],
        metadata: {
          siemType: connection.type,
          importedAt: new Date().toISOString()
        }
      });
    }

    return alerts;
  }

  private async processImportedAlerts(alerts: ExternalAlert[]): Promise<{
    imported: number;
    duplicates: number;
    errors: Array<{ alert: any; error: string }>;
  }> {
    // Mock processing
    const imported = Math.floor(alerts.length * 0.8); // 80% success rate
    const duplicates = Math.floor(alerts.length * 0.1); // 10% duplicates
    const errors = alerts.slice(imported + duplicates).map(alert => ({
      alert,
      error: 'Processing validation failed'
    }));

    // Trigger webhook for imported alerts
    for (let i = 0; i < imported; i++) {
      await webhookManager.triggerEvent({
        type: 'alert.created',
        data: alerts[i],
        source: 'siem_import',
        metadata: {
          correlationId: `import_${Date.now()}`
        }
      });
    }

    return { imported, duplicates, errors };
  }

  private applyFilters(threats: ThreatEvent[], filters: SIEMFilter[]): ThreatEvent[] {
    return threats.filter(threat => {
      return filters.every(filter => {
        const fieldValue = this.getFieldValue(threat, filter.field);
        const matches = this.evaluateFilter(fieldValue, filter);
        return filter.negate ? !matches : matches;
      });
    });
  }

  private evaluateFilter(value: any, filter: SIEMFilter): boolean {
    switch (filter.operator) {
      case 'equals':
        return value === filter.value;
      case 'contains':
        return String(value).includes(String(filter.value));
      case 'starts_with':
        return String(value).startsWith(String(filter.value));
      case 'ends_with':
        return String(value).endsWith(String(filter.value));
      case 'regex':
        return new RegExp(filter.value).test(String(value));
      case 'range':
        return value >= filter.value.min && value <= filter.value.max;
      default:
        return false;
    }
  }

  private transformEvents(threats: ThreatEvent[], mappings: FieldMapping[]): any[] {
    return threats.map(threat => {
      const transformed: any = {};
      
      mappings.forEach(mapping => {
        const sourceValue = this.getFieldValue(threat, mapping.sourceField);
        let targetValue = sourceValue;

        // Apply transformation
        if (mapping.transformation && sourceValue !== undefined) {
          targetValue = this.applyTransformation(sourceValue, mapping.transformation);
        }

        // Use default value if required field is missing
        if (targetValue === undefined && mapping.required && mapping.defaultValue !== undefined) {
          targetValue = mapping.defaultValue;
        }

        if (targetValue !== undefined) {
          transformed[mapping.targetField] = targetValue;
        }
      });

      return transformed;
    });
  }

  private formatForSIEM(events: any[], format: string, siemType: SIEMType): any[] {
    switch (format) {
      case 'cef':
        return events.map(event => this.formatAsCEF(event));
      case 'leef':
        return events.map(event => this.formatAsLEEF(event));
      case 'syslog':
        return events.map(event => this.formatAsSyslog(event));
      case 'json':
      default:
        return events;
    }
  }

  private formatAsCEF(event: any): string {
    // Common Event Format
    return `CEF:0|BG-ThreatAI|ThreatDetection|2.0|${event.type}|${event.description}|${this.mapSeverityToCEF(event.severity)}|src=${event.source} dst=${event.target} rt=${event.timestamp}`;
  }

  private formatAsLEEF(event: any): string {
    // Log Event Extended Format
    return `LEEF:2.0|BG-ThreatAI|ThreatDetection|2.0|${event.type}|src=${event.source}|dst=${event.target}|devTime=${event.timestamp}`;
  }

  private formatAsSyslog(event: any): string {
    // Syslog format
    const priority = this.mapSeverityToSyslog(event.severity);
    return `<${priority}>${new Date().toISOString()} bg-threat-ai: ${event.type} - ${event.description}`;
  }

  private getFieldValue(obj: any, fieldPath: string): any {
    return fieldPath.split('.').reduce((current, field) => current?.[field], obj);
  }

  private applyTransformation(value: any, transformation: string): any {
    switch (transformation) {
      case 'lowercase':
        return String(value).toLowerCase();
      case 'uppercase':
        return String(value).toUpperCase();
      case 'hash':
        return require('crypto').createHash('sha256').update(String(value)).digest('hex');
      case 'timestamp':
        return new Date(value).toISOString();
      default:
        return value;
    }
  }

  private mapSeverityToCEF(severity: string): number {
    const mapping = { low: 3, medium: 5, high: 7, critical: 10 };
    return mapping[severity as keyof typeof mapping] || 5;
  }

  private mapSeverityToSyslog(severity: string): number {
    const mapping = { low: 165, medium: 164, high: 163, critical: 162 };
    return mapping[severity as keyof typeof mapping] || 164;
  }

  private startSyncProcess(): void {
    // Auto-sync every 15 minutes
    this.syncInterval = setInterval(() => {
      this.performScheduledSync();
    }, 15 * 60 * 1000);
  }

  private startQueueProcessing(): void {
    // Process export queue every 30 seconds
    this.processingInterval = setInterval(() => {
      this.processExportQueue();
    }, 30000);
  }

  private async performScheduledSync(): Promise<void> {
    const connections = Array.from(this.connections.values())
      .filter(c => c.status === 'connected');

    for (const connection of connections) {
      try {
        // Import alerts if supported
        if (connection.features.includes('alert_import')) {
          await this.importAlerts(connection.id, connection.metadata.lastSync);
        }
      } catch (error) {
        logger.error('Scheduled SIEM sync failed', {
          connectionId: connection.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  private async processExportQueue(): Promise<void> {
    if (this.exportQueue.length === 0) return;

    // Group by connection and process in batches
    const byConnection = new Map<string, ThreatEvent[]>();
    
    const batch = this.exportQueue.splice(0, 100); // Process up to 100 items
    
    batch.forEach(item => {
      const existing = byConnection.get(item.connectionId) || [];
      byConnection.set(item.connectionId, [...existing, ...item.events]);
    });

    for (const [connectionId, events] of byConnection) {
      try {
        await this.exportThreats(connectionId, events, { immediate: true });
      } catch (error) {
        logger.error('Export queue processing failed', {
          connectionId,
          eventCount: events.length,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  private generateMockThreats(count: number): ThreatEvent[] {
    const threats: ThreatEvent[] = [];
    const types = ['malware', 'intrusion', 'anomaly', 'behavioral'];
    const severities: ('low' | 'medium' | 'high' | 'critical')[] = ['low', 'medium', 'high', 'critical'];

    for (let i = 0; i < count; i++) {
      threats.push({
        id: `mock_threat_${i}_${Date.now()}`,
        timestamp: new Date(Date.now() - Math.random() * 60 * 60 * 1000).toISOString(),
        type: types[Math.floor(Math.random() * types.length)] as any,
        severity: severities[Math.floor(Math.random() * severities.length)],
        source: `source_${Math.floor(Math.random() * 10)}`,
        target: `target_${Math.floor(Math.random() * 10)}`,
        description: `Mock threat ${i} for SIEM export`,
        riskScore: Math.random() * 10,
        status: 'active',
        metadata: {
          correlationId: `export_${i}`,
          source: 'mock_generator'
        }
      });
    }

    return threats;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }

    this.connections.clear();
    this.exportQueue = [];

    logger.info('SIEM Integration Service cleaned up');
  }
}

// Singleton instance
export const siemIntegrationService = new SIEMIntegrationService();