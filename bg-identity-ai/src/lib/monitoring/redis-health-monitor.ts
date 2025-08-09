import { redisClient } from '../redis-client';
import { logger } from '../logger';

export interface RedisConnectionHealth {
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  uptime: number;
  lastCheck: string;
  responseTime: number;
  lastSuccessfulOperation?: string;
  connectionAttempts: number;
}

export interface RedisPerformanceMetrics {
  avgLatency: number;
  operationsPerSecond: number;
  memoryUsage: number;
  connectedClients: number;
  totalConnectionsReceived: number;
  keyspaceHits: number;
  keyspaceMisses: number;
}

export interface RedisCacheStatistics {
  hitRate: number;
  totalRequests: number;
  totalHits: number;
  totalMisses: number;
  evictedKeys: number;
  expiredKeys: number;
  keysCount: number;
}

export interface RedisErrorMetrics {
  connectionErrors: number;
  operationTimeouts: number;
  lastError?: string;
  lastErrorTime?: string;
  errorRate: number;
  recoveryTime?: number;
}

export interface RedisHealthMetrics {
  connection: RedisConnectionHealth;
  performance: RedisPerformanceMetrics;
  cache: RedisCacheStatistics;
  errors: RedisErrorMetrics;
  timestamp: string;
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
}

export class RedisHealthMonitor {
  private static instance: RedisHealthMonitor;
  private metrics: RedisHealthMetrics;
  private operationTimes: number[] = [];
  private operationCount = 0;
  private errorCount = 0;
  private lastErrorTime?: string;
  private lastError?: string;
  private startTime = Date.now();
  private monitoringInterval?: NodeJS.Timeout;

  private constructor() {
    this.metrics = this.initializeMetrics();
    this.startPeriodicHealthCheck();
  }

  public static getInstance(): RedisHealthMonitor {
    if (!RedisHealthMonitor.instance) {
      RedisHealthMonitor.instance = new RedisHealthMonitor();
    }
    return RedisHealthMonitor.instance;
  }

  private initializeMetrics(): RedisHealthMetrics {
    return {
      connection: {
        status: 'disconnected',
        uptime: 0,
        lastCheck: new Date().toISOString(),
        responseTime: 0,
        connectionAttempts: 0
      },
      performance: {
        avgLatency: 0,
        operationsPerSecond: 0,
        memoryUsage: 0,
        connectedClients: 0,
        totalConnectionsReceived: 0,
        keyspaceHits: 0,
        keyspaceMisses: 0
      },
      cache: {
        hitRate: 0,
        totalRequests: 0,
        totalHits: 0,
        totalMisses: 0,
        evictedKeys: 0,
        expiredKeys: 0,
        keysCount: 0
      },
      errors: {
        connectionErrors: 0,
        operationTimeouts: 0,
        errorRate: 0
      },
      timestamp: new Date().toISOString(),
      overallStatus: 'unhealthy'
    };
  }

