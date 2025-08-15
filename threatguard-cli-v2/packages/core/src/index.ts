// Core Types and Schemas
export * from './types/index.js';

// API Client
export { APIClient, createAPIClient, APIClientError } from './api/client.js';
export type { APIClientConfig } from './api/client.js';

// WebSocket Client
export { WebSocketClient, createWebSocketClient, WebSocketClientError } from './services/websocket.js';
export type { WebSocketClientOptions, ConnectionInfo } from './services/websocket.js';

// Configuration Management
export { ConfigManager, createConfigManager, ConfigManagerError } from './services/config.js';
export type { ConfigManagerOptions } from './services/config.js';

// Utilities
export { Logger, createLogger, logger, generateCorrelationId, withCorrelation } from './utils/logger.js';
export type { LoggerOptions, LogLevel, LogEntry, LogOutput } from './utils/logger.js';

// Version
export const VERSION = '2.0.0';