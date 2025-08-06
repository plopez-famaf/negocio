#!/usr/bin/env node

/**
 * WebSocket Communication Integration Testing Suite
 * Tests WebSocket streaming functionality of bg-threat-ai service
 */

const io = require('socket.io-client');
const jwt = require('jsonwebtoken');
const chalk = require('chalk');
const { performance } = require('perf_hooks');

const BASE_URL = 'http://localhost:3001';
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-key';

// Test configuration
const CONFIG = {
  connectionTimeout: 5000,
  eventTimeout: 10000,
  maxConcurrentConnections: 100,
  loadTestDuration: 30000, // 30 seconds
  maxEventLatency: 50 // milliseconds
};

// Test results tracking
let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

class WebSocketTester {
  constructor() {
    this.testToken = this.generateTestToken();
    this.connections = [];
  }

  generateTestToken(userId = 'ws-test-user', role = 'analyst') {
    return jwt.sign(
      {
        sub: userId,
        role: role,
        email: `${userId}@threatguard.com`,
        permissions: ['threat:read', 'behavior:read', 'network:read', 'intelligence:read']
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  }

  createConnection(token = this.testToken, options = {}) {
    return io(BASE_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      timeout: CONFIG.connectionTimeout,
      forceNew: true,
      ...options
    });
  }

  async runTest(testName, testFn) {
    testResults.total++;
    console.log(chalk.cyan(`🧪 Testing: ${testName}`));
    
    try {
      await testFn();
      testResults.passed++;
      console.log(chalk.green(`✅ PASSED: ${testName}`));
      
    } catch (error) {
      testResults.failed++;
      testResults.errors.push({
        test: testName,
        error: error.message
      });
      console.log(chalk.red(`❌ FAILED: ${testName} - ${error.message}`));
    }
  }

  async testBasicConnection() {
    await this.runTest('Basic WebSocket Connection', () => {
      return new Promise((resolve, reject) => {
        const socket = this.createConnection();
        
        const timeout = setTimeout(() => {
          socket.disconnect();
          reject(new Error('Connection timeout'));
        }, CONFIG.connectionTimeout);

        socket.on('connect', () => {
          clearTimeout(timeout);
          console.log(chalk.dim(`   Connected with ID: ${socket.id}`));
          socket.disconnect();
          resolve();
        });

        socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });
  }

  async testAuthenticatedConnection() {
    await this.runTest('Authenticated WebSocket Connection', () => {
      return new Promise((resolve, reject) => {
        const socket = this.createConnection(this.testToken);
        
        const timeout = setTimeout(() => {
          socket.disconnect();
          reject(new Error('Authentication timeout'));
        }, CONFIG.connectionTimeout);

        socket.on('connect', () => {
          clearTimeout(timeout);
          console.log(chalk.dim(`   Authenticated connection established`));
          socket.disconnect();
          resolve();
        });

        socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(new Error(`Authentication failed: ${error.message}`));
        });
      });
    });
  }

  async testUnauthenticatedConnectionRejection() {
    await this.runTest('Unauthenticated Connection Rejection', () => {
      return new Promise((resolve, reject) => {
        const socket = this.createConnection('invalid-token');
        
        const timeout = setTimeout(() => {
          socket.disconnect();
          reject(new Error('Should have rejected invalid token'));
        }, CONFIG.connectionTimeout);

        socket.on('connect', () => {
          clearTimeout(timeout);
          socket.disconnect();
          reject(new Error('Invalid token was accepted'));
        });

        socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          if (error.message.includes('Authentication') || error.message.includes('token')) {
            console.log(chalk.dim(`   Correctly rejected: ${error.message}`));
            resolve();
          } else {
            reject(error);
          }
        });
      });
    });
  }

  async testEventStreaming() {
    await this.runTest('Event Streaming Reception', () => {
      return new Promise((resolve, reject) => {
        const socket = this.createConnection();
        let eventCount = 0;
        const requiredEvents = 3;
        const eventTypes = new Set();
        
        const timeout = setTimeout(() => {
          socket.disconnect();
          reject(new Error(`Only received ${eventCount}/${requiredEvents} events`));
        }, CONFIG.eventTimeout);

        socket.on('connect', () => {
          console.log(chalk.dim(`   Listening for stream events...`));
        });

        socket.on('stream_event', (event) => {
          eventCount++;
          eventTypes.add(event.type);
          
          console.log(chalk.dim(`   Received ${event.type} event (${eventCount}/${requiredEvents})`));
          
          // Validate event structure
          if (!event.type || !event.timestamp || !event.data || !event.metadata) {
            clearTimeout(timeout);
            socket.disconnect();
            reject(new Error('Invalid event structure'));
            return;
          }

          if (eventCount >= requiredEvents) {
            clearTimeout(timeout);
            socket.disconnect();
            console.log(chalk.dim(`   Event types received: ${Array.from(eventTypes).join(', ')}`));
            resolve();
          }
        });

        socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });
  }

  async testEventFiltering() {
    await this.runTest('Event Filtering', () => {
      return new Promise((resolve, reject) => {
        const socket = this.createConnection();
        let receivedEvents = [];
        
        const timeout = setTimeout(() => {
          socket.disconnect();
          
          // Check if filtering worked
          const threatEvents = receivedEvents.filter(e => e.type === 'threat');
          if (threatEvents.length > 0) {
            resolve();
          } else {
            reject(new Error('No threat events received after filtering'));
          }
        }, CONFIG.eventTimeout);

        socket.on('connect', () => {
          // Request only threat events
          socket.emit('update_filters', {
            eventTypes: ['threat'],
            severity: ['high', 'critical']
          });
          console.log(chalk.dim(`   Applied filters: threat events, high/critical severity`));
        });

        socket.on('filters_updated', (filters) => {
          console.log(chalk.dim(`   Filters confirmed:`, filters));
        });

        socket.on('stream_event', (event) => {
          receivedEvents.push(event);
          console.log(chalk.dim(`   Filtered event: ${event.type} (${event.data.severity || 'N/A'})`));
          
          // Verify filtering worked
          if (event.type !== 'threat') {
            clearTimeout(timeout);
            socket.disconnect();
            reject(new Error(`Received non-threat event: ${event.type}`));
            return;
          }
        });

        socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });
  }

  async testHeartbeat() {
    await this.runTest('Heartbeat Mechanism', () => {
      return new Promise((resolve, reject) => {
        const socket = this.createConnection();
        
        const timeout = setTimeout(() => {
          socket.disconnect();
          reject(new Error('Heartbeat timeout'));
        }, CONFIG.connectionTimeout);

        socket.on('connect', () => {
          socket.emit('heartbeat');
          console.log(chalk.dim(`   Sent heartbeat`));
        });

        socket.on('heartbeat_response', (response) => {
          clearTimeout(timeout);
          
          if (!response.timestamp || !response.status) {
            socket.disconnect();
            reject(new Error('Invalid heartbeat response'));
            return;
          }

          console.log(chalk.dim(`   Heartbeat response: ${response.status}`));
          socket.disconnect();
          resolve();
        });

        socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });
  }

  async testReconnection() {
    await this.runTest('Reconnection Handling', () => {
      return new Promise((resolve, reject) => {
        const socket = this.createConnection(this.testToken, {
          reconnection: true,
          reconnectionAttempts: 3,
          reconnectionDelay: 1000
        });
        
        let reconnected = false;
        let initialConnectionId = null;
        
        const timeout = setTimeout(() => {
          socket.disconnect();
          if (reconnected) {
            resolve();
          } else {
            reject(new Error('Reconnection failed'));
          }
        }, 10000);

        socket.on('connect', () => {
          if (!initialConnectionId) {
            initialConnectionId = socket.id;
            console.log(chalk.dim(`   Initial connection: ${socket.id}`));
            
            // Force disconnect to test reconnection
            setTimeout(() => {
              socket.disconnect();
            }, 1000);
          } else {
            console.log(chalk.dim(`   Reconnected with new ID: ${socket.id}`));
            reconnected = true;
            clearTimeout(timeout);
            socket.disconnect();
            resolve();
          }
        });

        socket.on('disconnect', (reason) => {
          if (reason === 'io client disconnect' && !reconnected) {
            console.log(chalk.dim(`   Disconnected, should reconnect...`));
          }
        });

        socket.on('connect_error', (error) => {
          if (!reconnected) {
            clearTimeout(timeout);
            reject(error);
          }
        });
      });
    });
  }

  async testConcurrentConnections() {
    await this.runTest('Concurrent Connections', async () => {
      const numConnections = Math.min(CONFIG.maxConcurrentConnections, 50); // Start with 50
      const connections = [];
      const promises = [];

      console.log(chalk.dim(`   Testing ${numConnections} concurrent connections...`));

      // Create multiple connections
      for (let i = 0; i < numConnections; i++) {
        const token = this.generateTestToken(`concurrent-user-${i}`);
        const socket = this.createConnection(token);
        connections.push(socket);

        const promise = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`Connection ${i} timeout`));
          }, CONFIG.connectionTimeout);

          socket.on('connect', () => {
            clearTimeout(timeout);
            resolve(i);
          });

          socket.on('connect_error', (error) => {
            clearTimeout(timeout);
            reject(new Error(`Connection ${i} failed: ${error.message}`));
          });
        });

        promises.push(promise);
      }

      try {
        const results = await Promise.all(promises);
        console.log(chalk.dim(`   ${results.length} connections established successfully`));
        
        // Test that all connections can receive events
        let eventCounts = new Array(numConnections).fill(0);
        
        const eventPromises = connections.map((socket, index) => {
          return new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(), 5000);
            
            socket.on('stream_event', (event) => {
              eventCounts[index]++;
              if (eventCounts[index] >= 2) { // Wait for at least 2 events
                clearTimeout(timeout);
                resolve();
              }
            });
          });
        });

        await Promise.all(eventPromises);
        
        const totalEvents = eventCounts.reduce((sum, count) => sum + count, 0);
        console.log(chalk.dim(`   Received ${totalEvents} total events across all connections`));
        
      } finally {
        // Clean up all connections
        connections.forEach(socket => socket.disconnect());
      }
    });
  }

  async testEventLatency() {
    await this.runTest('Event Latency Measurement', () => {
      return new Promise((resolve, reject) => {
        const socket = this.createConnection();
        const latencies = [];
        let eventCount = 0;
        const maxEvents = 10;
        
        const timeout = setTimeout(() => {
          socket.disconnect();
          
          if (latencies.length > 0) {
            const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
            const maxLatency = Math.max(...latencies);
            
            console.log(chalk.dim(`   Average latency: ${avgLatency.toFixed(2)}ms`));
            console.log(chalk.dim(`   Max latency: ${maxLatency.toFixed(2)}ms`));
            
            if (avgLatency > CONFIG.maxEventLatency) {
              reject(new Error(`Average latency ${avgLatency.toFixed(2)}ms exceeds limit of ${CONFIG.maxEventLatency}ms`));
            } else {
              resolve();
            }
          } else {
            reject(new Error('No events received for latency testing'));
          }
        }, CONFIG.eventTimeout);

        socket.on('connect', () => {
          console.log(chalk.dim(`   Measuring event latency...`));
        });

        socket.on('stream_event', (event) => {
          const eventTimestamp = new Date(event.timestamp).getTime();
          const currentTime = Date.now();
          const latency = currentTime - eventTimestamp;
          
          latencies.push(latency);
          eventCount++;
          
          if (eventCount >= maxEvents) {
            clearTimeout(timeout);
            socket.disconnect();
            
            const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
            console.log(chalk.dim(`   Measured ${eventCount} events, avg latency: ${avgLatency.toFixed(2)}ms`));
            
            if (avgLatency > CONFIG.maxEventLatency) {
              reject(new Error(`Average latency ${avgLatency.toFixed(2)}ms exceeds limit of ${CONFIG.maxEventLatency}ms`));
            } else {
              resolve();
            }
          }
        });

        socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });
  }

  async testLoadPerformance() {
    console.log(chalk.yellow('\n📊 Running WebSocket Load Performance Test...'));
    
    const numConnections = 20;
    const connections = [];
    const eventCounts = new Array(numConnections).fill(0);
    const startTime = performance.now();

    try {
      // Create connections
      for (let i = 0; i < numConnections; i++) {
        const token = this.generateTestToken(`load-user-${i}`);
        const socket = this.createConnection(token);
        connections.push(socket);
      }

      // Wait for all connections to establish
      await Promise.all(connections.map((socket, index) => {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`Load test connection ${index} timeout`));
          }, CONFIG.connectionTimeout);

          socket.on('connect', () => {
            clearTimeout(timeout);
            resolve();
          });

          socket.on('connect_error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        });
      }));

      console.log(chalk.dim(`   ${numConnections} connections established for load test`));

      // Count events for specified duration
      connections.forEach((socket, index) => {
        socket.on('stream_event', (event) => {
          eventCounts[index]++;
        });
      });

      // Wait for load test duration
      await new Promise(resolve => setTimeout(resolve, CONFIG.loadTestDuration));

      const totalEvents = eventCounts.reduce((sum, count) => sum + count, 0);
      const duration = (performance.now() - startTime) / 1000; // seconds
      const eventsPerSecond = (totalEvents / duration).toFixed(2);
      const eventsPerConnection = (totalEvents / numConnections).toFixed(2);

      console.log(chalk.cyan(`📈 Load Test Results:`));
      console.log(chalk.dim(`   Duration: ${duration.toFixed(1)}s`));
      console.log(chalk.dim(`   Connections: ${numConnections}`));
      console.log(chalk.dim(`   Total Events: ${totalEvents}`));
      console.log(chalk.dim(`   Events/Second: ${eventsPerSecond}`));
      console.log(chalk.dim(`   Events/Connection: ${eventsPerConnection}`));

      if (totalEvents < 100) {
        console.log(chalk.red(`⚠️  Low event throughput: ${totalEvents} events`));
      } else {
        console.log(chalk.green(`✅ Good event throughput: ${eventsPerSecond} events/sec`));
      }

    } finally {
      // Clean up all connections
      connections.forEach(socket => socket.disconnect());
    }
  }

  async runAllTests() {
    console.log(chalk.bold.cyan('🚀 Starting WebSocket Communication Integration Testing Suite\n'));
    console.log(chalk.dim(`Base URL: ${BASE_URL}`));
    console.log(chalk.dim(`Connection Timeout: ${CONFIG.connectionTimeout}ms`));
    console.log(chalk.dim(`Event Timeout: ${CONFIG.eventTimeout}ms`));
    console.log(chalk.dim(`Max Event Latency: ${CONFIG.maxEventLatency}ms\n`));

    // Check service availability first
    try {
      const socket = this.createConnection();
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          socket.disconnect();
          reject(new Error('Service availability check timeout'));
        }, 5000);

        socket.on('connect', () => {
          clearTimeout(timeout);
          socket.disconnect();
          resolve();
        });

        socket.on('connect_error', reject);
      });
      
      console.log(chalk.green('✅ WebSocket service is available\n'));
    } catch (error) {
      console.log(chalk.red('❌ WebSocket service is not available. Please start bg-threat-ai service first.'));
      console.log(chalk.dim('   Run: cd bg-identity-ai && npm run dev\n'));
      process.exit(1);
    }

    // Run all test suites
    await this.testBasicConnection();
    await this.testAuthenticatedConnection();
    await this.testUnauthenticatedConnectionRejection();
    await this.testEventStreaming();
    await this.testEventFiltering();
    await this.testHeartbeat();
    await this.testReconnection();
    await this.testConcurrentConnections();
    await this.testEventLatency();
    await this.testLoadPerformance();

    // Print final results
    this.printResults();
  }

  printResults() {
    console.log(chalk.bold.cyan('\n📊 WebSocket Test Results Summary'));
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
      console.log(chalk.green('\n🎉 All WebSocket communication tests passed!'));
      process.exit(0);
    } else {
      console.log(chalk.red('\n💥 Some tests failed. Please review and fix issues.'));
      process.exit(1);
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new WebSocketTester();
  tester.runAllTests().catch(error => {
    console.error(chalk.red('Test runner error:'), error);
    process.exit(1);
  });
}

module.exports = WebSocketTester;