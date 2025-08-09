/**
 * Performance Benchmarking Suite
 * Comprehensive performance testing for API and WebSocket endpoints
 */

const axios = require('axios');
const WebSocket = require('ws');
const { performance } = require('perf_hooks');

class PerformanceBenchmarkSuite {
  constructor(config = {}) {
    this.apiUrl = config.apiUrl || 'http://localhost:3001';
    this.wsUrl = config.wsUrl || 'ws://localhost:3001/ws';
    this.authToken = config.authToken || 'test_token_123';
    
    this.benchmarks = {
      api: {},
      websocket: {},
      overall: {}
    };
    
    this.targets = {
      apiResponseTime: 100, // ms
      websocketLatency: 50, // ms
      throughput: 100, // requests/second
      concurrency: 50 // concurrent connections
    };
  }

  async runAllBenchmarks() {
    console.log('🎯 Starting Performance Benchmark Suite...\n');

    try {
      // API Performance Tests
      await this.benchmarkAPIEndpoints();
      
      // WebSocket Performance Tests
      await this.benchmarkWebSocketPerformance();
      
      // Load Testing
      await this.benchmarkConcurrentLoad();
      
      // Memory and Resource Usage
      await this.benchmarkResourceUsage();
      
      this.generatePerformanceReport();
      
    } catch (error) {
      console.error('❌ Benchmark suite failed:', error.message);
      throw error;
    }
  }

  async benchmarkAPIEndpoints() {
    console.log('🔄 Benchmarking API Endpoints...');
    
    const endpoints = [
      { path: '/health', method: 'GET', name: 'Health Check' },
      { path: '/auth/validate', method: 'GET', name: 'Auth Validation', requiresAuth: true },
      { path: '/threat/events', method: 'GET', name: 'Get Threats', requiresAuth: true },
      { path: '/behavior/patterns', method: 'GET', name: 'Behavior Patterns', requiresAuth: true },
      { path: '/network/events', method: 'GET', name: 'Network Events', requiresAuth: true },
      { path: '/metrics', method: 'GET', name: 'System Metrics', requiresAuth: true }
    ];
    
    for (const endpoint of endpoints) {
      await this.benchmarkSingleEndpoint(endpoint);
    }
    
    console.log('✅ API endpoint benchmarks completed\n');
  }

  async benchmarkSingleEndpoint(endpoint) {
    const iterations = 20;
    const times = [];
    
    console.log(`  📊 Testing ${endpoint.name}...`);
    
    for (let i = 0; i < iterations; i++) {
      try {
        const start = performance.now();
        
        const config = {
          method: endpoint.method,
          url: `${this.apiUrl}${endpoint.path}`,
          timeout: 5000
        };
        
        if (endpoint.requiresAuth) {
          config.headers = {
            'Authorization': `Bearer ${this.authToken}`
          };
        }
        
        await axios(config);
        
        const end = performance.now();
        times.push(end - start);
        
      } catch (error) {
        console.warn(`    ⚠️  Request ${i + 1} failed: ${error.message}`);
      }
    }
    
    if (times.length > 0) {
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const p95 = this.calculatePercentile(times, 95);
      
      this.benchmarks.api[endpoint.name] = {
        avgTime: avgTime.toFixed(2),
        minTime: minTime.toFixed(2),
        maxTime: maxTime.toFixed(2),
        p95: p95.toFixed(2),
        successRate: ((times.length / iterations) * 100).toFixed(1),
        meetsTarget: avgTime <= this.targets.apiResponseTime
      };
      
      const status = avgTime <= this.targets.apiResponseTime ? '✅' : '❌';
      console.log(`    ${status} Avg: ${avgTime.toFixed(2)}ms, P95: ${p95.toFixed(2)}ms, Success: ${this.benchmarks.api[endpoint.name].successRate}%`);
    }
  }

