import { logger } from '@/lib/logger';

export interface ClientCapacityMetrics {
  clientId: string;
  connectionLatency: number;
  messageProcessingRate: number; // messages per second
  errorRate: number; // percentage
  queueDepth: number;
  lastActivityTime: number;
  clientType: 'cli' | 'web' | 'api' | 'mobile';
  bandwidthEstimate: number; // bytes per second
}

export interface ThrottleRecommendation {
  clientId: string;
  recommendedRate: number; // events per second
  throttleLevel: 'none' | 'light' | 'moderate' | 'heavy' | 'critical';
  reason: string;
  adjustmentFactor: number;
  timeToRecheck: number; // milliseconds
}

export interface ThrottleConfiguration {
  maxEventsPerSecond: number;
  adaptiveEnabled: boolean;
  windowSizeMs: number;
  latencyThresholds: {
    light: number;    // 200ms
    moderate: number; // 500ms
    heavy: number;    // 1000ms
    critical: number; // 2000ms
  };
  errorRateThresholds: {
    light: number;    // 2%
    moderate: number; // 5%
    heavy: number;    // 10%
    critical: number; // 20%
  };
  queueDepthThresholds: {
    light: number;    // 10 messages
    moderate: number; // 25 messages
    heavy: number;    // 50 messages
    critical: number; // 100 messages
  };
}

export class AdaptiveThrottlingService {
  private clientMetrics: Map<string, ClientCapacityMetrics> = new Map();
  private throttleRecommendations: Map<string, ThrottleRecommendation> = new Map();
  private config: ThrottleConfiguration;
  private monitoringInterval?: NodeJS.Timeout;
  private metricsWindow: Map<string, Array<{ timestamp: number; metrics: ClientCapacityMetrics }>> = new Map();

  constructor(config?: Partial<ThrottleConfiguration>) {
    this.config = {
      maxEventsPerSecond: 1000,
      adaptiveEnabled: true,
      windowSizeMs: 30000, // 30 seconds
      latencyThresholds: {
        light: 200,
        moderate: 500,
        heavy: 1000,
        critical: 2000
      },
      errorRateThresholds: {
        light: 2,
        moderate: 5,
        heavy: 10,
        critical: 20
      },
      queueDepthThresholds: {
        light: 10,
        moderate: 25,
        heavy: 50,
        critical: 100
      },
      ...config
    };

    this.startMonitoring();
    logger.info('Adaptive Throttling Service initialized', {
      config: this.config,
      features: [
        'capacity_monitoring',
        'latency_adaptation',
        'queue_depth_tracking',
        'error_rate_analysis',
        'bandwidth_estimation'
      ]
    });
  }

  /**
   * Update client capacity metrics
   */
  updateClientMetrics(clientId: string, metrics: Partial<ClientCapacityMetrics>): void {
    const currentMetrics = this.clientMetrics.get(clientId) || {
      clientId,
      connectionLatency: 0,
      messageProcessingRate: 0,
      errorRate: 0,
      queueDepth: 0,
      lastActivityTime: Date.now(),
      clientType: 'cli',
      bandwidthEstimate: 0
    };

    const updatedMetrics = {
      ...currentMetrics,
      ...metrics,
      lastActivityTime: Date.now()
    };

    this.clientMetrics.set(clientId, updatedMetrics);
    this.addToMetricsWindow(clientId, updatedMetrics);

    // Recalculate throttle recommendation
    if (this.config.adaptiveEnabled) {
      const recommendation = this.calculateThrottleRecommendation(clientId);
      this.throttleRecommendations.set(clientId, recommendation);

      logger.debug('Client metrics updated', {
        clientId,
        metrics: updatedMetrics,
        recommendation: {
          throttleLevel: recommendation.throttleLevel,
          recommendedRate: recommendation.recommendedRate,
          reason: recommendation.reason
        }
      });
    }
  }

  /**
   * Get throttle recommendation for a client
   */
  getThrottleRecommendation(clientId: string): ThrottleRecommendation {
    const existing = this.throttleRecommendations.get(clientId);
    if (existing && (Date.now() - existing.timeToRecheck) < existing.timeToRecheck) {
      return existing;
    }

    // Calculate new recommendation
    const recommendation = this.calculateThrottleRecommendation(clientId);
    this.throttleRecommendations.set(clientId, recommendation);
    return recommendation;
  }

