import { Redis as RedisType } from 'ioredis';
export interface RedisConfig {
    host: string;
    port: number;
    db: number;
    retryDelayOnClusterDown: number;
    enableReadyCheck: boolean;
    maxRetriesPerRequest: number;
    lazyConnect: boolean;
    keepAlive: number;
    family: number;
    keyPrefix: string;
}
export declare class RedisClient {
    private config?;
    private client;
    private isConnected;
    private reconnectAttempts;
    private readonly maxReconnectAttempts;
    private readonly reconnectDelay;
    constructor(config?: Partial<RedisConfig> | undefined);
    private getRedisConfig;
    private initialize;
    private setupEventHandlers;
    private connect;
    private handleReconnect;
    isReady(): boolean;
    get(key: string): Promise<string | null>;
    set(key: string, value: string, ttlSeconds?: number): Promise<boolean>;
    del(key: string | string[]): Promise<number>;
    exists(key: string): Promise<boolean>;
    hget(hash: string, field: string): Promise<string | null>;
    hset(hash: string, field: string, value: string): Promise<boolean>;
    expire(key: string, seconds: number): Promise<boolean>;
    publish(channel: string, message: string): Promise<number>;
    createSubscriber(): RedisType | null;
    ping(): Promise<boolean>;
    disconnect(): Promise<void>;
}
export declare const redisClient: RedisClient;
//# sourceMappingURL=redis-client.d.ts.map