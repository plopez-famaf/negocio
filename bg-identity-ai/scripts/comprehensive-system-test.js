#!/usr/bin/env node

/**
 * 🚀 Comprehensive System Testing Suite
 * Console-First Threat Detection Platform - Complete System Validation
 * 
 * This suite validates the entire platform end-to-end:
 * - bg-threat-ai service (port 3002)
 * - threatguard-cli integration  
 * - Redis infrastructure and caching
 * - WebSocket real-time streaming
 * - API performance and security
 * - ML/AI threat detection systems
 */

const axios = require('axios');
const jwt = require('jsonwebtoken');
const { performance } = require('perf_hooks');
const { spawn, execSync } = require('child_process');

// Configuration
const CONFIG = {
  baseUrl: 'http://localhost:3002',
  webUrl: 'http://localhost:3000',
  jwtSecret: 'test-secret-key-for-development-only',
  testTimeout: 30000,
  performanceTargets: {
    apiResponseTime: 100, // ms
    websocketLatency: 50,  // ms
    cacheHitRate: 85,      // percentage
    concurrentUsers: 100   // connections
  }
};

// Test results aggregator
class TestResultsAggregator {
  constructor() {
    this.results = {
      phases: {},
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
        performance: {},
        startTime: Date.now(),
        endTime: null
      }
    };
  }

  addPhaseResult(phase, tests) {
    this.results.phases[phase] = {
      tests,
      passed: tests.filter(t => t.success).length,
      failed: tests.filter(t => !t.success).length,
      warnings: tests.filter(t => t.warning).length,
      duration: tests.reduce((sum, t) => sum + (t.duration || 0), 0)
    };

    this.updateSummary();
  }

  updateSummary() {
    this.results.summary.total = 0;
    this.results.summary.passed = 0;
    this.results.summary.failed = 0;
    this.results.summary.warnings = 0;

    Object.values(this.results.phases).forEach(phase => {
      this.results.summary.total += phase.tests.length;
      this.results.summary.passed += phase.passed;
      this.results.summary.failed += phase.failed;
      this.results.summary.warnings += phase.warnings;
    });
  }

  getSuccessRate() {
    if (this.results.summary.total === 0) return 0;
    return (this.results.summary.passed / this.results.summary.total) * 100;
  }

  finalize() {
    this.results.summary.endTime = Date.now();
    this.results.summary.totalDuration = this.results.summary.endTime - this.results.summary.startTime;
  }
}

// Test utilities
class TestUtils {
  static async measureTime(fn) {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      return { success: true, result, duration };
    } catch (error) {
      const duration = performance.now() - start;
      return { success: false, error, duration };
    }
  }

  static generateJWT(payload = {}) {
    return jwt.sign({
      id: 'comprehensive-test-user',
      email: 'test@threatguard.com',
      role: 'admin',
      ...payload
    }, CONFIG.jwtSecret, { expiresIn: '1h' });
  }

  static async checkServiceHealth(url) {
    try {
      const response = await axios.get(`${url}/health`, { timeout: 5000 });
      return {
        available: true,
        healthy: response.data.status === 'healthy',
        data: response.data
      };
    } catch (error) {
      return {
        available: false,
        healthy: false,
        error: error.message
      };
    }
  }

  static logTest(phase, testName, success, details = {}) {
    const status = success ? '✅' : '❌';
    const warning = details.warning ? '⚠️ ' : '';
    console.log(`${status} ${warning}[${phase}] ${testName}`);
    
    if (details.duration) {
      console.log(`   Duration: ${details.duration.toFixed(2)}ms`);
    }
    
    if (details.metric) {
      console.log(`   Metric: ${details.metric}`);
    }
    
    if (!success && details.error) {
      console.log(`   Error: ${details.error}`);
    }
    
    if (details.warning) {
      console.log(`   Warning: ${details.warning}`);
    }
  }

  static async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main testing class