  /**
   * Calculate throttle recommendation based on client capacity
   */
  private calculateThrottleRecommendation(clientId: string): ThrottleRecommendation {
    const metrics = this.clientMetrics.get(clientId);
    if (!metrics) {
      return {
        clientId,
        recommendedRate: this.config.maxEventsPerSecond,
        throttleLevel: 'none',
        reason: 'No metrics available',
        adjustmentFactor: 1.0,
        timeToRecheck: 30000
      };
    }

    const windowMetrics = this.getMetricsWindow(clientId);
    const averageLatency = this.calculateAverageLatency(windowMetrics);
    const averageErrorRate = this.calculateAverageErrorRate(windowMetrics);
    const currentQueueDepth = metrics.queueDepth;

    // Determine throttle level based on thresholds
    const throttleLevel = this.determineThrottleLevel(averageLatency, averageErrorRate, currentQueueDepth);
    const adjustmentFactor = this.calculateAdjustmentFactor(throttleLevel, metrics.clientType);
    const recommendedRate = Math.max(1, Math.floor(this.config.maxEventsPerSecond * adjustmentFactor));

    const reason = this.generateThrottleReason(throttleLevel, {
      latency: averageLatency,
      errorRate: averageErrorRate,
      queueDepth: currentQueueDepth,
      clientType: metrics.clientType
    });

    return {
      clientId,
      recommendedRate,
      throttleLevel,
      reason,
      adjustmentFactor,
      timeToRecheck: this.calculateRecheckTime(throttleLevel)
    };
  }

  /**
   * Determine throttle level based on metrics
   */
  private determineThrottleLevel(
    latency: number,
    errorRate: number,
    queueDepth: number
  ): ThrottleRecommendation['throttleLevel'] {
    // Critical conditions take precedence
    if (
      latency >= this.config.latencyThresholds.critical ||
      errorRate >= this.config.errorRateThresholds.critical ||
      queueDepth >= this.config.queueDepthThresholds.critical
    ) {
      return 'critical';
    }

    // Heavy throttling
    if (
      latency >= this.config.latencyThresholds.heavy ||
      errorRate >= this.config.errorRateThresholds.heavy ||
      queueDepth >= this.config.queueDepthThresholds.heavy
    ) {
      return 'heavy';
    }

    // Moderate throttling
    if (
      latency >= this.config.latencyThresholds.moderate ||
      errorRate >= this.config.errorRateThresholds.moderate ||
      queueDepth >= this.config.queueDepthThresholds.moderate
    ) {
      return 'moderate';
    }

    // Light throttling
    if (
      latency >= this.config.latencyThresholds.light ||
      errorRate >= this.config.errorRateThresholds.light ||
      queueDepth >= this.config.queueDepthThresholds.light
    ) {
      return 'light';
    }

    return 'none';
  }

  /**
   * Calculate adjustment factor based on throttle level and client type
   */
  private calculateAdjustmentFactor(
    throttleLevel: ThrottleRecommendation['throttleLevel'],
    clientType: ClientCapacityMetrics['clientType']
  ): number {
    const baseAdjustments = {
      'none': 1.0,
      'light': 0.8,
      'moderate': 0.6,
      'heavy': 0.4,
      'critical': 0.2
    };

    const clientTypeMultipliers = {
      'cli': 1.2,      // CLI clients can typically handle more
      'web': 1.0,      // Web clients are baseline
      'api': 1.5,      // API clients can handle the most
      'mobile': 0.7    // Mobile clients need reduced rates
    };

    return baseAdjustments[throttleLevel] * clientTypeMultipliers[clientType];
  }

  /**
   * Add metrics to sliding window
   */
  private addToMetricsWindow(clientId: string, metrics: ClientCapacityMetrics): void {
    if (!this.metricsWindow.has(clientId)) {
      this.metricsWindow.set(clientId, []);
    }

    const window = this.metricsWindow.get(clientId)!;
    const now = Date.now();
    
    window.push({ timestamp: now, metrics });

    // Remove old entries outside the window
    const cutoffTime = now - this.config.windowSizeMs;
    const filteredWindow = window.filter(entry => entry.timestamp >= cutoffTime);
    this.metricsWindow.set(clientId, filteredWindow);
  }

  /**
   * Get metrics window for client
   */
  private getMetricsWindow(clientId: string): Array<{ timestamp: number; metrics: ClientCapacityMetrics }> {
    return this.metricsWindow.get(clientId) || [];
  }

  /**
   * Calculate average latency from metrics window
   */
  private calculateAverageLatency(window: Array<{ timestamp: number; metrics: ClientCapacityMetrics }>): number {
    if (window.length === 0) return 0;
    
    const sum = window.reduce((acc, entry) => acc + entry.metrics.connectionLatency, 0);
    return sum / window.length;
  }

  /**
   * Calculate average error rate from metrics window
   */
  private calculateAverageErrorRate(window: Array<{ timestamp: number; metrics: ClientCapacityMetrics }>): number {
    if (window.length === 0) return 0;
    
    const sum = window.reduce((acc, entry) => acc + entry.metrics.errorRate, 0);
    return sum / window.length;
  }

