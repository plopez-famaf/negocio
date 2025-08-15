import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  UserBehaviorModel,
  UserEvent,
  UserBehaviorInput,
  BehaviorAnalysisResult
} from '@/ml/models/behavioral-analysis/user-behavior-model';
import { TrainingData, TrainingConfig } from '@/ml/models/base/model-interfaces';

describe('UserBehaviorModel', () => {
  let model: UserBehaviorModel;

  beforeEach(async () => {
    model = new UserBehaviorModel();
    await model.initialize();
  });

  afterEach(() => {
    // Cleanup if needed
  });

  describe('Initialization', () => {
    it('should initialize with correct model properties', () => {
      expect(model.modelId).toBe('user-behavior-v1');
      expect(model.modelName).toBe('User Behavior Analytics Model');
      expect(model.version).toBe('1.0.0');
      expect(model.isLoaded).toBe(true);
    });

    it('should have expected feature names', () => {
      const modelInfo = model.getModelInfo();
      expect(modelInfo.features).toContain('login_frequency');
      expect(modelInfo.features).toContain('session_duration_avg');
      expect(modelInfo.features).toContain('location_entropy');
      expect(modelInfo.features.length).toBe(10);
    });
  });

  describe('Input Validation', () => {
    it('should validate correct user behavior input', async () => {
      const input = createValidUserBehaviorInput();
      
      const result = await model.analyzeUserBehavior(input);
      
      expect(result).toBeDefined();
      expect(result.userId).toBe(input.userId);
      expect(typeof result.anomalyScore).toBe('number');
      expect(typeof result.isAnomalous).toBe('boolean');
    });

    it('should reject input with missing required fields', async () => {
      const invalidInput = {
        userId: 'user123',
        events: [], // Empty events
        timeWindow: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-01T23:59:59Z'
        }
      };

      const result = await model.analyzeUserBehavior(invalidInput);
      expect(result.confidence).toBeLessThan(0.5); // Low confidence due to no data
    });

    it('should reject input with invalid event structure', async () => {
      const invalidInput = {
        userId: 'user123',
        events: [
          {
            // Missing required fields
            eventType: 'login',
            timestamp: '2024-01-01T08:00:00Z'
          }
        ],
        timeWindow: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-01T23:59:59Z'
        }
      } as UserBehaviorInput;

      await expect(model.analyzeUserBehavior(invalidInput)).rejects.toThrow();
    });
  });

  describe('Normal Behavior Analysis', () => {
    it('should classify normal user behavior correctly', async () => {
      const normalInput = createNormalBehaviorInput();
      
      const result = await model.analyzeUserBehavior(normalInput);
      
      expect(result.isAnomalous).toBe(false);
      expect(result.riskLevel).toMatch(/low|medium/);
      expect(result.anomalyScore).toBeLessThan(0.7);
      expect(result.behaviorPatterns).toBeDefined();
    });

    it('should build user profile from normal behavior', async () => {
      const normalInput = createNormalBehaviorInput();
      
      // Analyze multiple times to build profile
      await model.analyzeUserBehavior(normalInput);
      const result = await model.analyzeUserBehavior(normalInput);
      
      expect(result.confidence).toBeGreaterThan(0.3); // Should increase with more data
      expect(result.behaviorPatterns.loginFrequency).toBeGreaterThan(0);
    });
  });

  describe('Anomalous Behavior Detection', () => {
    it('should detect location-based anomalies', async () => {
      const anomalousInput = createLocationAnomalyInput();
      
      const result = await model.analyzeUserBehavior(anomalousInput);
      
      expect(result.isAnomalous).toBe(true);
      expect(result.riskLevel).toMatch(/high|critical/);
      expect(result.anomalies.some(a => a.type.includes('location'))).toBe(true);
    });

    it('should detect time-based anomalies', async () => {
      const anomalousInput = createTimeAnomalyInput();
      
      const result = await model.analyzeUserBehavior(anomalousInput);
      
      expect(result.anomalies.some(a => a.type.includes('time'))).toBe(true);
      expect(result.behaviorPatterns.timePatterns).toBeDefined();
    });

    it('should detect login frequency anomalies', async () => {
      const anomalousInput = createLoginFrequencyAnomalyInput();
      
      const result = await model.analyzeUserBehavior(anomalousInput);
      
      expect(result.anomalies.some(a => a.type.includes('login'))).toBe(true);
      expect(result.behaviorPatterns.loginFrequency).toBeGreaterThan(10); // Very high frequency
    });

    it('should detect privilege escalation attempts', async () => {
      const anomalousInput = createPrivilegeEscalationInput();
      
      const result = await model.analyzeUserBehavior(anomalousInput);
      
      expect(result.isAnomalous).toBe(true);
      expect(result.riskLevel).toBe('critical');
      expect(result.anomalies.some(a => a.type === 'privilege_escalation')).toBe(true);
    });

    it('should detect high failure rate anomalies', async () => {
      const anomalousInput = createHighFailureRateInput();
      
      const result = await model.analyzeUserBehavior(anomalousInput);
      
      expect(result.anomalies.some(a => a.type === 'high_failure_rate')).toBe(true);
      expect(result.riskLevel).toMatch(/high|critical/);
    });
  });

  describe('Behavior Pattern Analysis', () => {
    it('should identify access patterns correctly', async () => {
      const input = createPatternAnalysisInput();
      
      const result = await model.analyzeUserBehavior(input);
      
      expect(result.behaviorPatterns.accessPatterns.length).toBeGreaterThan(0);
      expect(result.behaviorPatterns.locationVariability).toBeGreaterThanOrEqual(0);
      expect(result.behaviorPatterns.timePatterns.length).toBe(24); // Hourly patterns
    });

    it('should calculate risk indicators accurately', async () => {
      const riskyInput = createRiskyBehaviorInput();
      
      const result = await model.analyzeUserBehavior(riskyInput);
      
      expect(result.behaviorPatterns.riskIndicators.length).toBeGreaterThan(0);
      expect(result.behaviorPatterns.riskIndicators).toContain('multiple_failed_logins');
    });
  });

  describe('Confidence and Risk Assessment', () => {
    it('should provide appropriate confidence scores', async () => {
      const input = createValidUserBehaviorInput();
      
      const result = await model.analyzeUserBehavior(input);
      
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should increase confidence with more user history', async () => {
      const input = createValidUserBehaviorInput();
      
      // First analysis (limited history)
      const result1 = await model.analyzeUserBehavior(input);
      
      // Second analysis (building history)
      const result2 = await model.analyzeUserBehavior(input);
      
      expect(result2.confidence).toBeGreaterThanOrEqual(result1.confidence);
    });

    it('should assign appropriate risk levels', async () => {
      const scenarios = [
        { input: createNormalBehaviorInput(), expectedRisk: ['low', 'medium'] },
        { input: createLocationAnomalyInput(), expectedRisk: ['high', 'critical'] },
        { input: createPrivilegeEscalationInput(), expectedRisk: ['critical'] }
      ];

      for (const scenario of scenarios) {
        const result = await model.analyzeUserBehavior(scenario.input);
        expect(scenario.expectedRisk).toContain(result.riskLevel);
      }
    });
  });

  describe('Recommendations', () => {
    it('should provide relevant recommendations for anomalous behavior', async () => {
      const anomalousInput = createLocationAnomalyInput();
      
      const result = await model.analyzeUserBehavior(anomalousInput);
      
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.some(r => r.includes('investigate'))).toBe(true);
    });

    it('should provide monitoring recommendations for normal behavior', async () => {
      const normalInput = createNormalBehaviorInput();
      
      const result = await model.analyzeUserBehavior(normalInput);
      
      expect(result.recommendations).toContain('Continue monitoring user behavior');
    });
  });

  describe('Training', () => {
    it('should train successfully with user behavior data', async () => {
      const trainingData = createTrainingData();
      const config: TrainingConfig = {
        algorithm: 'user-behavior-analytics',
        hyperparameters: {
          anomalyThreshold: 0.7,
          minEventsForProfile: 50
        },
        validationSplit: 0.2
      };

      const result = await model.train(trainingData, config);
      
      expect(result.modelId).toBe(model.modelId);
      expect(result.trainingTime).toBeGreaterThan(0);
      expect(result.convergence).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should complete analysis within performance target', async () => {
      const input = createValidUserBehaviorInput();
      
      const startTime = Date.now();
      await model.analyzeUserBehavior(input);
      const endTime = Date.now();
      
      const analysisTime = endTime - startTime;
      expect(analysisTime).toBeLessThan(1000); // <1s for analysis
    });

    it('should handle batch analysis efficiently', async () => {
      const users = ['user1', 'user2', 'user3', 'user4', 'user5'];
      const inputs = users.map(userId => ({ 
        ...createValidUserBehaviorInput(), 
        userId 
      }));
      
      const startTime = Date.now();
      const promises = inputs.map(input => model.analyzeUserBehavior(input));
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      const totalTime = endTime - startTime;
      const avgTimePerAnalysis = totalTime / inputs.length;
      
      expect(results.length).toBe(inputs.length);
      expect(avgTimePerAnalysis).toBeLessThan(500); // <500ms per analysis
    });
  });

  describe('Model Persistence', () => {
    it('should save and load model state correctly', async () => {
      // Analyze some behavior to build state
      const input = createValidUserBehaviorInput();
      await model.analyzeUserBehavior(input);
      
      // Save model
      await model.save('test-uba-model');
      
      // Create new model and load
      const newModel = new UserBehaviorModel();
      await newModel.initialize();
      await newModel.load('test-uba-model');
      
      // Test consistency
      const result1 = await model.analyzeUserBehavior(input);
      const result2 = await newModel.analyzeUserBehavior(input);
      
      expect(result1.userId).toBe(result2.userId);
      // Behavior scores should be similar
      expect(Math.abs(result1.anomalyScore - result2.anomalyScore)).toBeLessThan(0.1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle users with no historical data', async () => {
      const input = createValidUserBehaviorInput();
      input.userId = 'new-user-' + Date.now(); // Ensure new user
      
      const result = await model.analyzeUserBehavior(input);
      
      expect(result.confidence).toBeLessThan(0.5); // Lower confidence for new user
      expect(result.isAnomalous).toBeDefined();
    });

    it('should handle empty event lists gracefully', async () => {
      const emptyInput: UserBehaviorInput = {
        userId: 'user123',
        events: [],
        timeWindow: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-01T23:59:59Z'
        }
      };
      
      const result = await model.analyzeUserBehavior(emptyInput);
      
      expect(result.confidence).toBeLessThan(0.3);
      expect(result.behaviorPatterns.loginFrequency).toBe(0);
    });

    it('should handle extreme timestamp values', async () => {
      const input = createValidUserBehaviorInput();
      input.events[0].timestamp = '1970-01-01T00:00:00Z'; // Unix epoch
      
      const result = await model.analyzeUserBehavior(input);
      expect(result).toBeDefined();
    });
  });

  describe('Regression Tests', () => {
    it('should maintain consistent behavior detection over time', async () => {
      const testCases = [
        {
          input: createNormalBehaviorInput(),
          expectedAnomalous: false
        },
        {
          input: createLocationAnomalyInput(),
          expectedAnomalous: true
        },
        {
          input: createPrivilegeEscalationInput(),
          expectedAnomalous: true
        }
      ];

      for (const testCase of testCases) {
        const result = await model.analyzeUserBehavior(testCase.input);
        expect(result.isAnomalous).toBe(testCase.expectedAnomalous);
      }
    });
  });
});