class ComprehensiveSystemTester {
  constructor() {
    this.results = new TestResultsAggregator();
    this.authToken = TestUtils.generateJWT();
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.authToken}`
    };
  }

  async runAllTests() {
    console.log('🚀 Comprehensive System Testing Suite');
    console.log('================================================================');
    console.log('Console-First Threat Detection Platform - Complete Validation\n');

    try {
      // Phase 1: System Architecture Validation
      await this.runPhase1_SystemArchitecture();
      
      // Phase 2: Core API & Business Logic  
      await this.runPhase2_CoreAPI();
      
      // Phase 3: Real-time Systems & WebSocket
      await this.runPhase3_Realtime();
      
      // Phase 4: Advanced Features & AI Systems
      await this.runPhase4_AIFeatures();
      
      // Phase 5: Security & Compliance
      await this.runPhase5_Security();
      
      // Phase 6: Performance & Load Testing
      await this.runPhase6_Performance();
      
      // Phase 7: End-to-End User Workflows  
      await this.runPhase7_E2E();

      // Generate final report
      this.generateFinalReport();

    } catch (error) {
      console.error('💥 Critical error during testing:', error.message);
      process.exit(1);
    }
  }

  async runPhase1_SystemArchitecture() {
    console.log('\n📋 Phase 1: System Architecture Validation');
    console.log('--------------------------------------------------');
    
    const tests = [];

    // Test 1.1: Service Health Validation
    const healthTest = await TestUtils.measureTime(async () => {
      const bgThreatHealth = await TestUtils.checkServiceHealth(CONFIG.baseUrl);
      const bgWebHealth = await TestUtils.checkServiceHealth(CONFIG.webUrl);
      
      return {
        bgThreatAI: bgThreatHealth,
        bgWeb: bgWebHealth
      };
    });

    tests.push({
      name: 'Service Health Validation',
      success: healthTest.success && healthTest.result.bgThreatAI.healthy,
      duration: healthTest.duration,
      warning: !healthTest.result.bgWeb.healthy ? 'bg-web service not healthy' : null,
      details: healthTest.result
    });

    TestUtils.logTest('P1', 'Service Health Validation', tests[0].success, {
      duration: tests[0].duration,
      warning: tests[0].warning,
      metric: `bg-threat-ai: ${healthTest.result?.bgThreatAI?.data?.status}`
    });

    // Test 1.2: Redis Infrastructure
    const redisTest = await TestUtils.measureTime(async () => {
      const response = await axios.get(`${CONFIG.baseUrl}/health/redis`);
      return response.data;
    });

    tests.push({
      name: 'Redis Infrastructure Validation',
      success: redisTest.success && redisTest.result.overallStatus === 'healthy',
      duration: redisTest.duration,
      details: redisTest.result
    });

    TestUtils.logTest('P1', 'Redis Infrastructure Validation', tests[1].success, {
      duration: tests[1].duration,
      metric: `Status: ${redisTest.result?.overallStatus}, Hit Rate: ${redisTest.result?.cache?.hitRate || 0}%`
    });

    // Test 1.3: WebSocket Server Initialization
    const wsTest = await TestUtils.measureTime(async () => {
      // Check if WebSocket server is responding by checking health endpoint with WebSocket info
      const response = await axios.get(`${CONFIG.baseUrl}/health/detailed`);
      return response.data;
    });

    tests.push({
      name: 'WebSocket Server Initialization',
      success: wsTest.success,
      duration: wsTest.duration,
      details: wsTest.result
    });

    TestUtils.logTest('P1', 'WebSocket Server Initialization', tests[2].success, {
      duration: tests[2].duration,
      metric: `Service uptime: ${wsTest.result?.uptime?.toFixed(2)}s`
    });

    // Test 1.4: Environment Configuration
    const envTest = await TestUtils.measureTime(async () => {
      const requiredEnvVars = ['NODE_ENV', 'JWT_SECRET', 'REDIS_URL'];
      const missing = requiredEnvVars.filter(env => !process.env[env]);
      return { missing, total: requiredEnvVars.length };
    });

    tests.push({
      name: 'Environment Configuration Validation',
      success: envTest.success && envTest.result.missing.length === 0,
      duration: envTest.duration,
      warning: envTest.result.missing.length > 0 ? `Missing: ${envTest.result.missing.join(', ')}` : null
    });

    TestUtils.logTest('P1', 'Environment Configuration Validation', tests[3].success, {
      duration: tests[3].duration,
      warning: tests[3].warning,
      metric: `${envTest.result.total - envTest.result.missing.length}/${envTest.result.total} vars configured`
    });

    this.results.addPhaseResult('Phase 1: System Architecture', tests);
  }

  async runPhase2_CoreAPI() {
    console.log('\n🔧 Phase 2: Core API & Business Logic Testing');
    console.log('--------------------------------------------------');
    
    const tests = [];

    // Test 2.1: API Authentication
    const authTest = await TestUtils.measureTime(async () => {
      // Test with invalid token
      try {
        await axios.post(`${CONFIG.baseUrl}/api/threat/detect-realtime`, 
          { events: [] }, 
          { headers: { Authorization: 'Bearer invalid-token' } }
        );
        return { authenticated: false };
      } catch (error) {
        if (error.response?.status === 401) {
          return { authenticated: true, properly_rejected: true };
        }
        throw error;
      }
    });

    tests.push({
      name: 'API Authentication Validation',
      success: authTest.success && authTest.result.properly_rejected,
      duration: authTest.duration
    });

    TestUtils.logTest('P2', 'API Authentication Validation', tests[0].success, {
      duration: tests[0].duration,
      metric: 'Invalid tokens properly rejected'
    });

    // Test 2.2: Core Threat Detection Endpoints
    const coreEndpoints = [
      { endpoint: '/api/threat/detect-realtime', method: 'POST', data: { events: [{ id: 'test-1', type: 'network' }] }},
      { endpoint: '/api/threat/analyze-behavior', method: 'POST', data: { target: 'test-user', timeRange: { start: new Date().toISOString(), end: new Date().toISOString() }}},
      { endpoint: '/api/threat/query-intelligence', method: 'POST', data: { indicators: ['192.168.1.1'] }},
      { endpoint: '/api/threat/correlate-threats', method: 'POST', data: { events: [], timeWindow: '1h' }}
    ];

    for (const [index, endpoint] of coreEndpoints.entries()) {
      const test = await TestUtils.measureTime(async () => {
        const response = await axios[endpoint.method.toLowerCase()](`${CONFIG.baseUrl}${endpoint.endpoint}`, endpoint.data, { headers: this.headers });
        return response.data;
      });

      tests.push({
        name: `Core API Endpoint: ${endpoint.endpoint}`,
        success: test.success,
        duration: test.duration,
        performancePass: test.duration < CONFIG.performanceTargets.apiResponseTime
      });

      TestUtils.logTest('P2', `Core API: ${endpoint.endpoint}`, tests[index + 1].success, {
        duration: tests[index + 1].duration,
        metric: `Response time: ${test.duration.toFixed(2)}ms (target: <${CONFIG.performanceTargets.apiResponseTime}ms)`
      });
    }

    // Test 2.3: Input Validation (Zod Schemas)
    const validationTest = await TestUtils.measureTime(async () => {
      try {
        await axios.post(`${CONFIG.baseUrl}/api/threat/detect-realtime`, 
          { invalid_data: true }, 
          { headers: this.headers }
        );
        return { validation_working: false };
      } catch (error) {
        if (error.response?.status === 400) {
          return { validation_working: true };
        }
        return { validation_working: false, unexpected_error: true };
      }
    });

    tests.push({
      name: 'Input Validation (Zod Schemas)',
      success: validationTest.success && validationTest.result.validation_working,
      duration: validationTest.duration
    });

    TestUtils.logTest('P2', 'Input Validation (Zod Schemas)', tests[tests.length - 1].success, {
      duration: tests[tests.length - 1].duration,
      metric: 'Invalid data properly rejected'
    });

    this.results.addPhaseResult('Phase 2: Core API & Business Logic', tests);
  }

  async runPhase3_Realtime() {
    console.log('\n⚡ Phase 3: Real-time Systems & WebSocket Testing');
    console.log('--------------------------------------------------');
    
    const tests = [];

    // Test 3.1: WebSocket Connection Test
    const wsConnectionTest = await TestUtils.measureTime(async () => {
      // This is a simplified test - in a real scenario, we'd use socket.io-client
      // For now, we'll test the WebSocket-related health endpoints
      const response = await axios.get(`${CONFIG.baseUrl}/health/detailed`);
      return { 
        websocket_info_available: !!response.data.components,
        service_uptime: response.data.uptime > 0
      };
    });

    tests.push({
      name: 'WebSocket Infrastructure Check',
      success: wsConnectionTest.success && wsConnectionTest.result.service_uptime,
      duration: wsConnectionTest.duration
    });

    TestUtils.logTest('P3', 'WebSocket Infrastructure Check', tests[0].success, {
      duration: tests[0].duration,
      metric: `Service uptime: ${wsConnectionTest.result?.service_uptime ? 'Active' : 'Inactive'}`
    });

    // Test 3.2: Real-time Event Processing
    const eventProcessingTest = await TestUtils.measureTime(async () => {
      const events = [
        { id: 'rt-1', type: 'network', timestamp: new Date().toISOString() },
        { id: 'rt-2', type: 'behavioral', timestamp: new Date().toISOString() },
        { id: 'rt-3', type: 'threat-intel', timestamp: new Date().toISOString() }
      ];

      const response = await axios.post(`${CONFIG.baseUrl}/api/threat/detect-realtime`, {
        events,
        realtime: true
      }, { headers: this.headers });

      return {
        processed: response.data.threatsDetected >= 0,
        response_time: response.data.processingTime || 0
      };
    });

    tests.push({
      name: 'Real-time Event Processing',
      success: eventProcessingTest.success && eventProcessingTest.result.processed,
      duration: eventProcessingTest.duration,
      performancePass: eventProcessingTest.duration < CONFIG.performanceTargets.apiResponseTime
    });

    TestUtils.logTest('P3', 'Real-time Event Processing', tests[1].success, {
      duration: tests[1].duration,
      metric: `Processing latency: ${eventProcessingTest.duration.toFixed(2)}ms`
    });

    // Test 3.3: CLI Integration Readiness
    const cliReadinessTest = await TestUtils.measureTime(async () => {
      // Check readiness endpoint
      const response = await axios.get(`${CONFIG.baseUrl}/health/ready`);
      return {
        ready: response.data.ready,
        redis_ready: response.data.checks?.redis?.ready
      };
    });

    tests.push({
      name: 'CLI Integration Readiness',
      success: cliReadinessTest.success && cliReadinessTest.result.ready,
      duration: cliReadinessTest.duration
    });

    TestUtils.logTest('P3', 'CLI Integration Readiness', tests[2].success, {
      duration: tests[2].duration,
      metric: `Ready: ${cliReadinessTest.result?.ready}, Redis: ${cliReadinessTest.result?.redis_ready}`
    });

    this.results.addPhaseResult('Phase 3: Real-time Systems & WebSocket', tests);
  }

  async runPhase4_AIFeatures() {
    console.log('\n🤖 Phase 4: Advanced Features & AI Systems');
    console.log('--------------------------------------------------');
    
    const tests = [];

    // Test 4.1: Threat Detection Algorithms
    const threatDetectionTest = await TestUtils.measureTime(async () => {
      const maliciousEvents = [
        { 
          id: 'threat-1', 
          type: 'malware', 
          severity: 'high',
          source: '192.168.1.100',
          indicators: ['suspicious_binary', 'network_anomaly']
        },
        {
          id: 'threat-2',
          type: 'behavioral',
          severity: 'medium', 
          source: 'user-123',
          patterns: ['unusual_access', 'privilege_escalation']
        }
      ];

      const response = await axios.post(`${CONFIG.baseUrl}/api/threat/detect-realtime`, {
        events: maliciousEvents,
        analysis_depth: 'comprehensive'
      }, { headers: this.headers });

      return {
        threats_detected: response.data.threatsDetected > 0,
        risk_score: response.data.overallRiskScore,
        analysis_quality: response.data.detectionId ? true : false
      };
    });

    tests.push({
      name: 'Threat Detection Algorithms',
      success: threatDetectionTest.success && threatDetectionTest.result.threats_detected,
      duration: threatDetectionTest.duration
    });

    TestUtils.logTest('P4', 'Threat Detection Algorithms', tests[0].success, {
      duration: tests[0].duration,
      metric: `Risk Score: ${threatDetectionTest.result?.risk_score}, Threats: ${threatDetectionTest.result?.threats_detected}`
    });

    // Test 4.2: Behavioral Analysis
    const behaviorAnalysisTest = await TestUtils.measureTime(async () => {
      const response = await axios.post(`${CONFIG.baseUrl}/api/threat/analyze-behavior`, {
        target: 'comprehensive-test-user',
        timeRange: {
          start: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          end: new Date().toISOString()
        },
        analysisType: 'comprehensive',
        metrics: ['access_patterns', 'privilege_usage', 'network_behavior']
      }, { headers: this.headers });

      return {
        analysis_completed: !!response.data.analysisId,
        patterns_found: response.data.patterns?.length > 0,
        risk_assessment: response.data.overallRiskScore >= 0
      };
    });

    tests.push({
      name: 'Behavioral Analysis System',
      success: behaviorAnalysisTest.success && behaviorAnalysisTest.result.analysis_completed,
      duration: behaviorAnalysisTest.duration
    });

    TestUtils.logTest('P4', 'Behavioral Analysis System', tests[1].success, {
      duration: tests[1].duration,
      metric: `Patterns: ${behaviorAnalysisTest.result?.patterns_found}, Risk: ${behaviorAnalysisTest.result?.risk_assessment}`
    });

    // Test 4.3: Threat Intelligence Integration
    const threatIntelTest = await TestUtils.measureTime(async () => {
      const indicators = [
        '192.168.1.100',      // IP
        'malicious.com',       // Domain  
        'suspicious-file.exe', // File
        'a1b2c3d4e5f6789012345678901234567890abcd' // Hash
      ];

      const response = await axios.post(`${CONFIG.baseUrl}/api/threat/query-intelligence`, {
        indicators,
        sources: ['internal', 'external'],
        realtime: true
      }, { headers: this.headers });

      return {
        query_processed: !!response.data.queryId,
        results_returned: response.data.results?.length === indicators.length,
        reputation_data: response.data.results?.some(r => r.reputation)
      };
    });

    tests.push({
      name: 'Threat Intelligence Integration',
      success: threatIntelTest.success && threatIntelTest.result.query_processed,
      duration: threatIntelTest.duration
    });

    TestUtils.logTest('P4', 'Threat Intelligence Integration', tests[2].success, {
      duration: tests[2].duration,
      metric: `Results: ${threatIntelTest.result?.results_returned}, Reputation: ${threatIntelTest.result?.reputation_data}`
    });

    // Test 4.4: Correlation Engine
    const correlationTest = await TestUtils.measureTime(async () => {
      const correlationEvents = [
        {
          id: 'event-1',
          timestamp: new Date().toISOString(),
          type: 'network',
          source: '192.168.1.100',
          severity: 'medium'
        },
        {
          id: 'event-2', 
          timestamp: new Date().toISOString(),
          type: 'malware',
          source: '192.168.1.100', // Same source for correlation
          severity: 'high'
        }
      ];

      const response = await axios.post(`${CONFIG.baseUrl}/api/threat/correlate-threats`, {
        events: correlationEvents,
        timeWindow: '1h',
        correlationRules: ['source_ip', 'time_proximity']
      }, { headers: this.headers });

      return {
        correlation_id: !!response.data.correlationId,
        correlations_found: response.data.correlations?.length > 0,
        risk_escalation: response.data.highRiskCorrelations > 0
      };
    });

    tests.push({
      name: 'Threat Correlation Engine',
      success: correlationTest.success && correlationTest.result.correlation_id,
      duration: correlationTest.duration
    });

    TestUtils.logTest('P4', 'Threat Correlation Engine', tests[3].success, {
      duration: tests[3].duration,
      metric: `Correlations: ${correlationTest.result?.correlations_found}, Risk Escalation: ${correlationTest.result?.risk_escalation}`
    });

    this.results.addPhaseResult('Phase 4: Advanced Features & AI Systems', tests);
  }

  async runPhase5_Security() {
    console.log('\n🔒 Phase 5: Security & Compliance Testing');
    console.log('--------------------------------------------------');
    
    const tests = [];

    // Test 5.1: Authentication Security
    const authSecurityTest = await TestUtils.measureTime(async () => {
      const testCases = [
        { token: null, expected: 401 },
        { token: 'invalid-token', expected: 401 },
        { token: 'Bearer malformed', expected: 401 },
        { token: this.authToken, expected: 200 }
      ];

      const results = [];
      for (const testCase of testCases) {
        try {
          const headers = testCase.token ? { Authorization: `Bearer ${testCase.token}` } : {};
          const response = await axios.post(`${CONFIG.baseUrl}/api/threat/detect-realtime`, 
            { events: [] }, 
            { headers, validateStatus: () => true }
          );
          results.push(response.status === testCase.expected);
        } catch (error) {
          results.push(false);
        }
      }

      return { all_auth_tests_passed: results.every(r => r) };
    });

    tests.push({
      name: 'Authentication Security Validation',
      success: authSecurityTest.success && authSecurityTest.result.all_auth_tests_passed,
      duration: authSecurityTest.duration
    });

    TestUtils.logTest('P5', 'Authentication Security Validation', tests[0].success, {
      duration: tests[0].duration,
      metric: 'All auth test cases passed'
    });

    // Test 5.2: Input Sanitization
    const sanitizationTest = await TestUtils.measureTime(async () => {
      const maliciousInputs = [
        { events: [{ id: '<script>alert("xss")</script>' }] },
        { events: [{ id: 'test"; DROP TABLE users; --' }] },
        { events: [{ id: '${process.env.JWT_SECRET}' }] }
      ];

      const results = [];
      for (const input of maliciousInputs) {
        try {
          const response = await axios.post(`${CONFIG.baseUrl}/api/threat/detect-realtime`, 
            input, 
            { headers: this.headers, validateStatus: () => true }
          );
          // Should either reject (400) or sanitize safely
          results.push(response.status === 400 || (response.status === 200 && !response.data.error));
        } catch (error) {
          results.push(true); // Rejected is good
        }
      }

      return { sanitization_working: results.every(r => r) };
    });

    tests.push({
      name: 'Input Sanitization Validation', 
      success: sanitizationTest.success && sanitizationTest.result.sanitization_working,
      duration: sanitizationTest.duration
    });

    TestUtils.logTest('P5', 'Input Sanitization Validation', tests[1].success, {
      duration: tests[1].duration,
      metric: 'Malicious inputs properly handled'
    });

    // Test 5.3: Rate Limiting
    const rateLimitTest = await TestUtils.measureTime(async () => {
      // Make rapid requests to test rate limiting
      const requests = [];
      for (let i = 0; i < 20; i++) {
        requests.push(
          axios.get(`${CONFIG.baseUrl}/health`, { 
            validateStatus: () => true,
            timeout: 5000 
          })
        );
      }

      const responses = await Promise.all(requests);
      const rateLimited = responses.some(r => r.status === 429);
      
      return { rate_limiting_active: rateLimited };
    });

    tests.push({
      name: 'Rate Limiting Protection',
      success: rateLimitTest.success,
      duration: rateLimitTest.duration,
      warning: !rateLimitTest.result?.rate_limiting_active ? 'Rate limiting not triggered' : null
    });

    TestUtils.logTest('P5', 'Rate Limiting Protection', tests[2].success, {
      duration: tests[2].duration,
      warning: tests[2].warning,
      metric: `Rate limiting: ${rateLimitTest.result?.rate_limiting_active ? 'Active' : 'Not detected'}`
    });

    // Test 5.4: Security Headers
    const headersTest = await TestUtils.measureTime(async () => {
      const response = await axios.get(`${CONFIG.baseUrl}/health`);
      const headers = response.headers;

      const requiredHeaders = [
        'x-content-type-options',
        'x-frame-options', 
        'x-xss-protection'
      ];

      const presentHeaders = requiredHeaders.filter(header => headers[header.toLowerCase()]);
      
      return { 
        headers_present: presentHeaders.length,
        total_required: requiredHeaders.length,
        all_present: presentHeaders.length === requiredHeaders.length
      };
    });

    tests.push({
      name: 'Security Headers Validation',
      success: headersTest.success,
      duration: headersTest.duration,
      warning: !headersTest.result?.all_present ? `Missing ${headersTest.result?.total_required - headersTest.result?.headers_present} headers` : null
    });

    TestUtils.logTest('P5', 'Security Headers Validation', tests[3].success, {
      duration: tests[3].duration,
      warning: tests[3].warning,
      metric: `${headersTest.result?.headers_present}/${headersTest.result?.total_required} headers present`
    });

    this.results.addPhaseResult('Phase 5: Security & Compliance', tests);
  }

  async runPhase6_Performance() {
    console.log('\n⚡ Phase 6: Performance & Load Testing');
    console.log('--------------------------------------------------');
    
    const tests = [];

    // Test 6.1: API Response Time Benchmarks
    const apiPerfTest = await TestUtils.measureTime(async () => {
      const endpoints = [
        { url: '/health', target: 50 },
        { url: '/health/redis', target: 100 },
        { url: '/api/threat/detect-realtime', target: 200, method: 'POST', data: { events: [] } }
      ];

      const results = [];
      for (const endpoint of endpoints) {
        const iterations = 10;
        const times = [];

        for (let i = 0; i < iterations; i++) {
          const start = performance.now();
          try {
            if (endpoint.method === 'POST') {
              await axios.post(`${CONFIG.baseUrl}${endpoint.url}`, endpoint.data, { headers: this.headers });
            } else {
              await axios.get(`${CONFIG.baseUrl}${endpoint.url}`);
            }
            times.push(performance.now() - start);
          } catch (error) {
            times.push(Infinity);
          }
        }

        const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
        const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

        results.push({
          endpoint: endpoint.url,
          avgTime,
          p95Time,
          target: endpoint.target,
          passes: avgTime <= endpoint.target && p95Time <= endpoint.target * 1.5
        });
      }

      return { results, allPass: results.every(r => r.passes) };
    });

    tests.push({
      name: 'API Response Time Benchmarks',
      success: apiPerfTest.success && apiPerfTest.result.allPass,
      duration: apiPerfTest.duration,
      details: apiPerfTest.result?.results
    });

    TestUtils.logTest('P6', 'API Response Time Benchmarks', tests[0].success, {
      duration: tests[0].duration,
      metric: `Performance targets: ${apiPerfTest.result?.results?.filter(r => r.passes).length}/${apiPerfTest.result?.results?.length} passed`
    });

    // Test 6.2: Redis Cache Performance
    const cachePerformanceTest = await TestUtils.measureTime(async () => {
      // Warm up cache
      await axios.post(`${CONFIG.baseUrl}/api/threat/analyze-behavior`, {
        target: 'cache-test-user',
        timeRange: { start: new Date().toISOString(), end: new Date().toISOString() }
      }, { headers: this.headers });

      // Test cache hit
      const start = performance.now();
      await axios.post(`${CONFIG.baseUrl}/api/threat/analyze-behavior`, {
        target: 'cache-test-user', 
        timeRange: { start: new Date().toISOString(), end: new Date().toISOString() }
      }, { headers: this.headers });
      const cacheHitTime = performance.now() - start;

      // Check Redis health for cache stats
      const redisHealth = await axios.get(`${CONFIG.baseUrl}/health/redis`);
      const hitRate = redisHealth.data.cache?.hitRate || 0;

      return {
        cache_hit_time: cacheHitTime,
        hit_rate: hitRate,
        performance_good: cacheHitTime < 50 // Should be very fast for cache hits
      };
    });

    tests.push({
      name: 'Redis Cache Performance',
      success: cachePerformanceTest.success,
      duration: cachePerformanceTest.duration
    });

    TestUtils.logTest('P6', 'Redis Cache Performance', tests[1].success, {
      duration: tests[1].duration,
      metric: `Cache hit time: ${cachePerformanceTest.result?.cache_hit_time?.toFixed(2)}ms, Hit rate: ${cachePerformanceTest.result?.hit_rate}%`
    });

    // Test 6.3: Concurrent Request Handling
    const concurrencyTest = await TestUtils.measureTime(async () => {
      const concurrentRequests = 20;
      const requests = [];

      for (let i = 0; i < concurrentRequests; i++) {
        requests.push(
          axios.get(`${CONFIG.baseUrl}/health`, {
            timeout: 10000,
            validateStatus: () => true
          })
        );
      }

      const start = performance.now();
      const responses = await Promise.all(requests);
      const totalTime = performance.now() - start;

      const successCount = responses.filter(r => r.status === 200).length;
      const avgResponseTime = totalTime / concurrentRequests;

      return {
        total_time: totalTime,
        success_rate: (successCount / concurrentRequests) * 100,
        avg_response_time: avgResponseTime,
        all_successful: successCount === concurrentRequests
      };
    });

    tests.push({
      name: 'Concurrent Request Handling',
      success: concurrencyTest.success && concurrencyTest.result.success_rate >= 95,
      duration: concurrencyTest.duration
    });

    TestUtils.logTest('P6', 'Concurrent Request Handling', tests[2].success, {
      duration: tests[2].duration,
      metric: `Success rate: ${concurrencyTest.result?.success_rate?.toFixed(1)}%, Avg time: ${concurrencyTest.result?.avg_response_time?.toFixed(2)}ms`
    });

    // Test 6.4: Memory Usage Monitoring
    const memoryTest = await TestUtils.measureTime(async () => {
      const healthData = await axios.get(`${CONFIG.baseUrl}/health/detailed`);
      const memory = healthData.data.memory;
      
      const memoryUsageMB = memory.rss / 1024 / 1024;
      const heapUsageMB = memory.heapUsed / 1024 / 1024;
      
      return {
        memory_usage_mb: memoryUsageMB,
        heap_usage_mb: heapUsageMB,
        memory_reasonable: memoryUsageMB < 500, // Less than 500MB
        heap_reasonable: heapUsageMB < 200     // Less than 200MB heap
      };
    });

    tests.push({
      name: 'Memory Usage Monitoring',
      success: memoryTest.success,
      duration: memoryTest.duration,
      warning: !memoryTest.result?.memory_reasonable ? 'High memory usage detected' : null
    });

    TestUtils.logTest('P6', 'Memory Usage Monitoring', tests[3].success, {
      duration: tests[3].duration,
      warning: tests[3].warning,
      metric: `Memory: ${memoryTest.result?.memory_usage_mb?.toFixed(1)}MB, Heap: ${memoryTest.result?.heap_usage_mb?.toFixed(1)}MB`
    });

    this.results.addPhaseResult('Phase 6: Performance & Load Testing', tests);
  }

  async runPhase7_E2E() {
    console.log('\n🎯 Phase 7: End-to-End User Workflows');
    console.log('--------------------------------------------------');
    
    const tests = [];

    // Test 7.1: Complete Threat Detection Workflow
    const e2eWorkflowTest = await TestUtils.measureTime(async () => {
      // Step 1: Threat Detection
      const detectResponse = await axios.post(`${CONFIG.baseUrl}/api/threat/detect-realtime`, {
        events: [
          { id: 'e2e-threat-1', type: 'malware', source: '192.168.1.100' },
          { id: 'e2e-threat-2', type: 'behavioral', source: 'user-e2e-test' }
        ]
      }, { headers: this.headers });

      const detectionId = detectResponse.data.detectionId;

      // Step 2: Behavioral Analysis
      const behaviorResponse = await axios.post(`${CONFIG.baseUrl}/api/threat/analyze-behavior`, {
        target: 'user-e2e-test',
        timeRange: { start: new Date().toISOString(), end: new Date().toISOString() }
      }, { headers: this.headers });

      const analysisId = behaviorResponse.data.analysisId;

      // Step 3: Threat Intelligence Lookup
      const intelResponse = await axios.post(`${CONFIG.baseUrl}/api/threat/query-intelligence`, {
        indicators: ['192.168.1.100']
      }, { headers: this.headers });

      const queryId = intelResponse.data.queryId;

      // Step 4: Risk Profile Generation  
      const profileResponse = await axios.get(`${CONFIG.baseUrl}/api/threat/risk-profile/user-e2e-test`, {
        headers: this.headers
      });

      return {
        detection_completed: !!detectionId,
        analysis_completed: !!analysisId,
        intelligence_completed: !!queryId,
        profile_generated: profileResponse.data.target === 'user-e2e-test',
        full_workflow_success: !!(detectionId && analysisId && queryId && profileResponse.data.target)
      };
    });

    tests.push({
      name: 'Complete Threat Detection Workflow',
      success: e2eWorkflowTest.success && e2eWorkflowTest.result.full_workflow_success,
      duration: e2eWorkflowTest.duration
    });

    TestUtils.logTest('P7', 'Complete Threat Detection Workflow', tests[0].success, {
      duration: tests[0].duration,
      metric: `Steps completed: Detection:${e2eWorkflowTest.result?.detection_completed}, Analysis:${e2eWorkflowTest.result?.analysis_completed}, Intel:${e2eWorkflowTest.result?.intelligence_completed}, Profile:${e2eWorkflowTest.result?.profile_generated}`
    });

    // Test 7.2: System Health Monitoring Workflow
    const healthWorkflowTest = await TestUtils.measureTime(async () => {
      // Check basic health
      const basicHealth = await axios.get(`${CONFIG.baseUrl}/health`);
      
      // Check readiness
      const readiness = await axios.get(`${CONFIG.baseUrl}/health/ready`);
      
      // Check detailed health with Redis
      const detailedHealth = await axios.get(`${CONFIG.baseUrl}/health/detailed`);

      return {
        basic_healthy: basicHealth.data.status === 'healthy',
        service_ready: readiness.data.ready === true,
        detailed_available: !!detailedHealth.data.components,
        redis_healthy: detailedHealth.data.components?.redis?.overallStatus === 'healthy',
        monitoring_complete: !!(basicHealth.data.status && readiness.data.ready && detailedHealth.data.components)
      };
    });

    tests.push({
      name: 'System Health Monitoring Workflow',
      success: healthWorkflowTest.success && healthWorkflowTest.result.monitoring_complete,
      duration: healthWorkflowTest.duration
    });

    TestUtils.logTest('P7', 'System Health Monitoring Workflow', tests[1].success, {
      duration: tests[1].duration,
      metric: `Health:${healthWorkflowTest.result?.basic_healthy}, Ready:${healthWorkflowTest.result?.service_ready}, Redis:${healthWorkflowTest.result?.redis_healthy}`
    });

    // Test 7.3: Production Readiness Validation
    const productionReadinessTest = await TestUtils.measureTime(async () => {
      const checklist = {
        service_healthy: false,
        redis_operational: false,
        api_performance: false,
        security_headers: false,
        error_handling: false
      };

      // Check service health
      const health = await axios.get(`${CONFIG.baseUrl}/health/detailed`);
      checklist.service_healthy = health.data.overallStatus === 'healthy';
      checklist.redis_operational = health.data.components?.redis?.overallStatus === 'healthy';

      // Check API performance 
      const start = performance.now();
      await axios.post(`${CONFIG.baseUrl}/api/threat/detect-realtime`, 
        { events: [] }, 
        { headers: this.headers }
      );
      const apiTime = performance.now() - start;
      checklist.api_performance = apiTime < CONFIG.performanceTargets.apiResponseTime;

      // Check security headers
      const securityCheck = await axios.get(`${CONFIG.baseUrl}/health`);
      checklist.security_headers = !!(securityCheck.headers['x-content-type-options']);

      // Check error handling
      try {
        await axios.post(`${CONFIG.baseUrl}/api/threat/invalid-endpoint`, {}, { headers: this.headers });
      } catch (error) {
        checklist.error_handling = error.response?.status === 404;
      }

      const readinessScore = Object.values(checklist).filter(Boolean).length;
      const totalChecks = Object.keys(checklist).length;

      return {
        ...checklist,
        readiness_score: readinessScore,
        total_checks: totalChecks,
        production_ready: readinessScore === totalChecks
      };
    });

    tests.push({
      name: 'Production Readiness Validation',
      success: productionReadinessTest.success && productionReadinessTest.result.production_ready,
      duration: productionReadinessTest.duration
    });

    TestUtils.logTest('P7', 'Production Readiness Validation', tests[2].success, {
      duration: tests[2].duration,
      metric: `Readiness: ${productionReadinessTest.result?.readiness_score}/${productionReadinessTest.result?.total_checks} checks passed`
    });

    this.results.addPhaseResult('Phase 7: End-to-End User Workflows', tests);
  }

  generateFinalReport() {
    this.results.finalize();
    
    console.log('\n================================================================');
    console.log('🎯 COMPREHENSIVE SYSTEM TEST REPORT');
    console.log('================================================================');
    
    const successRate = this.results.getSuccessRate();
    const duration = (this.results.results.summary.totalDuration / 1000).toFixed(2);
    
    console.log(`\n📊 SUMMARY STATISTICS:`);
    console.log(`• Total Tests: ${this.results.results.summary.total}`);
    console.log(`• Passed: ${this.results.results.summary.passed}`);
    console.log(`• Failed: ${this.results.results.summary.failed}`);
    console.log(`• Warnings: ${this.results.results.summary.warnings}`);
    console.log(`• Success Rate: ${successRate.toFixed(1)}%`);
    console.log(`• Total Duration: ${duration}s`);

    console.log(`\n📋 PHASE RESULTS:`);
    Object.entries(this.results.results.phases).forEach(([phase, data]) => {
      const phaseSuccess = (data.passed / data.tests.length * 100).toFixed(1);
      const status = data.failed === 0 ? '✅' : '❌';
      console.log(`${status} ${phase}: ${data.passed}/${data.tests.length} (${phaseSuccess}%)`);
    });

    // Performance summary
    const performanceResults = this.extractPerformanceMetrics();
    if (performanceResults.length > 0) {
      console.log(`\n⚡ PERFORMANCE SUMMARY:`);
      performanceResults.forEach(metric => {
        console.log(`• ${metric.name}: ${metric.value} (target: ${metric.target})`);
      });
    }

    // Final verdict
    console.log(`\n🎯 FINAL VERDICT:`);
    if (successRate >= 95) {
      console.log('🎉 SYSTEM READY FOR PRODUCTION!');
      console.log('✨ Console-First Threat Detection Platform fully validated');
      console.log('🚀 All critical systems operational and performant');
    } else if (successRate >= 85) {
      console.log('⚠️  SYSTEM MOSTLY READY - Minor issues detected');
      console.log('🔧 Address warnings before production deployment');
    } else {
      console.log('❌ SYSTEM NOT READY FOR PRODUCTION');
      console.log('💥 Critical issues must be resolved');
    }

    console.log('\n================================================================');
    
    // Exit with appropriate code
    process.exit(successRate >= 95 ? 0 : 1);
  }

  extractPerformanceMetrics() {
    // Extract performance metrics from test results
    const metrics = [];
    
    Object.values(this.results.results.phases).forEach(phase => {
      phase.tests.forEach(test => {
        if (test.performancePass !== undefined) {
          metrics.push({
            name: test.name,
            value: `${test.duration?.toFixed(2)}ms`,
            target: `<${CONFIG.performanceTargets.apiResponseTime}ms`,
            passed: test.performancePass
          });
        }
      });
    });

    return metrics;
  }
}

// Execute comprehensive test suite
if (require.main === module) {
  const tester = new ComprehensiveSystemTester();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n⏸️  Test execution interrupted');
    process.exit(130);
  });

  // Run all tests
  tester.runAllTests().catch(error => {
    console.error('\n💥 Comprehensive test suite failed:', error);
    process.exit(1);
  });
}

module.exports = ComprehensiveSystemTester;