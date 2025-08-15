import { inspect } from 'util';
import { z } from 'zod';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
  timestamp?: boolean;
  colors?: boolean;
  structured?: boolean;
  correlationId?: string;
  outputs?: LogOutput[];
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  prefix?: string;
  correlationId?: string;
  metadata?: any;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface LogOutput {
  write(entry: LogEntry): void | Promise<void>;
}

// Schema for log level validation
const LogLevelSchema = z.enum(['error', 'warn', 'info', 'debug', 'trace']);

// Log level priority mapping
const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
};

// Color codes for terminal output
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  error: COLORS.red,
  warn: COLORS.yellow,
  info: COLORS.blue,
  debug: COLORS.cyan,
  trace: COLORS.gray,
};

// Console output implementation
class ConsoleOutput implements LogOutput {
  constructor(private useColors: boolean = true) {}

  write(entry: LogEntry): void {
    const { timestamp, level, message, prefix, correlationId, metadata, error } = entry;
    
    let output = '';
    
    // Timestamp
    if (this.useColors) {
      output += `${COLORS.gray}${timestamp}${COLORS.reset} `;
    } else {
      output += `${timestamp} `;
    }
    
    // Level
    const levelColor = this.useColors ? LEVEL_COLORS[level] : '';
    const resetColor = this.useColors ? COLORS.reset : '';
    output += `${levelColor}[${level.toUpperCase().padEnd(5)}]${resetColor} `;
    
    // Prefix
    if (prefix) {
      const prefixColor = this.useColors ? COLORS.magenta : '';
      output += `${prefixColor}[${prefix}]${resetColor} `;
    }
    
    // Correlation ID
    if (correlationId) {
      const corrColor = this.useColors ? COLORS.cyan : '';
      output += `${corrColor}(${correlationId})${resetColor} `;
    }
    
    // Message
    output += message;
    
    // Metadata
    if (metadata && Object.keys(metadata).length > 0) {
      const metaColor = this.useColors ? COLORS.dim : '';
      output += ` ${metaColor}${inspect(metadata, { colors: this.useColors, depth: 2, compact: true })}${resetColor}`;
    }
    
    // Error details
    if (error) {
      const errorColor = this.useColors ? COLORS.red : '';
      output += `\n${errorColor}Error: ${error.name}: ${error.message}${resetColor}`;
      if (error.stack) {
        output += `\n${errorColor}${error.stack}${resetColor}`;
      }
    }
    
    // Output to appropriate stream
    if (level === 'error' || level === 'warn') {
      console.error(output);
    } else {
      console.log(output);
    }
  }
}

// JSON output implementation
class JsonOutput implements LogOutput {
  write(entry: LogEntry): void {
    console.log(JSON.stringify(entry));
  }
}

export class Logger {
  private level: LogLevel;
  private prefix?: string;
  private timestamp: boolean;
  private colors: boolean;
  private structured: boolean;
  private correlationId?: string;
  private outputs: LogOutput[];

  constructor(options: LoggerOptions = {}) {
    this.level = options.level || 'info';
    this.prefix = options.prefix;
    this.timestamp = options.timestamp ?? true;
    this.colors = options.colors ?? true;
    this.structured = options.structured ?? false;
    this.correlationId = options.correlationId;
    
    // Set up outputs
    if (options.outputs && options.outputs.length > 0) {
      this.outputs = options.outputs;
    } else if (this.structured) {
      this.outputs = [new JsonOutput()];
    } else {
      this.outputs = [new ConsoleOutput(this.colors)];
    }
  }

  setLevel(level: LogLevel): void {
    try {
      this.level = LogLevelSchema.parse(level);
    } catch {
      throw new Error(`Invalid log level: ${level}`);
    }
  }

  setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
  }

  clearCorrelationId(): void {
    this.correlationId = undefined;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] <= LOG_LEVELS[this.level];
  }

  private createEntry(level: LogLevel, message: string, metadata?: any, error?: Error): LogEntry {
    const entry: LogEntry = {
      timestamp: this.timestamp ? new Date().toISOString() : '',
      level,
      message,
      prefix: this.prefix,
      correlationId: this.correlationId,
    };

    if (metadata) {
      entry.metadata = metadata;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  }

  private async log(level: LogLevel, message: string, metadata?: any, error?: Error): Promise<void> {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry = this.createEntry(level, message, metadata, error);
    
    // Write to all outputs
    await Promise.all(this.outputs.map(output => output.write(entry)));
  }

  // Main logging methods
  async error(message: string, metadata?: any): Promise<void>;
  async error(message: string, error: Error): Promise<void>;
  async error(message: string, metadata: any, error: Error): Promise<void>;
  async error(message: string, metadataOrError?: any, error?: Error): Promise<void> {
    if (metadataOrError instanceof Error) {
      await this.log('error', message, undefined, metadataOrError);
    } else {
      await this.log('error', message, metadataOrError, error);
    }
  }

  async warn(message: string, metadata?: any): Promise<void> {
    await this.log('warn', message, metadata);
  }

  async info(message: string, metadata?: any): Promise<void> {
    await this.log('info', message, metadata);
  }

  async debug(message: string, metadata?: any): Promise<void> {
    await this.log('debug', message, metadata);
  }

  async trace(message: string, metadata?: any): Promise<void> {
    await this.log('trace', message, metadata);
  }

  // Convenience methods
  async success(message: string, metadata?: any): Promise<void> {
    await this.info(`✅ ${message}`, metadata);
  }

  async warning(message: string, metadata?: any): Promise<void> {
    await this.warn(`⚠️ ${message}`, metadata);
  }

  async failure(message: string, metadata?: any, error?: Error): Promise<void> {
    await this.error(`❌ ${message}`, metadata, error);
  }

  // Performance timing
  time(label: string): void {
    console.time(label);
  }

  timeEnd(label: string): void {
    console.timeEnd(label);
  }

  // Child logger with additional context
  child(options: Partial<LoggerOptions>): Logger {
    return new Logger({
      level: this.level,
      prefix: this.prefix,
      timestamp: this.timestamp,
      colors: this.colors,
      structured: this.structured,
      correlationId: this.correlationId,
      outputs: this.outputs,
      ...options,
      prefix: options.prefix || this.prefix,
      correlationId: options.correlationId || this.correlationId,
    });
  }

  // Create scoped logger with correlation ID
  withCorrelation(correlationId: string): Logger {
    return this.child({ correlationId });
  }

  // Create prefixed logger
  withPrefix(prefix: string): Logger {
    return this.child({ prefix });
  }

  // Configuration getters
  getLevel(): LogLevel {
    return this.level;
  }

  getPrefix(): string | undefined {
    return this.prefix;
  }

  getCorrelationId(): string | undefined {
    return this.correlationId;
  }

  isLevelEnabled(level: LogLevel): boolean {
    return this.shouldLog(level);
  }
}

// Factory function for creating configured logger
export function createLogger(options?: LoggerOptions): Logger {
  return new Logger(options);
}

// Default logger instance
export const logger = new Logger({
  level: (process.env.LOG_LEVEL as LogLevel) || 'info',
  colors: process.stdout.isTTY,
  structured: process.env.LOG_FORMAT === 'json',
});

// Structured logging helpers
export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function withCorrelation<T>(correlationId: string, fn: (logger: Logger) => T): T {
  const scopedLogger = logger.withCorrelation(correlationId);
  return fn(scopedLogger);
}

// Export for backward compatibility
export { Logger as default };