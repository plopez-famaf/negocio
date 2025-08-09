/**
 * WebSocket Load Testing Framework
 * Tests WebSocket connections under load with 100+ concurrent connections
 */

const WebSocket = require('ws');
const { performance } = require('perf_hooks');

class WebSocketLoadTester {
  constructor(wsUrl = 'ws://localhost:3001/ws', options = {}) {
    this.wsUrl = wsUrl;
    this.maxConnections = options.maxConnections || 100;
    this.testDurationMs = options.testDurationMs || 60000; // 1 minute
    this.authToken = options.authToken || 'test_token_123';
    
    this.connections = [];
    this.metrics = {
      connectionsEstablished: 0,
      connectionsFailed: 0,
      messagesReceived: 0,
      messagesSent: 0,
      avgLatency: 0,
      maxLatency: 0,
      minLatency: Infinity,
      latencies: []
    };
    
    this.isRunning = false;
  }

  async runLoadTest() {
    console.log(`🚀 Starting WebSocket Load Test: ${this.maxConnections} connections for ${this.testDurationMs/1000}s\n`);
    
    this.isRunning = true;
    const startTime = performance.now();

    try {
      // Phase 1: Establish connections
      await this.establishConnections();
      
      // Phase 2: Send/receive messages under load
      await this.runMessageLoadTest();
      
      // Phase 3: Clean shutdown
      await this.cleanupConnections();
      
      const endTime = performance.now();
      this.calculateMetrics();
      this.printResults(endTime - startTime);
      
      return this.metrics;
      
    } catch (error) {
      console.error('❌ Load test failed:', error.message);
      await this.cleanupConnections();
      throw error;
    }
  }

  async establishConnections() {
    console.log('📡 Establishing connections...');
    
    const connectionPromises = [];
    
    for (let i = 0; i < this.maxConnections; i++) {
      connectionPromises.push(this.createConnection(i));
    }
    
    // Batch connections to avoid overwhelming the server
    const batchSize = 10;
    for (let i = 0; i < connectionPromises.length; i += batchSize) {
      const batch = connectionPromises.slice(i, i + batchSize);
      await Promise.allSettled(batch);
      
      // Small delay between batches
      if (i + batchSize < connectionPromises.length) {
        await this.sleep(100);
      }
    }
    
    console.log(`✅ Attempted ${this.maxConnections} connections`);
    console.log(`✅ Successfully established ${this.metrics.connectionsEstablished} connections`);
    console.log(`❌ Failed connections: ${this.metrics.connectionsFailed}\n`);
  }

