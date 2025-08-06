/**
 * Test Utilities and Helpers
 * Common functions used across all test suites
 */

const jwt = require('jsonwebtoken');
const axios = require('axios');
const chalk = require('chalk');
const { performance } = require('perf_hooks');

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-key';

class TestHelpers {
  /**
   * Generate a test JWT token
   */
  static generateTestToken(userId = 'test-user', role = 'analyst', permissions = []) {
    const defaultPermissions = [
      'threat:read',
      'behavior:read', 
      'network:read',
      'intelligence:read'
    ];

    return jwt.sign(
      {
        sub: userId,
        role: role,
        email: `${userId}@threatguard.com`,
        permissions: permissions.length > 0 ? permissions : defaultPermissions,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
      },
      JWT_SECRET
    );
  }

  /**
   * Wait for a specified amount of time
   */
  static async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry a function multiple times with exponential backoff
   */
  static async retry(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          console.log(chalk.dim(`   Retry ${attempt}/${maxRetries} in ${delay}ms...`));
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Check if a service is available
   */
  static async checkServiceAvailability(baseUrl, timeout = 5000) {
    try {
      const response = await axios.get(`${baseUrl}/health`, {
        timeout: timeout
      });

      return {
        available: true,
        status: response.status,
        data: response.data
      };
    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }

  /**
   * Measure execution time of a function
   */
  static async measureTime(fn, label = 'Operation') {
    const startTime = performance.now();
    
    try {
      const result = await fn();
      const endTime = performance.now();
      const duration = endTime - startTime;

      return {
        result,
        duration,
        success: true
      };
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      return {
        error,
        duration,
        success: false
      };
    }
  }

  /**
   * Create a test axios instance with authentication
   */
  static createAuthenticatedAxios(baseUrl, token) {
    return axios.create({
      baseURL: baseUrl,
      timeout: 5000,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Generate random test data
   */
  static generateTestData() {
    const now = new Date();
    const randomId = Math.random().toString(36).substr(2, 9);
    
    return {
      userId: `test-user-${randomId}`,
      sessionId: `session-${randomId}`,
      timestamp: now.toISOString(),
      ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
      userAgent: 'ThreatGuard-CLI/1.0.0 Test-Agent',
      correlationId: `test-${Date.now()}-${randomId}`
    };
  }

  /**
   * Validate API response structure
   */
  static validateApiResponse(response, requiredFields = []) {
    const errors = [];

    // Check status code
    if (response.status < 200 || response.status >= 300) {
      errors.push(`Invalid status code: ${response.status}`);
    }

    // Check response has data
    if (!response.data) {
      errors.push('Response missing data field');
      return errors;
    }

    // Check required fields
    for (const field of requiredFields) {
      if (typeof response.data[field] === 'undefined') {
        errors.push(`Missing required field: ${field}`);
      }
    }

    return errors;
  }

  /**
   * Validate WebSocket event structure
   */
  static validateStreamEvent(event) {
    const errors = [];
    
    if (!event.type) {
      errors.push('Event missing type field');
    }

    if (!event.timestamp) {
      errors.push('Event missing timestamp field');
    }

    if (!event.data) {
      errors.push('Event missing data field');
    }

    if (!event.metadata) {
      errors.push('Event missing metadata field');
    } else {
      if (!event.metadata.source) {
        errors.push('Event metadata missing source field');
      }
      if (!event.metadata.correlationId) {
        errors.push('Event metadata missing correlationId field');
      }
    }

    // Validate timestamp format
    if (event.timestamp && isNaN(new Date(event.timestamp).getTime())) {
      errors.push('Event timestamp is not a valid ISO date');
    }

    return errors;
  }

  /**
   * Create test results formatter
   */
  static createResultsTracker() {
    return {
      total: 0,
      passed: 0,
      failed: 0,
      errors: [],
      
      addTest: function(testName, success, error = null) {
        this.total++;
        if (success) {
          this.passed++;
        } else {
          this.failed++;
          this.errors.push({
            test: testName,
            error: error?.message || error || 'Unknown error'
          });
        }
      },
      
      getSuccessRate: function() {
        return this.total > 0 ? (this.passed / this.total * 100) : 0;
      },
      
      printSummary: function(title = 'Test Results') {
        console.log(chalk.bold.cyan(`\n📊 ${title}`));
        console.log(chalk.dim('================================'));
        console.log(`Total Tests: ${this.total}`);
        console.log(chalk.green(`Passed: ${this.passed}`));
        console.log(chalk.red(`Failed: ${this.failed}`));
        console.log(`Success Rate: ${this.getSuccessRate().toFixed(1)}%`);

        if (this.errors.length > 0) {
          console.log(chalk.red('\n❌ Failed Tests:'));
          this.errors.forEach(error => {
            console.log(chalk.red(`   • ${error.test}: ${error.error}`));
          });
        }
      }
    };
  }

  /**
   * Performance benchmarking utilities
   */
  static createPerformanceBenchmark() {
    return {
      measurements: [],
      
      record: function(operation, duration, metadata = {}) {
        this.measurements.push({
          operation,
          duration,
          timestamp: new Date().toISOString(),
          ...metadata
        });
      },
      
      getStats: function(operation = null) {
        let data = this.measurements;
        
        if (operation) {
          data = data.filter(m => m.operation === operation);
        }
        
        if (data.length === 0) {
          return null;
        }
        
        const durations = data.map(m => m.duration);
        
        return {
          count: data.length,
          average: durations.reduce((a, b) => a + b, 0) / durations.length,
          min: Math.min(...durations),
          max: Math.max(...durations),
          p95: this.percentile(durations, 95),
          p99: this.percentile(durations, 99)
        };
      },
      
      percentile: function(arr, p) {
        const sorted = arr.sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * (p / 100)) - 1;
        return sorted[index];
      },
      
      printReport: function() {
        const operations = [...new Set(this.measurements.map(m => m.operation))];
        
        console.log(chalk.yellow('\n📈 Performance Report'));
        console.log(chalk.dim('================================'));
        
        for (const operation of operations) {
          const stats = this.getStats(operation);
          if (stats) {
            console.log(chalk.cyan(`\n${operation}:`));
            console.log(chalk.dim(`  Count: ${stats.count}`));
            console.log(chalk.dim(`  Average: ${stats.average.toFixed(2)}ms`));
            console.log(chalk.dim(`  Min: ${stats.min.toFixed(2)}ms`));
            console.log(chalk.dim(`  Max: ${stats.max.toFixed(2)}ms`));
            console.log(chalk.dim(`  P95: ${stats.p95.toFixed(2)}ms`));
            console.log(chalk.dim(`  P99: ${stats.p99.toFixed(2)}ms`));
          }
        }
      }
    };
  }

  /**
   * Load testing utilities
   */
  static async runLoadTest(testFn, options = {}) {
    const {
      concurrency = 10,
      duration = 10000,
      rampUpTime = 2000,
      label = 'Load Test'
    } = options;

    console.log(chalk.yellow(`\n🚀 Running ${label}`));
    console.log(chalk.dim(`Concurrency: ${concurrency}, Duration: ${duration}ms`));

    const results = [];
    const errors = [];
    const startTime = performance.now();
    const benchmark = this.createPerformanceBenchmark();

    // Ramp up workers gradually
    const workers = [];
    const rampUpInterval = rampUpTime / concurrency;

    for (let i = 0; i < concurrency; i++) {
      setTimeout(async () => {
        const workerId = i;
        const workerStartTime = performance.now();
        
        while (performance.now() - startTime < duration) {
          try {
            const testResult = await this.measureTime(testFn);
            
            if (testResult.success) {
              results.push({
                workerId,
                duration: testResult.duration,
                timestamp: performance.now() - startTime
              });
              benchmark.record(`worker-${workerId}`, testResult.duration);
            } else {
              errors.push({
                workerId,
                error: testResult.error?.message || 'Unknown error',
                timestamp: performance.now() - startTime
              });
            }

            // Small delay between requests
            await this.sleep(10);

          } catch (error) {
            errors.push({
              workerId,
              error: error.message,
              timestamp: performance.now() - startTime
            });
          }
        }
      }, i * rampUpInterval);
    }

    // Wait for test duration + ramp up time + cleanup
    await this.sleep(duration + rampUpTime + 1000);

    const totalTime = performance.now() - startTime;
    const successfulRequests = results.length;
    const failedRequests = errors.length;
    const totalRequests = successfulRequests + failedRequests;

    console.log(chalk.cyan(`\n📊 ${label} Results:`));
    console.log(chalk.dim(`Duration: ${(totalTime / 1000).toFixed(2)}s`));
    console.log(chalk.dim(`Total Requests: ${totalRequests}`));
    console.log(chalk.green(`Successful: ${successfulRequests}`));
    console.log(chalk.red(`Failed: ${failedRequests}`));
    
    if (totalRequests > 0) {
      const successRate = (successfulRequests / totalRequests * 100).toFixed(1);
      console.log(chalk.dim(`Success Rate: ${successRate}%`));
      
      const rps = (successfulRequests / (totalTime / 1000)).toFixed(2);
      console.log(chalk.dim(`Requests/Second: ${rps}`));
    }

    if (results.length > 0) {
      const durations = results.map(r => r.duration);
      const avgLatency = durations.reduce((a, b) => a + b, 0) / durations.length;
      console.log(chalk.dim(`Average Latency: ${avgLatency.toFixed(2)}ms`));
    }

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      results,
      errors,
      benchmark
    };
  }

  /**
   * Environment validation
   */
  static validateTestEnvironment() {
    const issues = [];

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion < 16) {
      issues.push(`Node.js version ${nodeVersion} is too old. Requires Node.js 16+`);
    }

    // Check required environment variables
    if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
      issues.push('JWT_SECRET environment variable not set');
    }

    // Check if required dependencies are available
    const requiredModules = ['axios', 'socket.io-client', 'jsonwebtoken', 'chalk'];
    for (const module of requiredModules) {
      try {
        require.resolve(module);
      } catch (error) {
        issues.push(`Required module '${module}' is not installed`);
      }
    }

    return issues;
  }

  /**
   * Print test environment information
   */
  static printEnvironmentInfo() {
    console.log(chalk.bold.cyan('🔧 Test Environment Information'));
    console.log(chalk.dim('================================'));
    console.log(chalk.dim(`Node.js Version: ${process.version}`));
    console.log(chalk.dim(`Platform: ${process.platform}`));
    console.log(chalk.dim(`Architecture: ${process.arch}`));
    console.log(chalk.dim(`Working Directory: ${process.cwd()}`));
    console.log(chalk.dim(`Test Runner PID: ${process.pid}`));
    
    const envIssues = this.validateTestEnvironment();
    if (envIssues.length > 0) {
      console.log(chalk.red('\n⚠️  Environment Issues:'));
      envIssues.forEach(issue => {
        console.log(chalk.red(`   • ${issue}`));
      });
    } else {
      console.log(chalk.green('\n✅ Environment validation passed'));
    }
  }
}

module.exports = TestHelpers;