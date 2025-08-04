import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { ServiceResponse, InterServiceRequest, ServiceError } from '../types/common';

export class ServiceClient {
  private client: AxiosInstance;
  private serviceName: string;

  constructor(baseURL: string, serviceName: string, options?: {
    timeout?: number;
    retries?: number;
    retryDelay?: number;
  }) {
    this.serviceName = serviceName;
    
    this.client = axios.create({
      baseURL,
      timeout: options?.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `BG-Service-${serviceName}/1.0.0`
      }
    });

    this.setupInterceptors(options?.retries || 3, options?.retryDelay || 1000);
  }

  private setupInterceptors(retries: number, retryDelay: number) {
    // Request interceptor - add correlation ID and service metadata
    this.client.interceptors.request.use((config) => {
      const correlationId = uuidv4();
      
      config.headers['X-Correlation-ID'] = correlationId;
      config.headers['X-Service-Source'] = this.serviceName;
      config.headers['X-Request-Timestamp'] = new Date().toISOString();
      
      console.log(`[${this.serviceName}] Outgoing request:`, {
        method: config.method?.toUpperCase(),
        url: config.url,
        correlationId
      });
      
      return config;
    });

    // Response interceptor - handle standard responses and errors
    this.client.interceptors.response.use(
      (response) => {
        const correlationId = response.config.headers['X-Correlation-ID'];
        
        console.log(`[${this.serviceName}] Response received:`, {
          status: response.status,
          correlationId,
          responseTime: Date.now() - new Date(response.config.headers['X-Request-Timestamp']).getTime()
        });
        
        return response;
      },
      async (error) => {
        const config = error.config;
        const correlationId = config?.headers['X-Correlation-ID'];
        
        console.error(`[${this.serviceName}] Request failed:`, {
          status: error.response?.status,
          message: error.message,
          correlationId
        });

        // Retry logic for certain errors
        if (this.shouldRetry(error) && config && !config.__retryCount) {
          config.__retryCount = 0;
        }

        if (config && config.__retryCount < retries) {
          config.__retryCount += 1;
          
          console.log(`[${this.serviceName}] Retrying request (${config.__retryCount}/${retries}):`, {
            correlationId,
            delay: retryDelay
          });

          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return this.client(config);
        }

        return Promise.reject(this.formatError(error, correlationId));
      }
    );
  }

  private shouldRetry(error: any): boolean {
    if (!error.response) return true; // Network errors
    
    const status = error.response.status;
    return status >= 500 || status === 429; // Server errors or rate limiting
  }

  private formatError(error: any, correlationId?: string): ServiceError {
    const baseError: ServiceError = {
      code: 'SVC_001',
      message: error.message || 'Service request failed',
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      correlationId
    };

    if (error.response) {
      baseError.code = `HTTP_${error.response.status}`;
      baseError.message = error.response.data?.error || error.response.statusText;
      baseError.details = error.response.data;
    }

    return baseError;
  }

  // Generic request method with typed responses
  async request<T = any>(
    config: AxiosRequestConfig & { 
      userId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<ServiceResponse<T>> {
    try {
      // Add inter-service request headers
      if (config.userId || config.metadata) {
        config.headers = {
          ...config.headers,
          ...(config.userId && { 'X-User-ID': config.userId }),
          ...(config.metadata && { 'X-Metadata': JSON.stringify(config.metadata) })
        };
      }

      const response = await this.client.request<ServiceResponse<T>>(config);
      return response.data;
    } catch (error) {
      throw error; // Error already formatted by interceptor
    }
  }

  // Convenience methods
  async get<T = any>(url: string, options?: { userId?: string; metadata?: Record<string, any> }): Promise<ServiceResponse<T>> {
    return this.request<T>({ method: 'GET', url, ...options });
  }

  async post<T = any>(url: string, data?: any, options?: { userId?: string; metadata?: Record<string, any> }): Promise<ServiceResponse<T>> {
    return this.request<T>({ method: 'POST', url, data, ...options });
  }

  async put<T = any>(url: string, data?: any, options?: { userId?: string; metadata?: Record<string, any> }): Promise<ServiceResponse<T>> {
    return this.request<T>({ method: 'PUT', url, data, ...options });
  }

  async delete<T = any>(url: string, options?: { userId?: string; metadata?: Record<string, any> }): Promise<ServiceResponse<T>> {
    return this.request<T>({ method: 'DELETE', url, ...options });
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  // Set authentication token
  setAuthToken(token: string) {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  // Remove authentication token
  clearAuthToken() {
    delete this.client.defaults.headers.common['Authorization'];
  }
}

// Pre-configured service clients for each AI service
export const createIdentityAIClient = (baseURL?: string) => {
  return new ServiceClient(
    baseURL || process.env.IDENTITY_AI_SERVICE_URL || 'http://localhost:3001',
    'bg-identity-ai'
  );
};

export const createThreatAIClient = (baseURL?: string) => {
  return new ServiceClient(
    baseURL || process.env.THREAT_AI_SERVICE_URL || 'http://localhost:3002',
    'bg-threat-ai'
  );
};

export const createDashboardClient = (baseURL?: string) => {
  return new ServiceClient(
    baseURL || process.env.AI_DASHBOARD_SERVICE_URL || 'http://localhost:3003',
    'bg-ai-dashboard'
  );
};

export const createMobileAIClient = (baseURL?: string) => {
  return new ServiceClient(
    baseURL || process.env.MOBILE_AI_SERVICE_URL || 'http://localhost:3004',
    'bg-mobile-ai'
  );
};