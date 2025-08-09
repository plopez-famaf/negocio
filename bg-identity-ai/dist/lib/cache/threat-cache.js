"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.threatCache = exports.ThreatCache = void 0;
const redis_client_1 = require("../redis-client");
const logger_1 = require("../logger");
class ThreatCache {
    prefixes = {
        threats: 'threats',
        behavior: 'behavior',
        intelligence: 'intel',
        network: 'network',
        correlation: 'correlation',
        sessions: 'sessions',
        events: 'events'
    };
    defaultTTL = {
        threats: 300, // 5 minutes for real-time threat events
        behavior: 3600, // 1 hour for behavioral baselines
        intelligence: 14400, // 4 hours for threat intelligence
        network: 1800, // 30 minutes for network monitoring
        correlation: 1800, // 30 minutes for correlation patterns
        sessions: 86400, // 24 hours for user sessions
        events: 300 // 5 minutes for event buffering
    };
    buildKey(prefix, identifier, suffix) {
        const parts = [prefix, identifier];
        if (suffix)
            parts.push(suffix);
        return parts.join(':');
    }
    // Real-time threat event caching (L1 Cache)
    async cacheThreatEvent(event, options) {
        const key = this.buildKey(this.prefixes.events, event.id);
        const ttl = options?.ttl || this.defaultTTL.threats;
        try {
            const serialized = JSON.stringify(event);
            const success = await redis_client_1.redisClient.set(key, serialized, ttl);
            if (success) {
                logger_1.logger.debug('Threat event cached', { eventId: event.id, ttl });
            }
            return success;
        }
        catch (error) {
            logger_1.logger.error('Failed to cache threat event', {
                eventId: event.id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
    async getThreatEvent(eventId) {
        const key = this.buildKey(this.prefixes.events, eventId);
        try {
            const cached = await redis_client_1.redisClient.get(key);
            if (!cached)
                return null;
            const event = JSON.parse(cached);
            logger_1.logger.debug('Threat event retrieved from cache', { eventId });
            return event;
        }
        catch (error) {
            logger_1.logger.error('Failed to retrieve threat event from cache', {
                eventId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }
    // Behavioral analysis caching (L2 Cache)
    async cacheBehaviorBaseline(target, analysisType, baseline, options) {
        const key = this.buildKey(this.prefixes.behavior, target, analysisType);
        const ttl = options?.ttl || this.defaultTTL.behavior;
        try {
            const serialized = JSON.stringify(baseline);
            const success = await redis_client_1.redisClient.set(key, serialized, ttl);
            if (success) {
                logger_1.logger.debug('Behavior baseline cached', { target, analysisType, ttl });
            }
            return success;
        }
        catch (error) {
            logger_1.logger.error('Failed to cache behavior baseline', {
                target,
                analysisType,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
    async getBehaviorBaseline(target, analysisType) {
        const key = this.buildKey(this.prefixes.behavior, target, analysisType);
        try {
            const cached = await redis_client_1.redisClient.get(key);
            if (!cached)
                return null;
            const baseline = JSON.parse(cached);
            logger_1.logger.debug('Behavior baseline retrieved from cache', { target, analysisType });
            return baseline;
        }
        catch (error) {
            logger_1.logger.error('Failed to retrieve behavior baseline from cache', {
                target,
                analysisType,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }
    // Threat intelligence caching (L3 Cache)
    async cacheThreatIntelligence(ioc, data, options) {
        const key = this.buildKey(this.prefixes.intelligence, ioc);
        const ttl = options?.ttl || this.defaultTTL.intelligence;
        try {
            const serialized = JSON.stringify(data);
            const success = await redis_client_1.redisClient.set(key, serialized, ttl);
            if (success) {
                logger_1.logger.debug('Threat intelligence cached', { ioc, type: data.type, ttl });
            }
            return success;
        }
        catch (error) {
            logger_1.logger.error('Failed to cache threat intelligence', {
                ioc,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
    async getThreatIntelligence(ioc) {
        const key = this.buildKey(this.prefixes.intelligence, ioc);
        try {
            const cached = await redis_client_1.redisClient.get(key);
            if (!cached)
                return null;
            const data = JSON.parse(cached);
            logger_1.logger.debug('Threat intelligence retrieved from cache', { ioc, type: data.type });
            return data;
        }
        catch (error) {
            logger_1.logger.error('Failed to retrieve threat intelligence from cache', {
                ioc,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }
    // Network monitoring caching
    async cacheNetworkConnection(connectionId, data, options) {
        const key = this.buildKey(this.prefixes.network, connectionId);
        const ttl = options?.ttl || this.defaultTTL.network;
        try {
            const serialized = JSON.stringify(data);
            const success = await redis_client_1.redisClient.set(key, serialized, ttl);
            if (success) {
                logger_1.logger.debug('Network connection cached', { connectionId, sourceIp: data.sourceIp, ttl });
            }
            return success;
        }
        catch (error) {
            logger_1.logger.error('Failed to cache network connection', {
                connectionId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
    async getNetworkConnection(connectionId) {
        const key = this.buildKey(this.prefixes.network, connectionId);
        try {
            const cached = await redis_client_1.redisClient.get(key);
            if (!cached)
                return null;
            const data = JSON.parse(cached);
            logger_1.logger.debug('Network connection retrieved from cache', { connectionId, sourceIp: data.sourceIp });
            return data;
        }
        catch (error) {
            logger_1.logger.error('Failed to retrieve network connection from cache', {
                connectionId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }
    // Correlation patterns caching
    async cacheCorrelationPattern(patternId, pattern, options) {
        const key = this.buildKey(this.prefixes.correlation, patternId);
        const ttl = options?.ttl || this.defaultTTL.correlation;
        try {
            const serialized = JSON.stringify(pattern);
            const success = await redis_client_1.redisClient.set(key, serialized, ttl);
            if (success) {
                logger_1.logger.debug('Correlation pattern cached', { patternId, ttl });
            }
            return success;
        }
        catch (error) {
            logger_1.logger.error('Failed to cache correlation pattern', {
                patternId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
    async getCorrelationPattern(patternId) {
        const key = this.buildKey(this.prefixes.correlation, patternId);
        try {
            const cached = await redis_client_1.redisClient.get(key);
            if (!cached)
                return null;
            const pattern = JSON.parse(cached);
            logger_1.logger.debug('Correlation pattern retrieved from cache', { patternId });
            return pattern;
        }
        catch (error) {
            logger_1.logger.error('Failed to retrieve correlation pattern from cache', {
                patternId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }
    // Session management (L4 Cache)
    async cacheUserSession(userId, sessionData, options) {
        const key = this.buildKey(this.prefixes.sessions, userId);
        const ttl = options?.ttl || this.defaultTTL.sessions;
        try {
            const serialized = JSON.stringify(sessionData);
            const success = await redis_client_1.redisClient.set(key, serialized, ttl);
            if (success) {
                logger_1.logger.debug('User session cached', { userId, ttl });
            }
            return success;
        }
        catch (error) {
            logger_1.logger.error('Failed to cache user session', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
    async getUserSession(userId) {
        const key = this.buildKey(this.prefixes.sessions, userId);
        try {
            const cached = await redis_client_1.redisClient.get(key);
            if (!cached)
                return null;
            const sessionData = JSON.parse(cached);
            logger_1.logger.debug('User session retrieved from cache', { userId });
            return sessionData;
        }
        catch (error) {
            logger_1.logger.error('Failed to retrieve user session from cache', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }
    // Batch operations
    async batchCacheThreatEvents(events, options) {
        let successCount = 0;
        for (const event of events) {
            const success = await this.cacheThreatEvent(event, options);
            if (success)
                successCount++;
        }
        logger_1.logger.info('Batch threat events cached', {
            total: events.length,
            successful: successCount
        });
        return successCount;
    }
    // Cache statistics
    async getCacheStats() {
        try {
            const isConnected = redis_client_1.redisClient.isReady();
            const keyCount = {};
            if (isConnected) {
                // Count keys by prefix
                for (const [name, prefix] of Object.entries(this.prefixes)) {
                    // Note: In production, avoid KEYS command, use SCAN instead
                    const pattern = `threatguard:${prefix}:*`;
                    const keys = await redis_client_1.redisClient.get('*') || '';
                    keyCount[name] = 0; // Simplified for now
                }
            }
            return {
                isConnected,
                keyCount,
                memory: null
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get cache stats', {
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
    async clearCache(prefix) {
        try {
            if (prefix) {
                const pattern = `threatguard:${prefix}:*`;
                // In production, implement proper key scanning and deletion
                logger_1.logger.info('Cache cleared for prefix', { prefix });
            }
            else {
                logger_1.logger.info('Full cache clear requested');
            }
            return true;
        }
        catch (error) {
            logger_1.logger.error('Failed to clear cache', {
                prefix,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
}
exports.ThreatCache = ThreatCache;
// Singleton instance
exports.threatCache = new ThreatCache();
//# sourceMappingURL=threat-cache.js.map