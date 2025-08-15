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
export declare class RedisHealthMonitor {
    private static instance;
    private metrics;
    private operationTimes;
    private operationCount;
    private errorCount;
    private lastErrorTime?;
    private lastError?;
    private startTime;
    private monitoringInterval?;
    private constructor();
    static getInstance(): RedisHealthMonitor;
    private initializeMetrics;
    private startPeriodicHealthCheck;
    collectMetrics(): Promise<RedisHealthMetrics>;
    private checkConnection;
    private getRedisInfo;
    private updateConnectionMetrics;
    private updatePerformanceMetrics;
    private updateCacheStatistics;
    private updateErrorMetrics;
    private updateOverallStatus;
    private recordOperation;
    private recordError;
    recordCacheHit(): void;
    recordCacheMiss(): void;
    getHealthMetrics(): Promise<RedisHealthMetrics>;
    getQuickHealthCheck(): Promise<{
        status: string;
        responseTime: number;
        uptime: number;
        hitRate: number;
    }>;
    cleanup(): void;
}
export declare const redisHealthMonitor: RedisHealthMonitor;
//# sourceMappingURL=redis-health-monitor.d.ts.map