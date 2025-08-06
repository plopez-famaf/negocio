#!/usr/bin/env node

/**
 * API Endpoints Integration Testing Suite
 * Tests all REST API endpoints of bg-threat-ai service
 */

const axios = require('axios');
const jwt = require('jsonwebtoken');
const chalk = require('chalk');
const { performance } = require('perf_hooks');

const BASE_URL = 'http://localhost:3001';
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-key';

// Test configuration
const CONFIG = {
  responseTimeLimit: 100, // milliseconds
  maxRetries: 3,
  timeout: 5000
};

// Test results tracking
let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

class APITester {
  constructor() {
    this.token = this.generateTestToken();
    this.axios = axios.create({
      baseURL: BASE_URL,
      timeout: CONFIG.timeout,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    });
  }

  generateTestToken() {
    return jwt.sign(
      {
        sub: 'test-user-api-testing',
        role: 'analyst',
        email: 'api-test@threatguard.com',
        permissions: ['threat:read', 'behavior:read', 'network:read']
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  }

  async runTest(testName, testFn) {
    testResults.total++;
    console.log(chalk.cyan(`🧪 Testing: ${testName}`));
    
    const startTime = performance.now();
    
    try {
      await testFn();
      const duration = Math.round(performance.now() - startTime);
      
      if (duration > CONFIG.responseTimeLimit) {
        throw new Error(`Response time ${duration}ms exceeds limit of ${CONFIG.responseTimeLimit}ms`);
      }
      
      testResults.passed++;
      console.log(chalk.green(`✅ PASSED: ${testName} (${duration}ms)`));
      
    } catch (error) {
      testResults.failed++;
      testResults.errors.push({
        test: testName,
        error: error.message
      });
      console.log(chalk.red(`❌ FAILED: ${testName} - ${error.message}`));
    }
  }

  async testHealthEndpoint() {
    await this.runTest('Health Endpoint', async () => {
      const response = await this.axios.get('/health');
      
      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }
      
      if (!response.data.service || !response.data.status) {
        throw new Error('Health response missing required fields');
      }
      
      if (response.data.status !== 'healthy') {
        throw new Error(`Service status is ${response.data.status}, expected 'healthy'`);
      }
    });
  }

  async testThreatEndpoints() {
    // Test threat scan endpoint
    await this.runTest('Threat Scan Endpoint', async () => {
      const response = await this.axios.post('/api/threat/scan', {
        targets: ['192.168.1.1', 'example.com'],
        options: {
          scan_type: 'quick',
          include_vulns: true
        }
      });
      
      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }
      
      if (!response.data.scanId) {
        throw new Error('Scan response missing scanId');
      }
    });

    // Test threat list endpoint
    await this.runTest('Threat List Endpoint', async () => {
      const response = await this.axios.get('/api/threat/list?limit=10&severity=high');
      
      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }
      
      if (!Array.isArray(response.data.threats)) {
        throw new Error('Threat list response should contain threats array');
      }
    });

