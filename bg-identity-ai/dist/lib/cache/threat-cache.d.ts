import { ThreatEvent, BehaviorAnalysisResult } from '@/types/threat';
export interface CacheOptions {
    ttl?: number;
    useCompression?: boolean;
    keyPrefix?: string;
}
export interface ThreatIntelligenceData {
    ioc: string;
    type: 'ip' | 'domain' | 'hash' | 'url' | 'email';
    reputation: number;
    sources: string[];
    lastSeen: string;
    categories: string[];
    confidence: number;
}
export interface NetworkConnectionData {
    sourceIp: string;
    destinationIp: string;
    port: number;
    protocol: string;
    timestamp: string;
    bytes: number;
    packets: number;
    flags: string[];
}
export declare class ThreatCache {
    private readonly prefixes;
    private readonly defaultTTL;
    private buildKey;
    cacheThreatEvent(event: ThreatEvent, options?: CacheOptions): Promise<boolean>;
    getThreatEvent(eventId: string): Promise<ThreatEvent | null>;
    cacheBehaviorBaseline(target: string, analysisType: string, baseline: BehaviorAnalysisResult, options?: CacheOptions): Promise<boolean>;
    getBehaviorBaseline(target: string, analysisType: string): Promise<BehaviorAnalysisResult | null>;
    cacheThreatIntelligence(ioc: string, data: ThreatIntelligenceData, options?: CacheOptions): Promise<boolean>;
    getThreatIntelligence(ioc: string): Promise<ThreatIntelligenceData | null>;
    cacheNetworkConnection(connectionId: string, data: NetworkConnectionData, options?: CacheOptions): Promise<boolean>;
    getNetworkConnection(connectionId: string): Promise<NetworkConnectionData | null>;
    cacheCorrelationPattern(patternId: string, pattern: any, options?: CacheOptions): Promise<boolean>;
    getCorrelationPattern(patternId: string): Promise<any>;
    cacheUserSession(userId: string, sessionData: any, options?: CacheOptions): Promise<boolean>;
    getUserSession(userId: string): Promise<any>;
    batchCacheThreatEvents(events: ThreatEvent[], options?: CacheOptions): Promise<number>;
    getCacheStats(): Promise<{
        isConnected: boolean;
        keyCount: Record<string, number>;
        memory: any;
    }>;
    clearCache(prefix?: string): Promise<boolean>;
}
export declare const threatCache: ThreatCache;
//# sourceMappingURL=threat-cache.d.ts.map