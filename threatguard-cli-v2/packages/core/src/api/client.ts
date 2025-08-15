import ky, { type KyInstance, type Options as KyOptions } from 'ky';
import pRetry from 'p-retry';
import pTimeout from 'p-timeout';
import type {
  APIResponse,
  AuthCredentials,
  AuthToken,
  ThreatScanResult,
  BehaviorAnalysisRequest,
  BehaviorAnalysisResult,
  NetworkScanTarget,
  NetworkEvent,
  ThreatIntelligenceQuery,
  ThreatIntelligenceResult,
  ReportRequest,
  ReportResult,
  CLIConfig,
} from '../types/index.js';
import { schemas } from '../types/index.js';

export interface APIClientConfig {
  baseUrl: string;
  timeout?: number;
  retries?: number;
  userAgent?: string;
  token?: string;
  debug?: boolean;
}

export class APIClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'APIClientError';
  }
}

export class APIClient {
  private client: KyInstance;
  private config: APIClientConfig;
  private token?: string;

  constructor(config: APIClientConfig) {
    this.config = {
      timeout: 30000,
      retries: 3,
      userAgent: 'threatguard-cli/2.0.0',
      debug: false,
      ...config,
    };

    this.token = config.token;
    this.client = this.createClient();
  }

  private createClient(): KyInstance {
    const options: KyOptions = {
      prefixUrl: this.config.baseUrl,
      timeout: this.config.timeout,
      retry: {
        limit: this.config.retries!,
        methods: ['get', 'post', 'put', 'patch', 'delete'],
        statusCodes: [408, 413, 429, 500, 502, 503, 504],
        delay: attemptCount => Math.min(1000 * 2 ** attemptCount, 10000),
      },
      headers: {
        'User-Agent': this.config.userAgent!,
        'Content-Type': 'application/json',
      },
      hooks: {
        beforeRequest: [
          request => {
            if (this.token) {
              request.headers.set('Authorization', `Bearer ${this.token}`);
            }

            if (this.config.debug) {
              console.debug(`API Request: ${request.method} ${request.url}`);
            }
          },
        ],
        afterResponse: [
          async (request, options, response) => {
            if (this.config.debug) {
              console.debug(`API Response: ${response.status} ${request.url}`);
            }

            // Handle authentication errors
            if (response.status === 401) {
              this.token = undefined;
              throw new APIClientError('Authentication failed. Please login again.', 401, 'AUTH_FAILED');
            }

            return response;
          },
        ],
        beforeError: [
          error => {
            const { response } = error;
            if (response?.body) {
              try {
                const errorData = JSON.parse(response.body as string);
                if (errorData.error) {
                  error.name = 'APIClientError';
                  error.message = errorData.error.message || error.message;
                }
              } catch {
                // Ignore JSON parse errors
              }
            }
            return error;
          },
        ],
      },
    };

    return ky.create(options);
  }

  setToken(token: string): void {
    this.token = token;
    this.client = this.createClient();
  }

  clearToken(): void {
    this.token = undefined;
    this.client = this.createClient();
  }

  private async request<T>(endpoint: string, options?: KyOptions): Promise<T> {
    try {
      const response = await pTimeout(
        this.client(endpoint, options),
        { milliseconds: this.config.timeout! }
      );

      const data = await response.json<APIResponse<T>>();

      if (!data.success) {
        throw new APIClientError(
          data.error?.message || 'Request failed',
          response.status,
          data.error?.code,
          data.error?.details
        );
      }

      return data.data as T;
    } catch (error) {
      if (error instanceof APIClientError) {
        throw error;
      }

      // Transform other errors
      if (error instanceof Error) {
        throw new APIClientError(error.message);
      }

      throw new APIClientError('Unknown error occurred');
    }
  }

  private async requestWithRetry<T>(endpoint: string, options?: KyOptions): Promise<T> {
    return pRetry(
      () => this.request<T>(endpoint, options),
      {
        retries: this.config.retries!,
        onFailedAttempt: error => {
          if (this.config.debug) {
            console.debug(`Retry attempt ${error.attemptNumber} failed: ${error.message}`);
          }
        },
      }
    );
  }