  async benchmarkWebSocketPerformance() {
    console.log('🔌 Benchmarking WebSocket Performance...');
    
    const testDuration = 10000; // 10 seconds
    const messageInterval = 100; // Send message every 100ms
    
    const latencies = [];
    let messagesSent = 0;
    let messagesReceived = 0;
    
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });
      
      let startTime = null;
      let testInterval = null;
      
      const timeout = setTimeout(() => {
        clearInterval(testInterval);
        ws.close();
        reject(new Error('WebSocket benchmark timed out'));
      }, testDuration + 5000);
      
      ws.on('open', () => {
        console.log('  📡 WebSocket connected, starting latency test...');
        startTime = performance.now();
        
        // Send periodic messages to measure latency
        testInterval = setInterval(() => {
          if (performance.now() - startTime >= testDuration) {
            clearInterval(testInterval);
            ws.close();
            return;
          }
          
          const message = {
            type: 'ping',
            timestamp: performance.now(),
            id: messagesSent++
          };
          
          ws.send(JSON.stringify(message));
        }, messageInterval);
      });
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          messagesReceived++;
          
          if (message.timestamp) {
            const latency = performance.now() - message.timestamp;
            latencies.push(latency);
          }
        } catch (error) {
          console.warn('    ⚠️  Failed to parse WebSocket message');
        }
      });
      
      ws.on('close', () => {
        clearTimeout(timeout);
        clearInterval(testInterval);
        
        if (latencies.length > 0) {
          const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
          const minLatency = Math.min(...latencies);
          const maxLatency = Math.max(...latencies);
          const p95Latency = this.calculatePercentile(latencies, 95);
          
          this.benchmarks.websocket = {
            avgLatency: avgLatency.toFixed(2),
            minLatency: minLatency.toFixed(2),
            maxLatency: maxLatency.toFixed(2),
            p95Latency: p95Latency.toFixed(2),
            messagesSent,
            messagesReceived,
            successRate: ((messagesReceived / messagesSent) * 100).toFixed(1),
            meetsTarget: avgLatency <= this.targets.websocketLatency
          };
          
          const status = avgLatency <= this.targets.websocketLatency ? '✅' : '❌';
          console.log(`  ${status} Avg Latency: ${avgLatency.toFixed(2)}ms, P95: ${p95Latency.toFixed(2)}ms`);
          console.log(`    Messages: ${messagesReceived}/${messagesSent} (${this.benchmarks.websocket.successRate}% success)`);
        }
        
        console.log('✅ WebSocket performance benchmark completed\n');
        resolve();
      });
      
      ws.on('error', (error) => {
        clearTimeout(timeout);
        clearInterval(testInterval);
        reject(error);
      });
    });
  }

  async benchmarkConcurrentLoad() {
    console.log('🚀 Benchmarking Concurrent Load...');
    
    const concurrentRequests = 25;
    const requestsPerConnection = 4;
    
    const startTime = performance.now();
    const promises = [];
    
    for (let i = 0; i < concurrentRequests; i++) {
      promises.push(this.runConcurrentRequests(requestsPerConnection));
    }
    
    const results = await Promise.allSettled(promises);
    const endTime = performance.now();
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    const totalTime = endTime - startTime;
    const totalRequests = concurrentRequests * requestsPerConnection;
    const requestsPerSecond = (totalRequests / (totalTime / 1000)).toFixed(2);
    
    this.benchmarks.overall.concurrentLoad = {
      concurrentConnections: concurrentRequests,
      requestsPerConnection,
      totalRequests,
      successful,
      failed,
      successRate: ((successful / concurrentRequests) * 100).toFixed(1),
      totalTime: totalTime.toFixed(2),
      requestsPerSecond,
      meetsTarget: parseFloat(requestsPerSecond) >= this.targets.throughput
    };
    
    const status = parseFloat(requestsPerSecond) >= this.targets.throughput ? '✅' : '❌';
    console.log(`  ${status} Throughput: ${requestsPerSecond} req/s, Success: ${this.benchmarks.overall.concurrentLoad.successRate}%`);
    console.log('✅ Concurrent load benchmark completed\n');
  }

  async runConcurrentRequests(count) {
    const requests = [];
    
    for (let i = 0; i < count; i++) {
      requests.push(
        axios.get(`${this.apiUrl}/health`, { timeout: 5000 })
      );
    }
    
    await Promise.all(requests);
  }

  async benchmarkResourceUsage() {
    console.log('💾 Benchmarking Resource Usage...');
    
    // Memory usage monitoring would be implemented here
    // For now, we'll simulate basic resource metrics
    
    const initialMemory = process.memoryUsage();
    
    // Simulate some load
    await this.runConcurrentRequests(10);
    
    const finalMemory = process.memoryUsage();
    
    this.benchmarks.overall.resourceUsage = {
      initialHeapUsed: (initialMemory.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
      finalHeapUsed: (finalMemory.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
      heapGrowth: ((finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024).toFixed(2) + ' MB'
    };
    
    console.log(`  📊 Heap Growth: ${this.benchmarks.overall.resourceUsage.heapGrowth}`);
    console.log('✅ Resource usage benchmark completed\n');
  }

  calculatePercentile(values, percentile) {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * (percentile / 100)) - 1;
    return sorted[index];
  }

  generatePerformanceReport() {
    console.log('📋 Performance Benchmark Report');
    console.log('=====================================');
    
    // API Endpoints Summary
    console.log('\n🔄 API Endpoint Performance:');
    Object.entries(this.benchmarks.api).forEach(([name, metrics]) => {
      const status = metrics.meetsTarget ? '✅' : '❌';
      console.log(`  ${status} ${name}: ${metrics.avgTime}ms avg (P95: ${metrics.p95}ms)`);
    });
    
    // WebSocket Summary
    if (this.benchmarks.websocket.avgLatency) {
      console.log('\n🔌 WebSocket Performance:');
      const ws = this.benchmarks.websocket;
      const status = ws.meetsTarget ? '✅' : '❌';
      console.log(`  ${status} Average Latency: ${ws.avgLatency}ms (P95: ${ws.p95Latency}ms)`);
      console.log(`  📊 Success Rate: ${ws.successRate}%`);
    }
    
    // Concurrent Load Summary
    if (this.benchmarks.overall.concurrentLoad) {
      console.log('\n🚀 Concurrent Load Performance:');
      const load = this.benchmarks.overall.concurrentLoad;
      const status = load.meetsTarget ? '✅' : '❌';
      console.log(`  ${status} Throughput: ${load.requestsPerSecond} req/s`);
      console.log(`  📊 Success Rate: ${load.successRate}%`);
    }
    
    // Overall Assessment
    console.log('\n🎯 Performance Assessment:');
    const apiTargetsMet = Object.values(this.benchmarks.api).filter(m => m.meetsTarget).length;
    const totalApiTargets = Object.values(this.benchmarks.api).length;
    const wsTargetMet = this.benchmarks.websocket.meetsTarget;
    const loadTargetMet = this.benchmarks.overall.concurrentLoad?.meetsTarget;
    
    if (apiTargetsMet === totalApiTargets && wsTargetMet && loadTargetMet) {
      console.log('✅ EXCELLENT - All performance targets met');
    } else if (apiTargetsMet >= totalApiTargets * 0.8) {
      console.log('⚠️  GOOD - Most performance targets met');
    } else {
      console.log('❌ NEEDS IMPROVEMENT - Performance targets not met');
    }
    
    console.log('\n📊 Detailed Results:');
    console.log(JSON.stringify(this.benchmarks, null, 2));
  }
}

// CLI usage
if (require.main === module) {
  const config = {
    apiUrl: process.argv[2] || 'http://localhost:3001',
    wsUrl: process.argv[3] || 'ws://localhost:3001/ws',
    authToken: process.argv[4] || 'test_token_123'
  };
  
  const suite = new PerformanceBenchmarkSuite(config);
  
  suite.runAllBenchmarks()
    .then(() => {
      console.log('\n🎉 Performance benchmark suite completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Benchmark suite failed:', error.message);
      process.exit(1);
    });
}

module.exports = { PerformanceBenchmarkSuite };