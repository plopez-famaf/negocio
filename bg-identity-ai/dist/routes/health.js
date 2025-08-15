"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRoutes = void 0;
const express_1 = require("express");
const logger_1 = require("@/lib/logger");
const redis_health_monitor_1 = require("@/lib/monitoring/redis-health-monitor");
const router = (0, express_1.Router)();
exports.healthRoutes = router;
router.get('/', async (req, res) => {
    try {
        const redisHealthCheck = await redis_health_monitor_1.redisHealthMonitor.getQuickHealthCheck();
        const healthCheck = {
            service: 'bg-identity-ai',
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: process.env.npm_package_version || '2.0.0',
            redis: {
                status: redisHealthCheck.status,
                responseTime: redisHealthCheck.responseTime,
                uptime: redisHealthCheck.uptime,
                hitRate: redisHealthCheck.hitRate
            }
        };
        // Determine overall health based on Redis status
        if (redisHealthCheck.status === 'error' || redisHealthCheck.status === 'disconnected') {
            healthCheck.status = 'degraded';
        }
        const statusCode = healthCheck.status === 'healthy' ? 200 :
            healthCheck.status === 'degraded' ? 200 : 503;
        logger_1.logger.info('Health check requested', healthCheck);
        return res.status(statusCode).json(healthCheck);
    }
    catch (error) {
        logger_1.logger.error('Health check failed', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        const healthCheck = {
            service: 'bg-identity-ai',
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: process.env.npm_package_version || '2.0.0',
            error: 'Health check failed'
        };
        return res.status(500).json(healthCheck);
    }
});
router.get('/ready', async (req, res) => {
    try {
        const redisHealthCheck = await redis_health_monitor_1.redisHealthMonitor.getQuickHealthCheck();
        const redisReady = redisHealthCheck.status === 'connected';
        const readinessCheck = {
            service: 'bg-identity-ai',
            ready: redisReady,
            timestamp: new Date().toISOString(),
            checks: {
                redis: {
                    ready: redisReady,
                    status: redisHealthCheck.status,
                    responseTime: redisHealthCheck.responseTime
                }
            }
        };
        const statusCode = readinessCheck.ready ? 200 : 503;
        return res.status(statusCode).json(readinessCheck);
    }
    catch (error) {
        logger_1.logger.error('Readiness check failed', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return res.status(500).json({
            service: 'bg-identity-ai',
            ready: false,
            timestamp: new Date().toISOString(),
            error: 'Readiness check failed'
        });
    }
});
// Detailed Redis health endpoint
router.get('/redis', async (req, res) => {
    try {
        const detailedMetrics = await redis_health_monitor_1.redisHealthMonitor.getHealthMetrics();
        const redisHealth = {
            service: 'bg-identity-ai',
            component: 'redis',
            ...detailedMetrics,
            timestamp: new Date().toISOString()
        };
        const statusCode = detailedMetrics.overallStatus === 'healthy' ? 200 :
            detailedMetrics.overallStatus === 'degraded' ? 200 : 503;
        logger_1.logger.info('Redis health check requested', {
            status: detailedMetrics.overallStatus,
            hitRate: detailedMetrics.cache.hitRate,
            responseTime: detailedMetrics.connection.responseTime
        });
        return res.status(statusCode).json(redisHealth);
    }
    catch (error) {
        logger_1.logger.error('Redis health check failed', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return res.status(500).json({
            service: 'bg-identity-ai',
            component: 'redis',
            timestamp: new Date().toISOString(),
            overallStatus: 'unhealthy',
            error: 'Redis health check failed'
        });
    }
});
// Comprehensive health endpoint with all details
router.get('/detailed', async (req, res) => {
    try {
        const redisMetrics = await redis_health_monitor_1.redisHealthMonitor.getHealthMetrics();
        const detailedHealth = {
            service: 'bg-identity-ai',
            timestamp: new Date().toISOString(),
            overallStatus: redisMetrics.overallStatus,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: process.env.npm_package_version || '2.0.0',
            components: {
                redis: redisMetrics,
                node: {
                    version: process.version,
                    platform: process.platform,
                    arch: process.arch,
                    pid: process.pid
                }
            }
        };
        const statusCode = detailedHealth.overallStatus === 'healthy' ? 200 :
            detailedHealth.overallStatus === 'degraded' ? 200 : 503;
        logger_1.logger.info('Detailed health check requested', {
            overallStatus: detailedHealth.overallStatus,
            redisStatus: redisMetrics.connection.status,
            cacheHitRate: redisMetrics.cache.hitRate
        });
        return res.status(statusCode).json(detailedHealth);
    }
    catch (error) {
        logger_1.logger.error('Detailed health check failed', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return res.status(500).json({
            service: 'bg-identity-ai',
            timestamp: new Date().toISOString(),
            overallStatus: 'unhealthy',
            error: 'Detailed health check failed'
        });
    }
});
//# sourceMappingURL=health.js.map