    // Test specific threat details
    await this.runTest('Threat Details Endpoint', async () => {
      const response = await this.axios.get('/api/threat/details/test-threat-id');
      
      if (response.status !== 200 && response.status !== 404) {
        throw new Error(`Expected status 200 or 404, got ${response.status}`);
      }
      
      if (response.status === 200 && !response.data.threat) {
        throw new Error('Threat details response missing threat object');
      }
    });
  }

  async testBehaviorEndpoints() {
    // Test behavior analysis endpoint
    await this.runTest('Behavior Analysis Endpoint', async () => {
      const response = await this.axios.post('/api/threat/behavior/analyze', {
        target: 'user-test-123',
        timeRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString()
        },
        analysisType: 'user'
      });
      
      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }
      
      if (!response.data.analysisId) {
        throw new Error('Behavior analysis response missing analysisId');
      }
    });

    // Test behavior patterns endpoint
    await this.runTest('Behavior Patterns Endpoint', async () => {
      const response = await this.axios.get('/api/threat/behavior/patterns?target=user-test-123');
      
      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }
      
      if (!Array.isArray(response.data.patterns)) {
        throw new Error('Behavior patterns response should contain patterns array');
      }
    });
  }

  async testNetworkEndpoints() {
    // Test network monitoring endpoint
    await this.runTest('Network Monitoring Endpoint', async () => {
      const response = await this.axios.post('/api/threat/network/monitor', {
        targets: ['192.168.1.0/24'],
        options: {
          duration: 60,
          detection_types: ['intrusion', 'anomaly']
        }
      });
      
      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }
      
      if (!response.data.sessionId) {
        throw new Error('Network monitoring response missing sessionId');
      }
    });

    // Test network events endpoint
    await this.runTest('Network Events Endpoint', async () => {
      const response = await this.axios.get('/api/threat/network/events?limit=50');
      
      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }
      
      if (!Array.isArray(response.data.events)) {
        throw new Error('Network events response should contain events array');
      }
    });
  }

  async testIntelligenceEndpoints() {
    // Test threat intelligence query
    await this.runTest('Threat Intelligence Query', async () => {
      const response = await this.axios.post('/api/threat/intelligence/query', {
        indicators: ['8.8.8.8', 'example.com'],
        types: ['ip', 'domain']
      });
      
      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }
      
      if (!Array.isArray(response.data.results)) {
        throw new Error('Intelligence query response should contain results array');
      }
    });

    // Test intelligence feeds
    await this.runTest('Intelligence Feeds Endpoint', async () => {
      const response = await this.axios.get('/api/threat/intelligence/feeds');
      
      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }
      
      if (!Array.isArray(response.data.feeds)) {
        throw new Error('Intelligence feeds response should contain feeds array');
      }
    });
  }

  async testAuthenticationAndAuthorization() {
    // Test without authentication
    await this.runTest('Unauthenticated Request Protection', async () => {
      try {
        const unauthenticatedAxios = axios.create({
          baseURL: BASE_URL,
          timeout: CONFIG.timeout
        });
        
        const response = await unauthenticatedAxios.get('/api/threat/list');
        
        if (response.status !== 401) {
          throw new Error(`Expected status 401 for unauthenticated request, got ${response.status}`);
        }
      } catch (error) {
        if (error.response && error.response.status === 401) {
          // This is expected
          return;
        }
        throw error;
      }
    });

    // Test with invalid token
    await this.runTest('Invalid Token Protection', async () => {
      try {
        const invalidTokenAxios = axios.create({
          baseURL: BASE_URL,
          timeout: CONFIG.timeout,
          headers: {
            'Authorization': 'Bearer invalid-token-here',
            'Content-Type': 'application/json'
          }
        });
        
        const response = await invalidTokenAxios.get('/api/threat/list');
        
        if (response.status !== 401) {
          throw new Error(`Expected status 401 for invalid token, got ${response.status}`);
        }
      } catch (error) {
        if (error.response && error.response.status === 401) {
          // This is expected
          return;
        }
        throw error;
      }
    });
  }

  async testErrorHandling() {
    // Test malformed JSON
    await this.runTest('Malformed JSON Handling', async () => {
      try {
        const response = await this.axios.post('/api/threat/scan', 'invalid-json-here', {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.status !== 400) {
          throw new Error(`Expected status 400 for malformed JSON, got ${response.status}`);
        }
      } catch (error) {
        if (error.response && error.response.status === 400) {
          // This is expected
          return;
        }
        throw error;
      }
    });

    // Test missing required fields
    await this.runTest('Missing Required Fields', async () => {
      try {
        const response = await this.axios.post('/api/threat/scan', {});
        
        if (response.status !== 400) {
          throw new Error(`Expected status 400 for missing fields, got ${response.status}`);
        }
      } catch (error) {
        if (error.response && error.response.status === 400) {
          // This is expected
          return;
        }
        throw error;
      }
    });
  }

  async testPerformance() {
    console.log(chalk.yellow('\n📊 Running Performance Tests...'));
    
    const performanceTests = [];
    const iterations = 10;
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      try {
        await this.axios.get('/health');
        const duration = performance.now() - startTime;
        performanceTests.push(duration);
      } catch (error) {
        console.log(chalk.red(`Performance test iteration ${i + 1} failed: ${error.message}`));
      }
    }
    
    if (performanceTests.length > 0) {
      const avgTime = performanceTests.reduce((a, b) => a + b, 0) / performanceTests.length;
      const minTime = Math.min(...performanceTests);
      const maxTime = Math.max(...performanceTests);
      
      console.log(chalk.cyan(`📈 Performance Results (${iterations} requests):`));
      console.log(chalk.dim(`   Average: ${avgTime.toFixed(2)}ms`));
      console.log(chalk.dim(`   Min: ${minTime.toFixed(2)}ms`));
      console.log(chalk.dim(`   Max: ${maxTime.toFixed(2)}ms`));
      
      if (avgTime > CONFIG.responseTimeLimit) {
        console.log(chalk.red(`⚠️  Average response time exceeds limit of ${CONFIG.responseTimeLimit}ms`));
      } else {
        console.log(chalk.green(`✅ Performance within acceptable limits`));
      }
    }
  }

  async runAllTests() {
    console.log(chalk.bold.cyan('🚀 Starting API Endpoints Integration Testing Suite\n'));
    console.log(chalk.dim(`Base URL: ${BASE_URL}`));
    console.log(chalk.dim(`Response Time Limit: ${CONFIG.responseTimeLimit}ms`));
    console.log(chalk.dim(`Timeout: ${CONFIG.timeout}ms\n`));

    // Check service availability first
    try {
      await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
      console.log(chalk.green('✅ Service is available\n'));
    } catch (error) {
      console.log(chalk.red('❌ Service is not available. Please start bg-threat-ai service first.'));
      console.log(chalk.dim('   Run: cd bg-identity-ai && npm run dev\n'));
      process.exit(1);
    }

    // Run all test suites
    await this.testHealthEndpoint();
    await this.testThreatEndpoints();
    await this.testBehaviorEndpoints();
    await this.testNetworkEndpoints();
    await this.testIntelligenceEndpoints();
    await this.testAuthenticationAndAuthorization();
    await this.testErrorHandling();
    await this.testPerformance();

    // Print final results
    this.printResults();
  }

  printResults() {
    console.log(chalk.bold.cyan('\n📊 Test Results Summary'));
    console.log(chalk.dim('================================'));
    console.log(`Total Tests: ${testResults.total}`);
    console.log(chalk.green(`Passed: ${testResults.passed}`));
    console.log(chalk.red(`Failed: ${testResults.failed}`));
    
    const successRate = (testResults.passed / testResults.total * 100).toFixed(1);
    console.log(`Success Rate: ${successRate}%`);

    if (testResults.errors.length > 0) {
      console.log(chalk.red('\n❌ Failed Tests:'));
      testResults.errors.forEach(error => {
        console.log(chalk.red(`   • ${error.test}: ${error.error}`));
      });
    }

    if (testResults.failed === 0) {
      console.log(chalk.green('\n🎉 All API endpoint tests passed!'));
      process.exit(0);
    } else {
      console.log(chalk.red('\n💥 Some tests failed. Please review and fix issues.'));
      process.exit(1);
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new APITester();
  tester.runAllTests().catch(error => {
    console.error(chalk.red('Test runner error:'), error);
    process.exit(1);
  });
}

module.exports = APITester;