// Helper functions for creating test data

function createValidUserBehaviorInput(): UserBehaviorInput {
  return {
    userId: 'test-user-123',
    events: createNormalEvents(),
    timeWindow: {
      start: '2024-01-01T00:00:00Z',
      end: '2024-01-01T23:59:59Z'
    }
  };
}

function createNormalEvents(): UserEvent[] {
  return [
    {
      userId: 'test-user-123',
      sessionId: 'session-1',
      eventType: 'login',
      timestamp: '2024-01-01T09:00:00Z',
      sourceIp: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      location: {
        country: 'US',
        city: 'New York'
      },
      success: true
    },
    {
      userId: 'test-user-123',
      sessionId: 'session-1',
      eventType: 'file_access',
      timestamp: '2024-01-01T09:15:00Z',
      sourceIp: '192.168.1.100',
      resource: '/documents/report.pdf',
      action: 'read',
      dataSize: 1048576,
      success: true
    },
    {
      userId: 'test-user-123',
      sessionId: 'session-1',
      eventType: 'logout',
      timestamp: '2024-01-01T17:00:00Z',
      sourceIp: '192.168.1.100',
      success: true
    }
  ];
}

function createNormalBehaviorInput(): UserBehaviorInput {
  const events: UserEvent[] = [];
  const baseTime = new Date('2024-01-01T09:00:00Z').getTime();
  
  // Create normal working hours login pattern
  for (let day = 0; day < 5; day++) {
    const dayStart = baseTime + day * 24 * 60 * 60 * 1000;
    
    events.push({
      userId: 'normal-user',
      sessionId: `session-${day}`,
      eventType: 'login',
      timestamp: new Date(dayStart + 9 * 60 * 60 * 1000).toISOString(), // 9 AM
      sourceIp: '192.168.1.100',
      location: { country: 'US', city: 'New York' },
      success: true
    });

    events.push({
      userId: 'normal-user',
      sessionId: `session-${day}`,
      eventType: 'file_access',
      timestamp: new Date(dayStart + 10 * 60 * 60 * 1000).toISOString(),
      sourceIp: '192.168.1.100',
      resource: '/workspace/documents',
      success: true
    });

    events.push({
      userId: 'normal-user',
      sessionId: `session-${day}`,
      eventType: 'logout',
      timestamp: new Date(dayStart + 17 * 60 * 60 * 1000).toISOString(), // 5 PM
      sourceIp: '192.168.1.100',
      success: true
    });
  }
  
  return {
    userId: 'normal-user',
    events,
    timeWindow: {
      start: '2024-01-01T00:00:00Z',
      end: '2024-01-05T23:59:59Z'
    }
  };
}

