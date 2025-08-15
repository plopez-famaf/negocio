import { logger } from '@/lib/logger';
import { ThreatEvent } from '@/types/threat';
import { enhancedStreamManager } from '@/services/enhanced-stream-manager';
import { adaptiveThrottlingService } from '@/services/adaptive-throttling-service';
import { smartFilteringService } from '@/services/smart-filtering-service';

export interface DashboardMetricsRequest {
  timeRange?: {
    start: string;
    end: string;
  };
  includeRealtime?: boolean;
  includePredictions?: boolean;
  refreshInterval?: number; // seconds
}

export interface DashboardMetricsResponse {
  timestamp: string;
  realTimeStats: RealTimeStatistics;
  topThreats: TopThreatSummary[];
  performanceMetrics: SystemPerformanceMetrics;
  alertSummary: AlertSummary;
  trendSummary: TrendSummary;
  systemHealth: SystemHealthMetrics;
  metadata: {
    generationTime: number;
    dataFreshness: number; // seconds since last update
    coverage: DataCoverageSummary;
  };
}

export interface RealTimeStatistics {
  currentPeriod: {
    totalThreats: number;
    criticalThreats: number;
    highThreats: number;
    mediumThreats: number;
    lowThreats: number;
    resolvedThreats: number;
    falsePositives: number;
  };
  lastHour: {
    totalThreats: number;
    averageRiskScore: number;
    topCategory: string;
    peakMinute: string;
  };
  last24Hours: {
    totalThreats: number;
    averageRiskScore: number;
    categoryBreakdown: CategoryBreakdown[];
    hourlyDistribution: HourlyDistribution[];
  };
  comparison: {
    hourOverHour: PercentageChange;
    dayOverDay: PercentageChange;
    weekOverWeek: PercentageChange;
  };
}

export interface TopThreatSummary {
  id: string;
  type: string;
  severity: string;
  riskScore: number;
  source: string;
  target: string;
  timestamp: string;
  description: string;
  status: string;
  tags: string[];
  impactScore: number;
  urgencyScore: number;
  metadata: {
    correlatedThreats: number;
    affectedAssets: string[];
    detectionMethod: string;
  };
}

export interface SystemPerformanceMetrics {
  api: {
    averageResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
    uptime: number;
    activeConnections: number;
  };
  streaming: {
    activeStreams: number;
    eventsPerSecond: number;
    streamLatency: number;
    aggregationRate: number;
    filterEfficiency: number;
  };
  ml: {
    modelsActive: number;
    averageInferenceTime: number;
    modelAccuracy: number;
    predictionConfidence: number;
    retrainingStatus: string;
  };
  resources: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkBandwidth: number;
    activeProcesses: number;
  };
}

export interface AlertSummary {
  activeAlerts: number;
  criticalAlerts: number;
  acknowledgedAlerts: number;
  recentAlerts: RecentAlert[];
  alertsByCategory: CategoryBreakdown[];
  escalationQueue: number;
  averageResolutionTime: number; // minutes
  slaCompliance: number; // percentage
}

export interface TrendSummary {
  direction: 'increasing' | 'decreasing' | 'stable';
  strength: number; // 0-1
  confidence: number; // 0-1
  keyInsights: string[];
  forecastNext24h: {
    expectedThreats: number;
    confidence: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
  seasonalPatterns: {
    detected: boolean;
    period?: string;
    strength?: number;
  };
}

export interface SystemHealthMetrics {
  overallHealth: 'healthy' | 'warning' | 'critical';
  healthScore: number; // 0-100
  components: ComponentHealth[];
  lastHealthCheck: string;
  uptime: number; // seconds
  diagnostics: {
    issues: HealthIssue[];
    recommendations: string[];
  };
}

export interface CategoryBreakdown {
  category: string;
  count: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
}

export interface HourlyDistribution {
  hour: number;
  count: number;
  averageRiskScore: number;
  peakMinute: number;
}

export interface PercentageChange {
  value: number;
  percentage: number;
  direction: 'increase' | 'decrease' | 'stable';
}

export interface RecentAlert {
  id: string;
  type: string;
  severity: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  source: string;
}

export interface ComponentHealth {
  component: string;
  status: 'healthy' | 'warning' | 'critical';
  uptime: number;
  lastCheck: string;
  metrics: {
    [key: string]: any;
  };
}

export interface HealthIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  description: string;
  recommendation: string;
  timestamp: string;
}

