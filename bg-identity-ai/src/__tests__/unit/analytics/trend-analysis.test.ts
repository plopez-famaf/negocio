import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TrendAnalysisService, TrendAnalysisRequest } from '@/services/analytics/trend-analysis-service';
import { ThreatEvent } from '@/types/threat';

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('TrendAnalysisService', () => {
  let trendAnalysisService: TrendAnalysisService;
  let mockThreatData: ThreatEvent[];

  beforeEach(() => {
    trendAnalysisService = new TrendAnalysisService();
    
    // Create comprehensive mock threat data for testing
    mockThreatData = [
      {
        id: 'threat_1',
        timestamp: '2025-01-10T10:00:00.000Z',
        type: 'malware',
        severity: 'high',
        source: 'scanner_1',
        target: 'server_1',
        description: 'Malware detected in file system',
        riskScore: 8.5,
        status: 'active',
        metadata: { correlationId: 'corr_1', source: 'detector_1' }
      },
      {
        id: 'threat_2',
        timestamp: '2025-01-10T11:00:00.000Z',
        type: 'intrusion',
        severity: 'critical',
        source: 'scanner_2',
        target: 'server_2',
        description: 'Unauthorized access attempt',
        riskScore: 9.2,
        status: 'investigating',
        metadata: { correlationId: 'corr_2', source: 'detector_2' }
      },
      {
        id: 'threat_3',
        timestamp: '2025-01-10T12:00:00.000Z',
        type: 'anomaly',
        severity: 'medium',
        source: 'scanner_1',
        target: 'server_3',
        description: 'Behavioral anomaly detected',
        riskScore: 6.1,
        status: 'resolved',
        metadata: { correlationId: 'corr_3', source: 'detector_3' }
      },
      {
        id: 'threat_4',
        timestamp: '2025-01-10T13:00:00.000Z',
        type: 'malware',
        severity: 'high',
        source: 'scanner_3',
        target: 'server_1',
        description: 'Another malware instance',
        riskScore: 7.8,
        status: 'active',
        metadata: { correlationId: 'corr_4', source: 'detector_1' }
      },
      {
        id: 'threat_5',
        timestamp: '2025-01-10T14:00:00.000Z',
        type: 'behavioral',
        severity: 'low',
        source: 'scanner_2',
        target: 'server_4',
        description: 'Unusual user behavior',
        riskScore: 4.2,
        status: 'false_positive',
        metadata: { correlationId: 'corr_5', source: 'detector_4' }
      }
    ];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeTrends', () => {
    it('should analyze trends with basic parameters', async () => {
      const request: TrendAnalysisRequest = {
        timeRange: {
          start: '2025-01-10T09:00:00.000Z',
          end: '2025-01-10T15:00:00.000Z'
        },
        granularity: 'hourly',
        categories: ['malware', 'intrusion']
      };

      const result = await trendAnalysisService.analyzeTrends(request, mockThreatData);

      expect(result).toBeDefined();
      expect(result.analysisId).toMatch(/^trend_analysis_/);
      expect(result.trends).toBeInstanceOf(Array);
      expect(result.trends.length).toBeGreaterThan(0);
      expect(result.metadata.processingTime).toBeGreaterThan(0);
    });

    it('should handle hourly granularity correctly', async () => {
      const request: TrendAnalysisRequest = {
        timeRange: {
          start: '2025-01-10T09:00:00.000Z',
          end: '2025-01-10T15:00:00.000Z'
        },
        granularity: 'hourly',
        categories: ['malware']
      };

      const result = await trendAnalysisService.analyzeTrends(request, mockThreatData);

      // Should group data by hours
      const malwareTrend = result.trends.find(t => t.category === 'malware');
      expect(malwareTrend).toBeDefined();
      expect(malwareTrend?.dataPoints).toBeInstanceOf(Array);
      expect(malwareTrend?.dataPoints.length).toBeGreaterThan(0);
    });

    it('should handle daily granularity correctly', async () => {
      const request: TrendAnalysisRequest = {
        timeRange: {
          start: '2025-01-09T00:00:00.000Z',
          end: '2025-01-11T23:59:59.000Z'
        },
        granularity: 'daily',
        categories: ['malware', 'intrusion']
      };

      const result = await trendAnalysisService.analyzeTrends(request, mockThreatData);

      expect(result.trends).toBeInstanceOf(Array);
      result.trends.forEach(trend => {
        expect(trend.granularity).toBe('daily');
        expect(trend.dataPoints).toBeInstanceOf(Array);
      });
    });

    it('should handle weekly granularity correctly', async () => {
      // Extend mock data to span multiple weeks
      const weeklyMockData = [
        ...mockThreatData,
        {
          id: 'threat_week2',
          timestamp: '2025-01-17T10:00:00.000Z',
          type: 'malware',
          severity: 'high',
          source: 'scanner_1',
          target: 'server_1',
          description: 'Weekly test threat',
          riskScore: 7.5,
          status: 'active',
          metadata: { correlationId: 'corr_week2', source: 'detector_1' }
        }
      ];

      const request: TrendAnalysisRequest = {
        timeRange: {
          start: '2025-01-06T00:00:00.000Z',
          end: '2025-01-20T23:59:59.000Z'
        },
        granularity: 'weekly',
        categories: ['malware']
      };

      const result = await trendAnalysisService.analyzeTrends(request, weeklyMockData);

      expect(result.trends).toBeInstanceOf(Array);
      const malwareTrend = result.trends.find(t => t.category === 'malware');
      expect(malwareTrend?.granularity).toBe('weekly');
    });

    it('should include forecasting when requested', async () => {
      const request: TrendAnalysisRequest = {
        timeRange: {
          start: '2025-01-10T09:00:00.000Z',
          end: '2025-01-10T15:00:00.000Z'
        },
        granularity: 'hourly',
        categories: ['malware'],
        includeForecasting: true,
        forecastPeriods: 5
      };

      const result = await trendAnalysisService.analyzeTrends(request, mockThreatData);

      expect(result.forecasting).toBeDefined();
      expect(result.forecasting?.predictions).toBeInstanceOf(Array);
      expect(result.forecasting?.predictions.length).toBe(5);
      expect(result.forecasting?.confidence_intervals).toBeDefined();
      expect(result.forecasting?.accuracy_metrics).toBeDefined();
    });

    it('should exclude forecasting when not requested', async () => {
      const request: TrendAnalysisRequest = {
        timeRange: {
          start: '2025-01-10T09:00:00.000Z',
          end: '2025-01-10T15:00:00.000Z'
        },
        granularity: 'hourly',
        categories: ['malware'],
        includeForecasting: false
      };

      const result = await trendAnalysisService.analyzeTrends(request, mockThreatData);

      expect(result.forecasting).toBeUndefined();
    });

    it('should generate insights based on trend data', async () => {
      const request: TrendAnalysisRequest = {
        timeRange: {
          start: '2025-01-10T09:00:00.000Z',
          end: '2025-01-10T15:00:00.000Z'
        },
        granularity: 'hourly',
        categories: ['malware', 'intrusion']
      };

      const result = await trendAnalysisService.analyzeTrends(request, mockThreatData);

      expect(result.insights).toBeInstanceOf(Array);
      expect(result.insights.length).toBeGreaterThan(0);
      
      result.insights.forEach(insight => {
        expect(insight).toHaveProperty('type');
        expect(insight).toHaveProperty('message');
        expect(insight).toHaveProperty('severity');
        expect(insight).toHaveProperty('confidence');
        expect(['trend_change', 'anomaly', 'pattern', 'forecast'].includes(insight.type)).toBe(true);
      });
    });

    it('should calculate statistical metrics correctly', async () => {
      const request: TrendAnalysisRequest = {
        timeRange: {
          start: '2025-01-10T09:00:00.000Z',
          end: '2025-01-10T15:00:00.000Z'
        },
        granularity: 'hourly',
        categories: ['malware']
      };

      const result = await trendAnalysisService.analyzeTrends(request, mockThreatData);

      const malwareTrend = result.trends.find(t => t.category === 'malware');
      expect(malwareTrend?.statistics).toBeDefined();
      expect(malwareTrend?.statistics.average).toBeGreaterThan(0);
      expect(malwareTrend?.statistics.total).toBeGreaterThan(0);
      expect(malwareTrend?.statistics.trend.direction).toMatch(/^(increasing|decreasing|stable)$/);
      expect(malwareTrend?.statistics.trend.strength).toBeGreaterThanOrEqual(0);
      expect(malwareTrend?.statistics.trend.strength).toBeLessThanOrEqual(1);
    });

    it('should handle empty threat data gracefully', async () => {
      const request: TrendAnalysisRequest = {
        timeRange: {
          start: '2025-01-10T09:00:00.000Z',
          end: '2025-01-10T15:00:00.000Z'
        },
        granularity: 'hourly',
        categories: ['malware']
      };

      const result = await trendAnalysisService.analyzeTrends(request, []);

      expect(result).toBeDefined();
      expect(result.trends).toBeInstanceOf(Array);
      expect(result.trends.length).toBe(0);
      expect(result.insights).toBeInstanceOf(Array);
    });

    it('should filter data by categories correctly', async () => {
      const request: TrendAnalysisRequest = {
        timeRange: {
          start: '2025-01-10T09:00:00.000Z',
          end: '2025-01-10T15:00:00.000Z'
        },
        granularity: 'hourly',
        categories: ['intrusion'] // Only intrusion, not malware
      };

      const result = await trendAnalysisService.analyzeTrends(request, mockThreatData);

      expect(result.trends.length).toBe(1);
      expect(result.trends[0].category).toBe('intrusion');
      
      // Should not include malware trends
      const malwareTrend = result.trends.find(t => t.category === 'malware');
      expect(malwareTrend).toBeUndefined();
    });

    it('should handle invalid time ranges gracefully', async () => {
      const request: TrendAnalysisRequest = {
        timeRange: {
          start: '2025-01-10T15:00:00.000Z', // End before start
          end: '2025-01-10T09:00:00.000Z'
        },
        granularity: 'hourly',
        categories: ['malware']
      };

      await expect(trendAnalysisService.analyzeTrends(request, mockThreatData))
        .rejects.toThrow('Invalid time range');
    });

    it('should validate granularity parameter', async () => {
      const request = {
        timeRange: {
          start: '2025-01-10T09:00:00.000Z',
          end: '2025-01-10T15:00:00.000Z'
        },
        granularity: 'invalid_granularity', // Invalid granularity
        categories: ['malware']
      } as TrendAnalysisRequest;

      await expect(trendAnalysisService.analyzeTrends(request, mockThreatData))
        .rejects.toThrow('Invalid granularity');
    });

    it('should handle large datasets efficiently', async () => {
      // Create a large dataset
      const largeDataset: ThreatEvent[] = [];
      for (let i = 0; i < 1000; i++) {
        largeDataset.push({
          id: `threat_${i}`,
          timestamp: new Date(Date.now() - (i * 60000)).toISOString(), // 1 minute intervals
          type: ['malware', 'intrusion', 'anomaly'][i % 3] as any,
          severity: ['low', 'medium', 'high', 'critical'][i % 4] as any,
          source: `scanner_${i % 5}`,
          target: `server_${i % 10}`,
          description: `Test threat ${i}`,
          riskScore: Math.random() * 10,
          status: ['active', 'resolved', 'investigating'][i % 3] as any,
          metadata: { correlationId: `corr_${i}`, source: `detector_${i % 3}` }
        });
      }

      const request: TrendAnalysisRequest = {
        timeRange: {
          start: new Date(Date.now() - 1000 * 60000).toISOString(),
          end: new Date().toISOString()
        },
        granularity: 'hourly',
        categories: ['malware', 'intrusion']
      };

      const startTime = Date.now();
      const result = await trendAnalysisService.analyzeTrends(request, largeDataset);
      const processingTime = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.trends.length).toBeGreaterThan(0);
    });

    it('should generate accurate correlation IDs', async () => {
      const request: TrendAnalysisRequest = {
        timeRange: {
          start: '2025-01-10T09:00:00.000Z',
          end: '2025-01-10T15:00:00.000Z'
        },
        granularity: 'hourly',
        categories: ['malware']
      };

      const result1 = await trendAnalysisService.analyzeTrends(request, mockThreatData);
      const result2 = await trendAnalysisService.analyzeTrends(request, mockThreatData);

      // Each analysis should have unique IDs
      expect(result1.analysisId).not.toBe(result2.analysisId);
      expect(result1.analysisId).toMatch(/^trend_analysis_\d+_[a-z0-9]+$/);
      expect(result2.analysisId).toMatch(/^trend_analysis_\d+_[a-z0-9]+$/);
    });

    it('should handle concurrent analysis requests', async () => {
      const request: TrendAnalysisRequest = {
        timeRange: {
          start: '2025-01-10T09:00:00.000Z',
          end: '2025-01-10T15:00:00.000Z'
        },
        granularity: 'hourly',
        categories: ['malware', 'intrusion']
      };

      // Run multiple analyses concurrently
      const promises = Array(5).fill(null).map(() => 
        trendAnalysisService.analyzeTrends(request, mockThreatData)
      );

      const results = await Promise.all(promises);

      // All should complete successfully
      expect(results.length).toBe(5);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.trends.length).toBeGreaterThan(0);
      });

      // All should have unique analysis IDs
      const analysisIds = results.map(r => r.analysisId);
      const uniqueIds = new Set(analysisIds);
      expect(uniqueIds.size).toBe(5);
    });
  });

  describe('cache behavior', () => {
    it('should use cache for identical requests', async () => {
      const request: TrendAnalysisRequest = {
        timeRange: {
          start: '2025-01-10T09:00:00.000Z',
          end: '2025-01-10T15:00:00.000Z'
        },
        granularity: 'hourly',
        categories: ['malware']
      };

      // First request
      const startTime1 = Date.now();
      const result1 = await trendAnalysisService.analyzeTrends(request, mockThreatData);
      const duration1 = Date.now() - startTime1;

      // Second identical request (should be faster due to caching)
      const startTime2 = Date.now();
      const result2 = await trendAnalysisService.analyzeTrends(request, mockThreatData);
      const duration2 = Date.now() - startTime2;

      expect(result1.trends.length).toBe(result2.trends.length);
      // Second request might be faster due to internal optimizations
      expect(duration2).toBeLessThanOrEqual(duration1 * 1.5); // Allow some variance
    });
  });

  describe('error handling', () => {
    it('should handle malformed threat data', async () => {
      const malformedData = [
        {
          id: 'malformed_threat',
          // Missing required fields
          description: 'Malformed threat data'
        }
      ] as any;

      const request: TrendAnalysisRequest = {
        timeRange: {
          start: '2025-01-10T09:00:00.000Z',
          end: '2025-01-10T15:00:00.000Z'
        },
        granularity: 'hourly',
        categories: ['malware']
      };

      // Should handle gracefully and skip malformed entries
      const result = await trendAnalysisService.analyzeTrends(request, malformedData);
      expect(result).toBeDefined();
      expect(result.trends).toBeInstanceOf(Array);
    });

    it('should handle network or processing errors gracefully', async () => {
      const request: TrendAnalysisRequest = {
        timeRange: {
          start: '2025-01-10T09:00:00.000Z',
          end: '2025-01-10T15:00:00.000Z'
        },
        granularity: 'hourly',
        categories: ['malware']
      };

      // Mock a processing error by providing null data
      await expect(trendAnalysisService.analyzeTrends(request, null as any))
        .rejects.toThrow();
    });
  });
});