function createLocationAnomalyInput(): UserBehaviorInput {
  return {
    userId: 'location-anomaly-user',
    events: [
      {
        userId: 'location-anomaly-user',
        sessionId: 'session-1',
        eventType: 'login',
        timestamp: '2024-01-01T09:00:00Z',
        sourceIp: '192.168.1.100',
        location: { country: 'US', city: 'New York' },
        success: true
      },
      {
        userId: 'location-anomaly-user',
        sessionId: 'session-2',
        eventType: 'login',
        timestamp: '2024-01-01T10:00:00Z',
        sourceIp: '203.0.113.1',
        location: { country: 'CN', city: 'Beijing' }, // Impossible travel
        success: true
      }
    ],
    timeWindow: {
      start: '2024-01-01T00:00:00Z',
      end: '2024-01-01T23:59:59Z'
    }
  };
}

function createTimeAnomalyInput(): UserBehaviorInput {
  return {
    userId: 'time-anomaly-user',
    events: [
      {
        userId: 'time-anomaly-user',
        sessionId: 'session-1',
        eventType: 'login',
        timestamp: '2024-01-01T03:00:00Z', // 3 AM - unusual time
        sourceIp: '192.168.1.100',
        location: { country: 'US', city: 'New York' },
        success: true
      },
      {
        userId: 'time-anomaly-user',
        sessionId: 'session-1',
        eventType: 'file_access',
        timestamp: '2024-01-01T03:30:00Z',
        sourceIp: '192.168.1.100',
        resource: '/sensitive/financial_data',
        success: true
      }
    ],
    timeWindow: {
      start: '2024-01-01T00:00:00Z',
      end: '2024-01-01T23:59:59Z'
    }
  };
}

