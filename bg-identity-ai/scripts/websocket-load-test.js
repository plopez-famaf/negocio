#!/usr/bin/env node

/**
 * WebSocket Load Testing Suite
 * Tests concurrent WebSocket connections and real-time performance
 */

const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const { performance } = require('perf_hooks');

// Configuration
const CONFIG = {
  serverUrl: 'http://localhost:3002',
  jwtSecret: 'test-secret-key-for-development-only',
  maxConnections: 100,
  testDuration: 30000, // 30 seconds
  messageInterval: 1000, // 1 second between messages
  performanceTargets: {
    connectionTime: 1000,    // ms to establish connection
    messageLatency: 100,     // ms round-trip
    connectionSuccess: 95,   // percentage
    messageSuccess: 98       // percentage
  }
};

class WebSocketLoadTester {
  constructor() {
    this.connections = [];
    this.metrics = {
      connectionAttempts: 0,
      successfulConnections: 0,
      failedConnections: 0,
      messagesSent: 0,
      messagesReceived: 0,
      messageFailed: 0,
      latencies: [],
      connectionTimes: [],
      errors: []
    };
    this.testStartTime = null;
    this.testEndTime = null;
  }

  generateAuthToken(clientId) {
    return jwt.sign({
      id: `load-test-client-${clientId}`,
      email: `client${clientId}@loadtest.com`,
      role: 'user',
      test: true
    }, CONFIG.jwtSecret, { expiresIn: '1h' });
  }

