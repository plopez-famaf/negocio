#!/usr/bin/env node

/**
 * Performance Validation Test
 * Tests the API performance improvements after removing artificial delays
 * and improving threat detection algorithms
 */

const axios = require('axios');
const jwt = require('jsonwebtoken');

// Configuration
const CONFIG = {
  baseUrl: 'http://localhost:3002',
  jwtSecret: process.env.JWT_SECRET || 'test-secret-key-for-development-only',
  performanceTarget: 100, // ms
  threatDetectionTarget: 0.2 // 20% minimum detection rate
};

// Test utilities
class PerformanceValidator {
  constructor() {
    this.results = {
      apiTests: [],
      aiTests: [],
      overallStats: {
        averageResponseTime: 0,
        threatsDetected: 0,
        totalTests: 0
      }
    };
  }

  generateAuthToken() {
    return jwt.sign(
      {
        id: 'test-user-performance',
        email: 'performance@example.com',
        role: 'admin',
        exp: Math.floor(Date.now() / 1000) + 3600
      },
      CONFIG.jwtSecret
    );
  }

  async testApiEndpointPerformance(endpoint, testData, description) {
    console.log(`🚀 Testing: ${description}`);
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.generateAuthToken()}`
    };

    const startTime = performance.now();
    
    try {
      const response = await axios.post(`${CONFIG.baseUrl}${endpoint}`, testData, { headers });
      const endTime = performance.now();
      const responseTime = Math.round(endTime - startTime);

      const testResult = {
        endpoint,
        description,
        responseTime,
        success: response.status === 200,
        targetMet: responseTime < CONFIG.performanceTarget,
        data: response.data
      };

      this.results.apiTests.push(testResult);

      console.log(`   ⏱️  Response Time: ${responseTime}ms ${testResult.targetMet ? '✅' : '❌'} (Target: <${CONFIG.performanceTarget}ms)`);
      console.log(`   📊 Status: ${response.status} ${testResult.success ? '✅' : '❌'}`);
      
      return testResult;

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      const testResult = {
        endpoint,
        description,
        responseTime: -1,
        success: false,
        targetMet: false,
        error: error.message
      };
      this.results.apiTests.push(testResult);
      return testResult;
    }
  }

  async testThreatDetectionAccuracy() {
    console.log(`\n🤖 Testing AI Threat Detection Accuracy`);

    // Test with malicious events that should trigger detection
    const maliciousEvents = [
      {
        id: 'test-malware-1',
        type: 'malware',
        signature: 'trojan.generic.malware',
        fileHash: '44d88612fea8a8f36de82e1278abb02f', // MD5 hash
        source: 'suspicious-endpoint'
      },
      {
        id: 'test-intrusion-1',
        type: 'intrusion',
        payload: "' OR 1=1 --", // SQL injection
        source: 'web-application'
      },
      {
        id: 'test-network-1',
        type: 'network',
        port: 22, // SSH
        protocol: 'tcp',
        bytes: 150000, // Large data transfer
        source: 'unknown-source'
      },
      {
        id: 'test-behavioral-1',
        type: 'behavioral',
        deviation: 3.5, // High deviation
        time: 3, // 3 AM - outside business hours
        volume: 2000, // High volume
        source: 'user-activity'
      }
    ];

    const result = await this.testApiEndpointPerformance(
      '/api/threat/detect-realtime', 
      {
        events: maliciousEvents,
        source: 'performance-test',
        userId: 'test-user-performance'
      },
      'Threat Detection with Malicious Events'
    );

    if (result.success && result.data) {
      const threatsDetected = result.data.threatsDetected || 0;
      const detectionRate = threatsDetected / maliciousEvents.length;
      
      console.log(`   🎯 Threats Detected: ${threatsDetected}/${maliciousEvents.length} (${Math.round(detectionRate * 100)}%)`);
      console.log(`   📈 Detection Rate: ${detectionRate >= CONFIG.threatDetectionTarget ? '✅' : '❌'} (Target: ≥${Math.round(CONFIG.threatDetectionTarget * 100)}%)`);
      
      this.results.aiTests.push({
        testType: 'threat_detection',
        eventsProcessed: maliciousEvents.length,
        threatsDetected,
        detectionRate,
        targetMet: detectionRate >= CONFIG.threatDetectionTarget,
        responseTime: result.responseTime
      });

      this.results.overallStats.threatsDetected += threatsDetected;
    }
  }

  async runPerformanceValidation() {
    console.log('🎯 API Performance & AI Accuracy Validation');
    console.log('='.repeat(60));
    console.log(`Target API Response Time: <${CONFIG.performanceTarget}ms`);
    console.log(`Target Threat Detection Rate: ≥${Math.round(CONFIG.threatDetectionTarget * 100)}%`);
    console.log('');

    // Test 1: Real-time threat detection
    await this.testThreatDetectionAccuracy();

    // Test 2: Behavioral analysis
    await this.testApiEndpointPerformance(
      '/api/threat/analyze-behavior',
      {
        target: 'test-user-performance',
        timeRange: {
          start: new Date(Date.now() - 3600000).toISOString(),
          end: new Date().toISOString()
        },
        analysisType: 'user',
        metrics: ['login_frequency', 'data_access', 'location_variance']
      },
      'Behavioral Analysis Performance'
    );

    // Test 3: Threat intelligence query
    await this.testApiEndpointPerformance(
      '/api/threat/query-intelligence',
      {
        indicators: ['192.168.1.100', 'suspicious-domain.com', '44d88612fea8a8f36de82e1278abb02f'],
        sources: ['test-intelligence-feed']
      },
      'Threat Intelligence Query Performance'
    );

    // Test 4: Network monitoring
    await this.testApiEndpointPerformance(
      '/api/threat/monitor-network',
      {
        targets: ['192.168.1.0/24', '10.0.0.0/8'],
        options: {
          duration: 300,
          protocols: ['tcp', 'udp'],
          ports: [80, 443, 22, 3389]
        }
      },
      'Network Monitoring Performance'
    );

    // Test 5: Threat correlation
    const sampleThreats = [
      {
        id: 'threat-1',
        timestamp: new Date().toISOString(),
        type: 'network',
        severity: 'high',
        source: '192.168.1.100',
        description: 'Suspicious network activity'
      },
      {
        id: 'threat-2',
        timestamp: new Date().toISOString(),
        type: 'behavioral',
        severity: 'medium',
        source: '192.168.1.100',
        description: 'Unusual user behavior'
      }
    ];

    await this.testApiEndpointPerformance(
      '/api/threat/correlate-threats',
      {
        events: sampleThreats,
        timeWindow: '1h'
      },
      'Threat Correlation Performance'
    );

    await this.generateFinalReport();
  }

  async generateFinalReport() {
    console.log('\n📊 PERFORMANCE VALIDATION REPORT');
    console.log('='.repeat(60));

    // Calculate overall statistics
    const totalTests = this.results.apiTests.length;
    const successfulTests = this.results.apiTests.filter(t => t.success).length;
    const performantTests = this.results.apiTests.filter(t => t.targetMet).length;
    
    const responseTimes = this.results.apiTests
      .filter(t => t.success && t.responseTime > 0)
      .map(t => t.responseTime);
    
    const avgResponseTime = responseTimes.length > 0 
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;

    const minResponseTime = responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
    const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;

    // Performance Summary
    console.log('\n🚀 API Performance Summary:');
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Successful: ${successfulTests}/${totalTests} (${Math.round(successfulTests/totalTests*100)}%)`);
    console.log(`   Meeting Performance Target: ${performantTests}/${totalTests} (${Math.round(performantTests/totalTests*100)}%)`);
    console.log(`   Average Response Time: ${avgResponseTime}ms`);
    console.log(`   Response Time Range: ${minResponseTime}ms - ${maxResponseTime}ms`);

    // AI Accuracy Summary
    if (this.results.aiTests.length > 0) {
      const aiTest = this.results.aiTests[0];
      console.log('\n🤖 AI Threat Detection Summary:');
      console.log(`   Events Processed: ${aiTest.eventsProcessed}`);
      console.log(`   Threats Detected: ${aiTest.threatsDetected}`);
      console.log(`   Detection Rate: ${Math.round(aiTest.detectionRate * 100)}%`);
      console.log(`   Target Met: ${aiTest.targetMet ? '✅' : '❌'}`);
    }

    // Overall Assessment
    const overallPerformanceScore = performantTests / totalTests;
    const overallSuccessRate = successfulTests / totalTests;
    
    console.log('\n🎯 Overall Assessment:');
    console.log(`   Performance Score: ${Math.round(overallPerformanceScore * 100)}% ${overallPerformanceScore >= 0.8 ? '✅' : '⚠️'}`);
    console.log(`   Success Rate: ${Math.round(overallSuccessRate * 100)}% ${overallSuccessRate >= 0.9 ? '✅' : '⚠️'}`);

    // Improvement Analysis
    console.log('\n📈 Performance Improvement Analysis:');
    console.log(`   Previous Average: ~1500ms (baseline from comprehensive testing)`);
    console.log(`   Current Average: ${avgResponseTime}ms`);
    
    if (avgResponseTime > 0) {
      const improvementPercent = Math.round((1500 - avgResponseTime) / 1500 * 100);
      console.log(`   Performance Improvement: ${improvementPercent}% ${improvementPercent > 50 ? '🚀' : improvementPercent > 0 ? '📈' : '⚠️'}`);
    }

    // Recommendations
    console.log('\n💡 Recommendations:');
    if (overallPerformanceScore < 0.8) {
      console.log('   ⚠️  Consider further async optimization for remaining slow endpoints');
    }
    if (avgResponseTime > CONFIG.performanceTarget) {
      console.log('   🔧 Additional algorithm optimization needed to meet <100ms target');
    }
    if (this.results.aiTests.length > 0 && !this.results.aiTests[0].targetMet) {
      console.log('   🤖 AI threat detection accuracy needs further tuning');
    }
    if (overallPerformanceScore >= 0.8 && overallSuccessRate >= 0.9) {
      console.log('   ✅ Performance improvements successful! Ready for production deployment');
    }

    console.log('\n' + '='.repeat(60));
    console.log(`Validation completed at ${new Date().toLocaleString()}`);
  }
}

// Run performance validation
async function main() {
  const validator = new PerformanceValidator();
  
  try {
    await validator.runPerformanceValidation();
  } catch (error) {
    console.error('❌ Performance validation failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { PerformanceValidator };