function createLoginFrequencyAnomalyInput(): UserBehaviorInput {
  const events: UserEvent[] = [];
  const baseTime = new Date('2024-01-01T00:00:00Z').getTime();
  
  // Create excessive login attempts (50 logins in one day)
  for (let i = 0; i < 50; i++) {
    events.push({
      userId: 'frequent-login-user',
      sessionId: `session-${i}`,
      eventType: 'login',
      timestamp: new Date(baseTime + i * 30 * 60 * 1000).toISOString(), // Every 30 minutes
      sourceIp: '192.168.1.100',
      location: { country: 'US', city: 'New York' },
      success: true
    });
  }
  
  return {
    userId: 'frequent-login-user',
    events,
    timeWindow: {
      start: '2024-01-01T00:00:00Z',
      end: '2024-01-01T23:59:59Z'
    }
  };
}

function createPrivilegeEscalationInput(): UserBehaviorInput {
  return {
    userId: 'privilege-user',
    events: [
      {
        userId: 'privilege-user',
        sessionId: 'session-1',
        eventType: 'login',
        timestamp: '2024-01-01T09:00:00Z',
        sourceIp: '192.168.1.100',
        location: { country: 'US', city: 'New York' },
        success: true
      },
      {
        userId: 'privilege-user',
        sessionId: 'session-1',
        eventType: 'permission_change',
        timestamp: '2024-01-01T09:30:00Z',
        sourceIp: '192.168.1.100',
        resource: '/admin/user_permissions',
        action: 'elevate',
        success: true,
        metadata: { privileged: true }
      },
      {
        userId: 'privilege-user',
        sessionId: 'session-1',
        eventType: 'system_command',
        timestamp: '2024-01-01T09:35:00Z',
        sourceIp: '192.168.1.100',
        resource: 'sudo',
        success: true,
        metadata: { privileged: true }
      }
    ],
    timeWindow: {
      start: '2024-01-01T00:00:00Z',
      end: '2024-01-01T23:59:59Z'
    }
  };
}

