import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { vi } from 'vitest';

// Global test setup for integration tests
beforeAll(async () => {
  // Set up test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
  
  // Mock Redis for tests
  vi.mock('@/lib/cache/redis-client', () => ({
    redisClient: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      exists: vi.fn().mockResolvedValue(0),
      expire: vi.fn().mockResolvedValue(1),
      flushall: vi.fn().mockResolvedValue('OK'),
      quit: vi.fn().mockResolvedValue('OK')
    }
  }));

  // Mock database connections for tests
  vi.mock('@/lib/database/connection', () => ({
    db: {
      query: vi.fn(),
      transaction: vi.fn(),
      close: vi.fn()
    }
  }));

  // Mock external services
  vi.mock('@/services/external/threat-intelligence', () => ({
    threatIntelligenceService: {
      lookupIOC: vi.fn().mockResolvedValue({
        ioc: 'test-ioc',
        reputation: 'malicious',
        confidence: 0.95
      }),
      enrichThreat: vi.fn().mockResolvedValue({
        enrichment: 'test-enrichment-data'
      })
    }
  }));

  console.log('🧪 Integration test environment initialized');
});

afterAll(async () => {
  // Clean up test environment
  vi.clearAllMocks();
  vi.restoreAllMocks();
  
  console.log('🧹 Integration test environment cleaned up');
});

beforeEach(() => {
  // Reset mocks before each test
  vi.clearAllMocks();
  
  // Set default mock implementations
  const mockAuth = vi.mocked(require('@/lib/auth/middleware'));
  if (mockAuth.validateApiKey) {
    mockAuth.validateApiKey.mockResolvedValue(true);
  }
});

afterEach(() => {
  // Clean up after each test
  vi.clearAllTimers();
});

// Test utilities
export const createMockThreatEvent = (overrides = {}) => ({
  id: 'test_threat_' + Math.random().toString(36).substr(2, 9),
  timestamp: new Date().toISOString(),
  type: 'malware',
  severity: 'high',
  source: 'test_scanner',
  target: 'test_server',
  description: 'Test threat event',
  riskScore: 7.5,
  status: 'active',
  metadata: {
    correlationId: 'test_corr_' + Math.random().toString(36).substr(2, 9),
    source: 'test_detector'
  },
  ...overrides
});

export const createMockWebhook = (overrides = {}) => ({
  id: 'webhook_test_' + Math.random().toString(36).substr(2, 9),
  name: 'Test Webhook',
  url: 'https://example.com/webhook',
  eventTypes: ['threat.detected'],
  status: 'active',
  secret: 'test_secret_' + Math.random().toString(36).substr(2, 9),
  retryConfig: {
    maxRetries: 3,
    retryDelay: 1000,
    backoffMultiplier: 2
  },
  metadata: {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    failureCount: 0,
    successCount: 0
  },
  ...overrides
});

export const createMockSIEMConnection = (overrides = {}) => ({
  id: 'siem_test_' + Math.random().toString(36).substr(2, 9),
  name: 'Test SIEM Connection',
  type: 'splunk',
  status: 'active',
  config: {
    endpoint: 'https://splunk.test.com:8089',
    username: 'test_user',
    password: 'test_password',
    index: 'security_events',
    protocol: 'https',
    format: 'json'
  },
  features: ['event_export', 'alert_import'],
  capabilities: ['search', 'real_time', 'batch_processing'],
  metadata: {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastConnection: new Date().toISOString(),
    version: '8.2'
  },
  ...overrides
});

