import { Router } from 'express';
import { logger } from '@/lib/logger';
import { redisHealthMonitor } from '@/lib/monitoring/redis-health-monitor';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const redisHealthCheck = await redisHealthMonitor.getQuickHealthCheck();
    
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

    logger.info('Health check requested', healthCheck);
    res.status(200).json(healthCheck);
  } catch (error) {
    logger.error('Health check failed', {
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
    
    res.status(503).json(healthCheck);
  }
});

router.get('/ready', async (req, res) => {
  try {
    const redisHealthCheck = await redisHealthMonitor.getQuickHealthCheck();
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
    res.status(statusCode).json(readinessCheck);
  } catch (error) {
    logger.error('Readiness check failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(503).json({
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
    const detailedMetrics = await redisHealthMonitor.getHealthMetrics();
    
    const redisHealth = {
      service: 'bg-identity-ai',
      component: 'redis',
      timestamp: new Date().toISOString(),
      ...detailedMetrics
    };

    const statusCode = detailedMetrics.overallStatus === 'healthy' ? 200 : 
                      detailedMetrics.overallStatus === 'degraded' ? 200 : 503;
    
    logger.info('Redis health check requested', {
      status: detailedMetrics.overallStatus,
      hitRate: detailedMetrics.cache.hitRate,
      responseTime: detailedMetrics.connection.responseTime
    });

    res.status(statusCode).json(redisHealth);
  } catch (error) {
    logger.error('Redis health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(503).json({
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
    const redisMetrics = await redisHealthMonitor.getHealthMetrics();
    
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

    logger.info('Detailed health check requested', {
      overallStatus: detailedHealth.overallStatus,
      redisStatus: redisMetrics.connection.status,
      cacheHitRate: redisMetrics.cache.hitRate
    });

    res.status(statusCode).json(detailedHealth);
  } catch (error) {
    logger.error('Detailed health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(503).json({
      service: 'bg-identity-ai',
      timestamp: new Date().toISOString(),
      overallStatus: 'unhealthy',
      error: 'Detailed health check failed'
    });
  }
});

export { router as healthRoutes };