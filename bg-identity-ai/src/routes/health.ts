import { Router } from 'express';
import { logger } from '@/lib/logger';

const router = Router();

router.get('/', (req, res) => {
  const healthCheck = {
    service: 'bg-identity-ai',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  };

  logger.info('Health check requested', healthCheck);
  res.status(200).json(healthCheck);
});

router.get('/ready', (req, res) => {
  // Add readiness checks here (database, external services, etc.)
  res.status(200).json({
    service: 'bg-identity-ai',
    ready: true,
    timestamp: new Date().toISOString()
  });
});

export { router as healthRoutes };