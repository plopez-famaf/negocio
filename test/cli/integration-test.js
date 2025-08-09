/**
 * CLI Integration Testing Suite
 * Tests end-to-end CLI command workflows and error handling
 */

const { spawn } = require('child_process');
const { performance } = require('perf_hooks');
const path = require('path');

class CLIIntegrationTester {
  constructor(cliPath = '../threatguard-cli/dist/index.js') {
    this.cliPath = path.resolve(__dirname, cliPath);
    this.testResults = {
      total: 0,
      passed: 0,
      failed: 0,
      commands: {}
    };
    this.authToken = null;
  }

  async runTests() {
    console.log('🖥️  Starting CLI Integration Tests...\n');

    const testSuites = [
      { name: 'Authentication Commands', fn: () => this.testAuthCommands() },
      { name: 'Threat Detection Commands', fn: () => this.testThreatCommands() },
      { name: 'Behavior Analysis Commands', fn: () => this.testBehaviorCommands() },
      { name: 'Network Monitoring Commands', fn: () => this.testNetworkCommands() },
      { name: 'Intelligence Commands', fn: () => this.testIntelCommands() },
      { name: 'Configuration Commands', fn: () => this.testConfigCommands() },
      { name: 'Error Handling', fn: () => this.testErrorHandling() },
      { name: 'Performance Benchmarks', fn: () => this.testPerformance() }
    ];

    for (const suite of testSuites) {
      console.log(`📁 Running ${suite.name}...`);
      try {
        await suite.fn();
        console.log(`✅ ${suite.name} completed\n`);
      } catch (error) {
        console.log(`❌ ${suite.name} failed: ${error.message}\n`);
      }
    }

    this.printResults();
    return this.testResults;
  }

  async testAuthCommands() {
    const commands = [
      {
        name: 'auth status (unauthenticated)',
        cmd: ['auth', 'status'],
        expectExitCode: 1
      },
      {
        name: 'auth login',
        cmd: ['auth', 'login', '--username', 'test_user', '--password', 'test_password'],
        expectExitCode: 0,
        captureOutput: true
      },
      {
        name: 'auth status (authenticated)',
        cmd: ['auth', 'status'],
        expectExitCode: 0,
        captureOutput: true
      }
    ];

    for (const command of commands) {
      await this.runCLITest(command);
    }
  }

  async testThreatCommands() {
    const commands = [
      {
        name: 'threat scan',
        cmd: ['threat', 'scan', '--targets', '192.168.1.0/24', '--format', 'table'],
        expectExitCode: 0,
        timeout: 30000
      },
      {
        name: 'threat list',
        cmd: ['threat', 'list', '--severity', 'high', '--limit', '10'],
        expectExitCode: 0
      },
      {
        name: 'threat watch (5 seconds)',
        cmd: ['threat', 'watch', '--duration', '5'],
        expectExitCode: 0,
        timeout: 10000
      },
      {
        name: 'threat history',
        cmd: ['threat', 'history', '--days', '7', '--format', 'json'],
        expectExitCode: 0
      }
    ];

    for (const command of commands) {
      await this.runCLITest(command);
    }
  }

  async testBehaviorCommands() {
    const commands = [
      {
        name: 'behavior analyze',
        cmd: ['behavior', 'analyze', '--target', 'user123', '--type', 'user', '--days', '1'],
        expectExitCode: 0,
        timeout: 20000
      },
      {
        name: 'behavior patterns',
        cmd: ['behavior', 'patterns', '--target', 'system', '--format', 'table'],
        expectExitCode: 0
      },
      {
        name: 'behavior profile',
        cmd: ['behavior', 'profile', '--target', 'user123'],
        expectExitCode: 0
      }
    ];

    for (const command of commands) {
      await this.runCLITest(command);
    }
  }

  async testNetworkCommands() {
    const commands = [
      {
        name: 'network scan',
        cmd: ['network', 'scan', '--target', '192.168.1.1', '--ports', '22,80,443'],
        expectExitCode: 0,
        timeout: 15000
      },
      {
        name: 'network events',
        cmd: ['network', 'events', '--last', '1h', '--severity', 'warning'],
        expectExitCode: 0
      },
      {
        name: 'network monitor (5 seconds)',
        cmd: ['network', 'monitor', '--duration', '5', '--targets', '192.168.1.0/24'],
        expectExitCode: 0,
        timeout: 10000
      }
    ];

    for (const command of commands) {
      await this.runCLITest(command);
    }
  }

  async testIntelCommands() {
    const commands = [
      {
        name: 'intel query IP',
        cmd: ['intel', 'query', '--indicators', '8.8.8.8,1.1.1.1', '--type', 'ip'],
        expectExitCode: 0,
        timeout: 15000
      },
      {
        name: 'intel query domain',
        cmd: ['intel', 'query', '--indicators', 'example.com', '--type', 'domain'],
        expectExitCode: 0
      },
      {
        name: 'intel reputation',
        cmd: ['intel', 'reputation', '--indicator', '192.168.1.100'],
        expectExitCode: 0
      }
    ];

    for (const command of commands) {
      await this.runCLITest(command);
    }
  }

