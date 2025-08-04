import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { logger } from '@/lib/logger';
import { errorHandler } from '@/middleware/error-handler';
import { authMiddleware } from '@/middleware/auth';
import { biometricRoutes } from '@/routes/biometric';
import { documentRoutes } from '@/routes/document';
import { healthRoutes } from '@/routes/health';

dotenv.config();

const app = express();
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
app.use((req, res, next) => {
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
app.use('/api/biometric', authMiddleware, biometricRoutes);
app.use('/api/document', authMiddleware, documentRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  logger.info(`BG Identity AI Service listening on port ${PORT}`);
});

export default app;