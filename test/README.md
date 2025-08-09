# ThreatGuard Service Communication & Integration Testing

Comprehensive testing suite for the ThreatGuard console-first threat detection platform.

## 📋 Overview

This testing suite validates:
- **API Endpoint Performance** (<100ms response time)
- **WebSocket Load Testing** (100+ concurrent connections)
- **CLI Integration Testing** (end-to-end command workflows)
- **Performance Benchmarking** (<50ms WebSocket latency)

## 🚀 Quick Start

```bash
# Install dependencies
cd test
npm install

# Run quick test (15 seconds, 25 connections)
npm run test:quick

# Run full test suite (60 seconds, 100 connections)
npm run test:full

# Run individual test suites
npm run test:api
npm run test:websocket
npm run test:cli
npm run test:performance
```

## 📊 Test Suites

### 1. API Endpoint Testing
- **File**: `api/auth-endpoints.test.js`
- **Tests**: Authentication, validation, error handling
- **Target**: <100ms API response time
- **Usage**: `node api/auth-endpoints.test.js [api_url]`

### 2. WebSocket Load Testing  
- **File**: `websocket/load-test.js`
- **Tests**: 100+ concurrent connections, message latency
- **Target**: <50ms WebSocket latency
- **Usage**: `node websocket/load-test.js [ws_url] [max_connections] [duration_seconds]`

### 3. CLI Integration Testing
- **File**: `cli/integration-test.js`
- **Tests**: Command workflows, error handling, performance
- **Target**: All commands functional
- **Usage**: `node cli/integration-test.js [cli_path]`

### 4. Performance Benchmarking
- **File**: `performance/benchmark-suite.js`
- **Tests**: API throughput, WebSocket performance, resource usage
- **Target**: 100 req/s throughput
- **Usage**: `node performance/benchmark-suite.js [api_url] [ws_url] [auth_token]`

## 📈 Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| API Response Time | <100ms | Average across all endpoints |
| WebSocket Latency | <50ms | Average message round-trip |
| Connection Success Rate | >95% | WebSocket connections established |
| CLI Command Performance | <5s | Most commands complete quickly |
| Throughput | >100 req/s | Concurrent API requests |

## 🔧 Configuration

### Environment Variables

```bash
# Service URLs
export API_URL="http://localhost:3001"
export WS_URL="ws://localhost:3001/ws"

# Test Parameters
export MAX_CONNECTIONS=100
export TEST_DURATION=60
export CLI_PATH="../threatguard-cli/dist/index.js"

# Skip service health check
export SKIP_SERVICES=false
```

### Service Requirements

Before running tests, ensure services are running:

```bash
# Start bg-threat-ai service
cd bg-identity-ai
npm run dev  # Port 3001

# Start bg-web (optional)
cd bg-web
npm run dev  # Port 3000

# Build CLI (optional)
cd threatguard-cli
npm run build
```

## 📋 Test Results

Results are saved to `test-results.json` with detailed metrics:

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "overall": {
    "passed": 45,
    "failed": 2,
    "total": 47,
    "duration": 75000
  },
  "services": {
    "bg-threat-ai": { "status": "healthy" },
    "bg-web": { "status": "healthy" }
  },
  "tests": {
    "api": { "success": true, "performance": {...} },
    "websocket": { "success": true, "metrics": {...} },
    "cli": { "success": true, "commands": {...} },
    "performance": { "success": true, "benchmarks": {...} }
  }
}
```

## 🎯 Success Criteria

### Production Ready (95%+ success rate)
- ✅ All API endpoints respond <100ms
- ✅ WebSocket handles 100+ connections
- ✅ CLI commands work end-to-end
- ✅ Performance targets met

### Development Ready (80%+ success rate)
- ⚠️ Most functionality working
- ⚠️ Minor performance issues
- ⚠️ Some edge cases failing

### Needs Work (<80% success rate)
- ❌ Major functionality broken
- ❌ Performance targets missed
- ❌ Service communication issues

## 🔍 Troubleshooting

### Common Issues

**Service Not Running**
```bash
# Check service health
curl http://localhost:3001/health
curl http://localhost:3000/api/health
```

**WebSocket Connection Failed**
```bash
# Test WebSocket manually
wscat -c ws://localhost:3001/ws -H "Authorization: Bearer test_token_123"
```

**CLI Build Missing**
```bash
cd threatguard-cli
npm install
npm run build
```

**Port Conflicts**
```bash
# Check what's using ports
lsof -i :3001
lsof -i :3000
```

### Debug Mode

Run with verbose logging:
```bash
DEBUG=true npm run test
```

## 📝 Adding New Tests

### API Endpoint Test
```javascript
async testNewEndpoint() {
  const response = await axios.get(`${this.baseUrl}/new-endpoint`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
}
```

### CLI Command Test
```javascript
{
  name: 'new command test',
  cmd: ['new', 'command', '--option', 'value'],
  expectExitCode: 0,
  timeout: 5000
}
```

### Performance Benchmark
```javascript
async benchmarkNewFeature() {
  const times = [];
  for (let i = 0; i < 20; i++) {
    const start = performance.now();
    await performOperation();
    times.push(performance.now() - start);
  }
  return this.analyzeMetrics(times);
}
```

## 🚦 CI/CD Integration

### GitHub Actions
```yaml
name: Integration Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - name: Start Services
        run: ./start-services.sh
      - name: Run Tests
        run: cd test && npm install && npm run test:full
```

### Local Pre-commit
```bash
#!/bin/bash
# .git/hooks/pre-commit
cd test && npm run test:quick
if [ $? -eq 0 ]; then
  echo "✅ All tests passed"
else
  echo "❌ Tests failed, commit blocked"
  exit 1
fi
```

## 📚 Architecture

```
test/
├── api/                    # API endpoint tests
│   └── auth-endpoints.test.js
├── websocket/              # WebSocket load tests
│   └── load-test.js
├── cli/                    # CLI integration tests
│   └── integration-test.js
├── performance/            # Performance benchmarks
│   └── benchmark-suite.js
├── run-all-tests.js        # Master test runner
├── package.json            # Dependencies and scripts
└── README.md               # This file
```

The testing architecture follows the ThreatGuard service communication patterns:
- **bg-threat-ai** → REST API + WebSocket streaming
- **threatguard-cli** → CLI interface with API client
- **bg-web** → Landing page and admin interface

## 🎯 Next Steps

After completing Service Communication & Integration Testing:

1. **Database Schema Updates** - Remove biometric tables, add threat detection tables
2. **Web Interface Simplification** - Focus on landing page and CLI downloads  
3. **Open Source Library Integration** - PyOD, Suricata, River, ELK Stack
4. **Advanced CLI Features** - Export capabilities, scripting support, plugins
5. **Market Launch Preparation** - Documentation, demos, support systems