  // Authentication
  async login(credentials: AuthCredentials): Promise<AuthToken> {
    // Validate input
    const validatedCredentials = schemas.AuthCredentials.parse(credentials);

    const tokenData = await this.request<AuthToken>('auth/login', {
      method: 'post',
      json: validatedCredentials,
    });

    // Validate response
    const validatedToken = schemas.AuthToken.parse(tokenData);
    this.setToken(validatedToken.token);

    return validatedToken;
  }

  async logout(): Promise<void> {
    try {
      await this.request('auth/logout', { method: 'post' });
    } finally {
      this.clearToken();
    }
  }

  async validateToken(): Promise<boolean> {
    try {
      await this.request('auth/validate');
      return true;
    } catch {
      return false;
    }
  }

  // Threat Detection
  async startThreatScan(targets: string[], options?: any): Promise<ThreatScanResult> {
    const result = await this.requestWithRetry<ThreatScanResult>('threat/scan', {
      method: 'post',
      json: { targets, options },
    });

    return schemas.ThreatScanResult.parse(result);
  }

  async getThreatScanStatus(scanId: string): Promise<ThreatScanResult> {
    const result = await this.request<ThreatScanResult>(`threat/scan/${scanId}`);
    return schemas.ThreatScanResult.parse(result);
  }

  async getThreats(filters?: any): Promise<any[]> {
    return this.request<any[]>('threat/events', {
      searchParams: filters,
    });
  }

  // Behavioral Analysis
  async analyzeBehavior(request: BehaviorAnalysisRequest): Promise<BehaviorAnalysisResult> {
    const validatedRequest = schemas.BehaviorAnalysisRequest.parse(request);

    const result = await this.requestWithRetry<BehaviorAnalysisResult>('behavior/analyze', {
      method: 'post',
      json: validatedRequest,
    });

    return schemas.BehaviorAnalysisResult.parse(result);
  }

  async getBehaviorPatterns(target: string, timeRange?: any): Promise<any[]> {
    return this.request<any[]>('behavior/patterns', {
      searchParams: { target, ...timeRange },
    });
  }

  // Network Monitoring
  async scanNetwork(target: NetworkScanTarget): Promise<any> {
    const validatedTarget = schemas.NetworkScanTarget.parse(target);

    return this.requestWithRetry('network/scan', {
      method: 'post',
      json: validatedTarget,
    });
  }

  async getNetworkEvents(filters?: any): Promise<NetworkEvent[]> {
    const results = await this.request<NetworkEvent[]>('network/events', {
      searchParams: filters,
    });

    return results.map(event => schemas.NetworkEvent.parse(event));
  }

  // Threat Intelligence
  async queryThreatIntel(query: ThreatIntelligenceQuery): Promise<ThreatIntelligenceResult> {
    const validatedQuery = schemas.ThreatIntelligenceQuery.parse(query);

    const result = await this.requestWithRetry<ThreatIntelligenceResult>('intel/query', {
      method: 'post',
      json: validatedQuery,
    });

    return schemas.ThreatIntelligenceResult.parse(result);
  }

  // Reports
  async generateReport(request: ReportRequest): Promise<ReportResult> {
    const validatedRequest = schemas.ReportRequest.parse(request);

    const result = await this.requestWithRetry<ReportResult>('reports/generate', {
      method: 'post',
      json: validatedRequest,
    });

    return schemas.ReportResult.parse(result);
  }

  async getReportStatus(reportId: string): Promise<ReportResult> {
    const result = await this.request<ReportResult>(`reports/${reportId}`);
    return schemas.ReportResult.parse(result);
  }

  // System Health
  async getSystemHealth(): Promise<any> {
    return this.request('health');
  }

  // Metrics
  async getMetrics(timeRange?: any): Promise<any> {
    return this.request('metrics', {
      searchParams: timeRange,
    });
  }

  // Streaming support (for WebSocket connection info)
  async getStreamingEndpoint(): Promise<{ url: string; token: string }> {
    return this.request('stream/endpoint');
  }
}

// Factory function for creating configured API client
export function createAPIClient(config: APIClientConfig): APIClient {
  return new APIClient(config);
}

// Export for backward compatibility
export { APIClient as default };