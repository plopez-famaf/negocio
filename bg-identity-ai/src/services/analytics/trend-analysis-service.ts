import { logger } from '@/lib/logger';
import { ThreatEvent } from '@/types/threat';
import * as stats from 'simple-statistics';

export interface TrendAnalysisRequest {
  timeRange: {
    start: string;
    end: string;
  };
  categories: string[];
  granularity: 'hourly' | 'daily' | 'weekly';
  includeForecasting?: boolean;
  forecastPeriods?: number;
}

export interface TrendDataPoint {
  timestamp: string;
  value: number;
  category: string;
  metadata: {
    count: number;
    severity_breakdown: {
      low: number;
      medium: number;
      high: number;
      critical: number;
    };
  };
}

export interface TrendAnalysisResult {
  analysisId: string;
  requestedRange: {
    start: string;
    end: string;
  };
  actualRange: {
    start: string;
    end: string;
  };
  granularity: string;
  trends: TrendSeries[];
  insights: TrendInsight[];
  forecasting?: ForecastingResult;
  metadata: {
    processingTime: number;
    dataPoints: number;
    categories: string[];
    timestamp: string;
  };
}

export interface TrendSeries {
  category: string;
  dataPoints: TrendDataPoint[];
  statistics: {
    mean: number;
    median: number;
    standardDeviation: number;
    min: number;
    max: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    trendStrength: number; // 0-1
    seasonality?: {
      detected: boolean;
      period?: number;
      strength?: number;
    };
  };
}

export interface TrendInsight {
  type: 'anomaly' | 'trend_change' | 'threshold_breach' | 'pattern' | 'correlation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  description: string;
  confidence: number;
  timeframe: {
    start: string;
    end: string;
  };
  data: {
    [key: string]: any;
  };
}

export interface ForecastingResult {
  method: 'linear_regression' | 'exponential_smoothing' | 'arima' | 'ensemble';
  predictions: ForecastPoint[];
  confidence_intervals: {
    upper: number[];
    lower: number[];
  };
  accuracy_metrics: {
    mae: number; // Mean Absolute Error
    rmse: number; // Root Mean Square Error
    mape: number; // Mean Absolute Percentage Error
    confidence: number;
  };
  model_metadata: {
    training_data_points: number;
    forecast_horizon: number;
    parameters: { [key: string]: any };
  };
}

export interface ForecastPoint {
  timestamp: string;
  predicted_value: number;
  confidence_interval: {
    upper: number;
    lower: number;
  };
  category: string;
}

export class TrendAnalysisService {
  private cache: Map<string, { result: TrendAnalysisResult; expiry: number }> = new Map();
  private readonly CACHE_TTL = 300000; // 5 minutes

  constructor() {
    logger.info('Trend Analysis Service initialized', {
      features: [
        'temporal_analysis',
        'statistical_forecasting',
        'anomaly_detection',
        'pattern_recognition',
        'correlation_analysis'
      ]
    });
  }

