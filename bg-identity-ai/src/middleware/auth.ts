import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '@/lib/logger';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    logger.warn('Authentication failed: No token provided', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const decoded = jwt.verify(token, jwtSecret) as any;
    req.user = decoded;
    
    logger.info('User authenticated successfully', {
      userId: decoded.id,
      email: decoded.email
    });
    
    next();
  } catch (error) {
    logger.warn('Authentication failed: Invalid token', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip
    });
    res.status(401).json({ error: 'Invalid token.' });
  }
};