export const createMockMLModel = (overrides = {}) => ({
  id: 'model_test_' + Math.random().toString(36).substr(2, 9),
  name: 'Test ML Model',
  type: 'isolation_forest',
  version: '1.0.0',
  status: 'active',
  accuracy: 0.94,
  health: {
    lastHealthCheck: new Date().toISOString(),
    overallHealth: 'healthy',
    healthScore: 95,
    componentChecks: [
      {
        component: 'model_inference',
        status: 'healthy',
        lastCheck: new Date().toISOString(),
        responseTime: 45
      }
    ],
    issues: [],
    uptime: 86400
  },
  performance: {
    averageInferenceTime: 45,
    throughput: 1000,
    errorRate: 0.01,
    memoryUsage: 512,
    cpuUsage: 25,
    diskUsage: 1024,
    lastBenchmark: new Date().toISOString()
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

// API Response helpers
export const expectSuccessResponse = (response: any) => {
  expect(response.body).toHaveProperty('success', true);
  expect(response.body).toHaveProperty('data');
  expect(response.body).toHaveProperty('timestamp');
  expect(response.body).toHaveProperty('correlationId');
  expect(response.body.correlationId).toMatch(/^[a-f0-9-]{36}$/);
};

export const expectErrorResponse = (response: any, expectedError?: string) => {
  expect(response.body).toHaveProperty('success', false);
  expect(response.body).toHaveProperty('error');
  expect(response.body).toHaveProperty('correlationId');
  
  if (expectedError) {
    expect(response.body.error).toContain(expectedError);
  }
};

export const expectValidTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  expect(date.getTime()).toBeGreaterThan(0);
  expect(Math.abs(Date.now() - date.getTime())).toBeLessThan(60000); // Within last minute
};

// Performance testing helpers
export const measureResponseTime = async (fn: () => Promise<any>) => {
  const startTime = Date.now();
  const result = await fn();
  const duration = Date.now() - startTime;
  return { result, duration };
};

export const expectResponseTime = (duration: number, maxMs: number) => {
  expect(duration).toBeLessThan(maxMs);
};

// Concurrent testing helpers
export const runConcurrentTests = async (testFn: () => Promise<any>, concurrency: number = 5) => {
  const promises = Array(concurrency).fill(null).map(() => testFn());
  return Promise.all(promises);
};

// Test data generators
export const generateLargeThreatDataset = (count: number) => {
  return Array(count).fill(null).map((_, i) => createMockThreatEvent({
    id: `threat_${i}`,
    timestamp: new Date(Date.now() - (i * 60000)).toISOString(), // 1 minute intervals
    type: ['malware', 'intrusion', 'anomaly'][i % 3],
    severity: ['low', 'medium', 'high', 'critical'][i % 4],
    riskScore: Math.random() * 10
  }));
};

export const generateTrendAnalysisTestData = (hours: number = 24) => {
  const now = new Date();
  const threats = [];
  
  for (let i = 0; i < hours; i++) {
    const hourlyThreats = Math.floor(Math.random() * 10) + 1;
    for (let j = 0; j < hourlyThreats; j++) {
      threats.push(createMockThreatEvent({
        timestamp: new Date(now.getTime() - (i * 60 * 60 * 1000) - (j * 5 * 60 * 1000)).toISOString()
      }));
    }
  }
  
  return threats;
};

// Mock service responses
export const mockSuccessfulWebhookDelivery = () => ({
  id: 'delivery_test_' + Math.random().toString(36).substr(2, 9),
  webhookId: 'webhook_test_123',
  eventId: 'event_test_456',
  url: 'https://example.com/webhook',
  httpMethod: 'POST',
  status: 'delivered',
  attempts: [
    {
      attemptNumber: 1,
      timestamp: new Date().toISOString(),
      httpStatus: 200,
      responseTime: 125,
      requestHeaders: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': 'test_signature'
      },
      requestBody: JSON.stringify({ test: 'data' })
    }
  ],
  createdAt: new Date().toISOString()
});

export const mockFailedWebhookDelivery = () => ({
  id: 'delivery_failed_' + Math.random().toString(36).substr(2, 9),
  webhookId: 'webhook_test_123',
  eventId: 'event_test_456',
  url: 'https://unreachable.example.com/webhook',
  httpMethod: 'POST',
  status: 'failed',
  attempts: [
    {
      attemptNumber: 1,
      timestamp: new Date().toISOString(),
      httpStatus: 0,
      responseTime: 5000,
      errorMessage: 'Connection timeout',
      requestHeaders: {
        'Content-Type': 'application/json'
      },
      requestBody: JSON.stringify({ test: 'data' })
    }
  ],
  createdAt: new Date().toISOString()
});

console.log('🔧 Integration test utilities loaded');