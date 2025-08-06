import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { configManager } from '@/utils/config';
import { logger } from '@/utils/logger';
import { 
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
  ReportResult
} from '@/types';

class APIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'threatguard-cli/1.0.0'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const baseUrl = configManager.getApiUrl();
        config.baseURL = baseUrl;

        const token = configManager.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        logger.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error(`Request error: ${error.message}`);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse<APIResponse>) => {
        logger.debug(`API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        if (error.response?.status === 401) {
          logger.error('Authentication failed. Please login again.');
          configManager.logout();
        } else if (error.response?.status >= 500) {
          logger.error('Server error. Please try again later.');
        } else {
          logger.error(`API error: ${error.response?.data?.error?.message || error.message}`);
        }
        return Promise.reject(error);
      }
    );
  }

  // Authentication
  async login(credentials: AuthCredentials): Promise<AuthToken> {
    const response = await this.client.post<APIResponse<AuthToken>>('/auth/login', credentials);
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || 'Login failed');
    }

    const tokenData = response.data.data;
    configManager.setToken(tokenData.token);
    configManager.setUserId(tokenData.userId);
    
    return tokenData;
  }

  async logout(): Promise<void> {
    try {
      await this.client.post('/auth/logout');
    } finally {
      configManager.logout();
    }
  }

  async validateToken(): Promise<boolean> {
    try {
      const response = await this.client.get<APIResponse>('/auth/validate');
      return response.data.success;
    } catch {
      return false;
    }
  }

  // Threat Detection
  async startThreatScan(targets: string[], options?: any): Promise<ThreatScanResult> {
    const response = await this.client.post<APIResponse<ThreatScanResult>>('/threat/scan', {
      targets,
      options
    });

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || 'Failed to start threat scan');
    }

    return response.data.data;
  }

  async getThreatScanStatus(scanId: string): Promise<ThreatScanResult> {
    const response = await this.client.get<APIResponse<ThreatScanResult>>(`/threat/scan/${scanId}`);
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || 'Failed to get scan status');
    }

    return response.data.data;
  }

  async getThreats(filters?: any): Promise<any[]> {
    const response = await this.client.get<APIResponse<any[]>>('/threat/events', {
      params: filters
    });

    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to get threats');
    }

    return response.data.data || [];
  }

  // Behavioral Analysis
  async analyzeBehavior(request: BehaviorAnalysisRequest): Promise<BehaviorAnalysisResult> {
    const response = await this.client.post<APIResponse<BehaviorAnalysisResult>>('/behavior/analyze', request);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || 'Behavioral analysis failed');
    }

    return response.data.data;
  }

  async getBehaviorPatterns(target: string, timeRange?: any): Promise<any[]> {
    const response = await this.client.get<APIResponse<any[]>>('/behavior/patterns', {
      params: { target, ...timeRange }
    });

    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to get behavior patterns');
    }

    return response.data.data || [];
  }

  // Network Monitoring
  async scanNetwork(target: NetworkScanTarget): Promise<any> {
    const response = await this.client.post<APIResponse>('/network/scan', target);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || 'Network scan failed');
    }

    return response.data.data;
  }

  async getNetworkEvents(filters?: any): Promise<NetworkEvent[]> {
    const response = await this.client.get<APIResponse<NetworkEvent[]>>('/network/events', {
      params: filters
    });

    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to get network events');
    }

    return response.data.data || [];
  }

  // Threat Intelligence
  async queryThreatIntel(query: ThreatIntelligenceQuery): Promise<ThreatIntelligenceResult> {
    const response = await this.client.post<APIResponse<ThreatIntelligenceResult>>('/intel/query', query);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || 'Threat intelligence query failed');
    }

    return response.data.data;
  }

  // Reports
  async generateReport(request: ReportRequest): Promise<ReportResult> {
    const response = await this.client.post<APIResponse<ReportResult>>('/reports/generate', request);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || 'Report generation failed');
    }

    return response.data.data;
  }

  async getReportStatus(reportId: string): Promise<ReportResult> {
    const response = await this.client.get<APIResponse<ReportResult>>(`/reports/${reportId}`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || 'Failed to get report status');
    }

    return response.data.data;
  }

  // System Health
  async getSystemHealth(): Promise<any> {
    const response = await this.client.get<APIResponse>('/health');

    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to get system health');
    }

    return response.data.data;
  }

  // Metrics
  async getMetrics(timeRange?: any): Promise<any> {
    const response = await this.client.get<APIResponse>('/metrics', {
      params: timeRange
    });

    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to get metrics');
    }

    return response.data.data;
  }
}

export const apiClient = new APIClient();