  async createConnection(clientId) {
    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      const token = this.generateAuthToken(clientId);
      
      const socket = io(CONFIG.serverUrl, {
        auth: { token },
        transports: ['websocket'],
        timeout: 10000
      });

      socket.on('connect', () => {
        const connectionTime = performance.now() - startTime;
        this.metrics.connectionTimes.push(connectionTime);
        this.metrics.successfulConnections++;
        
        console.log(`✅ Client ${clientId} connected (${connectionTime.toFixed(2)}ms)`);
        
        resolve({
          id: clientId,
          socket,
          connected: true,
          connectionTime
        });
      });

      socket.on('connect_error', (error) => {
        this.metrics.failedConnections++;
        this.metrics.errors.push(`Client ${clientId} connection failed: ${error.message}`);
        
        console.log(`❌ Client ${clientId} connection failed: ${error.message}`);
        
        resolve({
          id: clientId,
          socket: null,
          connected: false,
          error: error.message
        });
      });

      socket.on('disconnect', (reason) => {
        console.log(`🔌 Client ${clientId} disconnected: ${reason}`);
      });

      // Setup message handling
      socket.on('threat-event', (data) => {
        const receiveTime = performance.now();
        if (data.timestamp) {
          const latency = receiveTime - data.timestamp;
          this.metrics.latencies.push(latency);
        }
        this.metrics.messagesReceived++;
      });

      socket.on('error', (error) => {
        this.metrics.errors.push(`Client ${clientId} error: ${error.message}`);
      });

      // Timeout handling
      setTimeout(() => {
        if (!socket.connected) {
          this.metrics.failedConnections++;
          reject(new Error(`Connection timeout for client ${clientId}`));
        }
      }, 10000);
    });
  }

  async establishConnections() {
    console.log(`🔄 Establishing ${CONFIG.maxConnections} WebSocket connections...`);
    
    const connectionPromises = [];
    
    // Create connections in batches to avoid overwhelming the server
    const batchSize = 10;
    for (let i = 0; i < CONFIG.maxConnections; i += batchSize) {
      const batch = [];
      
      for (let j = i; j < Math.min(i + batchSize, CONFIG.maxConnections); j++) {
        this.metrics.connectionAttempts++;
        batch.push(this.createConnection(j + 1));
      }
      
      const batchResults = await Promise.allSettled(batch);
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          this.connections.push(result.value);
        }
      });
      
      // Small delay between batches
      if (i + batchSize < CONFIG.maxConnections) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const connectedCount = this.connections.filter(c => c.connected).length;
    console.log(`📊 Connections established: ${connectedCount}/${CONFIG.maxConnections}`);
    
    return connectedCount;
  }

  async runMessageLoadTest() {
    console.log(`📤 Starting message load test (${CONFIG.testDuration / 1000}s duration)...`);
    
    const connectedClients = this.connections.filter(c => c.connected);
    if (connectedClients.length === 0) {
      throw new Error('No connected clients for message testing');
    }

    this.testStartTime = performance.now();
    
    // Send messages at regular intervals
    const messageInterval = setInterval(() => {
      connectedClients.forEach(client => {
        if (client.socket && client.socket.connected) {
          const message = {
            type: 'threat-query',
            clientId: client.id,
            timestamp: performance.now(),
            data: {
              query: 'real-time-threat-detection',
              priority: 'high',
              source: `load-test-client-${client.id}`
            }
          };
          
          try {
            client.socket.emit('threat-query', message);
            this.metrics.messagesSent++;
          } catch (error) {
            this.metrics.messageFailed++;
            this.metrics.errors.push(`Message send failed for client ${client.id}: ${error.message}`);
          }
        }
      });
    }, CONFIG.messageInterval);

    // Run test for specified duration
    await new Promise(resolve => setTimeout(resolve, CONFIG.testDuration));
    
    clearInterval(messageInterval);
    this.testEndTime = performance.now();
    
    console.log(`📥 Message load test completed`);
  }

  async simulateRealTimeEvents() {
    console.log(`🚨 Simulating real-time threat events...`);
    
    const connectedClients = this.connections.filter(c => c.connected);
    const eventTypes = ['malware-detected', 'behavioral-anomaly', 'network-intrusion', 'threat-intelligence-match'];
    
    // Simulate server-side events
    const eventInterval = setInterval(() => {
      const randomClient = connectedClients[Math.floor(Math.random() * connectedClients.length)];
      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      
      if (randomClient && randomClient.socket && randomClient.socket.connected) {
        // Simulate server sending events to clients
        const eventData = {
          type: eventType,
          timestamp: performance.now(),
          severity: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
          source: `192.168.1.${Math.floor(Math.random() * 255)}`,
          details: `Simulated ${eventType} event`
        };
        
        // In a real scenario, the server would broadcast this
        // For testing, we'll emit it back to ourselves to measure round-trip
        randomClient.socket.emit('simulate-event', eventData);
      }
    }, 500); // More frequent events for load testing

    await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds of events
    clearInterval(eventInterval);
  }

  calculateMetrics() {
    const totalTestTime = this.testEndTime - this.testStartTime;
    
    // Connection metrics
    const connectionSuccessRate = (this.metrics.successfulConnections / this.metrics.connectionAttempts) * 100;
    const avgConnectionTime = this.metrics.connectionTimes.length > 0 ? 
      this.metrics.connectionTimes.reduce((sum, time) => sum + time, 0) / this.metrics.connectionTimes.length : 0;
    
    // Message metrics
    const messageSuccessRate = this.metrics.messagesSent > 0 ? 
      (this.metrics.messagesReceived / this.metrics.messagesSent) * 100 : 0;
    const avgLatency = this.metrics.latencies.length > 0 ?
      this.metrics.latencies.reduce((sum, lat) => sum + lat, 0) / this.metrics.latencies.length : 0;
    
    // Percentile calculations
    const sortedLatencies = this.metrics.latencies.sort((a, b) => a - b);
    const p95Latency = sortedLatencies.length > 0 ? 
      sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] : 0;
    const p99Latency = sortedLatencies.length > 0 ?
      sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] : 0;

    const messagesPerSecond = totalTestTime > 0 ? 
      (this.metrics.messagesReceived / (totalTestTime / 1000)) : 0;

    return {
      connections: {
        attempted: this.metrics.connectionAttempts,
        successful: this.metrics.successfulConnections,
        failed: this.metrics.failedConnections,
        successRate: connectionSuccessRate,
        avgConnectionTime
      },
      messages: {
        sent: this.metrics.messagesSent,
        received: this.metrics.messagesReceived,
        failed: this.metrics.messageFailed,
        successRate: messageSuccessRate,
        avgLatency,
        p95Latency,
        p99Latency,
        messagesPerSecond
      },
      performance: {
        testDuration: totalTestTime,
        errors: this.metrics.errors.length,
        passedConnectionTarget: connectionSuccessRate >= CONFIG.performanceTargets.connectionSuccess,
        passedLatencyTarget: avgLatency <= CONFIG.performanceTargets.messageLatency,
        passedMessageTarget: messageSuccessRate >= CONFIG.performanceTargets.messageSuccess
      }
    };
  }

  async cleanup() {
    console.log(`🧹 Cleaning up connections...`);
    
    const cleanupPromises = this.connections
      .filter(c => c.connected && c.socket)
      .map(c => {
        return new Promise((resolve) => {
          c.socket.disconnect();
          resolve();
        });
      });

    await Promise.all(cleanupPromises);
    console.log(`✅ Cleanup completed`);
  }

  printResults(metrics) {
    console.log('\n================================================================');
    console.log('📊 WEBSOCKET LOAD TEST RESULTS');
    console.log('================================================================');

    console.log('\n🔌 CONNECTION METRICS:');
    console.log(`• Attempted Connections: ${metrics.connections.attempted}`);
    console.log(`• Successful Connections: ${metrics.connections.successful}`);
    console.log(`• Failed Connections: ${metrics.connections.failed}`);
    console.log(`• Success Rate: ${metrics.connections.successRate.toFixed(2)}% (target: ≥${CONFIG.performanceTargets.connectionSuccess}%)`);
    console.log(`• Average Connection Time: ${metrics.connections.avgConnectionTime.toFixed(2)}ms (target: <${CONFIG.performanceTargets.connectionTime}ms)`);

    console.log('\n📨 MESSAGE METRICS:');
    console.log(`• Messages Sent: ${metrics.messages.sent}`);
    console.log(`• Messages Received: ${metrics.messages.received}`);
    console.log(`• Messages Failed: ${metrics.messages.failed}`);
    console.log(`• Success Rate: ${metrics.messages.successRate.toFixed(2)}% (target: ≥${CONFIG.performanceTargets.messageSuccess}%)`);
    console.log(`• Average Latency: ${metrics.messages.avgLatency.toFixed(2)}ms (target: <${CONFIG.performanceTargets.messageLatency}ms)`);
    console.log(`• 95th Percentile Latency: ${metrics.messages.p95Latency.toFixed(2)}ms`);
    console.log(`• 99th Percentile Latency: ${metrics.messages.p99Latency.toFixed(2)}ms`);
    console.log(`• Messages/Second: ${metrics.messages.messagesPerSecond.toFixed(2)}`);

    console.log('\n⚡ PERFORMANCE SUMMARY:');
    console.log(`• Test Duration: ${(metrics.performance.testDuration / 1000).toFixed(2)}s`);
    console.log(`• Total Errors: ${metrics.performance.errors}`);
    console.log(`• Connection Target: ${metrics.performance.passedConnectionTarget ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`• Latency Target: ${metrics.performance.passedLatencyTarget ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`• Message Target: ${metrics.performance.passedMessageTarget ? '✅ PASS' : '❌ FAIL'}`);

    // Overall verdict
    const allTargetsPassed = metrics.performance.passedConnectionTarget && 
                            metrics.performance.passedLatencyTarget && 
                            metrics.performance.passedMessageTarget;

    console.log('\n🎯 FINAL VERDICT:');
    if (allTargetsPassed) {
      console.log('🎉 ALL PERFORMANCE TARGETS PASSED!');
      console.log('✨ WebSocket system ready for production load');
    } else {
      console.log('⚠️  SOME PERFORMANCE TARGETS FAILED');
      console.log('🔧 Performance optimization required');
    }

    // Error summary
    if (this.metrics.errors.length > 0) {
      console.log('\n❌ ERRORS ENCOUNTERED:');
      this.metrics.errors.slice(0, 10).forEach(error => { // Show first 10 errors
        console.log(`• ${error}`);
      });
      if (this.metrics.errors.length > 10) {
        console.log(`... and ${this.metrics.errors.length - 10} more errors`);
      }
    }

    console.log('\n================================================================\n');

    return allTargetsPassed;
  }

  async runFullLoadTest() {
    console.log('🚀 WebSocket Load Testing Suite');
    console.log('================================================================');
    console.log(`Target: ${CONFIG.maxConnections} concurrent connections`);
    console.log(`Duration: ${CONFIG.testDuration / 1000}s per phase`);
    console.log('================================================================\n');

    try {
      // Phase 1: Establish connections
      console.log('📋 Phase 1: Connection Load Test');
      const connectedCount = await this.establishConnections();
      
      if (connectedCount === 0) {
        throw new Error('Failed to establish any WebSocket connections');
      }

      // Phase 2: Message load test
      console.log('\n📋 Phase 2: Message Load Test');
      await this.runMessageLoadTest();

      // Phase 3: Real-time event simulation
      console.log('\n📋 Phase 3: Real-time Event Simulation');
      await this.simulateRealTimeEvents();

      // Calculate and display results
      const metrics = this.calculateMetrics();
      const success = this.printResults(metrics);

      // Cleanup
      await this.cleanup();

      return success;

    } catch (error) {
      console.error('💥 Load test failed:', error.message);
      await this.cleanup();
      return false;
    }
  }
}

// Run load test if called directly
if (require.main === module) {
  const loadTester = new WebSocketLoadTester();
  
  loadTester.runFullLoadTest()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Load test suite failed:', error);
      process.exit(1);
    });
}

module.exports = WebSocketLoadTester;