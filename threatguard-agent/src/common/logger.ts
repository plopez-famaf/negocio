/**
 * ThreatGuard Agent - Logger
 * Centralized logging with structured output
 */

import { createLogger, format, transports, Logger as WinstonLogger } from 'winston';
import { hostname } from 'os';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

export class Logger {
    private logger: WinstonLogger;
    private component: string;
    private static globalLevel: LogLevel = 'info';

    constructor(component: string) {
        this.component = component;
        this.logger = this.createLogger();
    }

    public static setLevel(level: LogLevel): void {
        Logger.globalLevel = level;
    }

    public debug(message: string, meta?: any): void {
        this.logger.debug(message, { ...meta, component: this.component });
    }

    public info(message: string, meta?: any): void {
        this.logger.info(message, { ...meta, component: this.component });
    }

    public warn(message: string, meta?: any): void {
        this.logger.warn(message, { ...meta, component: this.component });
    }

    public error(message: string, error?: any, meta?: any): void {
        const errorMeta = error instanceof Error 
            ? { 
                error: error.message, 
                stack: error.stack,
                name: error.name
              }
            : { error };

        this.logger.error(message, { 
            ...errorMeta, 
            ...meta, 
            component: this.component 
        });
    }

    public trace(message: string, meta?: any): void {
        if (Logger.globalLevel === 'trace') {
            this.logger.debug(`[TRACE] ${message}`, { ...meta, component: this.component });
        }
    }

    private createLogger(): WinstonLogger {
        const isProduction = process.env.NODE_ENV === 'production';
        
        const baseFormat = format.combine(
            format.timestamp(),
            format.errors({ stack: true }),
            format.json()
        );

        const consoleFormat = format.combine(
            format.colorize(),
            format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            format.printf(({ timestamp, level, message, component, ...meta }) => {
                const metaStr = Object.keys(meta).length > 0 
                    ? ` ${JSON.stringify(meta)}`
                    : '';
                return `${timestamp} [${component}] ${level}: ${message}${metaStr}`;
            })
        );

        const loggerTransports = [
            // Console output with colors for development
            new transports.Console({
                format: isProduction ? baseFormat : consoleFormat,
                level: Logger.globalLevel
            })
        ];

        // Add file transports in production
        if (isProduction) {
            loggerTransports.push(
                new transports.File({
                    filename: '/var/log/threatguard-agent/error.log',
                    level: 'error',
                    format: baseFormat,
                    maxsize: 10 * 1024 * 1024, // 10MB
                    maxFiles: 5
                }),
                new transports.File({
                    filename: '/var/log/threatguard-agent/combined.log',
                    format: baseFormat,
                    maxsize: 10 * 1024 * 1024, // 10MB
                    maxFiles: 10
                })
            );
        }

        return createLogger({
            level: Logger.globalLevel,
            format: baseFormat,
            defaultMeta: {
                service: 'threatguard-agent',
                version: '2.0.1',
                hostname: hostname(),
                pid: process.pid
            },
            transports: loggerTransports,
            exceptionHandlers: [
                new transports.Console({
                    format: consoleFormat
                })
            ],
            rejectionHandlers: [
                new transports.Console({
                    format: consoleFormat
                })
            ]
        });
    }
}