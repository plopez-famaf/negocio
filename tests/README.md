# ThreatGuard Service Communication Testing Suite

Comprehensive testing framework for the Console-First Threat Detection Platform, ensuring reliable communication between the ThreatGuard CLI and bg-threat-ai service.

## 🎯 **Testing Overview**

This testing suite validates the complete service communication architecture:

- **API Integration**: REST endpoint testing with authentication and validation
- **WebSocket Streaming**: Real-time event streaming and load testing
- **CLI Integration**: End-to-end command workflows and error handling
- **Performance Validation**: Response times, throughput, and scalability

## 📁 **Directory Structure**

```
tests/
├── integration/                    # Integration tests
│   ├── api-endpoints.test.js      # REST API endpoint testing
│   └── websocket-communication.test.js # WebSocket streaming tests
├── e2e/                           # End-to-end tests
│   └── cli-service-integration.test.js # CLI workflow testing
├── utils/                         # Test utilities and helpers
│   └── test-helpers.js            # Common test functions and utilities
├── run-all-tests.js              # Comprehensive test runner
├── package.json                   # Test dependencies and scripts
└── README.md                      # This file
```

## 🚀 **Quick Start**

### Prerequisites

1. **Start the bg-threat-ai service:**
   ```bash
   cd bg-identity-ai
   npm run dev
   ```

2. **Install test dependencies:**
   ```bash
   cd tests
   npm install
   ```

### Running Tests

**Run all tests:**
```bash
npm test
# or
node run-all-tests.js
```

**Run specific test suites:**
```bash
npm run test:api          # API endpoint tests
npm run test:websocket    # WebSocket communication tests
npm run test:cli          # CLI integration tests
npm run test:integration  # Integration tests only
npm run test:e2e          # E2E tests only
```

## 🧪 **Test Suites**

### 1. API Endpoints Integration Test
**File**: `integration/api-endpoints.test.js`

**Tests:**
- ✅ Health endpoint validation
- ✅ Threat detection endpoints (`/api/threat/*`)
- ✅ Behavior analysis endpoints
- ✅ Network monitoring endpoints
- ✅ Threat intelligence endpoints
- ✅ Authentication and authorization
- ✅ Error handling and validation
- ✅ Performance benchmarking

**Performance Targets:**
- API response time: < 100ms
- Authentication validation: < 50ms
- Error handling: Graceful with proper status codes

### 2. WebSocket Communication Test
**File**: `integration/websocket-communication.test.js`

**Tests:**
- ✅ Basic WebSocket connection
- ✅ JWT authentication
- ✅ Event streaming and filtering
- ✅ Heartbeat mechanism
- ✅ Reconnection handling
- ✅ Concurrent connections (100+ clients)
- ✅ Event latency measurement
- ✅ Load performance testing

**Performance Targets:**
- Connection time: < 2 seconds
- Event latency: < 50ms
- Concurrent connections: 100+
- Reconnection: < 3 seconds

### 3. CLI Service Integration Test
**File**: `e2e/cli-service-integration.test.js`

**Tests:**
- ✅ CLI installation and setup
- ✅ Basic command execution
- ✅ Service connectivity
- ✅ WebSocket integration
- ✅ Authentication flow
- ✅ Error handling and recovery
- ✅ Performance metrics
- ✅ End-to-end workflows
- ✅ Concurrent CLI sessions

**Performance Targets:**
- CLI startup time: < 2 seconds
- Command execution: < 1 second
- WebSocket connection: < 5 seconds

## 📊 **Performance Benchmarks**

### Expected Performance Metrics

| Component | Metric | Target | Critical |
|-----------|--------|---------|----------|
| **API Endpoints** | Response Time | < 100ms | < 200ms |
| **WebSocket** | Connection Time | < 2s | < 5s |
| **WebSocket** | Event Latency | < 50ms | < 100ms |
| **CLI** | Command Response | < 1s | < 3s |
| **Concurrent** | WebSocket Clients | 100+ | 50+ |
| **Load** | Events/Second | 1000+ | 500+ |

### Performance Test Results

The test suite automatically measures and reports:
- **Response Times**: Average, min, max, P95, P99
- **Throughput**: Requests per second, events per second
- **Concurrency**: Simultaneous connections handled
- **Error Rates**: Success/failure ratios
- **Resource Usage**: Memory and CPU during tests

## 🔧 **Test Configuration**

### Environment Variables

```bash
# Required
JWT_SECRET=your-jwt-secret-key
THREATGUARD_API_URL=http://localhost:3001

# Optional
NODE_ENV=test
DEBUG=true
```

### Test Settings

Key configuration options in test files:

```javascript
const CONFIG = {
  responseTimeLimit: 100,        // API response time limit (ms)
  connectionTimeout: 5000,       // WebSocket connection timeout (ms)
  eventTimeout: 10000,          // Event reception timeout (ms)
  maxConcurrentConnections: 100, // Load testing limit
  maxEventLatency: 50           // WebSocket event latency limit (ms)
};
```