  /**
   * Perform comprehensive trend analysis on threat data
   */
  async analyzeTrends(request: TrendAnalysisRequest, threatData: ThreatEvent[]): Promise<TrendAnalysisResult> {
    const startTime = Date.now();
    const analysisId = `trend_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(request);
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiry > Date.now()) {
        logger.debug('Returning cached trend analysis result', { analysisId });
        return cached.result;
      }

      logger.info('Starting trend analysis', {
        analysisId,
        timeRange: request.timeRange,
        categories: request.categories,
        granularity: request.granularity,
        threatDataSize: threatData.length
      });

      // Filter and prepare data
      const filteredData = this.filterThreatData(threatData, request);
      const actualRange = this.getActualDataRange(filteredData);

      // Group data by time periods
      const groupedData = this.groupDataByGranularity(filteredData, request.granularity);

      // Generate trend series for each category
      const trends = await this.generateTrendSeries(groupedData, request.categories);

      // Detect insights and patterns
      const insights = await this.detectInsights(trends, filteredData);

      // Generate forecasting if requested
      let forecasting: ForecastingResult | undefined;
      if (request.includeForecasting) {
        forecasting = await this.generateForecasting(trends, request.forecastPeriods || 7);
      }

      const result: TrendAnalysisResult = {
        analysisId,
        requestedRange: request.timeRange,
        actualRange,
        granularity: request.granularity,
        trends,
        insights,
        forecasting,
        metadata: {
          processingTime: Date.now() - startTime,
          dataPoints: filteredData.length,
          categories: request.categories,
          timestamp: new Date().toISOString()
        }
      };

      // Cache result
      this.cache.set(cacheKey, {
        result,
        expiry: Date.now() + this.CACHE_TTL
      });

      logger.info('Trend analysis completed', {
        analysisId,
        processingTime: result.metadata.processingTime,
        trendsGenerated: trends.length,
        insightsFound: insights.length,
        forecastingIncluded: !!forecasting
      });

      return result;

    } catch (error) {
      logger.error('Trend analysis failed', {
        analysisId,
        error: error instanceof Error ? error.message : 'Unknown error',
        request
      });
      throw new Error(`Trend analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Filter threat data based on request parameters
   */
  private filterThreatData(threatData: ThreatEvent[], request: TrendAnalysisRequest): ThreatEvent[] {
    const startTime = new Date(request.timeRange.start).getTime();
    const endTime = new Date(request.timeRange.end).getTime();

    return threatData.filter(threat => {
      const threatTime = new Date(threat.timestamp).getTime();
      const inTimeRange = threatTime >= startTime && threatTime <= endTime;
      const inCategories = request.categories.length === 0 || request.categories.includes(threat.type);
      
      return inTimeRange && inCategories;
    });
  }

  /**
   * Get actual data range from filtered data
   */
  private getActualDataRange(data: ThreatEvent[]): { start: string; end: string } {
    if (data.length === 0) {
      return { start: new Date().toISOString(), end: new Date().toISOString() };
    }

    const timestamps = data.map(d => new Date(d.timestamp).getTime());
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);

    return {
      start: new Date(minTime).toISOString(),
      end: new Date(maxTime).toISOString()
    };
  }

  /**
   * Group data by specified granularity
   */
  private groupDataByGranularity(
    data: ThreatEvent[], 
    granularity: TrendAnalysisRequest['granularity']
  ): Map<string, Map<string, ThreatEvent[]>> {
    const grouped = new Map<string, Map<string, ThreatEvent[]>>();

    for (const threat of data) {
      const timeKey = this.getTimeKey(threat.timestamp, granularity);
      const category = threat.type;

      if (!grouped.has(timeKey)) {
        grouped.set(timeKey, new Map());
      }

      const categoryMap = grouped.get(timeKey)!;
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }

      categoryMap.get(category)!.push(threat);
    }

