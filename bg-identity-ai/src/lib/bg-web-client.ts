import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { logger } from '@/lib/logger';

// =============================================================================
// BG-WEB API CLIENT FOR THREAT DETECTION INTEGRATION
// =============================================================================

interface ThreatEventData {
  type: 'network' | 'behavioral' | 'malware' | 'intrusion' | 'anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  target?: string;
  description: string;
  riskScore: number;
  status?: 'active' | 'investigating' | 'resolved' | 'false_positive';
  metadata?: Record<string, any>;
}

interface BehaviorPatternData {
  target: string;
  pattern: string;
  confidence: number;
  anomalyScore: number;
  baseline: Record<string, number>;
  current: Record<string, number>;
  deviations: string[];
}

interface NetworkEventData {
  eventType: 'connection' | 'traffic' | 'intrusion' | 'port_scan' | 'dns_query';
  sourceIp: string;
  destIp?: string;
  sourcePort?: number;
  destPort?: number;
  protocol: string;
  bytes: number;
  packets: number;
  flags: string[];
  severity: 'info' | 'warning' | 'critical';
  blocked: boolean;
}

interface ThreatIntelligenceData {
  indicator: string;
  type: 'ip' | 'domain' | 'hash' | 'url';
  reputation: 'clean' | 'suspicious' | 'malicious' | 'unknown';
  confidence: number;
  sources: string[];
  context: Record<string, any>;
}

/**
 * Client for communicating with bg-web threat detection APIs
 */
export class BgWebClient {
  private client: AxiosInstance;
  private baseUrl: string;
  private apiKey: string;
  private correlationId: string;

