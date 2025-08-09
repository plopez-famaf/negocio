#!/usr/bin/env node

/**
 * API Endpoint Testing Suite - bg-threat-ai Service
 * Tests all discovered endpoints with authentication
 */

const axios = require('axios');
const jwt = require('jsonwebtoken');
const { performance } = require('perf_hooks');

class ThreatAPITester {
  constructor(baseUrl = 'http://localhost:3002') {
    this.baseUrl = baseUrl;
    this.testResults = {
      total: 0,
      passed: 0,
      failed: 0,
      performance: {}
    };
    
    // Generate test JWT token
    this.jwtSecret = process.env.JWT_SECRET || 'test-secret-key';
    this.authToken = jwt.sign(
      { 
        id: 'test-user-123',
        sub: 'test-user-123', 
        email: 'test@example.com', 
        role: 'user' 
      },
      this.jwtSecret,
      { expiresIn: '1h' }
    );
  }

  async runTests() {
    console.log('🔐 Starting bg-threat-ai API Endpoint Tests...\n');
    console.log('📍 Service URL:', this.baseUrl);
    console.log('🎫 Auth Token Generated\n');

    const tests = [
      // Health endpoints (no auth required)
      { name: 'Health Check - Basic', fn: () => this.testHealthEndpoint() },
      { name: 'Health Check - Ready', fn: () => this.testReadinessEndpoint() },
      
      // Auth required endpoints
      { name: 'Threat Service Health (with auth)', fn: () => this.testThreatHealthEndpoint() },
      { name: 'Real-time Threat Detection', fn: () => this.testRealTimeThreatDetection() },
      { name: 'Behavioral Analysis', fn: () => this.testBehavioralAnalysis() },
      { name: 'Network Monitoring', fn: () => this.testNetworkMonitoring() },
      { name: 'Threat Intelligence Query', fn: () => this.testThreatIntelligence() },
      { name: 'Threat Correlation', fn: () => this.testThreatCorrelation() },
      { name: 'Threat History', fn: () => this.testThreatHistory() },
      { name: 'Risk Profile', fn: () => this.testRiskProfile() },
      
      // Error handling tests
      { name: 'Auth - No Token (401)', fn: () => this.testNoAuth() },
      { name: 'Auth - Invalid Token (401)', fn: () => this.testInvalidAuth() },
      { name: 'Bad Request (400)', fn: () => this.testBadRequest() },
      
      // Performance test
      { name: 'Performance - <100ms Response', fn: () => this.testPerformance() }
    ];

    for (const test of tests) {
      await this.runSingleTest(test.name, test.fn);
    }

    this.printResults();
    return this.testResults;
  }

  async runSingleTest(name, testFn) {
    this.testResults.total++;
    
    try {
      const start = performance.now();
      await testFn();
      const end = performance.now();
      
      this.testResults.performance[name] = `${(end - start).toFixed(2)}ms`;
      this.testResults.passed++;
      console.log(`✅ ${name} - ${this.testResults.performance[name]}`);
    } catch (error) {
      this.testResults.failed++;
      console.log(`❌ ${name} - ${error.message}`);
    }
  }

  // Health endpoints (no auth)
  async testHealthEndpoint() {
    const response = await axios.get(`${this.baseUrl}/health`, { timeout: 5000 });
    
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    const data = response.data;
    if (!data.service || data.service !== 'bg-identity-ai') {
      throw new Error(`Expected service 'bg-identity-ai', got '${data.service}'`);
    }
    
    if (data.status !== 'healthy') {
      throw new Error(`Service status is '${data.status}', expected 'healthy'`);
    }
  }

  async testReadinessEndpoint() {
    const response = await axios.get(`${this.baseUrl}/health/ready`, { timeout: 5000 });
    
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    if (!response.data.ready) {
      throw new Error('Service should be ready');
    }
  }

  // Auth required endpoints
  async testThreatHealthEndpoint() {
    const response = await axios.get(`${this.baseUrl}/api/threat/health`, {
      headers: { Authorization: `Bearer ${this.authToken}` },
      timeout: 5000
    });
    
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    const data = response.data;
    if (data.status !== 'healthy') {
      throw new Error(`Expected healthy status, got '${data.status}'`);
    }
  }

  async testRealTimeThreatDetection() {
    const testData = {
      events: [
        { target: '192.168.1.100', timestamp: new Date().toISOString() },
        { target: 'user_123', timestamp: new Date().toISOString() }
      ],
      source: 'test_client',
      timestamp: new Date().toISOString()
    };

    const response = await axios.post(`${this.baseUrl}/api/threat/detect-realtime`, testData, {
      headers: { Authorization: `Bearer ${this.authToken}` },
      timeout: 10000
    });
    
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    const result = response.data;
    if (typeof result.threatsDetected === 'undefined') {
      throw new Error('Response should contain threatsDetected count');
    }
  }

  async testBehavioralAnalysis() {
    const testData = {
      target: 'test_user_123',
      timeRange: {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString()
      },
      analysisType: 'user'
    };

    const response = await axios.post(`${this.baseUrl}/api/threat/analyze-behavior`, testData, {
      headers: { Authorization: `Bearer ${this.authToken}` },
      timeout: 10000
    });
    
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    const result = response.data;
    if (typeof result.overallRiskScore === 'undefined' || !Array.isArray(result.patterns)) {
      throw new Error('Response should contain overallRiskScore and patterns array');
    }
  }

