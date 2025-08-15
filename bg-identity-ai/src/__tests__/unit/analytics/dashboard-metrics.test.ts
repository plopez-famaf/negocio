import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DashboardMetricsService, DashboardMetricsRequest } from '@/services/analytics/dashboard-metrics-service';
import { ThreatEvent } from '@/types/threat';

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock('@/services/enhanced-stream-manager', () => ({
  enhancedStreamManager: {
    getSystemMetrics: vi.fn(() => ({
      activeChannels: 45,
      totalThroughput: 850,
      averageLatency: 25,
      connectedClients: 123,
      messagesSent: 5432,
      messagesReceived: 4321
    }))
  }
}));

vi.mock('@/services/adaptive-throttling-service', () => ({
  adaptiveThrottlingService: {
    getSystemStats: vi.fn(() => ({
      throttleEvents: 12,
      averageThrottleRate: 0.15,
      activeThrottles: 3
    }))
  }
}));

vi.mock('@/services/smart-filtering-service', () => ({
  smartFilteringService: {
    getStatistics: vi.fn(() => ({
      filteredEvents: 234,
      filterEfficiency: 0.87,
      averageRelevanceScore: 0.73
    }))
  }
}));

describe('DashboardMetricsService', () => {
  let dashboardMetricsService: DashboardMetricsService;
  let mockThreatData: ThreatEvent[];

  beforeEach(() => {
    dashboardMetricsService = new DashboardMetricsService();
    
    // Create comprehensive mock threat data for dashboard metrics
    const now = new Date();
    mockThreatData = [
      // Current period threats (last 15 minutes)
      {
        id: 'current_threat_1',
        timestamp: new Date(now.getTime() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
        type: 'malware',
        severity: 'critical',
        source: 'scanner_1',
        target: 'server_1',
        description: 'Critical malware detected',
        riskScore: 9.5,
        status: 'active',
        metadata: { correlationId: 'corr_current_1', source: 'detector_1' }
      },
      {
        id: 'current_threat_2',
        timestamp: new Date(now.getTime() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
        type: 'intrusion',
        severity: 'high',
        source: 'scanner_2',
        target: 'server_2',
        description: 'Intrusion attempt blocked',
        riskScore: 8.2,
        status: 'investigating',
        metadata: { correlationId: 'corr_current_2', source: 'detector_2' }
      },
      {
        id: 'current_threat_3',
        timestamp: new Date(now.getTime() - 8 * 60 * 1000).toISOString(), // 8 minutes ago
        type: 'anomaly',
        severity: 'medium',
        source: 'scanner_3',
        target: 'server_3',
        description: 'Behavioral anomaly',
        riskScore: 6.7,
        status: 'resolved',
        metadata: { correlationId: 'corr_current_3', source: 'detector_3' }
      },
      // Last hour threats
      {
        id: 'hour_threat_1',
        timestamp: new Date(now.getTime() - 45 * 60 * 1000).toISOString(), // 45 minutes ago
        type: 'malware',
        severity: 'high',
        source: 'scanner_1',
        target: 'server_4',
        description: 'Malware in email attachment',
        riskScore: 7.8,
        status: 'resolved',
        metadata: { correlationId: 'corr_hour_1', source: 'detector_1' }
      },
      {
        id: 'hour_threat_2',
        timestamp: new Date(now.getTime() - 50 * 60 * 1000).toISOString(), // 50 minutes ago
        type: 'behavioral',
        severity: 'low',
        source: 'scanner_4',
        target: 'server_5',
        description: 'Unusual user behavior pattern',
        riskScore: 4.1,
        status: 'false_positive',
        metadata: { correlationId: 'corr_hour_2', source: 'detector_4' }
      },
      // Last 24 hours threats
      {
        id: 'day_threat_1',
        timestamp: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
        type: 'network',
        severity: 'medium',
        source: 'scanner_5',
        target: 'server_6',
        description: 'Suspicious network traffic',
        riskScore: 6.3,
        status: 'active',
        metadata: { correlationId: 'corr_day_1', source: 'detector_5' }
      },
      {
        id: 'day_threat_2',
        timestamp: new Date(now.getTime() - 18 * 60 * 60 * 1000).toISOString(), // 18 hours ago
        type: 'intrusion',
        severity: 'critical',
        source: 'scanner_6',
        target: 'server_7',
        description: 'Successful intrusion detected',
        riskScore: 9.8,
        status: 'investigating',
        metadata: { correlationId: 'corr_day_2', source: 'detector_6' }
      }
    ];
  });

  afterEach(() => {
    vi.clearAllMocks();
    dashboardMetricsService.cleanup();
  });

  describe('getDashboardMetrics', () => {
    it('should generate comprehensive dashboard metrics', async () => {
      const request: DashboardMetricsRequest = {
        includeRealtime: true,
        includePredictions: true
      };

      const result = await dashboardMetricsService.getDashboardMetrics(request);

      expect(result).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.realTimeStats).toBeDefined();
      expect(result.topThreats).toBeDefined();
      expect(result.performanceMetrics).toBeDefined();
      expect(result.alertSummary).toBeDefined();
      expect(result.trendSummary).toBeDefined();
      expect(result.systemHealth).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should calculate real-time statistics correctly', async () => {
      const result = await dashboardMetricsService.getDashboardMetrics();

      const stats = result.realTimeStats;
      expect(stats.currentPeriod).toBeDefined();
      expect(stats.lastHour).toBeDefined();
      expect(stats.last24Hours).toBeDefined();
      expect(stats.comparison).toBeDefined();

      // Current period should have threats from last 15 minutes
      expect(stats.currentPeriod.totalThreats).toBeGreaterThanOrEqual(0);
      expect(stats.currentPeriod.criticalThreats).toBeGreaterThanOrEqual(0);
      expect(stats.currentPeriod.highThreats).toBeGreaterThanOrEqual(0);
      expect(stats.currentPeriod.mediumThreats).toBeGreaterThanOrEqual(0);
      expect(stats.currentPeriod.lowThreats).toBeGreaterThanOrEqual(0);
      expect(stats.currentPeriod.resolvedThreats).toBeGreaterThanOrEqual(0);
      expect(stats.currentPeriod.falsePositives).toBeGreaterThanOrEqual(0);

      // Last hour statistics
      expect(stats.lastHour.totalThreats).toBeGreaterThanOrEqual(0);
      expect(stats.lastHour.averageRiskScore).toBeGreaterThanOrEqual(0);
      expect(stats.lastHour.topCategory).toBeDefined();
      expect(stats.lastHour.peakMinute).toBeDefined();

      // Comparison metrics
      expect(stats.comparison.hourOverHour).toBeDefined();
      expect(stats.comparison.dayOverDay).toBeDefined();
      expect(stats.comparison.weekOverWeek).toBeDefined();
    });

    it('should generate top threats list', async () => {
      const result = await dashboardMetricsService.getDashboardMetrics();

      expect(result.topThreats).toBeInstanceOf(Array);
      result.topThreats.forEach(threat => {
        expect(threat).toHaveProperty('id');
        expect(threat).toHaveProperty('type');
        expect(threat).toHaveProperty('severity');
        expect(threat).toHaveProperty('riskScore');
        expect(threat).toHaveProperty('source');
        expect(threat).toHaveProperty('target');
        expect(threat).toHaveProperty('timestamp');
        expect(threat).toHaveProperty('description');
        expect(threat).toHaveProperty('status');
        expect(threat).toHaveProperty('tags');
        expect(threat).toHaveProperty('impactScore');
        expect(threat).toHaveProperty('urgencyScore');
        expect(threat).toHaveProperty('metadata');

        // Validate risk score is within valid range
        expect(threat.riskScore).toBeGreaterThanOrEqual(0);
        expect(threat.riskScore).toBeLessThanOrEqual(10);

        // Validate severity levels
        expect(['low', 'medium', 'high', 'critical'].includes(threat.severity)).toBe(true);

        // Validate status values
        expect(['active', 'investigating', 'resolved', 'false_positive'].includes(threat.status)).toBe(true);
      });
    });

    it('should provide performance metrics', async () => {
      const result = await dashboardMetricsService.getDashboardMetrics();

      const perf = result.performanceMetrics;
      expect(perf.api).toBeDefined();
      expect(perf.streaming).toBeDefined();
      expect(perf.ml).toBeDefined();
      expect(perf.resources).toBeDefined();

      // API metrics
      expect(perf.api.averageResponseTime).toBeGreaterThan(0);
      expect(perf.api.requestsPerSecond).toBeGreaterThan(0);
      expect(perf.api.errorRate).toBeGreaterThanOrEqual(0);
      expect(perf.api.uptime).toBeGreaterThan(0);
      expect(perf.api.activeConnections).toBeGreaterThan(0);

      // Streaming metrics
      expect(perf.streaming.activeStreams).toBeGreaterThanOrEqual(0);
      expect(perf.streaming.eventsPerSecond).toBeGreaterThanOrEqual(0);
      expect(perf.streaming.streamLatency).toBeGreaterThanOrEqual(0);

      // ML metrics
      expect(perf.ml.modelsActive).toBeGreaterThan(0);
      expect(perf.ml.averageInferenceTime).toBeGreaterThan(0);
      expect(perf.ml.modelAccuracy).toBeGreaterThan(0);
      expect(perf.ml.predictionConfidence).toBeGreaterThan(0);

      // Resource metrics
      expect(perf.resources.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(perf.resources.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(perf.resources.diskUsage).toBeGreaterThanOrEqual(0);
      expect(perf.resources.networkBandwidth).toBeGreaterThanOrEqual(0);
    });

    it('should generate alert summary', async () => {
      const result = await dashboardMetricsService.getDashboardMetrics();

      const alerts = result.alertSummary;
      expect(alerts.activeAlerts).toBeGreaterThanOrEqual(0);
      expect(alerts.criticalAlerts).toBeGreaterThanOrEqual(0);
      expect(alerts.acknowledgedAlerts).toBeGreaterThanOrEqual(0);
      expect(alerts.recentAlerts).toBeInstanceOf(Array);
      expect(alerts.alertsByCategory).toBeInstanceOf(Array);
      expect(alerts.escalationQueue).toBeGreaterThanOrEqual(0);
      expect(alerts.averageResolutionTime).toBeGreaterThan(0);
      expect(alerts.slaCompliance).toBeGreaterThan(0);
      expect(alerts.slaCompliance).toBeLessThanOrEqual(100);

      // Recent alerts structure
      alerts.recentAlerts.forEach(alert => {
        expect(alert).toHaveProperty('id');
        expect(alert).toHaveProperty('type');
        expect(alert).toHaveProperty('severity');
        expect(alert).toHaveProperty('message');
        expect(alert).toHaveProperty('timestamp');
        expect(alert).toHaveProperty('acknowledged');
        expect(alert).toHaveProperty('source');
      });
    });

    it('should provide trend summary', async () => {
      const result = await dashboardMetricsService.getDashboardMetrics();

      const trends = result.trendSummary;
      expect(['increasing', 'decreasing', 'stable'].includes(trends.direction)).toBe(true);
      expect(trends.strength).toBeGreaterThanOrEqual(0);
      expect(trends.strength).toBeLessThanOrEqual(1);
      expect(trends.confidence).toBeGreaterThanOrEqual(0);
      expect(trends.confidence).toBeLessThanOrEqual(1);
      expect(trends.keyInsights).toBeInstanceOf(Array);
      expect(trends.forecastNext24h).toBeDefined();
      expect(trends.seasonalPatterns).toBeDefined();

      // Forecast validation
      expect(trends.forecastNext24h.expectedThreats).toBeGreaterThanOrEqual(0);
      expect(trends.forecastNext24h.confidence).toBeGreaterThanOrEqual(0);
      expect(trends.forecastNext24h.confidence).toBeLessThanOrEqual(1);
      expect(['low', 'medium', 'high', 'critical'].includes(trends.forecastNext24h.riskLevel)).toBe(true);
    });

    it('should provide system health metrics', async () => {
      const result = await dashboardMetricsService.getDashboardMetrics();

      const health = result.systemHealth;
      expect(['healthy', 'warning', 'critical'].includes(health.overallHealth)).toBe(true);
      expect(health.healthScore).toBeGreaterThanOrEqual(0);
      expect(health.healthScore).toBeLessThanOrEqual(100);
      expect(health.components).toBeInstanceOf(Array);
      expect(health.lastHealthCheck).toBeDefined();
      expect(health.uptime).toBeGreaterThan(0);
      expect(health.diagnostics).toBeDefined();

      // Components validation
      health.components.forEach(component => {
        expect(component).toHaveProperty('component');
        expect(['healthy', 'warning', 'critical'].includes(component.status)).toBe(true);
        expect(component.uptime).toBeGreaterThan(0);
        expect(component.lastCheck).toBeDefined();
        expect(component.metrics).toBeDefined();
      });
    });

    it('should include metadata with generation information', async () => {
      const result = await dashboardMetricsService.getDashboardMetrics();

      const metadata = result.metadata;
      expect(metadata.generationTime).toBeGreaterThan(0);
      expect(metadata.dataFreshness).toBeGreaterThanOrEqual(0);
      expect(metadata.coverage).toBeDefined();
      expect(metadata.coverage.timeRange).toBeDefined();
      expect(metadata.coverage.dataPoints).toBeGreaterThanOrEqual(0);
      expect(metadata.coverage.completeness).toBeGreaterThanOrEqual(0);
      expect(metadata.coverage.completeness).toBeLessThanOrEqual(100);
      expect(metadata.coverage.sources).toBeInstanceOf(Array);
    });

    it('should handle time range filtering', async () => {
      const timeRange = {
        start: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        end: new Date().toISOString()
      };

      const request: DashboardMetricsRequest = {
        timeRange,
        includeRealtime: true
      };

      const result = await dashboardMetricsService.getDashboardMetrics(request);

      expect(result).toBeDefined();
      expect(result.metadata.coverage.timeRange.start).toBe(timeRange.start);
      expect(result.metadata.coverage.timeRange.end).toBe(timeRange.end);
    });

    it('should handle realtime flag correctly', async () => {
      const requestWithRealtime: DashboardMetricsRequest = {
        includeRealtime: true
      };

      const requestWithoutRealtime: DashboardMetricsRequest = {
        includeRealtime: false
      };

      const resultWithRealtime = await dashboardMetricsService.getDashboardMetrics(requestWithRealtime);
      const resultWithoutRealtime = await dashboardMetricsService.getDashboardMetrics(requestWithoutRealtime);

      expect(resultWithRealtime).toBeDefined();
      expect(resultWithoutRealtime).toBeDefined();
      
      // Both should have real-time stats but potentially different freshness
      expect(resultWithRealtime.realTimeStats).toBeDefined();
      expect(resultWithoutRealtime.realTimeStats).toBeDefined();
    });

    it('should handle refresh interval', async () => {
      const request: DashboardMetricsRequest = {
        refreshInterval: 30 // 30 seconds
      };

      const result = await dashboardMetricsService.getDashboardMetrics(request);

      expect(result).toBeDefined();
      // Refresh interval affects internal caching behavior
      expect(result.metadata.generationTime).toBeGreaterThan(0);
    });

    it('should handle empty threat data gracefully', async () => {
      // Mock empty threat data
      vi.spyOn(dashboardMetricsService as any, 'gatherThreatData').mockResolvedValue([]);

      const result = await dashboardMetricsService.getDashboardMetrics();

      expect(result).toBeDefined();
      expect(result.realTimeStats.currentPeriod.totalThreats).toBe(0);
      expect(result.topThreats).toEqual([]);
      expect(result.metadata.coverage.dataPoints).toBe(0);
    });

    it('should handle concurrent requests efficiently', async () => {
      const requests = Array(5).fill(null).map(() => 
        dashboardMetricsService.getDashboardMetrics({ includeRealtime: true })
      );

      const results = await Promise.all(requests);

      expect(results.length).toBe(5);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.realTimeStats).toBeDefined();
        expect(result.performanceMetrics).toBeDefined();
      });
    });

    it('should respect cache TTL for identical requests', async () => {
      const request: DashboardMetricsRequest = {
        includeRealtime: false // Avoid cache bypass
      };

      // First request
      const startTime1 = Date.now();
      const result1 = await dashboardMetricsService.getDashboardMetrics(request);
      const duration1 = Date.now() - startTime1;

      // Second request (should use cache)
      const startTime2 = Date.now();
      const result2 = await dashboardMetricsService.getDashboardMetrics(request);
      const duration2 = Date.now() - startTime2;

      expect(result1.realTimeStats.currentPeriod.totalThreats)
        .toBe(result2.realTimeStats.currentPeriod.totalThreats);
      
      // Second request should be significantly faster due to caching
      expect(duration2).toBeLessThan(duration1);
    });

    it('should generate unique response timestamps', async () => {
      const result1 = await dashboardMetricsService.getDashboardMetrics();
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      const result2 = await dashboardMetricsService.getDashboardMetrics();

      expect(result1.timestamp).not.toBe(result2.timestamp);
    });

    it('should handle error conditions gracefully', async () => {
      // Mock an error in threat data gathering
      vi.spyOn(dashboardMetricsService as any, 'gatherThreatData')
        .mockRejectedValue(new Error('Database connection failed'));

      await expect(dashboardMetricsService.getDashboardMetrics())
        .rejects.toThrow('Dashboard metrics generation failed');
    });
  });

  describe('caching behavior', () => {
    it('should cache results based on request parameters', async () => {
      const request1: DashboardMetricsRequest = {
        includeRealtime: false,
        includePredictions: false
      };

      const request2: DashboardMetricsRequest = {
        includeRealtime: true,
        includePredictions: true
      };

      const result1 = await dashboardMetricsService.getDashboardMetrics(request1);
      const result2 = await dashboardMetricsService.getDashboardMetrics(request2);

      // Different requests should potentially have different results
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });

    it('should clean expired cache entries', async () => {
      // This tests the internal cache cleanup mechanism
      const request: DashboardMetricsRequest = {};
      
      await dashboardMetricsService.getDashboardMetrics(request);
      
      // Access private method for testing
      (dashboardMetricsService as any).cleanExpiredCache();
      
      // Should complete without errors
      const result = await dashboardMetricsService.getDashboardMetrics(request);
      expect(result).toBeDefined();
    });
  });

  describe('performance characteristics', () => {
    it('should complete metrics generation within reasonable time', async () => {
      const startTime = Date.now();
      const result = await dashboardMetricsService.getDashboardMetrics();
      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(result.metadata.generationTime).toBeLessThan(1000);
    });

    it('should handle high-frequency requests', async () => {
      const requests = Array(20).fill(null).map((_, i) => 
        dashboardMetricsService.getDashboardMetrics({
          includeRealtime: i % 2 === 0 // Alternate realtime flag
        })
      );

      const startTime = Date.now();
      const results = await Promise.all(requests);
      const totalDuration = Date.now() - startTime;

      expect(results.length).toBe(20);
      expect(totalDuration).toBeLessThan(5000); // Should complete within 5 seconds
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.metadata.generationTime).toBeGreaterThan(0);
      });
    });
  });
});