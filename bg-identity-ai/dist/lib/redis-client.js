"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisClient = exports.RedisClient = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("./logger");
class RedisClient {
    config;
    client = null;
    isConnected = false;
    reconnectAttempts = 0;
    maxReconnectAttempts = 10;
    reconnectDelay = 2000;
    constructor(config) {
        this.config = config;
        this.initialize();
    }
    getRedisConfig() {
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
    initialize() {
        try {
            const config = this.getRedisConfig();
            this.client = new ioredis_1.default({
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
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize Redis client', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            this.client = null;
        }
    }
    setupEventHandlers() {
        if (!this.client)
            return;
        this.client.on('connect', () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            logger_1.logger.info('Redis client connected', {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || '6379',
                db: process.env.REDIS_DB || '0'
            });
        });
        this.client.on('ready', () => {
            logger_1.logger.info('Redis client ready for operations');
        });
        this.client.on('error', (error) => {
            this.isConnected = false;
            logger_1.logger.error('Redis connection error', {
                error: error.message,
                stack: error.stack,
                reconnectAttempts: this.reconnectAttempts
            });
        });
        this.client.on('close', () => {
            this.isConnected = false;
            logger_1.logger.warn('Redis connection closed');
            this.handleReconnect();
        });
        this.client.on('reconnecting', (delay) => {
            logger_1.logger.info('Redis client reconnecting', { delay });
        });
    }
    async connect() {
        if (!this.client)
            return;
        try {
            await this.client.connect();
        }
        catch (error) {
            logger_1.logger.error('Failed to connect to Redis', {
                error: error instanceof Error ? error.message : 'Unknown error',
                reconnectAttempts: this.reconnectAttempts
            });
            this.handleReconnect();
        }
    }
    handleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger_1.logger.error('Max Redis reconnect attempts reached', {
                maxAttempts: this.maxReconnectAttempts
            });
            return;
        }
        this.reconnectAttempts++;
        setTimeout(() => {
            logger_1.logger.info('Attempting Redis reconnection', {
                attempt: this.reconnectAttempts,
                maxAttempts: this.maxReconnectAttempts
            });
            this.connect();
        }, this.reconnectDelay * this.reconnectAttempts);
    }
    // Public API methods
    isReady() {
        return this.isConnected && this.client?.status === 'ready';
    }
    async get(key) {
        if (!this.isReady()) {
            logger_1.logger.warn('Redis not ready, skipping GET operation', { key });
            return null;
        }
        try {
            const result = await this.client.get(key);
            logger_1.logger.debug('Redis GET operation', { key, hasValue: !!result });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Redis GET operation failed', {
                key,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }
    async set(key, value, ttlSeconds) {
        if (!this.isReady()) {
            logger_1.logger.warn('Redis not ready, skipping SET operation', { key });
            return false;
        }
        try {
            let result;
            if (ttlSeconds) {
                result = await this.client.setex(key, ttlSeconds, value);
            }
            else {
                result = await this.client.set(key, value);
            }
            const success = result === 'OK';
            logger_1.logger.debug('Redis SET operation', { key, ttl: ttlSeconds, success });
            return success;
        }
        catch (error) {
            logger_1.logger.error('Redis SET operation failed', {
                key,
                ttl: ttlSeconds,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
    async del(key) {
        if (!this.isReady()) {
            logger_1.logger.warn('Redis not ready, skipping DEL operation', { key });
            return 0;
        }
        try {
            const result = Array.isArray(key)
                ? await this.client.del(...key)
                : await this.client.del(key);
            logger_1.logger.debug('Redis DEL operation', { key, deletedCount: result });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Redis DEL operation failed', {
                key,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return 0;
        }
    }
    async exists(key) {
        if (!this.isReady()) {
            logger_1.logger.warn('Redis not ready, skipping EXISTS operation', { key });
            return false;
        }
        try {
            const result = await this.client.exists(key);
            logger_1.logger.debug('Redis EXISTS operation', { key, exists: result === 1 });
            return result === 1;
        }
        catch (error) {
            logger_1.logger.error('Redis EXISTS operation failed', {
                key,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
    async hget(hash, field) {
        if (!this.isReady()) {
            logger_1.logger.warn('Redis not ready, skipping HGET operation', { hash, field });
            return null;
        }
        try {
            const result = await this.client.hget(hash, field);
            logger_1.logger.debug('Redis HGET operation', { hash, field, hasValue: !!result });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Redis HGET operation failed', {
                hash,
                field,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }
    async hset(hash, field, value) {
        if (!this.isReady()) {
            logger_1.logger.warn('Redis not ready, skipping HSET operation', { hash, field });
            return false;
        }
        try {
            const result = await this.client.hset(hash, field, value);
            logger_1.logger.debug('Redis HSET operation', { hash, field, result });
            return result === 1;
        }
        catch (error) {
            logger_1.logger.error('Redis HSET operation failed', {
                hash,
                field,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
    async expire(key, seconds) {
        if (!this.isReady()) {
            logger_1.logger.warn('Redis not ready, skipping EXPIRE operation', { key, seconds });
            return false;
        }
        try {
            const result = await this.client.expire(key, seconds);
            logger_1.logger.debug('Redis EXPIRE operation', { key, seconds, success: result === 1 });
            return result === 1;
        }
        catch (error) {
            logger_1.logger.error('Redis EXPIRE operation failed', {
                key,
                seconds,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
    // Pub/Sub methods for WebSocket integration
    async publish(channel, message) {
        if (!this.isReady()) {
            logger_1.logger.warn('Redis not ready, skipping PUBLISH operation', { channel });
            return 0;
        }
        try {
            const result = await this.client.publish(channel, message);
            logger_1.logger.debug('Redis PUBLISH operation', { channel, subscriberCount: result });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Redis PUBLISH operation failed', {
                channel,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return 0;
        }
    }
    createSubscriber() {
        if (!this.isReady()) {
            logger_1.logger.warn('Redis not ready, cannot create subscriber');
            return null;
        }
        try {
            const config = this.getRedisConfig();
            const subscriber = new ioredis_1.default({
                host: config.host,
                port: config.port,
                db: config.db,
                password: config.password,
                lazyConnect: true
            });
            logger_1.logger.info('Redis subscriber created');
            return subscriber;
        }
        catch (error) {
            logger_1.logger.error('Failed to create Redis subscriber', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }
    // Health check
    async ping() {
        if (!this.client)
            return false;
        try {
            const result = await this.client.ping();
            return result === 'PONG';
        }
        catch (error) {
            logger_1.logger.error('Redis ping failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
    // Cleanup
    async disconnect() {
        if (this.client) {
            try {
                await this.client.disconnect();
                logger_1.logger.info('Redis client disconnected');
            }
            catch (error) {
                logger_1.logger.error('Error during Redis disconnect', {
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
            this.client = null;
        }
        this.isConnected = false;
    }
}
exports.RedisClient = RedisClient;
// Singleton instance
exports.redisClient = new RedisClient();
//# sourceMappingURL=redis-client.js.map