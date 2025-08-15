"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisHealthMonitor = exports.RedisHealthMonitor = void 0;
const redis_client_1 = require("../redis-client");
const logger_1 = require("../logger");
class RedisHealthMonitor {
    static instance;
    metrics;
    operationTimes = [];
    operationCount = 0;
    errorCount = 0;
    lastErrorTime;
    lastError;
    startTime = Date.now();
    monitoringInterval;
    constructor() {
        this.metrics = this.initializeMetrics();
        this.startPeriodicHealthCheck();
    }
    static getInstance() {
        if (!RedisHealthMonitor.instance) {
            RedisHealthMonitor.instance = new RedisHealthMonitor();
        }
        return RedisHealthMonitor.instance;
    }
    initializeMetrics() {
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
    startPeriodicHealthCheck() {
        // Check health every 30 seconds
        this.monitoringInterval = setInterval(async () => {
            await this.collectMetrics();
        }, 30000);
        // Initial health check
        this.collectMetrics().catch(error => {
            logger_1.logger.error('Initial Redis health check failed', {
                component: 'redis-health-monitor',
                error: error.message
            });
        });
    }
    async collectMetrics() {
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
            logger_1.logger.debug('Redis health metrics collected', {
                component: 'redis-health-monitor',
                status: this.metrics.overallStatus,
                responseTime: Date.now() - startTime,
                hitRate: this.metrics.cache.hitRate
            });
            return this.metrics;
        }
        catch (error) {
            this.recordError(error);
            this.metrics.timestamp = new Date().toISOString();
            this.updateOverallStatus();
            logger_1.logger.error('Redis health metrics collection failed', {
                component: 'redis-health-monitor',
                error: error.message,
                duration: Date.now() - startTime
            });
            return this.metrics;
        }
    }
    async checkConnection() {
        const startTime = Date.now();
        try {
            if (!redis_client_1.redisClient.isReady()) {
                return {
                    status: 'disconnected',
                    responseTime: Date.now() - startTime
                };
            }
            // Test with a ping
            const pingResult = await redis_client_1.redisClient.ping();
            const responseTime = Date.now() - startTime;
            if (pingResult) {
                this.recordOperation(responseTime);
                return { status: 'connected', responseTime };
            }
            else {
                return { status: 'error', responseTime };
            }
        }
        catch (error) {
            return {
                status: 'error',
                responseTime: Date.now() - startTime
            };
        }
    }
    async getRedisInfo() {
        try {
            // Get Redis INFO command output
            // Note: ioredis doesn't expose INFO directly, so we'll use basic operations
            // to infer performance metrics
            const testKey = 'health_check_test_key';
            const testValue = 'test_value';
            // Test SET operation
            await redis_client_1.redisClient.set(testKey, testValue, 1); // 1 second TTL
            // Test GET operation  
            await redis_client_1.redisClient.get(testKey);
            // Test EXISTS operation
            await redis_client_1.redisClient.exists(testKey);
            // Clean up
            await redis_client_1.redisClient.del(testKey);
            return {
                // We'll simulate basic Redis INFO stats
                uptime_in_seconds: Math.floor((Date.now() - this.startTime) / 1000),
                connected_clients: 1, // We can't get real client count without INFO
                used_memory: 0, // Would need INFO MEMORY
                keyspace_hits: this.metrics.cache.totalHits,
                keyspace_misses: this.metrics.cache.totalMisses
            };
        }
        catch (error) {
            logger_1.logger.warn('Failed to collect Redis INFO stats', {
                component: 'redis-health-monitor',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return {};
        }
    }
    updateConnectionMetrics(connectionStatus, responseTime) {
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
    updatePerformanceMetrics(redisInfo) {
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
    updateCacheStatistics(redisInfo) {
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
    updateErrorMetrics() {
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
    updateOverallStatus() {
        const { connection, errors, performance } = this.metrics;
        if (connection.status === 'connected' && errors.errorRate < 0.1) {
            this.metrics.overallStatus = 'healthy';
        }
        else if (connection.status === 'connected' && errors.errorRate < 1.0) {
            this.metrics.overallStatus = 'degraded';
        }
        else {
            this.metrics.overallStatus = 'unhealthy';
        }
    }
    recordOperation(responseTime) {
        this.operationTimes.push(responseTime);
        this.operationCount++;
        // Keep only last 100 operations for average calculation
        if (this.operationTimes.length > 100) {
            this.operationTimes.shift();
        }
    }
    recordError(error) {
        this.errorCount++;
        this.lastError = error.message || 'Unknown error';
        this.lastErrorTime = new Date().toISOString();
        logger_1.logger.warn('Redis health monitor recorded error', {
            component: 'redis-health-monitor',
            error: this.lastError,
            errorCount: this.errorCount
        });
    }
    // Public methods for cache statistics tracking
    recordCacheHit() {
        this.metrics.cache.totalHits++;
    }
    recordCacheMiss() {
        this.metrics.cache.totalMisses++;
    }
    async getHealthMetrics() {
        return this.metrics;
    }
    async getQuickHealthCheck() {
        const startTime = Date.now();
        const connectionCheck = await this.checkConnection();
        return {
            status: connectionCheck.status,
            responseTime: Date.now() - startTime,
            uptime: this.metrics.connection.uptime,
            hitRate: this.metrics.cache.hitRate
        };
    }
    cleanup() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
        }
        logger_1.logger.info('Redis health monitor cleaned up', {
            component: 'redis-health-monitor'
        });
    }
}
exports.RedisHealthMonitor = RedisHealthMonitor;
// Singleton instance export
exports.redisHealthMonitor = RedisHealthMonitor.getInstance();
//# sourceMappingURL=redis-health-monitor.js.map