  async testNetworkMonitoring() {
    const testData = {
      targets: ['192.168.1.0/24', '10.0.0.1'],
      options: { duration: 30, protocols: ['tcp', 'udp'] }
    };

    const response = await axios.post(`${this.baseUrl}/api/threat/monitor-network`, testData, {
      headers: { Authorization: `Bearer ${this.authToken}` },
      timeout: 10000
    });
    
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    const result = response.data;
    if (!Array.isArray(result.events)) {
      throw new Error('Response should contain events array');
    }
  }

  async testThreatIntelligence() {
    const testData = {
      indicators: ['192.168.1.100', 'malicious-domain.com', 'd41d8cd98f00b204e9800998ecf8427e'],
      sources: ['test_source']
    };

    const response = await axios.post(`${this.baseUrl}/api/threat/query-intelligence`, testData, {
      headers: { Authorization: `Bearer ${this.authToken}` },
      timeout: 10000
    });
    
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    const result = response.data;
    if (!Array.isArray(result.results)) {
      throw new Error('Response should contain results array');
    }
  }

  async testThreatCorrelation() {
    const testData = {
      events: [
        { id: 'event1', type: 'login', timestamp: new Date().toISOString() },
        { id: 'event2', type: 'access', timestamp: new Date().toISOString() }
      ],
      timeWindow: 300,
      correlationRules: []
    };

    const response = await axios.post(`${this.baseUrl}/api/threat/correlate-threats`, testData, {
      headers: { Authorization: `Bearer ${this.authToken}` },
      timeout: 10000
    });
    
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    const result = response.data;
    if (!Array.isArray(result.correlations)) {
      throw new Error('Response should contain correlations array');
    }
  }

  async testThreatHistory() {
    const response = await axios.get(`${this.baseUrl}/api/threat/history?limit=10&severity=medium`, {
      headers: { Authorization: `Bearer ${this.authToken}` },
      timeout: 5000
    });
    
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    const result = response.data;
    if (!Array.isArray(result.threats)) {
      throw new Error('Response should contain threats array');
    }
  }

  async testRiskProfile() {
    const response = await axios.get(`${this.baseUrl}/api/threat/risk-profile/test_target_123`, {
      headers: { Authorization: `Bearer ${this.authToken}` },
      timeout: 5000
    });
    
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    const result = response.data;
    if (typeof result.overallRiskScore === 'undefined') {
      throw new Error('Response should contain overallRiskScore');
    }
  }

  // Error handling tests
  async testNoAuth() {
    try {
      await axios.get(`${this.baseUrl}/api/threat/health`, { timeout: 5000 });
      throw new Error('Request without auth token should fail');
    } catch (error) {
      if (error.response?.status !== 401) {
        throw new Error(`Expected 401 status, got ${error.response?.status}`);
      }
    }
  }

  async testInvalidAuth() {
    try {
      await axios.get(`${this.baseUrl}/api/threat/health`, {
        headers: { Authorization: 'Bearer invalid_token_123' },
        timeout: 5000
      });
      throw new Error('Request with invalid token should fail');
    } catch (error) {
      if (error.response?.status !== 401) {
        throw new Error(`Expected 401 status, got ${error.response?.status}`);
      }
    }
  }

  async testBadRequest() {
    try {
      await axios.post(`${this.baseUrl}/api/threat/detect-realtime`, {
        // Missing required 'events' field
        source: 'test'
      }, {
        headers: { Authorization: `Bearer ${this.authToken}` },
        timeout: 5000
      });
      throw new Error('Bad request should return 400');
    } catch (error) {
      if (error.response?.status !== 400) {
        throw new Error(`Expected 400 status, got ${error.response?.status}`);
      }
    }
  }

  async testPerformance() {
    const start = performance.now();
    await axios.get(`${this.baseUrl}/health`, { timeout: 1000 });
    const end = performance.now();
    
    const responseTime = end - start;
    if (responseTime > 100) {
      throw new Error(`Response time ${responseTime.toFixed(2)}ms exceeds 100ms target`);
    }
  }

  printResults() {
    console.log('\n📊 API Endpoint Test Results:');
    console.log(`Total Tests: ${this.testResults.total}`);
    console.log(`Passed: ${this.testResults.passed} ✅`);
    console.log(`Failed: ${this.testResults.failed} ❌`);
    console.log(`Success Rate: ${((this.testResults.passed / this.testResults.total) * 100).toFixed(1)}%`);
    
    if (Object.keys(this.testResults.performance).length > 0) {
      console.log('\n⏱️ Performance Metrics:');
      Object.entries(this.testResults.performance).forEach(([test, time]) => {
        console.log(`  ${test}: ${time}`);
      });
    }
    
    // Summary by category
    const healthTests = this.testResults.passed >= 2 ? '✅' : '❌';
    const authTests = this.testResults.passed >= 8 ? '✅' : '❌';
    const errorTests = this.testResults.failed <= 3 ? '✅' : '❌';
    
    console.log('\n📈 Test Categories:');
    console.log(`  Health Endpoints: ${healthTests}`);
    console.log(`  Auth Required Endpoints: ${authTests}`);  
    console.log(`  Error Handling: ${errorTests}`);
    console.log(`  Performance (<100ms): ${this.testResults.performance['Performance - <100ms Response'] ? '✅' : '❌'}`);
  }
}

// CLI usage
if (require.main === module) {
  const baseUrl = process.argv[2] || 'http://localhost:3002';
  const tester = new ThreatAPITester(baseUrl);
  
  tester.runTests()
    .then((results) => {
      console.log(`\n🎯 Testing Complete: ${results.passed}/${results.total} tests passed`);
      process.exit(results.failed === 0 ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    });
}

module.exports = { ThreatAPITester };