## 🛠️ **Test Utilities**

### TestHelpers Class

Common utilities available in all tests:

```javascript
const TestHelpers = require('./utils/test-helpers');

// JWT token generation
const token = TestHelpers.generateTestToken('user-123', 'analyst');

// Service availability check
const isAvailable = await TestHelpers.checkServiceAvailability('http://localhost:3001');

// Performance measurement
const result = await TestHelpers.measureTime(async () => {
  // Your test code here
});

// Load testing
const loadResults = await TestHelpers.runLoadTest(testFunction, {
  concurrency: 50,
  duration: 30000
});
```

### Results Tracking

Automated results tracking and reporting:

```javascript
const results = TestHelpers.createResultsTracker();
results.addTest('Test Name', success, error);
results.printSummary('Test Results');
```

## 📈 **Interpreting Results**

### Success Criteria

**✅ PASSED**: All tests pass with performance within targets
- API response times < 100ms average
- WebSocket connections stable with < 50ms latency
- CLI integration seamless with proper error handling
- 100+ concurrent connections supported
- > 95% success rate across all tests

**⚠️ WARNING**: Tests pass but performance below optimal
- Response times between targets and critical thresholds
- Some non-critical tests may fail
- Performance degradation under load

**❌ FAILED**: Critical functionality broken
- Service unavailable or unresponsive
- Authentication failures
- WebSocket connection issues
- CLI integration broken
- Performance below critical thresholds

### Common Issues and Solutions

**Service Not Available**
```bash
# Start the bg-threat-ai service
cd bg-identity-ai && npm run dev
```

**Authentication Errors**
```bash
# Check JWT_SECRET environment variable
export JWT_SECRET=development-secret-key
```

**Port Conflicts**
```bash
# Check if service is running on correct port
curl http://localhost:3001/health
```

**Performance Issues**
- Check system resources (CPU, memory)
- Verify no other applications consuming resources
- Run tests individually to isolate issues

## 🔄 **Continuous Testing**

### Integration with CI/CD

Add to your CI pipeline:

```yaml
# GitHub Actions example
- name: Run Service Communication Tests
  run: |
    cd bg-identity-ai && npm run dev &
    sleep 10
    cd ../tests && npm test
```

### Automated Monitoring

Set up periodic testing:

```bash
# Cron job example (every hour)
0 * * * * cd /path/to/tests && npm test > test-results.log 2>&1
```

## 📝 **Test Development**

### Adding New Tests

1. **Create test file** in appropriate directory (`integration/`, `e2e/`)
2. **Use TestHelpers** utilities for common operations
3. **Follow naming convention**: `*.test.js`
4. **Add to test runner** in `run-all-tests.js`

### Test Template

```javascript
#!/usr/bin/env node

const chalk = require('chalk');
const TestHelpers = require('../utils/test-helpers');

class NewTestSuite {
  async runTest(testName, testFn) {
    // Test implementation
  }

  async runAllTests() {
    console.log(chalk.bold.cyan('🚀 Starting New Test Suite'));
    // Test execution
  }
}

if (require.main === module) {
  const tester = new NewTestSuite();
  tester.runAllTests();
}
```

## 🏆 **Success Metrics**

### Platform Integration Verified

When all tests pass, you have verified:

- **✅ Console-First Architecture**: CLI successfully communicates with service
- **✅ Real-Time Capabilities**: WebSocket streaming operational
- **✅ Enterprise Security**: JWT authentication and authorization working
- **✅ Performance Standards**: Response times within acceptable limits
- **✅ Scalability**: Multiple concurrent users supported
- **✅ Error Resilience**: Proper error handling and recovery
- **✅ Production Readiness**: Complete integration validated

### Next Steps After Success

1. **Deploy to staging environment**
2. **Run production-level load tests**
3. **Set up monitoring and alerting**
4. **Document operational procedures**
5. **Train security analysts on CLI usage**

## 🆘 **Support & Troubleshooting**

### Debug Mode

Run tests with detailed output:

```bash
DEBUG=true npm test
```

### Logs

Test execution logs are available:
- **Console output**: Real-time test progress
- **Error details**: Specific failure information
- **Performance metrics**: Detailed timing data

### Getting Help

1. **Check service logs**: `bg-identity-ai/bg-threat-ai.log`
2. **Verify environment setup**: Node.js 16+, dependencies installed
3. **Review test output**: Look for specific error messages
4. **Test individual suites**: Isolate failing components

---

## 📄 **License**

This testing suite is part of the ThreatGuard Console-First Threat Detection Platform.

**Copyright © 2025 ThreatGuard Security**

---

*For additional support or questions about the testing framework, please refer to the main project documentation or contact the development team.*