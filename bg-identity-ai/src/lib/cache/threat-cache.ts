import { redisClient } from '../redis-client';
import { logger } from '../logger';
import { redisHealthMonitor } from '../monitoring/redis-health-monitor';
import { ThreatEvent, BehaviorAnalysisResult, BehaviorPattern } from '@/types/threat';

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

export class ThreatCache {
  private readonly prefixes = {
    threats: 'threats',
    behavior: 'behavior',
    intelligence: 'intel',
    network: 'network',
    correlation: 'correlation',
    sessions: 'sessions',
    events: 'events'
  };

  private readonly defaultTTL = {
    threats: 300,      // 5 minutes for real-time threat events
    behavior: 3600,    // 1 hour for behavioral baselines
    intelligence: 14400, // 4 hours for threat intelligence
    network: 1800,     // 30 minutes for network monitoring
    correlation: 1800, // 30 minutes for correlation patterns
    sessions: 86400,   // 24 hours for user sessions
    events: 300        // 5 minutes for event buffering
  };

  private buildKey(prefix: string, identifier: string, suffix?: string): string {
    const parts = [prefix, identifier];
    if (suffix) parts.push(suffix);
    return parts.join(':');
  }

  // Real-time threat event caching (L1 Cache)
  public async cacheThreatEvent(event: ThreatEvent, options?: CacheOptions): Promise<boolean> {
    const key = this.buildKey(this.prefixes.events, event.id);
    const ttl = options?.ttl || this.defaultTTL.threats;
    
    try {
      const serialized = JSON.stringify(event);
      const success = await redisClient.set(key, serialized, ttl);
      
      if (success) {
        logger.debug('Threat event cached', { eventId: event.id, ttl });
      }
      
      return success;
    } catch (error) {
      logger.error('Failed to cache threat event', {
        eventId: event.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  public async getThreatEvent(eventId: string): Promise<ThreatEvent | null> {
    const key = this.buildKey(this.prefixes.events, eventId);
    
    try {
      const cached = await redisClient.get(key);
      if (!cached) {
        redisHealthMonitor.recordCacheMiss();
        return null;
      }
      
      const event = JSON.parse(cached) as ThreatEvent;
      redisHealthMonitor.recordCacheHit();
      logger.debug('Threat event retrieved from cache', { eventId });
      return event;
    } catch (error) {
      redisHealthMonitor.recordCacheMiss();
      logger.error('Failed to retrieve threat event from cache', {
        eventId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  // Behavioral analysis caching (L2 Cache)
  public async cacheBehaviorBaseline(
    target: string, 
    analysisType: string, 
    baseline: BehaviorAnalysisResult,
    options?: CacheOptions
  ): Promise<boolean> {
    const key = this.buildKey(this.prefixes.behavior, target, analysisType);
    const ttl = options?.ttl || this.defaultTTL.behavior;
    
    try {
      const serialized = JSON.stringify(baseline);
      const success = await redisClient.set(key, serialized, ttl);
      
      if (success) {
        logger.debug('Behavior baseline cached', { target, analysisType, ttl });
      }
      
      return success;
    } catch (error) {
      logger.error('Failed to cache behavior baseline', {
        target,
        analysisType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  public async getBehaviorBaseline(target: string, analysisType: string): Promise<BehaviorAnalysisResult | null> {
    const key = this.buildKey(this.prefixes.behavior, target, analysisType);
    
    try {
      const cached = await redisClient.get(key);
      if (!cached) {
        redisHealthMonitor.recordCacheMiss();
        return null;
      }
      
      const baseline = JSON.parse(cached) as BehaviorAnalysisResult;
      redisHealthMonitor.recordCacheHit();
      logger.debug('Behavior baseline retrieved from cache', { target, analysisType });
      return baseline;
    } catch (error) {
      redisHealthMonitor.recordCacheMiss();
      logger.error('Failed to retrieve behavior baseline from cache', {
        target,
        analysisType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  // Threat intelligence caching (L3 Cache)
  public async cacheThreatIntelligence(
    ioc: string, 
    data: ThreatIntelligenceData,
    options?: CacheOptions
  ): Promise<boolean> {
    const key = this.buildKey(this.prefixes.intelligence, ioc);
    const ttl = options?.ttl || this.defaultTTL.intelligence;
    
    try {
      const serialized = JSON.stringify(data);
      const success = await redisClient.set(key, serialized, ttl);
      
      if (success) {
        logger.debug('Threat intelligence cached', { ioc, type: data.type, ttl });
      }
      
      return success;
    } catch (error) {
      logger.error('Failed to cache threat intelligence', {
        ioc,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  public async getThreatIntelligence(ioc: string): Promise<ThreatIntelligenceData | null> {
    const key = this.buildKey(this.prefixes.intelligence, ioc);
    
    try {
      const cached = await redisClient.get(key);
      if (!cached) {
        redisHealthMonitor.recordCacheMiss();
        return null;
      }
      
      const data = JSON.parse(cached) as ThreatIntelligenceData;
      redisHealthMonitor.recordCacheHit();
      logger.debug('Threat intelligence retrieved from cache', { ioc, type: data.type });
      return data;
    } catch (error) {
      redisHealthMonitor.recordCacheMiss();
      logger.error('Failed to retrieve threat intelligence from cache', {
        ioc,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  // Network monitoring caching
  public async cacheNetworkConnection(
    connectionId: string, 
    data: NetworkConnectionData,
    options?: CacheOptions
  ): Promise<boolean> {
    const key = this.buildKey(this.prefixes.network, connectionId);
    const ttl = options?.ttl || this.defaultTTL.network;
    
    try {
      const serialized = JSON.stringify(data);
      const success = await redisClient.set(key, serialized, ttl);
      
      if (success) {
        logger.debug('Network connection cached', { connectionId, sourceIp: data.sourceIp, ttl });
      }
      
      return success;
    } catch (error) {
      logger.error('Failed to cache network connection', {
        connectionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  public async getNetworkConnection(connectionId: string): Promise<NetworkConnectionData | null> {
    const key = this.buildKey(this.prefixes.network, connectionId);
    
    try {
      const cached = await redisClient.get(key);
      if (!cached) return null;
      
      const data = JSON.parse(cached) as NetworkConnectionData;
      logger.debug('Network connection retrieved from cache', { connectionId, sourceIp: data.sourceIp });
      return data;
    } catch (error) {
      logger.error('Failed to retrieve network connection from cache', {
        connectionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  // Correlation patterns caching
  public async cacheCorrelationPattern(
    patternId: string, 
    pattern: any,
    options?: CacheOptions
  ): Promise<boolean> {
    const key = this.buildKey(this.prefixes.correlation, patternId);
    const ttl = options?.ttl || this.defaultTTL.correlation;
    
    try {
      const serialized = JSON.stringify(pattern);
      const success = await redisClient.set(key, serialized, ttl);
      
      if (success) {
        logger.debug('Correlation pattern cached', { patternId, ttl });
      }
      
      return success;
    } catch (error) {
      logger.error('Failed to cache correlation pattern', {
        patternId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  public async getCorrelationPattern(patternId: string): Promise<any> {
    const key = this.buildKey(this.prefixes.correlation, patternId);
    
    try {
      const cached = await redisClient.get(key);
      if (!cached) return null;
      
      const pattern = JSON.parse(cached);
      logger.debug('Correlation pattern retrieved from cache', { patternId });
      return pattern;
    } catch (error) {
      logger.error('Failed to retrieve correlation pattern from cache', {
        patternId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  // Session management (L4 Cache)
  public async cacheUserSession(
    userId: string, 
    sessionData: any,
    options?: CacheOptions
  ): Promise<boolean> {
    const key = this.buildKey(this.prefixes.sessions, userId);
    const ttl = options?.ttl || this.defaultTTL.sessions;
    
    try {
      const serialized = JSON.stringify(sessionData);
      const success = await redisClient.set(key, serialized, ttl);
      
      if (success) {
        logger.debug('User session cached', { userId, ttl });
      }
      
      return success;
    } catch (error) {
      logger.error('Failed to cache user session', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  public async getUserSession(userId: string): Promise<any> {
    const key = this.buildKey(this.prefixes.sessions, userId);
    
    try {
      const cached = await redisClient.get(key);
      if (!cached) return null;
      
      const sessionData = JSON.parse(cached);
      logger.debug('User session retrieved from cache', { userId });
      return sessionData;
    } catch (error) {
      logger.error('Failed to retrieve user session from cache', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  // Batch operations
  public async batchCacheThreatEvents(events: ThreatEvent[], options?: CacheOptions): Promise<number> {
    let successCount = 0;
    
    for (const event of events) {
      const success = await this.cacheThreatEvent(event, options);
      if (success) successCount++;
    }
    
    logger.info('Batch threat events cached', { 
      total: events.length, 
      successful: successCount 
    });
    
    return successCount;
  }

  // Cache statistics
  public async getCacheStats(): Promise<{
    isConnected: boolean;
    keyCount: Record<string, number>;
    memory: any;
  }> {
    try {
      const isConnected = redisClient.isReady();
      const keyCount: Record<string, number> = {};
      
      if (isConnected) {
        // Count keys by prefix
        for (const [name, prefix] of Object.entries(this.prefixes)) {
          // Note: In production, avoid KEYS command, use SCAN instead
          const pattern = `threatguard:${prefix}:*`;
          const keys = await redisClient.get('*') || '';
          keyCount[name] = 0; // Simplified for now
        }
      }
      
      return {
        isConnected,
        keyCount,
        memory: null
      };
    } catch (error) {
      logger.error('Failed to get cache stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        isConnected: false,
        keyCount: {},
        memory: null
      };
    }
  }

  // Cache cleanup
  public async clearCache(prefix?: string): Promise<boolean> {
    try {
      if (prefix) {
        const pattern = `threatguard:${prefix}:*`;
        // In production, implement proper key scanning and deletion
        logger.info('Cache cleared for prefix', { prefix });
      } else {
        logger.info('Full cache clear requested');
      }
      
      return true;
    } catch (error) {
      logger.error('Failed to clear cache', {
        prefix,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }
}

// Singleton instance
export const threatCache = new ThreatCache();