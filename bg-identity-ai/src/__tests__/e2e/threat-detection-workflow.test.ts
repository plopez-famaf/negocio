import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createServer } from 'http';
import { parse } from 'url';
import WebSocket from 'ws';

// Import all API handlers for E2E workflow testing
import threatDetectionHandler from '@/pages/api/threat-detection/detect';
import threatStreamsHandler from '@/pages/api/threat-detection/streams';
import analyticsHandler from '@/pages/api/analytics/trend-analysis';
import dashboardHandler from '@/pages/api/analytics/dashboard-metrics';
import webhooksHandler from '@/pages/api/integrations/webhooks';
import siemHandler from '@/pages/api/integrations/siem';

// Import test utilities
import { 
  createMockThreatEvent, 
  createMockWebhook,
  createMockSIEMConnection,
  expectSuccessResponse,
  measureResponseTime 
} from '../integration/test-setup';

describe('End-to-End Threat Detection Workflow Tests', () => {
  let server: any;
  let wsServer: any;
  let testWebhookId: string;
  let testSiemId: string;

  beforeAll(async () => {
    // Create comprehensive test server with all endpoints
    server = createServer((req, res) => {
      const { pathname } = parse(req.url || '', true);
      
      // Route to appropriate handlers
      if (pathname === '/api/threat-detection/detect') {
        return threatDetectionHandler(req as any, res as any);
      } else if (pathname === '/api/threat-detection/streams') {
        return threatStreamsHandler(req as any, res as any);
      } else if (pathname === '/api/analytics/trend-analysis') {
        return analyticsHandler(req as any, res as any);
      } else if (pathname === '/api/analytics/dashboard-metrics') {
        return dashboardHandler(req as any, res as any);
      } else if (pathname === '/api/integrations/webhooks') {
        return webhooksHandler(req as any, res as any);
      } else if (pathname === '/api/integrations/siem') {
        return siemHandler(req as any, res as any);
      }
      
      res.statusCode = 404;
      res.end('Not Found');
    });

    // Set up WebSocket server for real-time testing
    wsServer = new WebSocket.Server({ port: 8081 });
    
    console.log('🚀 E2E test environment started');
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
    if (wsServer) {
      wsServer.close();
    }
    console.log('🛑 E2E test environment stopped');
  });

  beforeEach(async () => {
    // Set up test integrations before each workflow test
    
    // Create test webhook
    const webhookResponse = await request(server)
      .post('/api/integrations/webhooks')
      .send({
        name: 'E2E Test Webhook',
        url: 'https://webhook.test.com/endpoint',
        eventTypes: ['threat.detected', 'threat.resolved', 'alert.created']
      })
      .set('Content-Type', 'application/json')
      .set('x-api-key', 'test-api-key');
    
    testWebhookId = webhookResponse.body.data?.id;

    // Create test SIEM connection
    const siemResponse = await request(server)
      .post('/api/integrations/siem')
      .send({
        name: 'E2E Test SIEM',
        type: 'splunk',
        config: {
          endpoint: 'https://splunk.test.com:8089',
          username: 'test_user',
          password: 'test_password',
          index: 'security_events'
        },
        features: ['event_export', 'alert_import']
      })
      .set('Content-Type', 'application/json')
      .set('x-api-key', 'test-api-key');
    
    testSiemId = siemResponse.body.data?.id;
  });

  afterEach(async () => {
    // Clean up test integrations
    if (testWebhookId) {
      await request(server)
        .delete(`/api/integrations/webhooks?id=${testWebhookId}`)
        .set('x-api-key', 'test-api-key');
    }

    if (testSiemId) {
      await request(server)
        .delete(`/api/integrations/siem?id=${testSiemId}`)
        .set('x-api-key', 'test-api-key');
    }
  });

  describe('Complete Threat Detection to Analytics Workflow', () => {
    it('should process threat detection through complete analytics pipeline', async () => {
      const workflowStart = Date.now();

      // Step 1: Detect multiple threats to generate data
      const threats = [];
      const threatTypes = ['malware', 'intrusion', 'anomaly', 'behavioral'];
      
      for (let i = 0; i < 10; i++) {
        const threatData = {
          source: `endpoint_${i % 3}`,
          indicators: {
            fileHash: `hash_${i}`,
            ipAddress: `192.168.1.${100 + i}`,
            domain: `suspicious${i}.example.com`
          },
          severity: ['low', 'medium', 'high', 'critical'][i % 4],
          metadata: {
            timestamp: new Date(Date.now() - (i * 60000)).toISOString(), // Spread over time
            correlationId: `workflow_test_${i}`,
            detectionEngine: 'e2e_test_engine'
          }
        };

        const { result: threatResponse, duration } = await measureResponseTime(() =>
          request(server)
            .post('/api/threat-detection/detect')
            .send(threatData)
            .set('Content-Type', 'application/json')
            .set('x-api-key', 'test-api-key')
            .expect(200)
        );

        expectSuccessResponse(threatResponse);
        expect(duration).toBeLessThan(500); // Threat detection should be fast
        threats.push(threatResponse.body.data);
      }

      // Step 2: Wait for threat processing and indexing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 3: Verify threats appear in dashboard metrics
      const { result: dashboardResponse, duration: dashboardDuration } = await measureResponseTime(() =>
        request(server)
          .get('/api/analytics/dashboard-metrics?includeRealtime=true')
          .set('x-api-key', 'test-api-key')
          .expect(200)
      );

      expectSuccessResponse(dashboardResponse);
      expect(dashboardDuration).toBeLessThan(2000);
      
      const dashboard = dashboardResponse.body.data;
      expect(dashboard.realTimeStats.currentPeriod.totalThreats).toBeGreaterThan(0);
      expect(dashboard.topThreats).toBeInstanceOf(Array);
      expect(dashboard.performanceMetrics).toBeDefined();

      // Step 4: Perform trend analysis on the generated threats
      const trendRequest = {
        timeRange: {
          start: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          end: new Date().toISOString()
        },
        granularity: 'hourly',
        categories: threatTypes,
        includeForecasting: true,
        forecastPeriods: 3
      };

      const { result: trendResponse, duration: trendDuration } = await measureResponseTime(() =>
        request(server)
          .post('/api/analytics/trend-analysis')
          .send(trendRequest)
          .set('Content-Type', 'application/json')
          .set('x-api-key', 'test-api-key')
          .expect(200)
      );

      expectSuccessResponse(trendResponse);
      expect(trendDuration).toBeLessThan(3000);
      
      const trends = trendResponse.body.data;
      expect(trends.trends).toBeInstanceOf(Array);
      expect(trends.trends.length).toBeGreaterThan(0);
      expect(trends.forecasting).toBeDefined();
      expect(trends.forecasting.predictions).toBeInstanceOf(Array);
      expect(trends.insights).toBeInstanceOf(Array);

      // Step 5: Verify integration notifications were triggered
      if (testWebhookId) {
        const deliveriesResponse = await request(server)
          .get(`/api/integrations/webhooks/deliveries?webhookId=${testWebhookId}`)
          .set('x-api-key', 'test-api-key')
          .expect(200);

        expectSuccessResponse(deliveriesResponse);
        // Should have webhook deliveries for the threats
        expect(deliveriesResponse.body.data).toBeInstanceOf(Array);
      }

      const totalWorkflowTime = Date.now() - workflowStart;
      expect(totalWorkflowTime).toBeLessThan(10000); // Complete workflow under 10 seconds

      console.log(`✅ Complete workflow processed 10 threats in ${totalWorkflowTime}ms`);
    });

    it('should handle concurrent threat detection and analytics requests', async () => {
      const concurrencyLevel = 5;
      const threatsPerBatch = 3;

      // Step 1: Generate concurrent threat detection requests
      const threatBatches = Array(concurrencyLevel).fill(null).map((_, batchIndex) =>
        Array(threatsPerBatch).fill(null).map((_, threatIndex) => 
          request(server)
            .post('/api/threat-detection/detect')
            .send({
              source: `concurrent_endpoint_${batchIndex}_${threatIndex}`,
              indicators: {
                fileHash: `concurrent_hash_${batchIndex}_${threatIndex}`,
                ipAddress: `10.0.${batchIndex}.${threatIndex + 1}`
              },
              severity: ['medium', 'high'][threatIndex % 2],
              metadata: {
                correlationId: `concurrent_test_${batchIndex}_${threatIndex}`,
                detectionEngine: 'concurrent_test_engine'
              }
            })
            .set('Content-Type', 'application/json')
            .set('x-api-key', 'test-api-key')
        )
      );

      // Step 2: Execute all threat detection requests concurrently
      const startTime = Date.now();
      const allRequests = threatBatches.flat();
      const responses = await Promise.all(allRequests);
      const concurrentDetectionTime = Date.now() - startTime;

      // Verify all threats were detected successfully
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expectSuccessResponse(response);
      });

      console.log(`⚡ Processed ${allRequests.length} concurrent threats in ${concurrentDetectionTime}ms`);

      // Step 3: Wait for processing then perform concurrent analytics
      await new Promise(resolve => setTimeout(resolve, 1500));

      const analyticsRequests = [
        request(server)
          .get('/api/analytics/dashboard-metrics?includeRealtime=true')
          .set('x-api-key', 'test-api-key'),
        request(server)
          .post('/api/analytics/trend-analysis')
          .send({
            timeRange: {
              start: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
              end: new Date().toISOString()
            },
            granularity: 'hourly',
            categories: ['malware', 'intrusion']
          })
          .set('Content-Type', 'application/json')
          .set('x-api-key', 'test-api-key'),
        request(server)
          .get('/api/integrations/webhooks/stats')
          .set('x-api-key', 'test-api-key'),
        request(server)
          .get('/api/integrations/siem/sync-status')
          .set('x-api-key', 'test-api-key')
      ];

      const analyticsStartTime = Date.now();
      const analyticsResponses = await Promise.all(analyticsRequests);
      const concurrentAnalyticsTime = Date.now() - analyticsStartTime;

      // Verify all analytics requests completed successfully
      analyticsResponses.forEach(response => {
        expect(response.status).toBe(200);
        expectSuccessResponse(response);
      });

      console.log(`📊 Processed ${analyticsRequests.length} concurrent analytics in ${concurrentAnalyticsTime}ms`);

      expect(concurrentDetectionTime).toBeLessThan(3000);
      expect(concurrentAnalyticsTime).toBeLessThan(5000);
    });
  });

  describe('Real-time Streaming Workflow', () => {
    it('should stream threats in real-time through WebSocket', async () => {
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket test timeout'));
        }, 10000);

        // Connect to WebSocket stream
        const ws = new WebSocket('ws://localhost:8081');
        const receivedEvents: any[] = [];

        ws.on('open', async () => {
          console.log('📡 WebSocket connected for real-time testing');

          // Subscribe to threat streams
          ws.send(JSON.stringify({
            type: 'subscribe',
            channels: ['threats', 'alerts', 'analytics']
          }));

          // Generate threats that should be streamed
          for (let i = 0; i < 5; i++) {
            await request(server)
              .post('/api/threat-detection/detect')
              .send({
                source: `streaming_endpoint_${i}`,
                indicators: {
                  fileHash: `streaming_hash_${i}`,
                  ipAddress: `172.16.0.${i + 1}`
                },
                severity: 'high',
                metadata: {
                  correlationId: `streaming_test_${i}`,
                  streamingTest: true
                }
              })
              .set('Content-Type', 'application/json')
              .set('x-api-key', 'test-api-key')
              .expect(200);

            // Small delay between threats
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        });

        ws.on('message', (data) => {
          try {
            const event = JSON.parse(data.toString());
            receivedEvents.push(event);

            console.log(`📨 Received streaming event: ${event.type}`);

            // Check if we've received expected events
            if (receivedEvents.length >= 5) {
              const threatEvents = receivedEvents.filter(e => e.type === 'threat.detected');
              expect(threatEvents.length).toBeGreaterThan(0);

              // Verify event structure
              threatEvents.forEach(event => {
                expect(event).toHaveProperty('type', 'threat.detected');
                expect(event).toHaveProperty('data');
                expect(event).toHaveProperty('timestamp');
                expect(event.data).toHaveProperty('id');
                expect(event.data).toHaveProperty('severity');
              });

              clearTimeout(timeout);
              ws.close();
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });
  });

  describe('Integration Export Workflow', () => {
    it('should export threats to SIEM and trigger webhooks', async () => {
      if (!testSiemId || !testWebhookId) {
        console.log('⚠️ Skipping integration test - missing test integrations');
        return;
      }

      // Step 1: Generate threats for export
      const exportThreats = [];
      for (let i = 0; i < 3; i++) {
        const threatResponse = await request(server)
          .post('/api/threat-detection/detect')
          .send({
            source: `export_endpoint_${i}`,
            indicators: {
              fileHash: `export_hash_${i}`,
              ipAddress: `192.168.100.${i + 1}`,
              domain: `export-test-${i}.malicious.com`
            },
            severity: 'critical',
            metadata: {
              correlationId: `export_test_${i}`,
              exportTarget: 'siem_and_webhook'
            }
          })
          .set('Content-Type', 'application/json')
          .set('x-api-key', 'test-api-key')
          .expect(200);

        exportThreats.push(threatResponse.body.data);
      }

      // Step 2: Export to SIEM
      const siemExportResponse = await request(server)
        .post('/api/integrations/siem/export')
        .send({
          siemId: testSiemId,
          events: exportThreats.map(threat => ({
            id: threat.id,
            timestamp: threat.timestamp,
            type: threat.type,
            severity: threat.severity,
            source: threat.source,
            target: threat.target,
            description: threat.description,
            riskScore: threat.riskScore
          })),
          format: 'cef',
          batchSize: 100
        })
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expectSuccessResponse(siemExportResponse);
      expect(siemExportResponse.body.data.totalEvents).toBe(3);
      expect(siemExportResponse.body.data.format).toBe('cef');

      // Step 3: Wait for webhook processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 4: Verify webhook deliveries
      const deliveriesResponse = await request(server)
        .get(`/api/integrations/webhooks/deliveries?webhookId=${testWebhookId}&limit=10`)
        .set('x-api-key', 'test-api-key')
        .expect(200);

      expectSuccessResponse(deliveriesResponse);
      const deliveries = deliveriesResponse.body.data;
      expect(deliveries).toBeInstanceOf(Array);

      // Should have deliveries for threat.detected events
      const threatDeliveries = deliveries.filter((d: any) => 
        d.attempts.some((a: any) => 
          a.requestBody && a.requestBody.includes('export_test_')
        )
      );
      expect(threatDeliveries.length).toBeGreaterThan(0);

      console.log(`🔗 Successfully exported ${exportThreats.length} threats to SIEM and triggered ${threatDeliveries.length} webhook deliveries`);
    });

    it('should handle export failures gracefully', async () => {
      // Test with invalid SIEM connection
      const failureExportResponse = await request(server)
        .post('/api/integrations/siem/export')
        .send({
          siemId: 'non_existent_siem',
          events: [createMockThreatEvent()],
          format: 'json'
        })
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(404);

      expect(failureExportResponse.body.success).toBe(false);
      expect(failureExportResponse.body.error).toContain('SIEM connection not found');

      // Test webhook retry mechanism
      if (testWebhookId) {
        const retryResponse = await request(server)
          .post('/api/integrations/webhooks/retry')
          .send({ webhookId: testWebhookId })
          .set('Content-Type', 'application/json')
          .set('x-api-key', 'test-api-key')
          .expect(200);

        expectSuccessResponse(retryResponse);
        expect(retryResponse.body.data.retriedCount).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('End-to-End Performance Validation', () => {
    it('should maintain performance under sustained load', async () => {
      const loadTestStart = Date.now();
      const totalThreats = 20;
      const batchSize = 5;
      const batches = Math.ceil(totalThreats / batchSize);

      console.log(`🔥 Starting load test: ${totalThreats} threats in ${batches} batches`);

      const performanceMetrics = {
        threatDetection: [] as number[],
        analytics: [] as number[],
        integrations: [] as number[]
      };

      // Process threats in batches to simulate sustained load
      for (let batch = 0; batch < batches; batch++) {
        const batchPromises = [];

        // Generate batch of threats
        for (let i = 0; i < batchSize; i++) {
          const threatIndex = batch * batchSize + i;
          
          const threatPromise = measureResponseTime(() =>
            request(server)
              .post('/api/threat-detection/detect')
              .send({
                source: `load_test_endpoint_${threatIndex}`,
                indicators: {
                  fileHash: `load_test_hash_${threatIndex}`,
                  ipAddress: `10.10.${Math.floor(threatIndex / 255)}.${threatIndex % 255}`,
                  domain: `load-test-${threatIndex}.example.com`
                },
                severity: ['low', 'medium', 'high', 'critical'][threatIndex % 4],
                metadata: {
                  correlationId: `load_test_${threatIndex}`,
                  batchIndex: batch
                }
              })
              .set('Content-Type', 'application/json')
              .set('x-api-key', 'test-api-key')
              .expect(200)
          );

          batchPromises.push(threatPromise);
        }

        // Execute batch concurrently
        const batchResults = await Promise.all(batchPromises);
        
        // Record performance metrics
        batchResults.forEach(({ result, duration }) => {
          expectSuccessResponse(result);
          performanceMetrics.threatDetection.push(duration);
        });

        // Test analytics performance during load
        const { duration: analyticsDuration } = await measureResponseTime(() =>
          request(server)
            .get('/api/analytics/dashboard-metrics?includeRealtime=true')
            .set('x-api-key', 'test-api-key')
            .expect(200)
        );
        performanceMetrics.analytics.push(analyticsDuration);

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const totalLoadTime = Date.now() - loadTestStart;

      // Analyze performance metrics
      const avgThreatDetection = performanceMetrics.threatDetection.reduce((a, b) => a + b, 0) / performanceMetrics.threatDetection.length;
      const maxThreatDetection = Math.max(...performanceMetrics.threatDetection);
      const avgAnalytics = performanceMetrics.analytics.reduce((a, b) => a + b, 0) / performanceMetrics.analytics.length;

      console.log(`📊 Load test completed in ${totalLoadTime}ms:`);
      console.log(`  - Avg threat detection: ${avgThreatDetection.toFixed(2)}ms`);
      console.log(`  - Max threat detection: ${maxThreatDetection}ms`);
      console.log(`  - Avg analytics: ${avgAnalytics.toFixed(2)}ms`);

      // Performance assertions
      expect(avgThreatDetection).toBeLessThan(1000); // Average under 1 second
      expect(maxThreatDetection).toBeLessThan(2000); // Max under 2 seconds
      expect(avgAnalytics).toBeLessThan(3000); // Analytics under 3 seconds
      expect(totalLoadTime).toBeLessThan(30000); // Complete load test under 30 seconds
    });
  });

  describe('Data Consistency Validation', () => {
    it('should maintain data consistency across all endpoints', async () => {
      // Generate a set of threats with known characteristics
      const consistencyTestThreats = [];
      const testStartTime = new Date();
      
      for (let i = 0; i < 5; i++) {
        const threatResponse = await request(server)
          .post('/api/threat-detection/detect')
          .send({
            source: `consistency_endpoint_${i}`,
            indicators: {
              fileHash: `consistency_hash_${i}`,
              ipAddress: `203.0.113.${i + 1}` // Test IP range
            },
            severity: 'high',
            metadata: {
              correlationId: `consistency_test_${i}`,
              testMarker: 'data_consistency_validation'
            }
          })
          .set('Content-Type', 'application/json')
          .set('x-api-key', 'test-api-key')
          .expect(200);

        consistencyTestThreats.push(threatResponse.body.data);
      }

      // Wait for data propagation
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify data consistency across endpoints
      
      // 1. Dashboard metrics should reflect the threats
      const dashboardResponse = await request(server)
        .get('/api/analytics/dashboard-metrics?includeRealtime=true')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      const dashboard = dashboardResponse.body.data;
      expect(dashboard.realTimeStats.currentPeriod.totalThreats).toBeGreaterThanOrEqual(5);
      expect(dashboard.realTimeStats.currentPeriod.highThreats).toBeGreaterThanOrEqual(5);

      // 2. Trend analysis should include the threats
      const trendResponse = await request(server)
        .post('/api/analytics/trend-analysis')
        .send({
          timeRange: {
            start: testStartTime.toISOString(),
            end: new Date().toISOString()
          },
          granularity: 'hourly',
          categories: ['malware', 'intrusion', 'anomaly']
        })
        .set('Content-Type', 'application/json')
        .set('x-api-key', 'test-api-key')
        .expect(200);

      const trends = trendResponse.body.data;
      expect(trends.trends).toBeInstanceOf(Array);
      const totalTrendEvents = trends.trends.reduce((sum: number, trend: any) => 
        sum + trend.dataPoints.reduce((pointSum: number, point: any) => pointSum + point.count, 0), 0
      );
      expect(totalTrendEvents).toBeGreaterThanOrEqual(5);

      // 3. Integration statistics should be consistent
      if (testWebhookId) {
        const webhookStatsResponse = await request(server)
          .get('/api/integrations/webhooks/stats')
          .set('x-api-key', 'test-api-key')
          .expect(200);

        const webhookStats = webhookStatsResponse.body.data;
        expect(webhookStats.totalDeliveries).toBeGreaterThanOrEqual(5);
      }

      console.log('✅ Data consistency validated across all endpoints');
    });
  });
});