  /**
   * Generate human-readable throttle reason
   */
  private generateThrottleReason(
    throttleLevel: ThrottleRecommendation['throttleLevel'],
    context: {
      latency: number;
      errorRate: number;
      queueDepth: number;
      clientType: ClientCapacityMetrics['clientType'];
    }
  ): string {
    if (throttleLevel === 'none') {
      return 'Client performing optimally, no throttling needed';
    }

    const reasons = [];

    if (context.latency >= this.config.latencyThresholds[throttleLevel]) {
      reasons.push(`high latency (${Math.round(context.latency)}ms)`);
    }

    if (context.errorRate >= this.config.errorRateThresholds[throttleLevel]) {
      reasons.push(`elevated error rate (${context.errorRate.toFixed(1)}%)`);
    }

    if (context.queueDepth >= this.config.queueDepthThresholds[throttleLevel]) {
      reasons.push(`queue depth exceeded (${context.queueDepth} messages)`);
    }

    const reasonText = reasons.join(', ');
    return `${throttleLevel.charAt(0).toUpperCase() + throttleLevel.slice(1)} throttling due to ${reasonText}`;
  }

  /**
   * Calculate recheck time based on throttle level
   */
  private calculateRecheckTime(throttleLevel: ThrottleRecommendation['throttleLevel']): number {
    const recheckTimes = {
      'none': 60000,      // 1 minute
      'light': 30000,     // 30 seconds
      'moderate': 15000,  // 15 seconds
      'heavy': 10000,     // 10 seconds
      'critical': 5000    // 5 seconds
    };

    return recheckTimes[throttleLevel];
  }

  /**
   * Start monitoring and cleanup
   */
  private startMonitoring(): void {
    // Clean up old metrics every 5 minutes
    this.monitoringInterval = setInterval(() => {
      this.cleanupOldMetrics();
      this.logSystemStats();
    }, 300000);
  }

  /**
   * Cleanup old client metrics
   */
  private cleanupOldMetrics(): void {
    const fiveMinutesAgo = Date.now() - 300000;
    let cleanedClients = 0;

    for (const [clientId, metrics] of this.clientMetrics) {
      if (metrics.lastActivityTime < fiveMinutesAgo) {
        this.clientMetrics.delete(clientId);
        this.throttleRecommendations.delete(clientId);
        this.metricsWindow.delete(clientId);
        cleanedClients++;
      }
    }

    if (cleanedClients > 0) {
      logger.debug('Cleaned up old client metrics', { cleanedClients });
    }
  }

  /**
   * Log system statistics
   */
  private logSystemStats(): void {
    const activeClients = this.clientMetrics.size;
    const throttledClients = Array.from(this.throttleRecommendations.values())
      .filter(rec => rec.throttleLevel !== 'none').length;

    const throttleLevelCounts = Array.from(this.throttleRecommendations.values())
      .reduce((acc, rec) => {
        acc[rec.throttleLevel] = (acc[rec.throttleLevel] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    logger.info('Adaptive throttling system status', {
      activeClients,
      throttledClients,
      throttleLevelCounts,
      avgRecommendedRate: activeClients > 0 ? 
        Array.from(this.throttleRecommendations.values())
          .reduce((sum, rec) => sum + rec.recommendedRate, 0) / activeClients : 0
    });
  }

  /**
   * Get system statistics
   */
  getSystemStats(): {
    activeClients: number;
    throttledClients: number;
    throttleLevelBreakdown: Record<string, number>;
    averageRecommendedRate: number;
    configuredMaxRate: number;
  } {
    const activeClients = this.clientMetrics.size;
    const recommendations = Array.from(this.throttleRecommendations.values());
    const throttledClients = recommendations.filter(rec => rec.throttleLevel !== 'none').length;

    const throttleLevelBreakdown = recommendations.reduce((acc, rec) => {
      acc[rec.throttleLevel] = (acc[rec.throttleLevel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const averageRecommendedRate = activeClients > 0 ? 
      recommendations.reduce((sum, rec) => sum + rec.recommendedRate, 0) / activeClients : 0;

    return {
      activeClients,
      throttledClients,
      throttleLevelBreakdown,
      averageRecommendedRate,
      configuredMaxRate: this.config.maxEventsPerSecond
    };
  }

  /**
   * Update throttling configuration
   */
  updateConfiguration(newConfig: Partial<ThrottleConfiguration>): void {
    this.config = { ...this.config, ...newConfig };
    
    logger.info('Adaptive throttling configuration updated', {
      newConfig,
      activeClients: this.clientMetrics.size
    });

    // Recalculate all recommendations with new config
    for (const clientId of this.clientMetrics.keys()) {
      const recommendation = this.calculateThrottleRecommendation(clientId);
      this.throttleRecommendations.set(clientId, recommendation);
    }
  }

  /**
   * Remove client from tracking
   */
  removeClient(clientId: string): void {
    this.clientMetrics.delete(clientId);
    this.throttleRecommendations.delete(clientId);
    this.metricsWindow.delete(clientId);

    logger.debug('Client removed from throttling service', { clientId });
  }

  /**
   * Cleanup service
   */
  cleanup(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.clientMetrics.clear();
    this.throttleRecommendations.clear();
    this.metricsWindow.clear();

    logger.info('Adaptive Throttling Service cleaned up');
  }
}

// Singleton instance
export const adaptiveThrottlingService = new AdaptiveThrottlingService();