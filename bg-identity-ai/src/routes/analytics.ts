import { Router } from 'express';
import { logger } from '@/lib/logger';
import { trendAnalysisService, TrendAnalysisRequest } from '@/services/analytics/trend-analysis-service';
import { dashboardMetricsService, DashboardMetricsRequest } from '@/services/analytics/dashboard-metrics-service';
import { ThreatDetectionService } from '@/services/threat-detection-service';

const router = Router();
const threatService = new ThreatDetectionService();

/**
 * POST /api/analytics/trend-analysis
 * Advanced trend analysis with forecasting
 */
router.post('/trend-analysis', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const request: TrendAnalysisRequest = req.body;

    // Validate request
    if (!request.timeRange || !request.timeRange.start || !request.timeRange.end) {
      return res.status(400).json({ 
        error: 'Time range with start and end dates is required' 
      });
    }

    // Validate date format
    const startDate = new Date(request.timeRange.start);
    const endDate = new Date(request.timeRange.end);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ 
        error: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)' 
      });
    }

    if (startDate >= endDate) {
      return res.status(400).json({ 
        error: 'End date must be after start date' 
      });
    }

    // Validate granularity
    if (!['hourly', 'daily', 'weekly'].includes(request.granularity)) {
      return res.status(400).json({ 
        error: 'Granularity must be one of: hourly, daily, weekly' 
      });
    }

    logger.info('Trend analysis requested', {
      userId,
      timeRange: request.timeRange,
      granularity: request.granularity,
      categories: request.categories,
      includeForecasting: request.includeForecasting
    });

    // Get threat data for analysis (in production, this would query the database)
    const threatData = await threatService.getThreatHistory({
      userId,
      since: request.timeRange.start,
      limit: 10000 // Large limit for comprehensive analysis
    });

    // Perform trend analysis
    const result = await trendAnalysisService.analyzeTrends(request, threatData);

    logger.info('Trend analysis completed', {
      userId,
      analysisId: result.analysisId,
      processingTime: result.metadata.processingTime,
      trendsGenerated: result.trends.length,
      insightsFound: result.insights.length,
      forecastingIncluded: !!result.forecasting
    });

    return res.json({
      success: true,
      data: result,
      metadata: {
        requestId: `trend_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId
      }
    });

  } catch (error) {
    logger.error('Trend analysis failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      requestBody: req.body
    });
    
    return res.status(500).json({ 
      error: 'Trend analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/dashboard-metrics
 * Real-time dashboard metrics and KPIs
 */
router.get('/dashboard-metrics', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Parse query parameters
    const includeRealtime = req.query.realtime === 'true';
    const includePredictions = req.query.predictions === 'true';
    const refreshInterval = req.query.refresh ? parseInt(req.query.refresh as string) : undefined;

    // Optional time range for historical context
    let timeRange: { start: string; end: string } | undefined;
    if (req.query.start && req.query.end) {
      timeRange = {
        start: req.query.start as string,
        end: req.query.end as string
      };
    }

    const request: DashboardMetricsRequest = {
      timeRange,
      includeRealtime,
      includePredictions,
      refreshInterval
    };

    logger.info('Dashboard metrics requested', {
      userId,
      includeRealtime,
      includePredictions,
      timeRange
    });

    // Get dashboard metrics
    const metrics = await dashboardMetricsService.getDashboardMetrics(request);

    logger.info('Dashboard metrics generated', {
      userId,
      generationTime: metrics.metadata.generationTime,
      dataFreshness: metrics.metadata.dataFreshness,
      totalThreats: metrics.realTimeStats.currentPeriod.totalThreats,
      systemHealth: metrics.systemHealth.overallHealth
    });

    return res.json({
      success: true,
      data: metrics,
      metadata: {
        requestId: `dashboard_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId,
        cached: metrics.metadata.generationTime < 100 // Likely cached if very fast
      }
    });

  } catch (error) {
    logger.error('Dashboard metrics failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      query: req.query
    });
    
    return res.status(500).json({ 
      error: 'Dashboard metrics generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/analytics/predictive-modeling
 * ML-based threat forecasting
 */
router.post('/predictive-modeling', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { targetMetrics, forecastPeriod, confidenceLevel } = req.body;

    // Validate request
    if (!targetMetrics || !Array.isArray(targetMetrics)) {
      return res.status(400).json({ 
        error: 'targetMetrics array is required' 
      });
    }

    if (!forecastPeriod || typeof forecastPeriod !== 'number' || forecastPeriod < 1 || forecastPeriod > 30) {
      return res.status(400).json({ 
        error: 'forecastPeriod must be a number between 1 and 30 days' 
      });
    }

    const confidence = confidenceLevel || 0.95;
    if (confidence < 0.5 || confidence > 0.99) {
      return res.status(400).json({ 
        error: 'confidenceLevel must be between 0.5 and 0.99' 
      });
    }

    logger.info('Predictive modeling requested', {
      userId,
      targetMetrics,
      forecastPeriod,
      confidenceLevel: confidence
    });

    // Get historical data for prediction
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days history

    const threatData = await threatService.getThreatHistory({
      userId,
      since: startDate.toISOString(),
      limit: 5000
    });

    // Use trend analysis with forecasting enabled
    const trendRequest: TrendAnalysisRequest = {
      timeRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      categories: targetMetrics,
      granularity: 'daily',
      includeForecasting: true,
      forecastPeriods: forecastPeriod
    };

    const trendResult = await trendAnalysisService.analyzeTrends(trendRequest, threatData);

    // Extract forecasting result
    const forecastingResult = trendResult.forecasting;
    
    if (!forecastingResult) {
      return res.status(500).json({ 
        error: 'Forecasting generation failed' 
      });
    }

    const result = {
      modelId: `predictive_${Date.now()}`,
      forecastPeriod,
      confidenceLevel: confidence,
      targetMetrics,
      predictions: forecastingResult.predictions,
      confidence_intervals: forecastingResult.confidence_intervals,
      accuracy_metrics: {
        ...forecastingResult.accuracy_metrics,
        expectedAccuracy: Math.min(0.95, forecastingResult.accuracy_metrics.confidence * confidence)
      },
      model_metadata: {
        ...forecastingResult.model_metadata,
        dataQuality: threatData.length > 100 ? 'high' : threatData.length > 50 ? 'medium' : 'low',
        seasonalityDetected: trendResult.trends.some(t => t.statistics.seasonality?.detected)
      },
      insights: trendResult.insights.filter(i => ['trend_change', 'pattern'].includes(i.type)),
      recommendations: this.generatePredictiveRecommendations(forecastingResult, trendResult.insights)
    };

    logger.info('Predictive modeling completed', {
      userId,
      modelId: result.modelId,
      predictionsMade: result.predictions.length,
      expectedAccuracy: result.accuracy_metrics.expectedAccuracy,
      dataQuality: result.model_metadata.dataQuality
    });

    return res.json({
      success: true,
      data: result,
      metadata: {
        requestId: `prediction_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId,
        processingTime: trendResult.metadata.processingTime
      }
    });

  } catch (error) {
    logger.error('Predictive modeling failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      requestBody: req.body
    });
    
    return res.status(500).json({ 
      error: 'Predictive modeling failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/statistics
 * Historical aggregations and summaries
 */
router.get('/statistics', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Parse query parameters
    const period = req.query.period as string || 'last_30_days';
    const groupBy = req.query.group_by as string || 'day';
    const categories = req.query.categories ? (req.query.categories as string).split(',') : [];

    // Validate period
    const validPeriods = ['last_24_hours', 'last_7_days', 'last_30_days', 'last_90_days'];
    if (!validPeriods.includes(period)) {
      return res.status(400).json({ 
        error: `Period must be one of: ${validPeriods.join(', ')}` 
      });
    }

    // Validate groupBy
    const validGroupBy = ['hour', 'day', 'week', 'month'];
    if (!validGroupBy.includes(groupBy)) {
      return res.status(400).json({ 
        error: `group_by must be one of: ${validGroupBy.join(', ')}` 
      });
    }

    logger.info('Statistics requested', {
      userId,
      period,
      groupBy,
      categories
    });

    // Calculate time range based on period
    const endDate = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'last_24_hours':
        startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'last_7_days':
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last_30_days':
        startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'last_90_days':
        startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get threat data
    const threatData = await threatService.getThreatHistory({
      userId,
      since: startDate.toISOString(),
      limit: 10000
    });

    // Calculate statistics
    const statistics = this.calculateStatistics(threatData, groupBy, categories);
    
    const result = {
      period,
      timeRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      groupBy,
      categories: categories.length > 0 ? categories : 'all',
      statistics,
      summary: {
        totalThreats: threatData.length,
        averageRiskScore: threatData.length > 0 ? 
          threatData.reduce((sum, t) => sum + t.riskScore, 0) / threatData.length : 0,
        severityDistribution: this.calculateSeverityDistribution(threatData),
        categoryDistribution: this.calculateCategoryDistribution(threatData),
        resolutionStats: this.calculateResolutionStats(threatData),
        trends: {
          direction: this.calculateTrendDirection(threatData),
          changeRate: this.calculateChangeRate(threatData)
        }
      }
    };

    logger.info('Statistics calculated', {
      userId,
      period,
      totalThreats: result.summary.totalThreats,
      averageRiskScore: result.summary.averageRiskScore.toFixed(2),
      statisticsGroups: result.statistics.length
    });

    return res.json({
      success: true,
      data: result,
      metadata: {
        requestId: `stats_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId
      }
    });

  } catch (error) {
    logger.error('Statistics calculation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      query: req.query
    });
    
    return res.status(500).json({ 
      error: 'Statistics calculation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/analytics/bulk-operations
 * Batch threat management operations
 */
router.post('/bulk-operations', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { operation, threatIds, parameters } = req.body;

    // Validate request
    if (!operation) {
      return res.status(400).json({ error: 'Operation is required' });
    }

    if (!threatIds || !Array.isArray(threatIds) || threatIds.length === 0) {
      return res.status(400).json({ error: 'threatIds array is required and cannot be empty' });
    }

    if (threatIds.length > 1000) {
      return res.status(400).json({ error: 'Maximum 1000 threats can be processed in a single operation' });
    }

    const validOperations = ['update_status', 'assign', 'classify', 'delete', 'archive'];
    if (!validOperations.includes(operation)) {
      return res.status(400).json({ 
        error: `Operation must be one of: ${validOperations.join(', ')}` 
      });
    }

    logger.info('Bulk operation requested', {
      userId,
      operation,
      threatCount: threatIds.length,
      parameters
    });

    // Process bulk operation
    const results = await this.processBulkOperation(operation, threatIds, parameters, userId);

    logger.info('Bulk operation completed', {
      userId,
      operation,
      threatCount: threatIds.length,
      successCount: results.successful.length,
      failureCount: results.failed.length,
      processingTime: results.processingTime
    });

    return res.json({
      success: true,
      data: {
        operation,
        threatIds,
        results
      },
      metadata: {
        requestId: `bulk_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId
      }
    });

  } catch (error) {
    logger.error('Bulk operation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      requestBody: req.body
    });
    
    return res.status(500).json({ 
      error: 'Bulk operation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/export
 * Multi-format data export
 */
router.get('/export', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const format = req.query.format as string || 'json';
    const timeRange = {
      start: req.query.start as string,
      end: req.query.end as string
    };
    const categories = req.query.categories ? (req.query.categories as string).split(',') : [];
    const includeDetails = req.query.details === 'true';

    // Validate format
    const validFormats = ['json', 'csv', 'pdf'];
    if (!validFormats.includes(format)) {
      return res.status(400).json({ 
        error: `Format must be one of: ${validFormats.join(', ')}` 
      });
    }

    // Validate time range
    if (!timeRange.start || !timeRange.end) {
      return res.status(400).json({ 
        error: 'start and end date parameters are required' 
      });
    }

    logger.info('Data export requested', {
      userId,
      format,
      timeRange,
      categories,
      includeDetails
    });

    // Get threat data
    const threatData = await threatService.getThreatHistory({
      userId,
      since: timeRange.start,
      limit: 5000
    });

    // Filter by categories if specified
    const filteredData = categories.length > 0 ? 
      threatData.filter(t => categories.includes(t.type)) : 
      threatData;

    // Generate export based on format
    const exportResult = await this.generateExport(filteredData, format, includeDetails);

    // Set appropriate headers
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="threats_export_${Date.now()}.csv"`);
    } else if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="threats_export_${Date.now()}.pdf"`);
    } else {
      res.setHeader('Content-Type', 'application/json');
    }

    logger.info('Data export completed', {
      userId,
      format,
      threatsExported: filteredData.length,
      exportSize: typeof exportResult.data === 'string' ? exportResult.data.length : JSON.stringify(exportResult.data).length
    });

    if (format === 'json') {
      return res.json({
        success: true,
        data: exportResult.data,
        metadata: {
          requestId: `export_${Date.now()}`,
          timestamp: new Date().toISOString(),
          userId,
          format,
          threatCount: filteredData.length,
          timeRange
        }
      });
    } else {
      return res.send(exportResult.data);
    }

  } catch (error) {
    logger.error('Data export failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      query: req.query
    });
    
    return res.status(500).json({ 
      error: 'Data export failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper methods (would be moved to utility classes in production)
function generatePredictiveRecommendations(forecastingResult: any, insights: any[]): string[] {
  const recommendations: string[] = [];

  // Analyze forecast trends
  const avgPrediction = forecastingResult.predictions.reduce((sum: number, p: any) => sum + p.predicted_value, 0) / forecastingResult.predictions.length;
  
  if (avgPrediction > 50) {
    recommendations.push('Consider increasing monitoring frequency due to elevated threat predictions');
  }

  if (forecastingResult.accuracy_metrics.confidence < 0.7) {
    recommendations.push('Model confidence is low - consider collecting more historical data');
  }

  // Analyze insights
  const criticalInsights = insights.filter(i => i.severity === 'critical');
  if (criticalInsights.length > 0) {
    recommendations.push('Critical patterns detected - implement enhanced monitoring measures');
  }

  // Default recommendations
  if (recommendations.length === 0) {
    recommendations.push('Continue monitoring with current parameters');
    recommendations.push('Review forecasting accuracy weekly');
  }

  return recommendations;
}

// Additional helper methods would be implemented here...
function calculateStatistics(threatData: any[], groupBy: string, categories: string[]): any[] {
  // Mock implementation - would implement proper grouping and statistics
  return [
    {
      period: '2025-01-12',
      count: Math.floor(Math.random() * 50),
      averageRiskScore: Math.random() * 10,
      severityBreakdown: {
        critical: Math.floor(Math.random() * 10),
        high: Math.floor(Math.random() * 15),
        medium: Math.floor(Math.random() * 20),
        low: Math.floor(Math.random() * 25)
      }
    }
  ];
}

function calculateSeverityDistribution(threatData: any[]): any {
  return {
    critical: threatData.filter(t => t.severity === 'critical').length,
    high: threatData.filter(t => t.severity === 'high').length,
    medium: threatData.filter(t => t.severity === 'medium').length,
    low: threatData.filter(t => t.severity === 'low').length
  };
}

function calculateCategoryDistribution(threatData: any[]): any {
  const categories = new Map();
  threatData.forEach(t => {
    categories.set(t.type, (categories.get(t.type) || 0) + 1);
  });
  return Object.fromEntries(categories);
}

function calculateResolutionStats(threatData: any[]): any {
  return {
    resolved: threatData.filter(t => t.status === 'resolved').length,
    active: threatData.filter(t => t.status === 'active').length,
    investigating: threatData.filter(t => t.status === 'investigating').length,
    falsePositive: threatData.filter(t => t.status === 'false_positive').length
  };
}

function calculateTrendDirection(threatData: any[]): string {
  // Simple trend calculation
  return Math.random() > 0.5 ? 'increasing' : 'decreasing';
}

function calculateChangeRate(threatData: any[]): number {
  // Mock change rate
  return (Math.random() - 0.5) * 50; // -25% to +25%
}

async function processBulkOperation(operation: string, threatIds: string[], parameters: any, userId: string): Promise<any> {
  const startTime = Date.now();
  const successful: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  // Mock bulk operation processing
  for (const threatId of threatIds) {
    if (Math.random() > 0.1) { // 90% success rate
      successful.push(threatId);
    } else {
      failed.push({ id: threatId, error: 'Operation failed' });
    }
  }

  return {
    successful,
    failed,
    processingTime: Date.now() - startTime,
    operation,
    parameters
  };
}

async function generateExport(threatData: any[], format: string, includeDetails: boolean): Promise<{ data: any }> {
  if (format === 'csv') {
    // Mock CSV generation
    const headers = ['ID', 'Type', 'Severity', 'Risk Score', 'Timestamp', 'Status'];
    const rows = threatData.map(t => 
      [t.id, t.type, t.severity, t.riskScore, t.timestamp, t.status].join(',')
    );
    return { data: [headers.join(','), ...rows].join('\n') };
  } else if (format === 'pdf') {
    // Mock PDF generation
    return { data: 'PDF content would be generated here' };
  } else {
    // JSON format
    return { 
      data: includeDetails ? threatData : threatData.map(t => ({
        id: t.id,
        type: t.type,
        severity: t.severity,
        riskScore: t.riskScore,
        timestamp: t.timestamp,
        status: t.status
      }))
    };
  }
}

export { router as analyticsRoutes };