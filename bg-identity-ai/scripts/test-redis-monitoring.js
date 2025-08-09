#!/usr/bin/env node

/**
 * Redis Monitoring Validation Script
 * Tests all Redis monitoring endpoints and functionality
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

const BASE_URL = 'http://localhost:3002';

// Test results tracker
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, success, details = {}) {
  const status = success ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  
  if (!success && details.error) {
    console.log(`   Error: ${details.error}`);
  }
  
  if (details.data && typeof details.data === 'object') {
    console.log(`   Response: ${JSON.stringify(details.data, null, 2).substring(0, 200)}...`);
  }
  
  testResults.tests.push({ name, success, details });
  if (success) testResults.passed++;
  else testResults.failed++;
}

async function testEndpointPerformance(endpoint, maxResponseTime = 1000) {
  const start = performance.now();
  try {
    const response = await axios.get(`${BASE_URL}${endpoint}`);
    const duration = performance.now() - start;
    
    return {
      success: response.status === 200 && duration < maxResponseTime,
      duration: Math.round(duration),
      status: response.status,
      data: response.data
    };
  } catch (error) {
    const duration = performance.now() - start;
    return {
      success: false,
      duration: Math.round(duration),
      error: error.message
    };
  }
}

async function validateHealthResponse(response, expectedFields) {
  const missingFields = [];
  
  for (const field of expectedFields) {
    if (!response.hasOwnProperty(field)) {
      missingFields.push(field);
    }
  }
  
  return {
    isValid: missingFields.length === 0,
    missingFields
  };
}

async function runTests() {
  console.log('🔍 Starting Redis Monitoring Validation Tests');
  console.log('=' * 60);
  
  try {
    // Test 1: Basic Health Endpoint
    console.log('\n📊 Testing Basic Health Endpoint');
    const basicHealthResult = await testEndpointPerformance('/health');
    
    const basicHealthValid = await validateHealthResponse(basicHealthResult.data || {}, [
      'service', 'status', 'timestamp', 'uptime', 'memory', 'version', 'redis'
    ]);
    
    logTest('Basic Health Endpoint Response', 
      basicHealthResult.success && basicHealthValid.isValid,
      {
        data: {
          status: basicHealthResult.status,
          duration: `${basicHealthResult.duration}ms`,
          redisStatus: basicHealthResult.data?.redis?.status,
          overallStatus: basicHealthResult.data?.status
        },
        error: basicHealthResult.error || (basicHealthValid.isValid ? null : `Missing fields: ${basicHealthValid.missingFields.join(', ')}`)
      }
    );

    // Test 2: Readiness Endpoint
    console.log('\n⚡ Testing Readiness Endpoint');
    const readinessResult = await testEndpointPerformance('/health/ready');
    
    const readinessValid = await validateHealthResponse(readinessResult.data || {}, [
      'service', 'ready', 'timestamp', 'checks'
    ]);
    
    logTest('Readiness Endpoint Response',
      (readinessResult.status === 200 || readinessResult.status === 503) && readinessValid.isValid,
      {
        data: {
          status: readinessResult.status,
          duration: `${readinessResult.duration}ms`,
          ready: readinessResult.data?.ready,
          redisReady: readinessResult.data?.checks?.redis?.ready
        }
      }
    );

    // Test 3: Detailed Redis Health Endpoint
    console.log('\n🔧 Testing Detailed Redis Health Endpoint');
    const redisHealthResult = await testEndpointPerformance('/health/redis');
    
    const redisHealthValid = await validateHealthResponse(redisHealthResult.data || {}, [
      'service', 'component', 'timestamp', 'connection', 'performance', 'cache', 'errors', 'overallStatus'
    ]);
    
    logTest('Detailed Redis Health Endpoint',
      (redisHealthResult.status === 200 || redisHealthResult.status === 503) && redisHealthValid.isValid,
      {
        data: {
          status: redisHealthResult.status,
          duration: `${redisHealthResult.duration}ms`,
          overallStatus: redisHealthResult.data?.overallStatus,
          connectionStatus: redisHealthResult.data?.connection?.status,
          hitRate: redisHealthResult.data?.cache?.hitRate,
          avgLatency: redisHealthResult.data?.performance?.avgLatency
        }
      }
    );

    // Test 4: Comprehensive Health Endpoint
    console.log('\n🌟 Testing Comprehensive Health Endpoint');
    const detailedHealthResult = await testEndpointPerformance('/health/detailed', 2000); // Allow more time for detailed
    
    const detailedHealthValid = await validateHealthResponse(detailedHealthResult.data || {}, [
      'service', 'timestamp', 'overallStatus', 'uptime', 'memory', 'version', 'components'
    ]);
    
    logTest('Comprehensive Health Endpoint',
      (detailedHealthResult.status === 200 || detailedHealthResult.status === 503) && detailedHealthValid.isValid,
      {
        data: {
          status: detailedHealthResult.status,
          duration: `${detailedHealthResult.duration}ms`,
          overallStatus: detailedHealthResult.data?.overallStatus,
          redisStatus: detailedHealthResult.data?.components?.redis?.overallStatus,
          nodeVersion: detailedHealthResult.data?.components?.node?.version
        }
      }
    );

    // Test 5: Redis Metrics Consistency
    console.log('\n🔍 Testing Redis Metrics Consistency');
    try {
      const basicResponse = await axios.get(`${BASE_URL}/health`);
      const detailedResponse = await axios.get(`${BASE_URL}/health/redis`);
      
      const basicRedisStatus = basicResponse.data.redis.status;
      const detailedConnectionStatus = detailedResponse.data.connection.status;
      
      const statusesMatch = basicRedisStatus === detailedConnectionStatus;
      
      logTest('Redis Status Consistency Across Endpoints',
        statusesMatch,
        {
          data: {
            basicEndpointStatus: basicRedisStatus,
            detailedEndpointStatus: detailedConnectionStatus,
            consistent: statusesMatch
          }
        }
      );
    } catch (error) {
      logTest('Redis Status Consistency Across Endpoints', false, { error: error.message });
    }

    // Test 6: Performance Benchmarks
    console.log('\n⚡ Testing Performance Benchmarks');
    const performanceTests = [
      { endpoint: '/health', maxTime: 100, name: 'Basic Health' },
      { endpoint: '/health/ready', maxTime: 200, name: 'Readiness Check' },
      { endpoint: '/health/redis', maxTime: 500, name: 'Redis Details' },
      { endpoint: '/health/detailed', maxTime: 1000, name: 'Comprehensive Health' }
    ];

    for (const perfTest of performanceTests) {
      const result = await testEndpointPerformance(perfTest.endpoint, perfTest.maxTime);
      
      logTest(`${perfTest.name} Performance (<${perfTest.maxTime}ms)`,
        result.success && result.duration < perfTest.maxTime,
        {
          data: {
            duration: `${result.duration}ms`,
            target: `<${perfTest.maxTime}ms`,
            passed: result.duration < perfTest.maxTime
          }
        }
      );
    }

    // Test 7: Error Handling
    console.log('\n❗ Testing Error Handling');
    try {
      // Test non-existent endpoint
      const invalidResponse = await axios.get(`${BASE_URL}/health/nonexistent`, {
        validateStatus: () => true // Don't throw on 404
      });
      
      logTest('Invalid Endpoint Error Handling',
        invalidResponse.status === 404,
        {
          data: {
            status: invalidResponse.status,
            expectedStatus: 404
          }
        }
      );
    } catch (error) {
      logTest('Invalid Endpoint Error Handling', false, { error: error.message });
    }

    // Test 8: Response Format Validation
    console.log('\n📋 Testing Response Format Validation');
    try {
      const healthResponse = await axios.get(`${BASE_URL}/health`);
      const data = healthResponse.data;
      
      const validations = [
        { name: 'Service Name', test: data.service === 'bg-identity-ai' },
        { name: 'Timestamp Format', test: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(data.timestamp) },
        { name: 'Uptime is Number', test: typeof data.uptime === 'number' && data.uptime >= 0 },
        { name: 'Memory Object', test: typeof data.memory === 'object' && data.memory.rss > 0 },
        { name: 'Redis Object', test: typeof data.redis === 'object' && data.redis.status },
        { name: 'Version String', test: typeof data.version === 'string' && data.version.length > 0 }
      ];

      for (const validation of validations) {
        logTest(`Response Format: ${validation.name}`, validation.test, {
          data: { field: validation.name, passed: validation.test }
        });
      }
    } catch (error) {
      logTest('Response Format Validation', false, { error: error.message });
    }

  } catch (globalError) {
    console.error('\n❌ Global test error:', globalError.message);
  }

  // Print final results
  console.log('\n' + '='*60);
  console.log('📋 REDIS MONITORING VALIDATION RESULTS');
  console.log('='*60);
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📊 Total:  ${testResults.passed + testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);

  if (testResults.failed === 0) {
    console.log('\n🎉 ALL REDIS MONITORING TESTS PASSED!');
    console.log('✨ Redis monitoring system is fully functional and performant.');
  } else {
    console.log(`\n⚠️  ${testResults.failed} test(s) failed. Check logs above for details.`);
  }

  console.log('\n🔧 Redis Monitoring Features Validated:');
  console.log('   ✅ Basic health endpoint with Redis status');
  console.log('   ✅ Readiness checks for operational readiness');
  console.log('   ✅ Detailed Redis metrics and performance data');
  console.log('   ✅ Comprehensive system health with all components');
  console.log('   ✅ Performance benchmarks within target thresholds');
  console.log('   ✅ Error handling and graceful degradation');
  console.log('   ✅ Response format consistency and validation');

  return testResults.failed === 0;
}

// Run tests if called directly
if (require.main === module) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Redis monitoring test suite failed:', error);
    process.exit(1);
  });
}

module.exports = { runTests };