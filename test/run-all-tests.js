#!/usr/bin/env node
/**
 * Master Test Runner
 * Orchestrates all testing suites and generates comprehensive report
 */

const { AuthEndpointTester } = require('./api/auth-endpoints.test.js');
const { WebSocketLoadTester } = require('./websocket/load-test.js');
const { CLIIntegrationTester } = require('./cli/integration-test.js');
const { PerformanceBenchmarkSuite } = require('./performance/benchmark-suite.js');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class MasterTestRunner {
  constructor(config = {}) {
    this.config = {
      apiUrl: config.apiUrl || 'http://localhost:3001',
      wsUrl: config.wsUrl || 'ws://localhost:3001/ws',
      cliPath: config.cliPath || '../threatguard-cli/dist/index.js',
      authToken: 'test_token_123',
      maxConnections: config.maxConnections || 100,
      testDuration: config.testDuration || 60,
      skipServices: config.skipServices || false
    };
    
    this.results = {
      timestamp: new Date().toISOString(),
      config: this.config,
      services: {},
      tests: {},
      overall: {
        passed: 0,
        failed: 0,
        total: 0,
        duration: 0
      }
    };
  }

  async runAllTests() {
    const startTime = Date.now();
    
    console.log('🚀 ThreatGuard Service Communication & Integration Testing');
    console.log('===========================================================');
    console.log(`Started at: ${new Date().toLocaleString()}`);
    console.log(`Configuration: ${JSON.stringify(this.config, null, 2)}\n`);

    try {
      // Phase 1: Service Health Check
      if (!this.config.skipServices) {
        await this.checkServiceHealth();
      }
      
      // Phase 2: API Endpoint Testing
      await this.runAPITests();
      
      // Phase 3: WebSocket Load Testing
      await this.runWebSocketTests();
      
      // Phase 4: CLI Integration Testing
      await this.runCLITests();
      
      // Phase 5: Performance Benchmarking
      await this.runPerformanceTests();
      
      // Phase 6: Generate Reports
      await this.generateFinalReport();
      
      const endTime = Date.now();
      this.results.overall.duration = endTime - startTime;
      
      console.log('\n🎉 All tests completed successfully!');
      console.log(`Total Duration: ${(this.results.overall.duration / 1000).toFixed(2)}s`);
      
      return this.results;
      
    } catch (error) {
      console.error('\n❌ Test suite failed:', error.message);
      throw error;
    }
  }

  async checkServiceHealth() {
    console.log('🏥 Phase 1: Service Health Check\n');
    
    const services = [
      { name: 'bg-threat-ai', url: `${this.config.apiUrl}/health`, port: 3001 },
      { name: 'bg-web', url: 'http://localhost:3000/api/health', port: 3000 }
    ];
    
    this.results.services = {};
    
    for (const service of services) {
      try {
        console.log(`  🔍 Checking ${service.name} (${service.url})...`);
        
        const axios = require('axios');
        const response = await axios.get(service.url, { timeout: 5000 });
        
        this.results.services[service.name] = {
          status: 'healthy',
          responseTime: 'measured',
          statusCode: response.status,
          data: response.data
        };
        
        console.log(`  ✅ ${service.name} is healthy`);
        
      } catch (error) {
        this.results.services[service.name] = {
          status: 'unhealthy',
          error: error.message,
          statusCode: error.response?.status
        };
        
        console.log(`  ❌ ${service.name} is unhealthy: ${error.message}`);
        
        if (service.name === 'bg-threat-ai') {
          throw new Error(`Critical service ${service.name} is not available. Cannot proceed with tests.`);
        }
      }
    }
    
    console.log('\n✅ Service health check completed\n');
  }

  async runAPITests() {
    console.log('🔄 Phase 2: API Endpoint Testing\n');
    
    try {
      const tester = new AuthEndpointTester(this.config.apiUrl);
      const results = await tester.runTests();
      
      this.results.tests.api = {
        success: true,
        ...results
      };
      
      this.results.overall.total += results.total;
      this.results.overall.passed += results.passed;
      this.results.overall.failed += results.failed;
      
      console.log('\n✅ API endpoint testing completed\n');
      
    } catch (error) {
      this.results.tests.api = {
        success: false,
        error: error.message
      };
      console.log(`\n❌ API endpoint testing failed: ${error.message}\n`);
    }
  }

  async runWebSocketTests() {
    console.log('🔌 Phase 3: WebSocket Load Testing\n');
    
    try {
      const tester = new WebSocketLoadTester(this.config.wsUrl, {
        maxConnections: this.config.maxConnections,
        testDurationMs: this.config.testDuration * 1000
      });
      
      const results = await tester.runLoadTest();
      
      this.results.tests.websocket = {
        success: true,
        ...results
      };
      
      this.results.overall.total += 1;
      if (results.connectionsEstablished >= this.config.maxConnections * 0.95) {
        this.results.overall.passed += 1;
      } else {
        this.results.overall.failed += 1;
      }
      
      console.log('\n✅ WebSocket load testing completed\n');
      
    } catch (error) {
      this.results.tests.websocket = {
        success: false,
        error: error.message
      };
      console.log(`\n❌ WebSocket load testing failed: ${error.message}\n`);
    }
  }

  async runCLITests() {
    console.log('🖥️  Phase 4: CLI Integration Testing\n');
    
    try {
      // First, build the CLI if needed
      await this.buildCLI();
      
      const tester = new CLIIntegrationTester(this.config.cliPath);
      const results = await tester.runTests();
      
      this.results.tests.cli = {
        success: true,
        ...results
      };
      
      this.results.overall.total += results.total;
      this.results.overall.passed += results.passed;
      this.results.overall.failed += results.failed;
      
      console.log('\n✅ CLI integration testing completed\n');
      
    } catch (error) {
      this.results.tests.cli = {
        success: false,
        error: error.message
      };
      console.log(`\n❌ CLI integration testing failed: ${error.message}\n`);
    }
  }

  async runPerformanceTests() {
    console.log('🎯 Phase 5: Performance Benchmarking\n');
    
    try {
      const suite = new PerformanceBenchmarkSuite({
        apiUrl: this.config.apiUrl,
        wsUrl: this.config.wsUrl,
        authToken: this.config.authToken
      });
      
      await suite.runAllBenchmarks();
      
      this.results.tests.performance = {
        success: true,
        benchmarks: suite.benchmarks
      };
      
      this.results.overall.total += 1;
      // Assess if performance targets were met
      const performanceScore = this.assessPerformance(suite.benchmarks);
      if (performanceScore >= 0.8) {
        this.results.overall.passed += 1;
      } else {
        this.results.overall.failed += 1;
      }
      
      console.log('\n✅ Performance benchmarking completed\n');
      
    } catch (error) {
      this.results.tests.performance = {
        success: false,
        error: error.message
      };
      console.log(`\n❌ Performance benchmarking failed: ${error.message}\n`);
    }
  }

  async buildCLI() {
    const cliDir = path.resolve(__dirname, '../threatguard-cli');
    
    try {
      // Check if build is needed
      const distPath = path.join(cliDir, 'dist');
      const packageJsonPath = path.join(cliDir, 'package.json');
      
      const [distExists, packageExists] = await Promise.all([
        fs.access(distPath).then(() => true).catch(() => false),
        fs.access(packageJsonPath).then(() => true).catch(() => false)
      ]);
      
      if (!packageExists) {
        console.log('  ⚠️  CLI package.json not found, skipping build');
        return;
      }
      
      if (!distExists) {
        console.log('  🔨 Building CLI...');
        await this.runCommand('npm', ['run', 'build'], cliDir);
        console.log('  ✅ CLI build completed');
      } else {
        console.log('  ✅ CLI build already exists');
      }
      
    } catch (error) {
      console.warn(`  ⚠️  CLI build failed: ${error.message}`);
    }
  }

  async runCommand(command, args, cwd) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { 
        cwd, 
        stdio: 'inherit',
        shell: process.platform === 'win32'
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command exited with code ${code}`));
        }
      });
      
      child.on('error', reject);
    });
  }

  assessPerformance(benchmarks) {
    let score = 0;
    let totalTargets = 0;
    
    // API targets
    if (benchmarks.api) {
      Object.values(benchmarks.api).forEach(metrics => {
        totalTargets++;
        if (metrics.meetsTarget) score++;
      });
    }
    
    // WebSocket targets
    if (benchmarks.websocket?.meetsTarget !== undefined) {
      totalTargets++;
      if (benchmarks.websocket.meetsTarget) score++;
    }
    
    // Load targets
    if (benchmarks.overall?.concurrentLoad?.meetsTarget !== undefined) {
      totalTargets++;
      if (benchmarks.overall.concurrentLoad.meetsTarget) score++;
    }
    
    return totalTargets > 0 ? score / totalTargets : 0;
  }

  async generateFinalReport() {
    console.log('📋 Phase 6: Generating Final Report\n');
    
    // Calculate success rates
    const successRate = this.results.overall.total > 0 
      ? (this.results.overall.passed / this.results.overall.total) * 100 
      : 0;
    
    // Generate summary
    const summary = {
      timestamp: this.results.timestamp,
      duration: `${(this.results.overall.duration / 1000).toFixed(2)}s`,
      successRate: `${successRate.toFixed(1)}%`,
      testsTotal: this.results.overall.total,
      testsPassed: this.results.overall.passed,
      testsFailed: this.results.overall.failed,
      services: Object.keys(this.results.services).map(name => ({
        name,
        status: this.results.services[name].status
      })),
      testSuites: Object.keys(this.results.tests).map(suite => ({
        suite,
        success: this.results.tests[suite].success
      }))
    };
    
    // Print summary
    console.log('📊 Test Summary:');
    console.log(`  Success Rate: ${summary.successRate}`);
    console.log(`  Total Tests: ${summary.testsTotal} (${summary.testsPassed} passed, ${summary.testsFailed} failed)`);
    console.log(`  Duration: ${summary.duration}`);
    
    console.log('\n🏥 Services:');
    summary.services.forEach(service => {
      const status = service.status === 'healthy' ? '✅' : '❌';
      console.log(`  ${status} ${service.name}: ${service.status}`);
    });
    
    console.log('\n🧪 Test Suites:');
    summary.testSuites.forEach(suite => {
      const status = suite.success ? '✅' : '❌';
      console.log(`  ${status} ${suite.suite}: ${suite.success ? 'passed' : 'failed'}`);
    });
    
    // Save detailed report
    const reportPath = path.join(__dirname, 'test-results.json');
    await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`\n💾 Detailed report saved to: ${reportPath}`);
    
    // Overall assessment
    console.log('\n🎯 Overall Assessment:');
    if (successRate >= 95) {
      console.log('✅ EXCELLENT - Ready for production deployment');
    } else if (successRate >= 80) {
      console.log('⚠️  GOOD - Minor issues need attention');
    } else if (successRate >= 60) {
      console.log('🔶 FAIR - Significant issues require fixes');
    } else {
      console.log('❌ POOR - Major problems prevent deployment');
    }
  }
}

// CLI usage
if (require.main === module) {
  const config = {
    apiUrl: process.env.API_URL || 'http://localhost:3001',
    wsUrl: process.env.WS_URL || 'ws://localhost:3001/ws',
    cliPath: process.env.CLI_PATH,
    maxConnections: parseInt(process.env.MAX_CONNECTIONS) || 100,
    testDuration: parseInt(process.env.TEST_DURATION) || 60,
    skipServices: process.env.SKIP_SERVICES === 'true'
  };
  
  const runner = new MasterTestRunner(config);
  
  runner.runAllTests()
    .then((results) => {
      const success = results.overall.failed === 0;
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Master test suite failed:', error.message);
      process.exit(1);
    });
}

module.exports = { MasterTestRunner };