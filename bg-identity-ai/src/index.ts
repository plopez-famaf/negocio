import 'module-alias/register';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { logger } from '@/lib/logger';
import { errorHandler } from '@/middleware/error-handler';
import { authMiddleware } from '@/middleware/auth';
import { threatRoutes } from '@/routes/threat';
import { healthRoutes } from '@/routes/health';
import { analyticsRoutes } from '@/routes/analytics';
import { mlManagementRoutes } from '@/routes/ml-management';
import { integrationRoutes } from '@/routes/integrations';
import { EnhancedWebSocketStreamService } from '@/services/enhanced-websocket-stream-service';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

// Security and performance middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use((req, _res, next) => {
  logger.info('Request received', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });
  next();
});

// Routes
app.use('/health', healthRoutes);
app.use('/api/threat', authMiddleware, threatRoutes);
app.use('/api/analytics', authMiddleware, analyticsRoutes);
app.use('/api/ml', authMiddleware, mlManagementRoutes);
app.use('/api/integrations', authMiddleware, integrationRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize Enhanced WebSocket streaming service
const streamService = new EnhancedWebSocketStreamService(server);

// Start server
server.listen(PORT, () => {
  logger.info(`BG Threat AI Service listening on port ${PORT}`, {
    service: 'bg-threat-ai',
    version: '2.0.0',
    features: [
      'real-time-detection', 
      'behavioral-analysis', 
      'network-monitoring', 
      'threat-intelligence',
      'enhanced-websocket-streaming',
      'stream-multiplexing',
      'event-aggregation',
      'smart-filtering',
      'adaptive-throttling',
      'ml-relevance-scoring',
      'advanced-analytics',
      'trend-analysis',
      'predictive-modeling',
      'dashboard-metrics',
      'bulk-operations',
      'multi-format-export',
      'ml-model-management',
      'feature-importance-analysis',
      'drift-detection',
      'automated-retraining',
      'prediction-explanation',
      'webhook-integration',
      'siem-connectivity',
      'multi-siem-support',
      'bidirectional-sync',
      'automated-export'
    ],
    websocket: {
      enabled: true,
      transports: ['websocket', 'polling']
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  streamService.cleanup();
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  streamService.cleanup();
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

export default app;