function createHighFailureRateInput(): UserBehaviorInput {
  const events: UserEvent[] = [];
  
  // Create pattern of failed logins
  for (let i = 0; i < 10; i++) {
    events.push({
      userId: 'failure-user',
      sessionId: `failed-session-${i}`,
      eventType: 'login',
      timestamp: `2024-01-01T09:${i.toString().padStart(2, '0')}:00Z`,
      sourceIp: '192.168.1.100',
      location: { country: 'US', city: 'New York' },
      success: false // Failed login
    });
  }
  
  // Add one successful login
  events.push({
    userId: 'failure-user',
    sessionId: 'success-session',
    eventType: 'login',
    timestamp: '2024-01-01T09:15:00Z',
    sourceIp: '192.168.1.100',
    location: { country: 'US', city: 'New York' },
    success: true
  });
  
  return {
    userId: 'failure-user',
    events,
    timeWindow: {
      start: '2024-01-01T00:00:00Z',
      end: '2024-01-01T23:59:59Z'
    }
  };
}

function createPatternAnalysisInput(): UserBehaviorInput {
  return {
    userId: 'pattern-user',
    events: [
      {
        userId: 'pattern-user',
        sessionId: 'session-1',
        eventType: 'login',
        timestamp: '2024-01-01T09:00:00Z',
        sourceIp: '192.168.1.100',
        location: { country: 'US', city: 'New York' },
        success: true
      },
      {
        userId: 'pattern-user',
        sessionId: 'session-1',
        eventType: 'file_access',
        timestamp: '2024-01-01T09:15:00Z',
        sourceIp: '192.168.1.100',
        resource: '/documents/project_a',
        success: true
      },
      {
        userId: 'pattern-user',
        sessionId: 'session-1',
        eventType: 'network_access',
        timestamp: '2024-01-01T09:30:00Z',
        sourceIp: '192.168.1.100',
        resource: 'api.company.com',
        success: true
      },
      {
        userId: 'pattern-user',
        sessionId: 'session-1',
        eventType: 'data_transfer',
        timestamp: '2024-01-01T10:00:00Z',
        sourceIp: '192.168.1.100',
        resource: '/exports/report.csv',
        dataSize: 5242880, // 5MB
        success: true
      }
    ],
    timeWindow: {
      start: '2024-01-01T00:00:00Z',
      end: '2024-01-01T23:59:59Z'
    }
  };
}