  private startPeriodicHealthCheck(): void {
    // Check health every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      await this.collectMetrics();
    }, 30000);

    // Initial health check
    this.collectMetrics().catch(error => {
      logger.error('Initial Redis health check failed', {
        component: 'redis-health-monitor',
        error: error.message
      });
    });
  }

  public async collectMetrics(): Promise<RedisHealthMetrics> {
    const startTime = Date.now();

    try {
      // Test basic connectivity
      const connectionStatus = await this.checkConnection();
      
      // Collect Redis INFO stats if connected
      let redisInfo = {};
      if (connectionStatus.status === 'connected') {
        redisInfo = await this.getRedisInfo();
      }

      // Update connection metrics
      this.updateConnectionMetrics(connectionStatus, Date.now() - startTime);
      
      // Update performance metrics
      this.updatePerformanceMetrics(redisInfo);
      
      // Update cache statistics
      this.updateCacheStatistics(redisInfo);
      
      // Update error metrics
      this.updateErrorMetrics();

      // Determine overall status
      this.updateOverallStatus();

      this.metrics.timestamp = new Date().toISOString();

      logger.debug('Redis health metrics collected', {
        component: 'redis-health-monitor',
        status: this.metrics.overallStatus,
        responseTime: Date.now() - startTime,
        hitRate: this.metrics.cache.hitRate
      });

      return this.metrics;

    } catch (error: any) {
      this.recordError(error);
      this.metrics.timestamp = new Date().toISOString();
      this.updateOverallStatus();

      logger.error('Redis health metrics collection failed', {
        component: 'redis-health-monitor',
        error: error.message,
        duration: Date.now() - startTime
      });

      return this.metrics;
    }
  }

  private async checkConnection(): Promise<{ status: RedisConnectionHealth['status']; responseTime: number }> {
    const startTime = Date.now();
    
    try {
      if (!redisClient.isReady()) {
        return { 
          status: 'disconnected', 
          responseTime: Date.now() - startTime 
        };
      }

      // Test with a ping
      const pingResult = await redisClient.ping();
      const responseTime = Date.now() - startTime;

      if (pingResult) {
        this.recordOperation(responseTime);
        return { status: 'connected', responseTime };
      } else {
        return { status: 'error', responseTime };
      }

    } catch (error) {
      return { 
        status: 'error', 
        responseTime: Date.now() - startTime 
      };
    }
  }

  private async getRedisInfo(): Promise<any> {
    try {
      // Get Redis INFO command output
      // Note: ioredis doesn't expose INFO directly, so we'll use basic operations
      // to infer performance metrics
      
      const testKey = 'health_check_test_key';
      const testValue = 'test_value';
      
      // Test SET operation
      await redisClient.set(testKey, testValue, 1); // 1 second TTL
      
      // Test GET operation  
      await redisClient.get(testKey);
      
      // Test EXISTS operation
      await redisClient.exists(testKey);

      // Clean up
      await redisClient.del(testKey);

      return {
        // We'll simulate basic Redis INFO stats
        uptime_in_seconds: Math.floor((Date.now() - this.startTime) / 1000),
        connected_clients: 1, // We can't get real client count without INFO
        used_memory: 0, // Would need INFO MEMORY
        keyspace_hits: this.metrics.cache.totalHits,
        keyspace_misses: this.metrics.cache.totalMisses
      };

    } catch (error) {
      logger.warn('Failed to collect Redis INFO stats', {
        component: 'redis-health-monitor',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {};
    }
  }

  private updateConnectionMetrics(connectionStatus: any, responseTime: number): void {
    this.metrics.connection = {
      status: connectionStatus.status,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      lastCheck: new Date().toISOString(),
      responseTime,
      connectionAttempts: this.metrics.connection.connectionAttempts + 1,
      lastSuccessfulOperation: connectionStatus.status === 'connected' 
        ? new Date().toISOString() 
        : this.metrics.connection.lastSuccessfulOperation
    };
  }

  private updatePerformanceMetrics(redisInfo: any): void {
    // Calculate average latency from recent operations
    const avgLatency = this.operationTimes.length > 0 
      ? this.operationTimes.reduce((sum, time) => sum + time, 0) / this.operationTimes.length
      : 0;

    // Calculate operations per second (rough estimate)
    const uptimeSeconds = Math.max(this.metrics.connection.uptime, 1);
    const operationsPerSecond = this.operationCount / uptimeSeconds;

    this.metrics.performance = {
      avgLatency: Math.round(avgLatency * 100) / 100, // Round to 2 decimal places
      operationsPerSecond: Math.round(operationsPerSecond * 100) / 100,
      memoryUsage: redisInfo.used_memory || 0,
      connectedClients: redisInfo.connected_clients || 1,
      totalConnectionsReceived: redisInfo.total_connections_received || this.metrics.connection.connectionAttempts,
      keyspaceHits: redisInfo.keyspace_hits || this.metrics.cache.totalHits,
      keyspaceMisses: redisInfo.keyspace_misses || this.metrics.cache.totalMisses
    };
  }

  private updateCacheStatistics(redisInfo: any): void {
    // Use our internal tracking or Redis INFO stats
    const totalHits = this.metrics.cache.totalHits;
    const totalMisses = this.metrics.cache.totalMisses;
    const totalRequests = totalHits + totalMisses;
    
    const hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;

    this.metrics.cache = {
      hitRate: Math.round(hitRate * 100) / 100,
      totalRequests,
      totalHits,
      totalMisses,
      evictedKeys: redisInfo.evicted_keys || 0,
      expiredKeys: redisInfo.expired_keys || 0,
      keysCount: redisInfo.db0_keys || 0
    };
  }

  private updateErrorMetrics(): void {
    const uptimeSeconds = Math.max(this.metrics.connection.uptime, 1);
    const errorRate = (this.errorCount / uptimeSeconds) * 60; // Errors per minute

    this.metrics.errors = {
      connectionErrors: this.errorCount,
      operationTimeouts: 0, // Would need more detailed tracking
      errorRate: Math.round(errorRate * 100) / 100,
      lastError: this.lastError,
      lastErrorTime: this.lastErrorTime
    };
  }

  private updateOverallStatus(): void {
    const { connection, errors, performance } = this.metrics;

    if (connection.status === 'connected' && errors.errorRate < 0.1) {
      this.metrics.overallStatus = 'healthy';
    } else if (connection.status === 'connected' && errors.errorRate < 1.0) {
      this.metrics.overallStatus = 'degraded';
    } else {
      this.metrics.overallStatus = 'unhealthy';
    }
  }

  private recordOperation(responseTime: number): void {
    this.operationTimes.push(responseTime);
    this.operationCount++;

    // Keep only last 100 operations for average calculation
    if (this.operationTimes.length > 100) {
      this.operationTimes.shift();
    }
  }

  private recordError(error: any): void {
    this.errorCount++;
    this.lastError = error.message || 'Unknown error';
    this.lastErrorTime = new Date().toISOString();

    logger.warn('Redis health monitor recorded error', {
      component: 'redis-health-monitor',
      error: this.lastError,
      errorCount: this.errorCount
    });
  }

  // Public methods for cache statistics tracking
  public recordCacheHit(): void {
    this.metrics.cache.totalHits++;
  }

  public recordCacheMiss(): void {
    this.metrics.cache.totalMisses++;
  }

  public async getHealthMetrics(): Promise<RedisHealthMetrics> {
    return this.metrics;
  }

  public async getQuickHealthCheck(): Promise<{
    status: string;
    responseTime: number;
    uptime: number;
    hitRate: number;
  }> {
    const startTime = Date.now();
    const connectionCheck = await this.checkConnection();
    
    return {
      status: connectionCheck.status,
      responseTime: Date.now() - startTime,
      uptime: this.metrics.connection.uptime,
      hitRate: this.metrics.cache.hitRate
    };
  }

  public cleanup(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    logger.info('Redis health monitor cleaned up', {
      component: 'redis-health-monitor'
    });
  }
}

// Singleton instance export
export const redisHealthMonitor = RedisHealthMonitor.getInstance();