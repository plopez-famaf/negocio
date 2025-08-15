import WebSocket from 'ws';
import { EventEmitter } from 'eventemitter3';
import pRetry from 'p-retry';
import pTimeout from 'p-timeout';
import type { StreamEvent } from '../types/index.js';
import { schemas } from '../types/index.js';

export interface WebSocketClientOptions {
  autoReconnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  timeout?: number;
  filters?: {
    eventTypes?: string[];
    severity?: string[];
    sources?: string[];
  };
}

export interface ConnectionInfo {
  connected: boolean;
  url?: string;
  readyState?: number;
  reconnectAttempts: number;
  lastConnected?: Date;
  lastError?: string;
  filters?: any;
}

export class WebSocketClientError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'WebSocketClientError';
  }
}

export class WebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string = '';
  private token: string = '';
  private options: Required<WebSocketClientOptions>;
  private connected: boolean = false;
  private reconnectAttempts: number = 0;
  private heartbeatTimer?: NodeJS.Timeout;
  private reconnectTimer?: NodeJS.Timeout;
  private lastConnected?: Date;
  private lastError?: string;

  constructor(options: WebSocketClientOptions = {}) {
    super();

    this.options = {
      autoReconnect: true,
      reconnectAttempts: 5,
      reconnectInterval: 5000,
      heartbeatInterval: 30000,
      timeout: 10000,
      filters: {
        eventTypes: ['threat', 'behavior', 'network'],
        severity: ['medium', 'high', 'critical'],
        sources: [],
      },
      ...options,
    };
  }

  async connect(url: string, token: string): Promise<void> {
    if (this.connected) {
      throw new WebSocketClientError('Already connected');
    }

    this.url = url;
    this.token = token;

    return pTimeout(
      pRetry(() => this._connect(), {
        retries: this.options.reconnectAttempts,
        onFailedAttempt: error => {
          this.emit('retry', {
            attempt: error.attemptNumber,
            error: error.message,
          });
        },
      }),
      { milliseconds: this.options.timeout }
    );
  }

  private async _connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Construct WebSocket URL with auth token
        const wsUrl = new URL(this.url);
        wsUrl.searchParams.set('token', this.token);

        this.ws = new WebSocket(wsUrl.toString(), {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'User-Agent': 'threatguard-cli/2.0.0',
          },
          handshakeTimeout: this.options.timeout,
        });

        // Connection opened
        this.ws.on('open', () => {
          this.connected = true;
          this.reconnectAttempts = 0;
          this.lastConnected = new Date();
          this.lastError = undefined;

          this.startHeartbeat();
          this.sendInitialFilters();

          this.emit('connected', {
            url: this.url,
            timestamp: this.lastConnected,
          });

          resolve();
        });

        // Message received
        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(message);
          } catch (error) {
            this.emit('error', new WebSocketClientError(
              `Failed to parse message: ${error instanceof Error ? error.message : 'Unknown error'}`
            ));
          }
        });

        // Connection error
        this.ws.on('error', (error) => {
          this.lastError = error.message;
          this.emit('error', new WebSocketClientError(
            `WebSocket error: ${error.message}`,
            'WS_ERROR'
          ));
          
          if (!this.connected) {
            reject(new WebSocketClientError(`Connection failed: ${error.message}`));
          }
        });

        // Connection closed
        this.ws.on('close', (code, reason) => {
          this.connected = false;
          this.stopHeartbeat();

          const closeReason = reason.toString() || `Code: ${code}`;
          this.lastError = closeReason;

          this.emit('disconnected', {
            code,
            reason: closeReason,
            wasClean: code === 1000,
          });

          // Attempt reconnection if enabled and not manually closed
          if (this.options.autoReconnect && code !== 1000 && this.reconnectAttempts < this.options.reconnectAttempts) {
            this.scheduleReconnect();
          }
        });

      } catch (error) {
        reject(new WebSocketClientError(
          `Failed to create WebSocket: ${error instanceof Error ? error.message : 'Unknown error'}`
        ));
      }
    });
  }

  private handleMessage(message: any): void {
    try {
      const { type, data, id } = message;

      switch (type) {
        case 'stream_event':
          this.handleStreamEvent(data);
          break;

        case 'response':
          this.emit('response', { id, data });
          break;

        case 'error':
          this.emit('error', new WebSocketClientError(data.message, data.code));
          break;

        case 'heartbeat_response':
          this.emit('heartbeat_response', data);
          break;

        case 'filters_updated':
          this.emit('filters_updated', data);
          break;

        default:
          this.emit('message', message);
      }
    } catch (error) {
      this.emit('error', new WebSocketClientError(
        `Failed to handle message: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }
  }

  private handleStreamEvent(eventData: any): void {
    try {
      // Validate stream event
      const streamEvent = schemas.StreamEvent.parse(eventData);
      
      // Emit general stream event
      this.emit('stream_event', streamEvent);
      
      // Emit specific event type
      this.emit(`${streamEvent.type}_event`, streamEvent);
      
      // Emit legacy events for backward compatibility
      switch (streamEvent.type) {
        case 'threat':
          this.emit('threat', streamEvent.data);
          break;
        case 'behavior':
          this.emit('behavior', streamEvent.data);
          break;
        case 'network':
          this.emit('network', streamEvent.data);
          break;
        case 'system':
          this.emit('system', streamEvent.data);
          break;
      }

    } catch (error) {
      this.emit('error', new WebSocketClientError(
        `Invalid stream event: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
        this.send({
          type: 'heartbeat',
          timestamp: new Date().toISOString(),
        });
      }
    }, this.options.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.options.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );

    this.emit('reconnecting', {
      attempt: this.reconnectAttempts,
      delay,
      maxAttempts: this.options.reconnectAttempts,
    });

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this._connect();
      } catch (error) {
        this.emit('error', new WebSocketClientError(
          `Reconnection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        ));
      }
    }, delay);
  }

  private sendInitialFilters(): void {
    if (this.options.filters) {
      this.updateFilters(this.options.filters);
    }
  }

  private send(message: any): void {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new WebSocketClientError('WebSocket is not connected');
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      throw new WebSocketClientError(
        `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  updateFilters(filters: any): void {
    try {
      this.send({
        type: 'update_filters',
        data: filters,
      });

      this.options.filters = { ...this.options.filters, ...filters };
      
    } catch (error) {
      throw new WebSocketClientError(
        `Failed to update filters: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Request-response methods with promise support
  async requestThreatScan(targets: string[], options?: any): Promise<any> {
    return this.sendRequest('threat_scan', { targets, options });
  }

  async requestBehaviorAnalysis(target: string, timeRange?: any, analysisType?: string): Promise<any> {
    return this.sendRequest('behavior_analysis', { target, timeRange, analysisType });
  }

  async requestNetworkMonitoring(targets: string[], options?: any): Promise<any> {
    return this.sendRequest('network_monitoring', { targets, options });
  }

  private async sendRequest(requestType: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = `${requestType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Set up response handler
      const timeout = setTimeout(() => {
        this.off('response', responseHandler);
        reject(new WebSocketClientError('Request timeout', 'TIMEOUT'));
      }, this.options.timeout);

      const responseHandler = (response: { id: string; data: any }) => {
        if (response.id === requestId) {
          clearTimeout(timeout);
          this.off('response', responseHandler);
          resolve(response.data);
        }
      };

      this.on('response', responseHandler);

      // Send request
      try {
        this.send({
          type: 'request',
          requestType,
          id: requestId,
          data,
        });
      } catch (error) {
        clearTimeout(timeout);
        this.off('response', responseHandler);
        reject(error);
      }
    });
  }

  // Connection status
  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  getConnectionInfo(): ConnectionInfo {
    return {
      connected: this.connected,
      url: this.url,
      readyState: this.ws?.readyState,
      reconnectAttempts: this.reconnectAttempts,
      lastConnected: this.lastConnected,
      lastError: this.lastError,
      filters: this.options.filters,
    };
  }

  // Cleanup
  disconnect(): void {
    this.options.autoReconnect = false; // Prevent reconnection
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.connected = false;
    this.emit('disconnected', { code: 1000, reason: 'Client disconnect', wasClean: true });
  }

  cleanup(): void {
    this.disconnect();
    this.removeAllListeners();
  }
}

// Export factory function
export function createWebSocketClient(options?: WebSocketClientOptions): WebSocketClient {
  return new WebSocketClient(options);
}