  async testConfigCommands() {
    const commands = [
      {
        name: 'config show',
        cmd: ['config', 'show'],
        expectExitCode: 0,
        captureOutput: true
      },
      {
        name: 'config set api-url',
        cmd: ['config', 'set', 'api-url', 'http://localhost:3001'],
        expectExitCode: 0
      },
      {
        name: 'config get api-url',
        cmd: ['config', 'get', 'api-url'],
        expectExitCode: 0,
        expectedOutput: 'http://localhost:3001'
      }
    ];

    for (const command of commands) {
      await this.runCLITest(command);
    }
  }

  async testErrorHandling() {
    const commands = [
      {
        name: 'invalid command',
        cmd: ['invalid', 'command'],
        expectExitCode: 1
      },
      {
        name: 'missing required argument',
        cmd: ['threat', 'scan'],
        expectExitCode: 1
      },
      {
        name: 'invalid option value',
        cmd: ['threat', 'list', '--severity', 'invalid'],
        expectExitCode: 1
      },
      {
        name: 'network timeout handling',
        cmd: ['config', 'set', 'api-url', 'http://invalid-host:9999'],
        followUp: ['threat', 'list'],
        expectExitCode: 1
      }
    ];

    for (const command of commands) {
      await this.runCLITest(command);
      
      if (command.followUp) {
        await this.runCLITest({
          name: `${command.name} (followup)`,
          cmd: command.followUp,
          expectExitCode: command.expectExitCode
        });
      }
    }

    // Reset API URL
    await this.runCLITest({
      name: 'reset api-url',
      cmd: ['config', 'set', 'api-url', 'http://localhost:3001'],
      expectExitCode: 0
    });
  }

  async testPerformance() {
    const performanceCommands = [
      {
        name: 'auth status (performance)',
        cmd: ['auth', 'status'],
        maxTime: 2000 // 2 seconds
      },
      {
        name: 'threat list (performance)',
        cmd: ['threat', 'list', '--limit', '5'],
        maxTime: 5000 // 5 seconds
      },
      {
        name: 'config show (performance)',
        cmd: ['config', 'show'],
        maxTime: 1000 // 1 second
      }
    ];

    for (const command of performanceCommands) {
      const start = performance.now();
      await this.runCLITest({
        name: command.name,
        cmd: command.cmd,
        expectExitCode: 0
      });
      const end = performance.now();
      
      const executionTime = end - start;
      if (executionTime > command.maxTime) {
        throw new Error(`${command.name} took ${executionTime.toFixed(2)}ms, expected < ${command.maxTime}ms`);
      }
      
      console.log(`  ⏱️  ${command.name}: ${executionTime.toFixed(2)}ms`);
    }
  }

  async runCLITest(testConfig) {
    this.testResults.total++;
    
    try {
      const result = await this.executeCLICommand(
        testConfig.cmd,
        testConfig.timeout || 10000
      );
      
      // Check exit code
      if (testConfig.expectExitCode !== undefined && result.exitCode !== testConfig.expectExitCode) {
        throw new Error(`Expected exit code ${testConfig.expectExitCode}, got ${result.exitCode}`);
      }
      
      // Check expected output
      if (testConfig.expectedOutput && !result.stdout.includes(testConfig.expectedOutput)) {
        throw new Error(`Expected output to contain "${testConfig.expectedOutput}"`);
      }
      
      // Store output if needed
      if (testConfig.captureOutput) {
        this.testResults.commands[testConfig.name] = {
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode
        };
      }
      
      this.testResults.passed++;
      console.log(`  ✅ ${testConfig.name}`);
      
    } catch (error) {
      this.testResults.failed++;
      console.log(`  ❌ ${testConfig.name}: ${error.message}`);
    }
  }

  executeCLICommand(args, timeout = 10000) {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      
      const child = spawn('node', [this.cliPath, ...args], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'test' }
      });
      
      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Command timed out'));
      }, timeout);
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (exitCode) => {
        clearTimeout(timeoutId);
        resolve({
          exitCode,
          stdout,
          stderr
        });
      });
      
      child.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  printResults() {
    console.log('📊 CLI Integration Test Results:');
    console.log(`Total Tests: ${this.testResults.total}`);
    console.log(`Passed: ${this.testResults.passed} ✅`);
    console.log(`Failed: ${this.testResults.failed} ❌`);
    console.log(`Success Rate: ${((this.testResults.passed / this.testResults.total) * 100).toFixed(1)}%`);
    
    if (this.testResults.failed === 0) {
      console.log('\n🎉 All CLI integration tests passed!');
    } else {
      console.log('\n⚠️  Some CLI tests failed. Check the output above for details.');
    }
  }
}

// CLI usage
if (require.main === module) {
  const cliPath = process.argv[2];
  const tester = new CLIIntegrationTester(cliPath);
  
  tester.runTests()
    .then((results) => {
      process.exit(results.failed === 0 ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Integration tests failed:', error.message);
      process.exit(1);
    });
}

module.exports = { CLIIntegrationTester };