    return grouped;
  }

  /**
   * Generate time key based on granularity
   */
  private getTimeKey(timestamp: string, granularity: TrendAnalysisRequest['granularity']): string {
    const date = new Date(timestamp);

    switch (granularity) {
      case 'hourly':
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}T${date.getHours().toString().padStart(2, '0')}:00:00Z`;
      case 'daily':
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}T00:00:00Z`;
      case 'weekly':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        weekStart.setHours(0, 0, 0, 0);
        return weekStart.toISOString();
      default:
        return timestamp;
    }
  }

  /**
   * Generate trend series for categories
   */
  private async generateTrendSeries(
    groupedData: Map<string, Map<string, ThreatEvent[]>>,
    categories: string[]
  ): Promise<TrendSeries[]> {
    const trends: TrendSeries[] = [];

    // Get all categories if none specified
    const categoriesToAnalyze = categories.length > 0 ? categories : this.getAllCategories(groupedData);

    for (const category of categoriesToAnalyze) {
      const dataPoints: TrendDataPoint[] = [];

      // Generate data points for each time period
      for (const [timeKey, categoryMap] of groupedData) {
        const categoryData = categoryMap.get(category) || [];
        
        const severityBreakdown = {
          low: categoryData.filter(t => t.severity === 'low').length,
          medium: categoryData.filter(t => t.severity === 'medium').length,
          high: categoryData.filter(t => t.severity === 'high').length,
          critical: categoryData.filter(t => t.severity === 'critical').length
        };

        dataPoints.push({
          timestamp: timeKey,
          value: categoryData.length,
          category,
          metadata: {
            count: categoryData.length,
            severity_breakdown: severityBreakdown
          }
        });
      }

      // Sort by timestamp
      dataPoints.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Calculate statistics
      const values = dataPoints.map(dp => dp.value);
      const statistics = this.calculateStatistics(values);

      trends.push({
        category,
        dataPoints,
        statistics
      });
    }

    return trends;
  }

  /**
   * Calculate statistical measures for trend data
   */
  private calculateStatistics(values: number[]): TrendSeries['statistics'] {
    if (values.length === 0) {
      return {
        mean: 0,
        median: 0,
        standardDeviation: 0,
        min: 0,
        max: 0,
        trend: 'stable',
        trendStrength: 0
      };
    }

    const mean = stats.mean(values);
    const median = stats.median(values);
    const standardDeviation = stats.standardDeviation(values);
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Calculate trend using linear regression
    const xValues = values.map((_, index) => index);
    const linearRegression = stats.linearRegression(xValues.map((x, i) => [x, values[i]]));
    const slope = linearRegression.m;

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    let trendStrength = 0;

    if (Math.abs(slope) > 0.1) {
      trend = slope > 0 ? 'increasing' : 'decreasing';
      trendStrength = Math.min(Math.abs(slope), 1);
    }

    // Basic seasonality detection (simplified)
    const seasonality = this.detectSeasonality(values);

    return {
      mean,
      median,
      standardDeviation,
      min,
      max,
      trend,
      trendStrength,
      seasonality
    };
  }

  /**
   * Simple seasonality detection
   */
  private detectSeasonality(values: number[]): TrendSeries['statistics']['seasonality'] {
    if (values.length < 7) {
      return { detected: false };
    }

    // Simple autocorrelation check for weekly patterns
    const weeklyLag = 7;
    if (values.length >= weeklyLag * 2) {
      const autocorr = this.calculateAutocorrelation(values, weeklyLag);
      if (autocorr > 0.3) {
        return {
          detected: true,
          period: weeklyLag,
          strength: autocorr
        };
      }
    }

    return { detected: false };
  }

  /**
   * Calculate autocorrelation at specified lag
   */
  private calculateAutocorrelation(values: number[], lag: number): number {
    if (values.length <= lag) return 0;

    const n = values.length - lag;
    const mean = stats.mean(values);
    
    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (values[i] - mean) * (values[i + lag] - mean);
    }

    for (let i = 0; i < values.length; i++) {
      denominator += Math.pow(values[i] - mean, 2);
    }

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Detect insights and patterns
   */
  private async detectInsights(trends: TrendSeries[], rawData: ThreatEvent[]): Promise<TrendInsight[]> {
    const insights: TrendInsight[] = [];

    for (const trend of trends) {
      // Anomaly detection
      const anomalies = this.detectAnomalies(trend);
      insights.push(...anomalies);

      // Trend change detection
      const trendChanges = this.detectTrendChanges(trend);
      insights.push(...trendChanges);

      // Threshold breach detection
      const thresholdBreaches = this.detectThresholdBreaches(trend);
      insights.push(...thresholdBreaches);
    }

    // Cross-category correlations
    const correlations = this.detectCorrelations(trends);
    insights.push(...correlations);

    return insights;
  }

  /**
   * Detect anomalies in trend data
   */
  private detectAnomalies(trend: TrendSeries): TrendInsight[] {
    const insights: TrendInsight[] = [];
    const values = trend.dataPoints.map(dp => dp.value);
    const mean = trend.statistics.mean;
    const stdDev = trend.statistics.standardDeviation;

    // Z-score based anomaly detection
    const threshold = 2.5; // 2.5 standard deviations
    
    for (let i = 0; i < trend.dataPoints.length; i++) {
      const value = values[i];
      const zScore = stdDev === 0 ? 0 : Math.abs((value - mean) / stdDev);
      
      if (zScore > threshold) {
        insights.push({
          type: 'anomaly',
          severity: zScore > 3 ? 'high' : 'medium',
          category: trend.category,
          description: `Anomalous spike in ${trend.category} threats: ${value} events (${zScore.toFixed(2)}σ above normal)`,
          confidence: Math.min(zScore / 4, 1),
          timeframe: {
            start: trend.dataPoints[i].timestamp,
            end: trend.dataPoints[i].timestamp
          },
          data: {
            value,
            zScore,
            mean,
            standardDeviation: stdDev
          }
        });
      }
    }

    return insights;
  }

  /**
   * Detect trend changes
   */
  private detectTrendChanges(trend: TrendSeries): TrendInsight[] {
    const insights: TrendInsight[] = [];
    
    if (trend.statistics.trendStrength > 0.5) {
      const severity = trend.statistics.trendStrength > 0.8 ? 'high' : 'medium';
      
      insights.push({
        type: 'trend_change',
        severity,
        category: trend.category,
        description: `Strong ${trend.statistics.trend} trend detected in ${trend.category} threats (strength: ${(trend.statistics.trendStrength * 100).toFixed(1)}%)`,
        confidence: trend.statistics.trendStrength,
        timeframe: {
          start: trend.dataPoints[0]?.timestamp || new Date().toISOString(),
          end: trend.dataPoints[trend.dataPoints.length - 1]?.timestamp || new Date().toISOString()
        },
        data: {
          trend: trend.statistics.trend,
          strength: trend.statistics.trendStrength,
          dataPoints: trend.dataPoints.length
        }
      });
    }

    return insights;
  }

  /**
   * Detect threshold breaches
   */
  private detectThresholdBreaches(trend: TrendSeries): TrendInsight[] {
    const insights: TrendInsight[] = [];
    
    // Define dynamic thresholds based on historical data
    const highThreshold = trend.statistics.mean + (2 * trend.statistics.standardDeviation);
    const criticalThreshold = trend.statistics.mean + (3 * trend.statistics.standardDeviation);

    for (const dataPoint of trend.dataPoints) {
      if (dataPoint.value > criticalThreshold) {
        insights.push({
          type: 'threshold_breach',
          severity: 'critical',
          category: trend.category,
          description: `Critical threshold breach: ${dataPoint.value} ${trend.category} threats (threshold: ${criticalThreshold.toFixed(1)})`,
          confidence: 0.9,
          timeframe: {
            start: dataPoint.timestamp,
            end: dataPoint.timestamp
          },
          data: {
            value: dataPoint.value,
            threshold: criticalThreshold,
            breachPercentage: ((dataPoint.value - criticalThreshold) / criticalThreshold * 100).toFixed(1)
          }
        });
      } else if (dataPoint.value > highThreshold) {
        insights.push({
          type: 'threshold_breach',
          severity: 'medium',
          category: trend.category,
          description: `High threshold breach: ${dataPoint.value} ${trend.category} threats (threshold: ${highThreshold.toFixed(1)})`,
          confidence: 0.7,
          timeframe: {
            start: dataPoint.timestamp,
            end: dataPoint.timestamp
          },
          data: {
            value: dataPoint.value,
            threshold: highThreshold,
            breachPercentage: ((dataPoint.value - highThreshold) / highThreshold * 100).toFixed(1)
          }
        });
      }
    }

    return insights;
  }

  /**
   * Detect correlations between categories
   */
  private detectCorrelations(trends: TrendSeries[]): TrendInsight[] {
    const insights: TrendInsight[] = [];

    for (let i = 0; i < trends.length; i++) {
      for (let j = i + 1; j < trends.length; j++) {
        const trend1 = trends[i];
        const trend2 = trends[j];

        const correlation = this.calculateCorrelation(
          trend1.dataPoints.map(dp => dp.value),
          trend2.dataPoints.map(dp => dp.value)
        );

        if (Math.abs(correlation) > 0.7) {
          insights.push({
            type: 'correlation',
            severity: Math.abs(correlation) > 0.9 ? 'high' : 'medium',
            category: `${trend1.category} & ${trend2.category}`,
            description: `Strong ${correlation > 0 ? 'positive' : 'negative'} correlation between ${trend1.category} and ${trend2.category} threats (r=${correlation.toFixed(3)})`,
            confidence: Math.abs(correlation),
            timeframe: {
              start: trend1.dataPoints[0]?.timestamp || new Date().toISOString(),
              end: trend1.dataPoints[trend1.dataPoints.length - 1]?.timestamp || new Date().toISOString()
            },
            data: {
              correlation,
              category1: trend1.category,
              category2: trend2.category,
              dataPoints: Math.min(trend1.dataPoints.length, trend2.dataPoints.length)
            }
          });
        }
      }
    }

    return insights;
  }

  /**
   * Calculate Pearson correlation coefficient
   */
  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Generate forecasting predictions
   */
  private async generateForecasting(
    trends: TrendSeries[], 
    forecastPeriods: number
  ): Promise<ForecastingResult> {
    // Use the trend with most data points for forecasting
    const mainTrend = trends.reduce((max, trend) => 
      trend.dataPoints.length > max.dataPoints.length ? trend : max
    );

    const values = mainTrend.dataPoints.map(dp => dp.value);
    const timestamps = mainTrend.dataPoints.map(dp => dp.timestamp);

    // Simple linear regression forecasting
    const xValues = values.map((_, index) => index);
    const regression = stats.linearRegression(xValues.map((x, i) => [x, values[i]]));

    const predictions: ForecastPoint[] = [];
    const errors = values.map((actual, i) => Math.abs(actual - (regression.m * i + regression.b)));
    const mae = stats.mean(errors);
    const rmse = Math.sqrt(stats.mean(errors.map(e => e * e)));

    // Generate predictions
    for (let i = 0; i < forecastPeriods; i++) {
      const futureIndex = values.length + i;
      const predictedValue = regression.m * futureIndex + regression.b;
      const confidenceInterval = mae * 1.96; // 95% confidence interval approximation

      // Generate future timestamp
      const lastTimestamp = new Date(timestamps[timestamps.length - 1]);
      const futureTimestamp = new Date(lastTimestamp);
      futureTimestamp.setHours(futureTimestamp.getHours() + 24 * (i + 1)); // Daily increment

      predictions.push({
        timestamp: futureTimestamp.toISOString(),
        predicted_value: Math.max(0, predictedValue),
        confidence_interval: {
          upper: Math.max(0, predictedValue + confidenceInterval),
          lower: Math.max(0, predictedValue - confidenceInterval)
        },
        category: mainTrend.category
      });
    }

    const mape = values.length > 0 ? 
      stats.mean(values.map((actual, i) => Math.abs((actual - (regression.m * i + regression.b)) / Math.max(actual, 1)) * 100)) : 0;

    return {
      method: 'linear_regression',
      predictions,
      confidence_intervals: {
        upper: predictions.map(p => p.confidence_interval.upper),
        lower: predictions.map(p => p.confidence_interval.lower)
      },
      accuracy_metrics: {
        mae,
        rmse,
        mape,
        confidence: Math.max(0, 1 - (rmse / (stats.max(values) || 1)))
      },
      model_metadata: {
        training_data_points: values.length,
        forecast_horizon: forecastPeriods,
        parameters: {
          slope: regression.m,
          intercept: regression.b,
          r_squared: Math.pow(this.calculateCorrelation(xValues, values), 2)
        }
      }
    };
  }

  /**
   * Get all unique categories from grouped data
   */
  private getAllCategories(groupedData: Map<string, Map<string, ThreatEvent[]>>): string[] {
    const categories = new Set<string>();
    
    for (const categoryMap of groupedData.values()) {
      for (const category of categoryMap.keys()) {
        categories.add(category);
      }
    }

    return Array.from(categories);
  }

  /**
   * Generate cache key for request
   */
  private generateCacheKey(request: TrendAnalysisRequest): string {
    return `trend_${JSON.stringify(request)}`;
  }

  /**
   * Clean expired cache entries
   */
  public cleanCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache) {
      if (cached.expiry < now) {
        this.cache.delete(key);
      }
    }
  }
}

// Singleton instance
export const trendAnalysisService = new TrendAnalysisService();