function createRiskyBehaviorInput(): UserBehaviorInput {
  return {
    userId: 'risky-user',
    events: [
      // Multiple failed logins
      ...Array.from({ length: 8 }, (_, i) => ({
        userId: 'risky-user',
        sessionId: `failed-${i}`,
        eventType: 'login' as const,
        timestamp: `2024-01-01T08:${i.toString().padStart(2, '0')}:00Z`,
        sourceIp: '192.168.1.100',
        success: false
      })),
      // Successful login after failures
      {
        userId: 'risky-user',
        sessionId: 'success',
        eventType: 'login' as const,
        timestamp: '2024-01-01T08:15:00Z',
        sourceIp: '192.168.1.100',
        location: { country: 'US', city: 'New York' },
        success: true
      },
      // Off-hours access
      {
        userId: 'risky-user',
        sessionId: 'success',
        eventType: 'file_access' as const,
        timestamp: '2024-01-01T02:00:00Z', // 2 AM
        sourceIp: '192.168.1.100',
        resource: '/sensitive/hr_data',
        success: true
      }
    ],
    timeWindow: {
      start: '2024-01-01T00:00:00Z',
      end: '2024-01-01T23:59:59Z'
    }
  };
}

function createTrainingData(): TrainingData {
  // Create synthetic training data for user behavior
  const features: number[][] = [];
  const labels: boolean[] = [];
  
  // Generate normal user behavior data
  for (let i = 0; i < 800; i++) {
    features.push([
      2 + Math.random() * 3,     // login_frequency: 2-5 per day
      3600 + Math.random() * 7200, // session_duration_avg: 1-3 hours
      0.5 + Math.random() * 1,   // location_entropy: 0.5-1.5
      0.3 + Math.random() * 0.4, // time_pattern_score: 0.3-0.7
      5 + Math.random() * 10,    // access_pattern_diversity: 5-15
      0.05 + Math.random() * 0.05, // failure_rate: 0.05-0.1
      1000000 + Math.random() * 5000000, // data_transfer_volume
      0.1 + Math.random() * 0.2, // unusual_resource_access: 0.1-0.3
      0.05 + Math.random() * 0.1, // off_hours_activity: 0.05-0.15
      0 // privilege_escalation_attempts
    ]);
    labels.push(false); // Normal behavior
  }
  
  // Generate anomalous user behavior data
  for (let i = 0; i < 200; i++) {
    features.push([
      Math.random() < 0.5 ? Math.random() * 2 : 10 + Math.random() * 20, // Very low or very high
      Math.random() < 0.5 ? Math.random() * 300 : 14400 + Math.random() * 72000, // Very short or very long
      2 + Math.random() * 4,     // High location entropy
      0.8 + Math.random() * 0.2, // High time pattern score
      20 + Math.random() * 30,   // High access diversity
      0.2 + Math.random() * 0.6, // High failure rate
      Math.random() < 0.5 ? Math.random() * 10000 : 50000000 + Math.random() * 100000000,
      0.5 + Math.random() * 0.5, // High unusual access
      0.3 + Math.random() * 0.7, // High off-hours activity
      Math.floor(Math.random() * 5) // Some privilege escalation attempts
    ]);
    labels.push(true); // Anomalous behavior
  }
  
  return {
    features,
    labels,
    metadata: {
      size: features.length,
      source: 'synthetic-uba-training',
      version: '1.0',
      createdAt: new Date().toISOString()
    }
  };
}