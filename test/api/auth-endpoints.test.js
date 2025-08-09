/**
 * API Endpoint Testing Suite - Authentication
 * Tests all authentication endpoints with various scenarios
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

class AuthEndpointTester {
  constructor(baseUrl = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
    this.testResults = {
      total: 0,
      passed: 0,
      failed: 0,
      performance: {}
    };
  }

  async runTests() {
    console.log('🔐 Starting Authentication Endpoint Tests...\n');

    const tests = [
      { name: 'Health Check', fn: () => this.testHealthEndpoint() },
      { name: 'Login - Valid Credentials', fn: () => this.testValidLogin() },
      { name: 'Login - Invalid Credentials', fn: () => this.testInvalidLogin() },
      { name: 'Token Validation - Valid', fn: () => this.testValidTokenValidation() },
      { name: 'Token Validation - Invalid', fn: () => this.testInvalidTokenValidation() },
      { name: 'Logout', fn: () => this.testLogout() },
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

  async testHealthEndpoint() {
    const response = await axios.get(`${this.baseUrl}/health`, { timeout: 5000 });
    
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    if (!response.data.success) {
      throw new Error('Health check should return success: true');
    }
  }

  async testValidLogin() {
    const credentials = {
      username: 'test_user',
      password: 'test_password'
    };

    const response = await axios.post(`${this.baseUrl}/auth/login`, credentials, { timeout: 5000 });
    
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }

    const { data } = response.data;
    if (!data || !data.token || !data.userId) {
      throw new Error('Login should return token and userId');
    }

    // Store token for other tests
    this.authToken = data.token;
    this.userId = data.userId;
  }

  async testInvalidLogin() {
    const credentials = {
      username: 'invalid_user',
      password: 'wrong_password'
    };

    try {
      await axios.post(`${this.baseUrl}/auth/login`, credentials, { timeout: 5000 });
      throw new Error('Invalid credentials should not succeed');
    } catch (error) {
      if (error.response?.status !== 401) {
        throw new Error(`Expected 401 status for invalid credentials, got ${error.response?.status}`);
      }
    }
  }

  async testValidTokenValidation() {
    if (!this.authToken) {
      throw new Error('No auth token available - login test may have failed');
    }

    const response = await axios.get(`${this.baseUrl}/auth/validate`, {
      headers: { Authorization: `Bearer ${this.authToken}` },
      timeout: 5000
    });

    if (response.status !== 200 || !response.data.success) {
      throw new Error('Valid token should pass validation');
    }
  }

  async testInvalidTokenValidation() {
    try {
      await axios.get(`${this.baseUrl}/auth/validate`, {
        headers: { Authorization: 'Bearer invalid_token_123' },
        timeout: 5000
      });
      throw new Error('Invalid token should not pass validation');
    } catch (error) {
      if (error.response?.status !== 401) {
        throw new Error(`Expected 401 status for invalid token, got ${error.response?.status}`);
      }
    }
  }

  async testLogout() {
    if (!this.authToken) {
      throw new Error('No auth token available - login test may have failed');
    }

    const response = await axios.post(`${this.baseUrl}/auth/logout`, {}, {
      headers: { Authorization: `Bearer ${this.authToken}` },
      timeout: 5000
    });

    if (response.status !== 200) {
      throw new Error(`Expected status 200 for logout, got ${response.status}`);
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
    console.log('\n📊 Auth Endpoint Test Results:');
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
  }
}

// CLI usage
if (require.main === module) {
  const baseUrl = process.argv[2] || 'http://localhost:3001';
  const tester = new AuthEndpointTester(baseUrl);
  
  tester.runTests()
    .then((results) => {
      process.exit(results.failed === 0 ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    });
}

module.exports = { AuthEndpointTester };