  constructor() {
    this.baseUrl = process.env.BG_WEB_API_URL || 'http://localhost:3000';
    this.apiKey = process.env.BG_WEB_API_KEY || 'development-key';
    this.correlationId = this.generateCorrelationId();

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000, // 10 second timeout
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'User-Agent': 'bg-threat-ai-service/2.0.0',
        'X-Service-Name': 'bg-threat-ai',
        'X-Correlation-ID': this.correlationId,
      },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.info('Making request to bg-web API', {
          component: 'bg-web-client',
          method: config.method?.toUpperCase(),
          url: config.url,
          correlationId: this.correlationId,
        });
        return config;
      },
      (error) => {
        logger.error('Request interceptor error', {
          component: 'bg-web-client',
          correlationId: this.correlationId,
        }, error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.info('Received response from bg-web API', {
          component: 'bg-web-client',
          status: response.status,
          url: response.config.url,
          correlationId: this.correlationId,
        });
        return response;
      },
      (error) => {
        logger.error('Response interceptor error', {
          component: 'bg-web-client',
          status: error.response?.status,
          url: error.config?.url,
          correlationId: this.correlationId,
          message: error.message,
        });
        return Promise.reject(error);
      }
    );

    logger.info('BgWebClient initialized', {
      component: 'bg-web-client',
      baseUrl: this.baseUrl,
      correlationId: this.correlationId,
    });
  }

  // =============================================================================
  // THREAT EVENTS OPERATIONS
  // =============================================================================

  /**
   * Store a threat event in bg-web database
   */
  async createThreatEvent(
    eventId: string,
    threatData: ThreatEventData,
    userId?: string
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const response = await this.client.post('/api/threat/events', {
        eventId,
        ...threatData,
        userId,
        correlationId: this.correlationId,
      });

      if (response.data.success) {
        logger.info('Threat event created successfully', {
          component: 'bg-web-client',
          action: 'create_threat_event',
          eventId,
          id: response.data.id,
          correlationId: this.correlationId,
        });

        return {
          success: true,
          id: response.data.id,
        };
      } else {
        return {
          success: false,
          error: response.data.error || 'Unknown error creating threat event',
        };
      }
    } catch (error: any) {
      logger.error('Failed to create threat event', {
        component: 'bg-web-client',
        action: 'create_threat_event',
        eventId,
        correlationId: this.correlationId,
        error: error.message,
        status: error.response?.status,
      });

      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Query threat events from bg-web database
   */
  async queryThreatEvents(filters: {
    severity?: 'low' | 'medium' | 'high' | 'critical';
    status?: 'active' | 'investigating' | 'resolved' | 'false_positive';
    type?: 'network' | 'behavioral' | 'malware' | 'intrusion' | 'anomaly';
    riskScoreMin?: number;
    riskScoreMax?: number;
    page?: number;
    limit?: number;
  } = {}): Promise<{ success: boolean; data?: any[]; total?: number; error?: string }> {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, value.toString());
        }
      });

      const response = await this.client.get(`/api/threat/events?${params.toString()}`);

      if (response.data.success) {
        return {
          success: true,
          data: response.data.data,
          total: response.data.pagination?.total,
        };
      } else {
        return {
          success: false,
          error: response.data.error || 'Unknown error querying threat events',
        };
      }
    } catch (error: any) {
      logger.error('Failed to query threat events', {
        component: 'bg-web-client',
        action: 'query_threat_events',
        correlationId: this.correlationId,
        error: error.message,
        status: error.response?.status,
      });

      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Update threat event status
   */
  async updateThreatEventStatus(
    eventId: string,
    status: 'active' | 'investigating' | 'resolved' | 'false_positive'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.client.patch(`/api/threat/events/${eventId}/status`, {
        status,
      });

      if (response.data.success) {
        logger.info('Threat event status updated', {
          component: 'bg-web-client',
          action: 'update_threat_status',
          eventId,
          status,
          correlationId: this.correlationId,
        });

        return { success: true };
      } else {
        return {
          success: false,
          error: response.data.error || 'Unknown error updating threat event status',
        };
      }
    } catch (error: any) {
      logger.error('Failed to update threat event status', {
        component: 'bg-web-client',
        action: 'update_threat_status',
        eventId,
        status,
        correlationId: this.correlationId,
        error: error.message,
        httpStatus: error.response?.status,
      });

      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  // =============================================================================
  // STATISTICS AND ANALYTICS
  // =============================================================================

  /**
   * Get threat statistics from bg-web
   */
  async getThreatStatistics(timeRange?: {
    start?: string;
    end?: string;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const params = new URLSearchParams();
      if (timeRange?.start) params.append('start', timeRange.start);
      if (timeRange?.end) params.append('end', timeRange.end);

      const response = await this.client.get(`/api/threat/statistics?${params.toString()}`);

      if (response.data.success) {
        return {
          success: true,
          data: response.data.data,
        };
      } else {
        return {
          success: false,
          error: response.data.error || 'Unknown error getting threat statistics',
        };
      }
    } catch (error: any) {
      logger.error('Failed to get threat statistics', {
        component: 'bg-web-client',
        action: 'get_threat_statistics',
        correlationId: this.correlationId,
        error: error.message,
        status: error.response?.status,
      });

      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  // =============================================================================
  // HEALTH AND CONNECTIVITY
  // =============================================================================

  /**
   * Test connectivity to bg-web API
   */
  async testConnection(): Promise<{ success: boolean; responseTime?: number; error?: string }> {
    try {
      const startTime = Date.now();
      const response = await this.client.get('/api/health');
      const responseTime = Date.now() - startTime;

      if (response.status === 200) {
        logger.info('bg-web connection test successful', {
          component: 'bg-web-client',
          action: 'test_connection',
          responseTime,
          correlationId: this.correlationId,
        });

        return {
          success: true,
          responseTime,
        };
      } else {
        return {
          success: false,
          error: `Unexpected status code: ${response.status}`,
        };
      }
    } catch (error: any) {
      logger.error('bg-web connection test failed', {
        component: 'bg-web-client',
        action: 'test_connection',
        correlationId: this.correlationId,
        error: error.message,
        status: error.response?.status,
      });

      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private generateCorrelationId(): string {
    return `bg-threat-ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set custom correlation ID for request tracking
   */
  setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
    this.client.defaults.headers['X-Correlation-ID'] = correlationId;
  }

  /**
   * Update authentication token
   */
  updateAuthToken(token: string): void {
    this.client.defaults.headers['Authorization'] = `Bearer ${token}`;
    logger.info('Authentication token updated', {
      component: 'bg-web-client',
      correlationId: this.correlationId,
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): {
    baseUrl: string;
    correlationId: string;
    timeout: number;
  } {
    return {
      baseUrl: this.baseUrl,
      correlationId: this.correlationId,
      timeout: this.client.defaults.timeout || 0,
    };
  }
}

// Export singleton instance
export const bgWebClient = new BgWebClient();