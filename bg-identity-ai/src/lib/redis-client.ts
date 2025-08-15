import Redis, { Redis as RedisType } from 'ioredis';
import { logger } from './logger';

export interface RedisConfig {
  host: string;
  port: number;
  db: number;
  password?: string;
  retryDelayOnClusterDown: number;
  enableReadyCheck: boolean;
  maxRetriesPerRequest: number;
  lazyConnect: boolean;
  keepAlive: number;
  family: number;
  keyPrefix: string;
}

export class RedisClient {
  private client: RedisType | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelay = 2000;

  constructor(private config?: Partial<RedisConfig>) {
    this.initialize();
  }

  private getRedisConfig(): RedisConfig {
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      db: parseInt(process.env.REDIS_DB || '0', 10),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnClusterDown: 100,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 1000,
      family: 4,
      keyPrefix: 'threatguard:',
      ...this.config
    };
  }

  private initialize(): void {
    try {
      const config = this.getRedisConfig();
      
      this.client = new Redis({
        host: config.host,
        port: config.port,
        db: config.db,
        password: config.password,
        enableReadyCheck: config.enableReadyCheck,
        maxRetriesPerRequest: config.maxRetriesPerRequest,
        lazyConnect: config.lazyConnect,
        keepAlive: config.keepAlive,
        family: config.family,
        keyPrefix: config.keyPrefix,
      });

      this.setupEventHandlers();
      
      // Attempt initial connection
      this.connect();
      
    } catch (error) {
      logger.error('Failed to initialize Redis client', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      this.client = null;
    }
  }

  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      logger.info('Redis client connected', {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || '6379',
        db: process.env.REDIS_DB || '0'
      });
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready for operations');
    });

    this.client.on('error', (error) => {
      this.isConnected = false;
      logger.error('Redis connection error', {
        error: error.message,
        stack: error.stack,
        reconnectAttempts: this.reconnectAttempts
      });
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis connection closed');
      this.handleReconnect();
    });

    this.client.on('reconnecting', (delay: number) => {
      logger.info('Redis client reconnecting', { delay });
    });
  }

  private async connect(): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reconnectAttempts: this.reconnectAttempts
      });
      this.handleReconnect();
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max Redis reconnect attempts reached', {
        maxAttempts: this.maxReconnectAttempts
      });
      return;
    }

    this.reconnectAttempts++;
    
    setTimeout(() => {
      logger.info('Attempting Redis reconnection', {
        attempt: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts
      });
      this.connect();
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  // Public API methods
  public isReady(): boolean {
    return this.isConnected && this.client?.status === 'ready';
  }

  public async get(key: string): Promise<string | null> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping GET operation', { key });
      return null;
    }

    try {
      const result = await this.client!.get(key);
      logger.debug('Redis GET operation', { key, hasValue: !!result });
      return result;
    } catch (error) {
      logger.error('Redis GET operation failed', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  public async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping SET operation', { key });
      return false;
    }

    try {
      let result;
      if (ttlSeconds) {
        result = await this.client!.setex(key, ttlSeconds, value);
      } else {
        result = await this.client!.set(key, value);
      }
      
      const success = result === 'OK';
      logger.debug('Redis SET operation', { key, ttl: ttlSeconds, success });
      return success;
    } catch (error) {
      logger.error('Redis SET operation failed', {
        key,
        ttl: ttlSeconds,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  public async del(key: string | string[]): Promise<number> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping DEL operation', { key });
      return 0;
    }

    try {
      const result = Array.isArray(key) 
        ? await this.client!.del(...key)
        : await this.client!.del(key);
      logger.debug('Redis DEL operation', { key, deletedCount: result });
      return result;
    } catch (error) {
      logger.error('Redis DEL operation failed', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }

  public async exists(key: string): Promise<boolean> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping EXISTS operation', { key });
      return false;
    }

    try {
      const result = await this.client!.exists(key);
      logger.debug('Redis EXISTS operation', { key, exists: result === 1 });
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS operation failed', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  public async hget(hash: string, field: string): Promise<string | null> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping HGET operation', { hash, field });
      return null;
    }

    try {
      const result = await this.client!.hget(hash, field);
      logger.debug('Redis HGET operation', { hash, field, hasValue: !!result });
      return result;
    } catch (error) {
      logger.error('Redis HGET operation failed', {
        hash,
        field,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  public async hset(hash: string, field: string, value: string): Promise<boolean> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping HSET operation', { hash, field });
      return false;
    }

    try {
      const result = await this.client!.hset(hash, field, value);
      logger.debug('Redis HSET operation', { hash, field, result });
      return result === 1;
    } catch (error) {
      logger.error('Redis HSET operation failed', {
        hash,
        field,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  public async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping EXPIRE operation', { key, seconds });
      return false;
    }

    try {
      const result = await this.client!.expire(key, seconds);
      logger.debug('Redis EXPIRE operation', { key, seconds, success: result === 1 });
      return result === 1;
    } catch (error) {
      logger.error('Redis EXPIRE operation failed', {
        key,
        seconds,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  // Pub/Sub methods for WebSocket integration
  public async publish(channel: string, message: string): Promise<number> {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping PUBLISH operation', { channel });
      return 0;
    }

    try {
      const result = await this.client!.publish(channel, message);
      logger.debug('Redis PUBLISH operation', { channel, subscriberCount: result });
      return result;
    } catch (error) {
      logger.error('Redis PUBLISH operation failed', {
        channel,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }

  public createSubscriber(): RedisType | null {
    if (!this.isReady()) {
      logger.warn('Redis not ready, cannot create subscriber');
      return null;
    }

    try {
      const config = this.getRedisConfig();
      const subscriber = new Redis({
        host: config.host,
        port: config.port,
        db: config.db,
        password: config.password,
        lazyConnect: true
      });

      logger.info('Redis subscriber created');
      return subscriber;
    } catch (error) {
      logger.error('Failed to create Redis subscriber', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  // Health check
  public async ping(): Promise<boolean> {
    if (!this.client) return false;

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis ping failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  // Cleanup
  public async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.disconnect();
        logger.info('Redis client disconnected');
      } catch (error) {
        logger.error('Error during Redis disconnect', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      this.client = null;
    }
    this.isConnected = false;
  }
}

// Singleton instance
export const redisClient = new RedisClient();