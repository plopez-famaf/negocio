import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return JSON.stringify({
        timestamp,
        level,
        message,
        service: 'bg-identity-ai',
        correlationId: meta.correlationId || uuidv4(),
        ...meta
      });
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

export const correlationLogger = (correlationId: string) => {
  return logger.child({ correlationId });
};