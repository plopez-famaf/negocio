#!/usr/bin/env node

/**
 * Comprehensive Test Runner for Service Communication Testing
 * Runs all integration and E2E tests for the Console-First Threat Detection Platform
 */

const chalk = require('chalk');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const TestHelpers = require('./utils/test-helpers');

// Test configuration
const CONFIG = {
  testTimeout: 60000, // 1 minute per test suite
  maxRetries: 2,
  parallel: false // Run tests sequentially to avoid conflicts
};

// Test suites configuration
const TEST_SUITES = [
  {
    name: 'API Endpoints Integration Test',
    script: './integration/api-endpoints.test.js',
    description: 'Tests all REST API endpoints with authentication and validation',
    category: 'integration'
  },
  {
    name: 'WebSocket Communication Test',
    script: './integration/websocket-communication.test.js', 
    description: 'Tests WebSocket streaming, authentication, and load handling',
    category: 'integration'
  },
  {
    name: 'CLI Service Integration Test',
    script: './e2e/cli-service-integration.test.js',
    description: 'Tests end-to-end CLI workflows and service communication',
    category: 'e2e'
  }
];

class TestRunner {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      suites: []
    };
    this.benchmark = TestHelpers.createPerformanceBenchmark();
  }

  async runTestSuite(suite) {
    console.log(chalk.bold.cyan(`\n🧪 Running: ${suite.name}`));
    console.log(chalk.dim(`Description: ${suite.description}`));
    console.log(chalk.dim(`Category: ${suite.category}`));
    console.log(chalk.dim(`Script: ${suite.script}\n`));

    const scriptPath = path.resolve(__dirname, suite.script);
    
    // Check if test script exists
    if (!fs.existsSync(scriptPath)) {
      console.log(chalk.red(`❌ Test script not found: ${scriptPath}`));
      return {
        name: suite.name,
        success: false,
        error: 'Test script not found',
        duration: 0,
        skipped: true
      };
    }

    const testResult = await TestHelpers.measureTime(async () => {
      return this.executeTestScript(scriptPath, suite.name);
    });

    this.benchmark.record(suite.name, testResult.duration);

    if (testResult.success) {
      console.log(chalk.green(`✅ PASSED: ${suite.name} (${testResult.duration.toFixed(2)}ms)\n`));
      return {
        name: suite.name,
        success: true,
        duration: testResult.duration,
        output: testResult.result?.stdout || ''
      };
    } else {
      console.log(chalk.red(`❌ FAILED: ${suite.name} - ${testResult.error?.message || 'Unknown error'}\n`));
      return {
        name: suite.name,
        success: false,
        error: testResult.error?.message || 'Unknown error',
        duration: testResult.duration,
        output: testResult.result?.stderr || testResult.result?.stdout || ''
      };
    }
  }

  async executeTestScript(scriptPath, suiteName) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Test suite timeout: ${suiteName}`));
      }, CONFIG.testTimeout);

      const child = spawn('node', [scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_ENV: 'test',
          JWT_SECRET: process.env.JWT_SECRET || 'development-secret-key'
        }
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        
        // Stream output in real-time
        process.stdout.write(output);
      });

      child.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        
        // Stream error output in real-time
        process.stderr.write(chalk.red(output));
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        
        if (code === 0) {
          resolve({
            success: true,
            stdout,
            stderr,
            code
          });
        } else {
          reject(new Error(`Test suite failed with exit code ${code}`));
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Test execution error: ${error.message}`));
      });
    });
  }

  async checkPrerequisites() {
    console.log(chalk.yellow('📋 Checking Prerequisites...\n'));

    // Check environment
    const envIssues = TestHelpers.validateTestEnvironment();
    if (envIssues.length > 0) {
      console.log(chalk.red('❌ Environment issues found:'));
      envIssues.forEach(issue => {
        console.log(chalk.red(`   • ${issue}`));
      });
      return false;
    }

    // Check service availability
    const serviceUrl = 'http://localhost:3001';
    const serviceCheck = await TestHelpers.checkServiceAvailability(serviceUrl);
    
    if (!serviceCheck.available) {
      console.log(chalk.red('❌ bg-threat-ai service is not available'));
      console.log(chalk.dim('   Please start the service first:'));
      console.log(chalk.dim('   cd bg-identity-ai && npm run dev\n'));
      return false;
    }

    console.log(chalk.green('✅ Service is available and healthy'));
    console.log(chalk.dim(`   Service: ${serviceCheck.data?.service || 'Unknown'}`));
    console.log(chalk.dim(`   Status: ${serviceCheck.data?.status || 'Unknown'}`));
    console.log(chalk.dim(`   Version: ${serviceCheck.data?.version || 'Unknown'}\n`));

    // Check test dependencies
    const testDir = __dirname;
    const requiredFiles = [
      './integration/api-endpoints.test.js',
      './integration/websocket-communication.test.js',
      './e2e/cli-service-integration.test.js',
      './utils/test-helpers.js'
    ];

    const missingFiles = requiredFiles.filter(file => 
      !fs.existsSync(path.join(testDir, file))
    );

    if (missingFiles.length > 0) {
      console.log(chalk.red('❌ Missing test files:'));
      missingFiles.forEach(file => {
        console.log(chalk.red(`   • ${file}`));
      });
      return false;
    }

    console.log(chalk.green('✅ All test files present'));
    console.log(chalk.green('✅ Prerequisites check passed\n'));
    
    return true;
  }

  async runAllTests() {
    // Print header
    console.log(chalk.bold.magenta('🚀 ThreatGuard Service Communication Testing Suite'));
    console.log(chalk.dim('================================================================'));
    console.log(chalk.dim('Console-First Threat Detection Platform - Integration Testing\n'));

    // Print environment info
    TestHelpers.printEnvironmentInfo();

    // Check prerequisites
    const prereqsPassed = await this.checkPrerequisites();
    if (!prereqsPassed) {
      console.log(chalk.red('\n💥 Prerequisites check failed. Exiting.\n'));
      process.exit(1);
    }

    // Run test suites
    console.log(chalk.bold.cyan('🧪 Running Test Suites\n'));
    console.log(chalk.dim(`Total Suites: ${TEST_SUITES.length}`));
    console.log(chalk.dim(`Execution Mode: ${CONFIG.parallel ? 'Parallel' : 'Sequential'}`));
    console.log(chalk.dim(`Timeout per Suite: ${CONFIG.testTimeout / 1000}s\n`));

    const suiteResults = [];

    if (CONFIG.parallel) {
      // Run tests in parallel
      const promises = TEST_SUITES.map(suite => this.runTestSuite(suite));
      const results = await Promise.all(promises);
      suiteResults.push(...results);
    } else {
      // Run tests sequentially
      for (const suite of TEST_SUITES) {
        let attempts = 0;
        let result = null;

        while (attempts < CONFIG.maxRetries && (!result || !result.success)) {
          if (attempts > 0) {
            console.log(chalk.yellow(`⏳ Retrying ${suite.name} (attempt ${attempts + 1}/${CONFIG.maxRetries})\n`));
          }

          result = await this.runTestSuite(suite);
          attempts++;

          if (result.success) {
            break;
          }

          if (attempts < CONFIG.maxRetries) {
            await TestHelpers.sleep(2000); // Wait 2 seconds before retry
          }
        }

        suiteResults.push(result);
      }
    }

    // Process results
    this.processResults(suiteResults);

    // Print comprehensive report
    this.printFinalReport(suiteResults);

    // Exit with appropriate code
    const allPassed = suiteResults.every(result => result.success && !result.skipped);
    process.exit(allPassed ? 0 : 1);
  }

  processResults(suiteResults) {
    this.results.total = suiteResults.length;

    suiteResults.forEach(result => {
      if (result.skipped) {
        this.results.skipped++;
      } else if (result.success) {
        this.results.passed++;
      } else {
        this.results.failed++;
      }

      this.results.suites.push(result);
    });
  }

  printFinalReport(suiteResults) {
    console.log(chalk.bold.magenta('\n📊 Final Test Report'));
    console.log(chalk.dim('================================================================\n'));

    // Summary statistics
    console.log(chalk.bold.cyan('📈 Summary Statistics:'));
    console.log(`Total Test Suites: ${this.results.total}`);
    console.log(chalk.green(`Passed: ${this.results.passed}`));
    console.log(chalk.red(`Failed: ${this.results.failed}`));
    console.log(chalk.yellow(`Skipped: ${this.results.skipped}`));

    const successRate = this.results.total > 0 ? 
      (this.results.passed / (this.results.total - this.results.skipped) * 100) : 0;
    console.log(`Success Rate: ${successRate.toFixed(1)}%\n`);

    // Detailed results
    console.log(chalk.bold.cyan('📋 Detailed Results:'));
    suiteResults.forEach(result => {
      const status = result.skipped ? chalk.yellow('SKIPPED') :
                    result.success ? chalk.green('PASSED') : chalk.red('FAILED');
      
      const duration = result.duration ? `(${result.duration.toFixed(2)}ms)` : '';
      
      console.log(`${status} ${result.name} ${duration}`);
      
      if (!result.success && !result.skipped && result.error) {
        console.log(chalk.red(`   Error: ${result.error}`));
      }
    });

    // Performance report
    console.log('');
    this.benchmark.printReport();

    // Failed tests details
    const failedTests = suiteResults.filter(result => !result.success && !result.skipped);
    if (failedTests.length > 0) {
      console.log(chalk.red('\n❌ Failed Test Suites:'));
      failedTests.forEach(result => {
        console.log(chalk.red(`\n• ${result.name}`));
        console.log(chalk.red(`  Error: ${result.error}`));
        
        if (result.output && result.output.trim()) {
          console.log(chalk.dim('  Output:'));
          result.output.split('\n').forEach(line => {
            if (line.trim()) {
              console.log(chalk.dim(`    ${line}`));
            }
          });
        }
      });
    }

    // Success message
    if (this.results.failed === 0 && this.results.skipped === 0) {
      console.log(chalk.bold.green('\n🎉 ALL TESTS PASSED!'));
      console.log(chalk.cyan('\n🏆 Service Communication Integration Verified:'));
      console.log(chalk.dim('   • API endpoints working correctly ✅'));
      console.log(chalk.dim('   • WebSocket streaming operational ✅'));
      console.log(chalk.dim('   • CLI integration functional ✅'));
      console.log(chalk.dim('   • Authentication flows secure ✅'));
      console.log(chalk.dim('   • Performance within limits ✅'));
      console.log(chalk.dim('   • Error handling robust ✅'));
      
      console.log(chalk.bold.cyan('\n🚀 Console-First Threat Detection Platform Ready for Production!'));
    } else {
      console.log(chalk.red('\n💥 SOME TESTS FAILED'));
      console.log(chalk.yellow('Please review the failed tests and fix the issues before proceeding.'));
    }

    // Testing recommendations
    console.log(chalk.bold.cyan('\n💡 Next Steps:'));
    if (this.results.failed === 0) {
      console.log(chalk.dim('   • Run performance benchmarks under load'));
      console.log(chalk.dim('   • Test with multiple concurrent users'));
      console.log(chalk.dim('   • Implement monitoring and alerting'));
      console.log(chalk.dim('   • Prepare deployment procedures'));
    } else {
      console.log(chalk.dim('   • Fix failing test suites'));
      console.log(chalk.dim('   • Re-run tests to verify fixes'));
      console.log(chalk.dim('   • Check service logs for errors'));
      console.log(chalk.dim('   • Validate environment configuration'));
    }

    console.log(chalk.dim('\nFor detailed logs, check individual test outputs above.'));
    console.log(chalk.dim('================================================================\n'));
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const runner = new TestRunner();
  
  // Handle process signals for clean shutdown
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n⏸️  Test execution interrupted'));
    process.exit(130);
  });

  process.on('SIGTERM', () => {
    console.log(chalk.yellow('\n⏹️  Test execution terminated'));
    process.exit(143);
  });

  // Run all tests
  runner.runAllTests().catch(error => {
    console.error(chalk.red('\n💥 Test runner error:'), error.message);
    process.exit(1);
  });
}

module.exports = TestRunner;