export interface DataCoverageSummary {
  timeRange: {
    start: string;
    end: string;
  };
  dataPoints: number;
  completeness: number; // percentage
  sources: string[];
}

export class DashboardMetricsService {
  private cache: Map<string, { metrics: DashboardMetricsResponse; expiry: number }> = new Map();
  private readonly CACHE_TTL = 30000; // 30 seconds for real-time metrics
  private metricsUpdateInterval?: NodeJS.Timeout;
  private historicalData: Map<string, ThreatEvent[]> = new Map();
  private systemStartTime: number = Date.now();

  constructor() {
    this.startMetricsCollection();
    logger.info('Dashboard Metrics Service initialized', {
      features: [
        'real_time_statistics',
        'performance_monitoring',
        'alert_management',
        'trend_analysis',
        'system_health_tracking'
      ],
      updateInterval: '30s'
    });
  }

  /**
   * Get comprehensive dashboard metrics
   */
  async getDashboardMetrics(request: DashboardMetricsRequest = {}): Promise<DashboardMetricsResponse> {
    const startTime = Date.now();

    try {
      // Check cache first for recent metrics
      const cacheKey = this.generateCacheKey(request);
      const cached = this.cache.get(cacheKey);
      
      if (cached && cached.expiry > Date.now() && request.includeRealtime !== true) {
        logger.debug('Returning cached dashboard metrics');
        return cached.metrics;
      }

      logger.debug('Generating fresh dashboard metrics', { request });

      // Gather data from various sources
      const threatData = await this.gatherThreatData(request.timeRange);
      const streamingMetrics = enhancedStreamManager.getSystemMetrics();
      const throttlingStats = adaptiveThrottlingService.getSystemStats();
      const filteringStats = smartFilteringService.getStatistics();

      // Generate metrics components
      const realTimeStats = await this.generateRealTimeStatistics(threatData);
      const topThreats = await this.generateTopThreats(threatData);
      const performanceMetrics = await this.generatePerformanceMetrics(streamingMetrics, throttlingStats);
      const alertSummary = await this.generateAlertSummary(threatData);
      const trendSummary = await this.generateTrendSummary(threatData);
      const systemHealth = await this.generateSystemHealth();

      const metrics: DashboardMetricsResponse = {
        timestamp: new Date().toISOString(),
        realTimeStats,
        topThreats,
        performanceMetrics,
        alertSummary,
        trendSummary,
        systemHealth,
        metadata: {
          generationTime: Date.now() - startTime,
          dataFreshness: this.calculateDataFreshness(threatData),
          coverage: this.generateDataCoverage(threatData, request.timeRange)
        }
      };

      // Cache the result
      this.cache.set(cacheKey, {
        metrics,
        expiry: Date.now() + this.CACHE_TTL
      });

      logger.info('Dashboard metrics generated', {
        generationTime: metrics.metadata.generationTime,
        threatCount: threatData.length,
        realTimeThreats: realTimeStats.currentPeriod.totalThreats,
        systemHealth: systemHealth.overallHealth
      });

      return metrics;

    } catch (error) {
      logger.error('Dashboard metrics generation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        request
      });
      throw new Error(`Dashboard metrics generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Gather threat data for analysis
   */
  private async gatherThreatData(timeRange?: { start: string; end: string }): Promise<ThreatEvent[]> {
    // In a real implementation, this would query the database
    // For now, return mock data that represents recent threats
    const mockThreats = this.generateMockThreatData(timeRange);
    return mockThreats;
  }

  /**
   * Generate real-time statistics
   */
  private async generateRealTimeStatistics(threatData: ThreatEvent[]): Promise<RealTimeStatistics> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Current period (last 15 minutes)
    const currentPeriodStart = new Date(now.getTime() - 15 * 60 * 1000);
    const currentPeriodThreats = threatData.filter(t => new Date(t.timestamp) >= currentPeriodStart);

    const currentPeriod = {
      totalThreats: currentPeriodThreats.length,
      criticalThreats: currentPeriodThreats.filter(t => t.severity === 'critical').length,
      highThreats: currentPeriodThreats.filter(t => t.severity === 'high').length,
      mediumThreats: currentPeriodThreats.filter(t => t.severity === 'medium').length,
      lowThreats: currentPeriodThreats.filter(t => t.severity === 'low').length,
      resolvedThreats: currentPeriodThreats.filter(t => t.status === 'resolved').length,
      falsePositives: currentPeriodThreats.filter(t => t.status === 'false_positive').length
    };

    // Last hour analysis
    const lastHourThreats = threatData.filter(t => new Date(t.timestamp) >= oneHourAgo);
    const hourlyRiskScores = lastHourThreats.map(t => t.riskScore);
    const averageHourlyRisk = hourlyRiskScores.length > 0 ? 
      hourlyRiskScores.reduce((sum, score) => sum + score, 0) / hourlyRiskScores.length : 0;

    const hourlyCategories = this.calculateCategoryBreakdown(lastHourThreats);
    const topHourlyCategory = hourlyCategories.length > 0 ? hourlyCategories[0].category : 'none';

    // Peak minute calculation
    const peakMinute = this.findPeakPeriod(lastHourThreats, 'minute');

    const lastHour = {
      totalThreats: lastHourThreats.length,
      averageRiskScore: averageHourlyRisk,
      topCategory: topHourlyCategory,
      peakMinute: peakMinute
    };

    // Last 24 hours analysis
    const last24HourThreats = threatData.filter(t => new Date(t.timestamp) >= oneDayAgo);
    const dailyRiskScores = last24HourThreats.map(t => t.riskScore);
    const averageDailyRisk = dailyRiskScores.length > 0 ? 
      dailyRiskScores.reduce((sum, score) => sum + score, 0) / dailyRiskScores.length : 0;

    const last24Hours = {
      totalThreats: last24HourThreats.length,
      averageRiskScore: averageDailyRisk,
      categoryBreakdown: this.calculateCategoryBreakdown(last24HourThreats),
      hourlyDistribution: this.calculateHourlyDistribution(last24HourThreats)
    };

    // Historical comparison
    const previousHourThreats = threatData.filter(t => {
      const timestamp = new Date(t.timestamp);
      return timestamp >= new Date(oneHourAgo.getTime() - 60 * 60 * 1000) && timestamp < oneHourAgo;
    });

    const previousDayThreats = threatData.filter(t => {
      const timestamp = new Date(t.timestamp);
      return timestamp >= new Date(oneDayAgo.getTime() - 24 * 60 * 60 * 1000) && timestamp < oneDayAgo;
    });

    const previousWeekThreats = threatData.filter(t => {
      const timestamp = new Date(t.timestamp);
      return timestamp >= new Date(oneWeekAgo.getTime() - 7 * 24 * 60 * 60 * 1000) && timestamp < oneWeekAgo;
    });

    const comparison = {
      hourOverHour: this.calculatePercentageChange(lastHourThreats.length, previousHourThreats.length),
      dayOverDay: this.calculatePercentageChange(last24HourThreats.length, previousDayThreats.length),
      weekOverWeek: this.calculatePercentageChange(last24HourThreats.length, previousWeekThreats.length)
    };

    return {
      currentPeriod,
      lastHour,
      last24Hours,
      comparison
    };
  }

  /**
   * Generate top threats summary
   */
  private async generateTopThreats(threatData: ThreatEvent[]): Promise<TopThreatSummary[]> {
    // Sort by risk score and recency, take top 10
    const sortedThreats = threatData
      .filter(t => t.status === 'active' || t.status === 'investigating')
      .sort((a, b) => {
        // Primary sort by risk score
        if (b.riskScore !== a.riskScore) {
          return b.riskScore - a.riskScore;
        }
        // Secondary sort by timestamp (more recent first)
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      })
      .slice(0, 10);

    return sortedThreats.map(threat => ({
      id: threat.id,
      type: threat.type,
      severity: threat.severity,
      riskScore: threat.riskScore,
      source: threat.source,
      target: threat.target || 'unknown',
      timestamp: threat.timestamp,
      description: threat.description,
      status: threat.status,
      tags: this.extractTags(threat),
      impactScore: this.calculateImpactScore(threat),
      urgencyScore: this.calculateUrgencyScore(threat),
      metadata: {
        correlatedThreats: this.findCorrelatedThreats(threat, threatData).length,
        affectedAssets: this.extractAffectedAssets(threat),
        detectionMethod: this.getDetectionMethod(threat)
      }
    }));
  }

  /**
   * Generate performance metrics
   */
  private async generatePerformanceMetrics(
    streamingMetrics: any,
    throttlingStats: any
  ): Promise<SystemPerformanceMetrics> {
    const api = {
      averageResponseTime: Math.random() * 50 + 25, // Mock API response time
      requestsPerSecond: Math.random() * 1000 + 500,
      errorRate: Math.random() * 2, // 0-2%
      uptime: (Date.now() - this.systemStartTime) / 1000,
      activeConnections: Math.floor(Math.random() * 100 + 50)
    };

    const streaming = {
      activeStreams: streamingMetrics.activeChannels || 0,
      eventsPerSecond: streamingMetrics.totalThroughput || 0,
      streamLatency: streamingMetrics.averageLatency || 0,
      aggregationRate: Math.random() * 100, // Mock aggregation rate
      filterEfficiency: Math.random() * 100 // Mock filter efficiency
    };

    const ml = {
      modelsActive: 2, // Isolation Forest + UBA
      averageInferenceTime: Math.random() * 50 + 10,
      modelAccuracy: 0.94 + Math.random() * 0.05, // 94-99%
      predictionConfidence: 0.85 + Math.random() * 0.1, // 85-95%
      retrainingStatus: Math.random() > 0.9 ? 'in_progress' : 'up_to_date'
    };

    const resources = {
      cpuUsage: Math.random() * 60 + 20, // 20-80%
      memoryUsage: Math.random() * 50 + 30, // 30-80%
      diskUsage: Math.random() * 40 + 10, // 10-50%
      networkBandwidth: Math.random() * 1000 + 100, // MB/s
      activeProcesses: Math.floor(Math.random() * 50 + 20)
    };

    return {
      api,
      streaming,
      ml,
      resources
    };
  }

  /**
   * Generate alert summary
   */
  private async generateAlertSummary(threatData: ThreatEvent[]): Promise<AlertSummary> {
    // Filter for recent high-severity threats as alerts
    const recentAlerts = threatData
      .filter(t => {
        const isRecent = new Date(t.timestamp) >= new Date(Date.now() - 24 * 60 * 60 * 1000);
        const isHighSeverity = ['high', 'critical'].includes(t.severity);
        return isRecent && isHighSeverity;
      })
      .slice(0, 5)
      .map(threat => ({
        id: threat.id,
        type: threat.type,
        severity: threat.severity,
        message: threat.description,
        timestamp: threat.timestamp,
        acknowledged: Math.random() > 0.7, // Mock acknowledgment status
        source: threat.source
      }));

    const activeAlerts = recentAlerts.filter(a => !a.acknowledged).length;
    const criticalAlerts = recentAlerts.filter(a => a.severity === 'critical').length;
    const acknowledgedAlerts = recentAlerts.filter(a => a.acknowledged).length;

    return {
      activeAlerts,
      criticalAlerts,
      acknowledgedAlerts,
      recentAlerts,
      alertsByCategory: this.calculateCategoryBreakdown(threatData.filter(t => ['high', 'critical'].includes(t.severity))),
      escalationQueue: Math.floor(Math.random() * 10),
      averageResolutionTime: Math.random() * 120 + 30, // 30-150 minutes
      slaCompliance: Math.random() * 20 + 80 // 80-100%
    };
  }

  /**
   * Generate trend summary
   */
  private async generateTrendSummary(threatData: ThreatEvent[]): Promise<TrendSummary> {
    // Simple trend calculation
    const recentThreats = threatData.filter(t => 
      new Date(t.timestamp) >= new Date(Date.now() - 24 * 60 * 60 * 1000)
    );
    const previousThreats = threatData.filter(t => {
      const timestamp = new Date(t.timestamp);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      return timestamp >= twoDaysAgo && timestamp < oneDayAgo;
    });

    const changeRate = previousThreats.length > 0 ? 
      (recentThreats.length - previousThreats.length) / previousThreats.length : 0;

    let direction: 'increasing' | 'decreasing' | 'stable' = 'stable';
    let strength = 0;

    if (Math.abs(changeRate) > 0.1) {
      direction = changeRate > 0 ? 'increasing' : 'decreasing';
      strength = Math.min(Math.abs(changeRate), 1);
    }

    return {
      direction,
      strength,
      confidence: 0.8, // Mock confidence
      keyInsights: [
        'Network threats showing increased activity',
        'Behavioral anomalies trending upward',
        'Critical threats down 15% from last week'
      ],
      forecastNext24h: {
        expectedThreats: recentThreats.length + Math.floor(changeRate * recentThreats.length),
        confidence: 0.75,
        riskLevel: criticalAlerts => criticalAlerts > 10 ? 'critical' : criticalAlerts > 5 ? 'high' : 'medium'
      },
      seasonalPatterns: {
        detected: Math.random() > 0.5,
        period: 'weekly',
        strength: Math.random() * 0.5 + 0.2
      }
    };
  }

  /**
   * Generate system health metrics
   */
  private async generateSystemHealth(): Promise<SystemHealthMetrics> {
    const components: ComponentHealth[] = [
      {
        component: 'API Server',
        status: 'healthy',
        uptime: (Date.now() - this.systemStartTime) / 1000,
        lastCheck: new Date().toISOString(),
        metrics: { responseTime: '45ms', errorRate: '0.1%' }
      },
      {
        component: 'ML Models',
        status: 'healthy',
        uptime: (Date.now() - this.systemStartTime) / 1000,
        lastCheck: new Date().toISOString(),
        metrics: { accuracy: '95.2%', inferenceTime: '23ms' }
      },
      {
        component: 'Stream Manager',
        status: 'healthy',
        uptime: (Date.now() - this.systemStartTime) / 1000,
        lastCheck: new Date().toISOString(),
        metrics: { activeStreams: '45', latency: '18ms' }
      }
    ];

    const healthScore = components.reduce((sum, comp) => {
      return sum + (comp.status === 'healthy' ? 100 : comp.status === 'warning' ? 75 : 25);
    }, 0) / components.length;

    let overallHealth: SystemHealthMetrics['overallHealth'] = 'healthy';
    if (healthScore < 50) overallHealth = 'critical';
    else if (healthScore < 80) overallHealth = 'warning';

    return {
      overallHealth,
      healthScore,
      components,
      lastHealthCheck: new Date().toISOString(),
      uptime: (Date.now() - this.systemStartTime) / 1000,
      diagnostics: {
        issues: [],
        recommendations: [
          'Consider scaling stream processing for peak hours',
          'Monitor ML model drift weekly',
          'Optimize cache hit rates for better performance'
        ]
      }
    };
  }

  /**
   * Helper methods
   */
  private calculateCategoryBreakdown(threats: ThreatEvent[]): CategoryBreakdown[] {
    const categoryMap = new Map<string, number>();
    
    threats.forEach(threat => {
      const current = categoryMap.get(threat.type) || 0;
      categoryMap.set(threat.type, current + 1);
    });

    const total = threats.length;
    return Array.from(categoryMap.entries())
      .map(([category, count]) => ({
        category,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
        trend: Math.random() > 0.5 ? 'up' : Math.random() > 0.5 ? 'down' : 'stable',
        trendValue: (Math.random() - 0.5) * 20 // -10% to +10%
      }))
      .sort((a, b) => b.count - a.count);
  }

  private calculateHourlyDistribution(threats: ThreatEvent[]): HourlyDistribution[] {
    const hourlyMap = new Map<number, ThreatEvent[]>();
    
    threats.forEach(threat => {
      const hour = new Date(threat.timestamp).getHours();
      if (!hourlyMap.has(hour)) {
        hourlyMap.set(hour, []);
      }
      hourlyMap.get(hour)!.push(threat);
    });

    return Array.from(hourlyMap.entries())
      .map(([hour, hourThreats]) => ({
        hour,
        count: hourThreats.length,
        averageRiskScore: hourThreats.length > 0 ? 
          hourThreats.reduce((sum, t) => sum + t.riskScore, 0) / hourThreats.length : 0,
        peakMinute: this.findPeakMinute(hourThreats)
      }))
      .sort((a, b) => a.hour - b.hour);
  }

  private calculatePercentageChange(current: number, previous: number): PercentageChange {
    if (previous === 0) {
      return {
        value: current,
        percentage: current > 0 ? 100 : 0,
        direction: current > 0 ? 'increase' : 'stable'
      };
    }

    const change = current - previous;
    const percentage = (change / previous) * 100;
    
    return {
      value: change,
      percentage: Math.abs(percentage),
      direction: change > 0 ? 'increase' : change < 0 ? 'decrease' : 'stable'
    };
  }

  private findPeakPeriod(threats: ThreatEvent[], granularity: 'minute' | 'hour'): string {
    if (threats.length === 0) return 'none';

    const periodMap = new Map<string, number>();
    
    threats.forEach(threat => {
      const date = new Date(threat.timestamp);
      const key = granularity === 'minute' ? 
        `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}` :
        date.getHours().toString();
      
      periodMap.set(key, (periodMap.get(key) || 0) + 1);
    });

    let maxPeriod = '';
    let maxCount = 0;
    
    for (const [period, count] of periodMap) {
      if (count > maxCount) {
        maxCount = count;
        maxPeriod = period;
      }
    }

    return maxPeriod;
  }

  private findPeakMinute(threats: ThreatEvent[]): number {
    if (threats.length === 0) return 0;

    const minuteMap = new Map<number, number>();
    
    threats.forEach(threat => {
      const minute = new Date(threat.timestamp).getMinutes();
      minuteMap.set(minute, (minuteMap.get(minute) || 0) + 1);
    });

    let maxMinute = 0;
    let maxCount = 0;
    
    for (const [minute, count] of minuteMap) {
      if (count > maxCount) {
        maxCount = count;
        maxMinute = minute;
      }
    }

    return maxMinute;
  }

  private extractTags(threat: ThreatEvent): string[] {
    // Mock tag extraction
    return ['automated', 'ml-detected', threat.severity, threat.type];
  }

  private calculateImpactScore(threat: ThreatEvent): number {
    // Simple impact scoring based on risk score and severity
    const severityMultiplier = {
      'critical': 1.0,
      'high': 0.8,
      'medium': 0.6,
      'low': 0.4
    };
    
    return threat.riskScore * (severityMultiplier[threat.severity as keyof typeof severityMultiplier] || 0.5);
  }

  private calculateUrgencyScore(threat: ThreatEvent): number {
    // Calculate urgency based on time since detection and severity
    const hoursOld = (Date.now() - new Date(threat.timestamp).getTime()) / (1000 * 60 * 60);
    const ageMultiplier = Math.max(0.1, 1 - (hoursOld / 24)); // Decreases over 24 hours
    
    const severityScore = {
      'critical': 10,
      'high': 8,
      'medium': 6,
      'low': 4
    };
    
    return (severityScore[threat.severity as keyof typeof severityScore] || 4) * ageMultiplier;
  }

  private findCorrelatedThreats(threat: ThreatEvent, allThreats: ThreatEvent[]): ThreatEvent[] {
    // Simple correlation based on source, target, or type
    return allThreats.filter(t => 
      t.id !== threat.id && (
        t.source === threat.source ||
        t.target === threat.target ||
        (t.type === threat.type && Math.abs(new Date(t.timestamp).getTime() - new Date(threat.timestamp).getTime()) < 60 * 60 * 1000)
      )
    );
  }

  private extractAffectedAssets(threat: ThreatEvent): string[] {
    // Mock affected assets extraction
    return [threat.target || 'unknown', threat.source];
  }

  private getDetectionMethod(threat: ThreatEvent): string {
    // Mock detection method
    return Math.random() > 0.5 ? 'ML-Based Detection' : 'Rule-Based Detection';
  }

  private calculateDataFreshness(threatData: ThreatEvent[]): number {
    if (threatData.length === 0) return 0;
    
    const latestTimestamp = Math.max(...threatData.map(t => new Date(t.timestamp).getTime()));
    return (Date.now() - latestTimestamp) / 1000; // seconds
  }

  private generateDataCoverage(threatData: ThreatEvent[], timeRange?: { start: string; end: string }): DataCoverageSummary {
    const sources = Array.from(new Set(threatData.map(t => t.source)));
    
    let start: string, end: string;
    if (timeRange) {
      start = timeRange.start;
      end = timeRange.end;
    } else {
      const timestamps = threatData.map(t => new Date(t.timestamp).getTime());
      start = new Date(Math.min(...timestamps)).toISOString();
      end = new Date(Math.max(...timestamps)).toISOString();
    }

    return {
      timeRange: { start, end },
      dataPoints: threatData.length,
      completeness: Math.min(100, (threatData.length / 1000) * 100), // Mock completeness
      sources
    };
  }

  private generateMockThreatData(timeRange?: { start: string; end: string }): ThreatEvent[] {
    // Generate mock threat data for demonstration
    const threats: ThreatEvent[] = [];
    const threatTypes = ['malware', 'intrusion', 'anomaly', 'behavioral', 'network'];
    const severities: ('low' | 'medium' | 'high' | 'critical')[] = ['low', 'medium', 'high', 'critical'];
    const statuses: ('active' | 'resolved' | 'false_positive' | 'investigating')[] = ['active', 'resolved', 'false_positive', 'investigating'];

    const endTime = timeRange ? new Date(timeRange.end) : new Date();
    const startTime = timeRange ? new Date(timeRange.start) : new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

    for (let i = 0; i < 100; i++) {
      const randomTime = new Date(startTime.getTime() + Math.random() * (endTime.getTime() - startTime.getTime()));
      
      threats.push({
        id: `threat_${i}_${Date.now()}`,
        timestamp: randomTime.toISOString(),
        type: threatTypes[Math.floor(Math.random() * threatTypes.length)] as any,
        severity: severities[Math.floor(Math.random() * severities.length)],
        source: `source_${Math.floor(Math.random() * 10)}`,
        target: `target_${Math.floor(Math.random() * 10)}`,
        description: `Mock threat ${i} detected`,
        riskScore: Math.random() * 10,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        metadata: {
          correlationId: `corr_${i}`,
          source: `detector_${Math.floor(Math.random() * 5)}`
        }
      });
    }

    return threats;
  }

  private generateCacheKey(request: DashboardMetricsRequest): string {
    return `dashboard_${JSON.stringify(request)}`;
  }

  private startMetricsCollection(): void {
    // Update metrics cache every 30 seconds
    this.metricsUpdateInterval = setInterval(() => {
      this.cleanExpiredCache();
    }, 30000);
  }

  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache) {
      if (cached.expiry < now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Cleanup service
   */
  cleanup(): void {
    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
      this.metricsUpdateInterval = undefined;
    }

    this.cache.clear();
    this.historicalData.clear();

    logger.info('Dashboard Metrics Service cleaned up');
  }
}

// Singleton instance
export const dashboardMetricsService = new DashboardMetricsService();