  createConnection(connectionId) {
    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      
      const ws = new WebSocket(this.wsUrl, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'User-Agent': `websocket-load-tester-${connectionId}`
        }
      });

      const connectionTimeout = setTimeout(() => {
        this.metrics.connectionsFailed++;
        ws.terminate();
        reject(new Error(`Connection ${connectionId} timed out`));
      }, 5000);

      ws.on('open', () => {
        clearTimeout(connectionTimeout);
        const connectTime = performance.now() - startTime;
        
        this.connections.push({
          id: connectionId,
          ws,
          connectTime,
          messagesReceived: 0,
          messagesSent: 0
        });
        
        this.metrics.connectionsEstablished++;
        resolve(ws);
      });

      ws.on('message', (data) => {
        const receiveTime = performance.now();
        
        try {
          const message = JSON.parse(data.toString());
          
          // Track latency if message has timestamp
          if (message.timestamp) {
            const latency = receiveTime - message.timestamp;
            this.metrics.latencies.push(latency);
            
            if (latency > this.metrics.maxLatency) {
              this.metrics.maxLatency = latency;
            }
            if (latency < this.metrics.minLatency) {
              this.metrics.minLatency = latency;
            }
          }
          
          this.metrics.messagesReceived++;
          
          // Find connection and update its metrics
          const connection = this.connections.find(conn => conn.ws === ws);
          if (connection) {
            connection.messagesReceived++;
          }
          
        } catch (error) {
          console.warn(`Failed to parse message from connection ${connectionId}:`, error.message);
        }
      });

      ws.on('error', (error) => {
        clearTimeout(connectionTimeout);
        this.metrics.connectionsFailed++;
        reject(error);
      });

      ws.on('close', () => {
        clearTimeout(connectionTimeout);
        // Remove from active connections
        this.connections = this.connections.filter(conn => conn.ws !== ws);
      });
    });
  }

  async runMessageLoadTest() {
    console.log('💬 Starting message load test...');
    
    const testEndTime = performance.now() + this.testDurationMs;
    let messageInterval;
    
    return new Promise((resolve) => {
      // Send messages periodically from each connection
      messageInterval = setInterval(() => {
        if (performance.now() >= testEndTime) {
          clearInterval(messageInterval);
          resolve();
          return;
        }
        
        // Send message from a random subset of connections
        const activeConnections = this.connections.filter(conn => 
          conn.ws.readyState === WebSocket.OPEN
        );
        
        const messagesToSend = Math.min(5, activeConnections.length);
        
        for (let i = 0; i < messagesToSend; i++) {
          const randomConnection = activeConnections[
            Math.floor(Math.random() * activeConnections.length)
          ];
          
          if (randomConnection) {
            this.sendTestMessage(randomConnection);
          }
        }
      }, 100); // Send messages every 100ms
    });
  }

  sendTestMessage(connection) {
    if (connection.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    
    const message = {
      type: 'load_test',
      connectionId: connection.id,
      timestamp: performance.now(),
      data: {
        sequence: connection.messagesSent,
        payload: 'test_data_'.repeat(10) // Small payload
      }
    };
    
    try {
      connection.ws.send(JSON.stringify(message));
      connection.messagesSent++;
      this.metrics.messagesSent++;
    } catch (error) {
      console.warn(`Failed to send message on connection ${connection.id}:`, error.message);
    }
  }

  async cleanupConnections() {
    console.log('🧹 Cleaning up connections...');
    
    const cleanupPromises = this.connections.map(connection => {
      return new Promise((resolve) => {
        if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.close();
        }
        setTimeout(resolve, 100);
      });
    });
    
    await Promise.allSettled(cleanupPromises);
    
    // Force terminate any remaining connections
    this.connections.forEach(connection => {
      if (connection.ws.readyState !== WebSocket.CLOSED) {
        connection.ws.terminate();
      }
    });
    
    this.connections = [];
    console.log('✅ All connections cleaned up\n');
  }

  calculateMetrics() {
    if (this.metrics.latencies.length > 0) {
      this.metrics.avgLatency = this.metrics.latencies.reduce((sum, lat) => sum + lat, 0) / this.metrics.latencies.length;
    }
    
    if (this.metrics.minLatency === Infinity) {
      this.metrics.minLatency = 0;
    }
  }

  printResults(totalTestTime) {
    console.log('📊 WebSocket Load Test Results:');
    console.log(`Total Test Time: ${(totalTestTime / 1000).toFixed(2)}s`);
    console.log(`Target Connections: ${this.maxConnections}`);
    console.log(`Successful Connections: ${this.metrics.connectionsEstablished} ✅`);
    console.log(`Failed Connections: ${this.metrics.connectionsFailed} ❌`);
    console.log(`Success Rate: ${((this.metrics.connectionsEstablished / this.maxConnections) * 100).toFixed(1)}%`);
    
    console.log('\n💬 Message Statistics:');
    console.log(`Messages Sent: ${this.metrics.messagesSent}`);
    console.log(`Messages Received: ${this.metrics.messagesReceived}`);
    console.log(`Message Success Rate: ${this.metrics.messagesSent > 0 ? ((this.metrics.messagesReceived / this.metrics.messagesSent) * 100).toFixed(1) : 0}%`);
    
    if (this.metrics.latencies.length > 0) {
      console.log('\n⏱️ Latency Metrics:');
      console.log(`Average Latency: ${this.metrics.avgLatency.toFixed(2)}ms`);
      console.log(`Min Latency: ${this.metrics.minLatency.toFixed(2)}ms`);
      console.log(`Max Latency: ${this.metrics.maxLatency.toFixed(2)}ms`);
      
      const targetLatency = 50; // 50ms target
      const underTargetCount = this.metrics.latencies.filter(lat => lat <= targetLatency).length;
      console.log(`Under ${targetLatency}ms: ${((underTargetCount / this.metrics.latencies.length) * 100).toFixed(1)}%`);
    }
    
    // Performance assessment
    console.log('\n🎯 Performance Assessment:');
    const connectionSuccessRate = (this.metrics.connectionsEstablished / this.maxConnections) * 100;
    const messageSuccessRate = this.metrics.messagesSent > 0 ? (this.metrics.messagesReceived / this.metrics.messagesSent) * 100 : 0;
    const avgLatencyGood = this.metrics.avgLatency <= 50;
    
    if (connectionSuccessRate >= 95 && messageSuccessRate >= 95 && avgLatencyGood) {
      console.log('✅ EXCELLENT - All performance targets met');
    } else if (connectionSuccessRate >= 90 && messageSuccessRate >= 90) {
      console.log('⚠️  GOOD - Minor performance issues detected');
    } else {
      console.log('❌ NEEDS IMPROVEMENT - Performance targets not met');
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI usage
if (require.main === module) {
  const wsUrl = process.argv[2] || 'ws://localhost:3001/ws';
  const maxConnections = parseInt(process.argv[3]) || 100;
  const durationSeconds = parseInt(process.argv[4]) || 60;
  
  const tester = new WebSocketLoadTester(wsUrl, {
    maxConnections,
    testDurationMs: durationSeconds * 1000
  });
  
  tester.runLoadTest()
    .then((metrics) => {
      const success = metrics.connectionsEstablished >= (maxConnections * 0.95);
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Load test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { WebSocketLoadTester };