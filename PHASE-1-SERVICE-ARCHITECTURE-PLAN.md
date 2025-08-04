# 🚀 Phase 1: Service Architecture Setup - Detailed Implementation Plan

## 📊 **Phase Overview**
**Duration**: 2-3 weeks  
**Status**: 📋 **Ready for Implementation**  
**Objective**: Create foundational microservices architecture for AI transformation  
**Team Size**: 3-4 developers (can work in parallel)

---

## 🎯 **Phase 1 Mission**

Establish the core infrastructure that enables all AI services to communicate, authenticate, and operate together while maintaining the existing bg-web platform's functionality.

### **Success Definition**
- All 4 AI services start with single `docker-compose up` command
- Services authenticate and communicate through API gateway
- Event system propagates messages between services reliably  
- Integration tests achieve 90%+ success rate
- Development environment setup completed in <30 minutes

---

## 📅 **Week-by-Week Implementation Plan**

### **Week 1: Foundation & Infrastructure (Days 1-7)**

#### **🏗️ Day 1-2: Project Structure & Repository Creation**

**1.1 Create New Repository Structure**
```bash
# Create 4 new repositories parallel to bg-web
mkdir -p ../bg-ai-ecosystem
cd ../bg-ai-ecosystem

# 1. Identity AI Service (Python/FastAPI/ML)
mkdir bg-identity-ai
cd bg-identity-ai
git init
# Create initial structure:
├── Dockerfile
├── docker-compose.yml  
├── requirements.txt          # Python ML dependencies
├── pyproject.toml           # Python project config
├── src/
│   ├── api/                 # FastAPI REST endpoints
│   ├── models/              # AI/ML model definitions  
│   ├── services/            # Business logic services
│   ├── utils/               # Shared utilities
│   └── config/              # Configuration management
├── tests/                   # Unit and integration tests
├── scripts/                 # Deployment utilities
└── docs/                    # Service documentation

# 2. Threat AI Service (Go/Rust for performance)  
mkdir bg-threat-ai
cd bg-threat-ai
git init
# Create structure optimized for high-performance stream processing

# 3. AI Dashboard Service (Next.js/React)
mkdir bg-ai-dashboard  
cd bg-ai-dashboard
git init
# Create React-based monitoring dashboard

# 4. Mobile AI Service (React Native)
mkdir bg-mobile-ai
cd bg-mobile-ai
git init  
# Create cross-platform mobile app structure
```

**1.2 Initialize Core Files**
```dockerfile
# bg-identity-ai/Dockerfile
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies for ML
RUN apt-get update && apt-get install -y \
    build-essential \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/
EXPOSE 8001
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8001", "--reload"]
```

```python
# bg-identity-ai/requirements.txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
tensorflow==2.15.0
opencv-python==4.8.1.78
pillow==10.1.0
numpy==1.24.3
redis==5.0.1
sqlalchemy==2.0.23
psycopg2-binary==2.9.9
python-jose[cryptography]==3.3.0
python-multipart==0.0.6
```

#### **🐳 Day 3-4: Docker & Container Orchestration**

**2.1 Multi-Service Docker Compose**
```yaml
# Root level docker-compose.yml
version: '3.8'
services:
  # Existing core platform  
  web:
    build: ./bg-web
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - IDENTITY_AI_URL=http://identity-ai:8001
      - THREAT_AI_URL=http://threat-ai:8002
      - AI_DASHBOARD_URL=http://ai-dashboard:3001
    depends_on:
      - redis
      - postgres
      - identity-ai
      - threat-ai

  # AI Identity Verification Service
  identity-ai:
    build: ./bg-identity-ai
    ports:
      - "8001:8001"
    environment:
      - ENVIRONMENT=development
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - SERVICE_NAME=bg-identity-ai
      - SERVICE_VERSION=1.0.0
      - JWT_SECRET=${SERVICE_JWT_SECRET}
    volumes:
      - ./bg-identity-ai/models:/app/models  # ML model storage
    depends_on:
      - redis
      - postgres

  # Threat Detection Service  
  threat-ai:
    build: ./bg-threat-ai
    ports:
      - "8002:8002"
    environment:
      - ENVIRONMENT=development
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - SERVICE_NAME=bg-threat-ai
      - SERVICE_VERSION=1.0.0
      - JWT_SECRET=${SERVICE_JWT_SECRET}
    depends_on:
      - redis
      - postgres

  # AI Monitoring Dashboard
  ai-dashboard:
    build: ./bg-ai-dashboard
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - IDENTITY_AI_URL=http://identity-ai:8001
      - THREAT_AI_URL=http://threat-ai:8002
      - WEBSOCKET_URL=ws://web:3000
    depends_on:
      - identity-ai
      - threat-ai

  # Shared Infrastructure (enhanced from existing)
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: bg_ai_platform
      POSTGRES_USER: postgres  
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-password}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init-ai-schemas.sql:/docker-entrypoint-initdb.d/init-ai-schemas.sql

  # Message Queue for Event Processing
  kafka:
    image: confluentinc/cp-kafka:latest
    ports:
      - "9092:9092"
    environment:
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    depends_on:
      - zookeeper

  zookeeper:
    image: confluentinc/cp-zookeeper:latest
    ports:
      - "2181:2181"
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181

volumes:
  postgres_data:
  redis_data:
```

#### **⚙️ Day 5-7: CI/CD Pipeline Setup**

**3.1 GitHub Actions for Each Service**
```yaml
# .github/workflows/identity-ai-service.yml
name: Identity AI Service CI/CD

on:
  push:
    branches: [main, develop]
    paths: ['bg-identity-ai/**']
  pull_request:
    branches: [main]
    paths: ['bg-identity-ai/**']

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: password
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
          
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python 3.11
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
          
      - name: Cache pip dependencies
        uses: actions/cache@v3
        with:
          path: ~/.cache/pip
          key: ${{ runner.os }}-pip-${{ hashFiles('bg-identity-ai/requirements.txt') }}
          
      - name: Install dependencies
        run: |
          cd bg-identity-ai
          pip install -r requirements.txt
          pip install pytest pytest-cov pytest-asyncio
          
      - name: Run unit tests
        run: |
          cd bg-identity-ai
          pytest tests/ -v --cov=src/ --cov-report=xml
          
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./bg-identity-ai/coverage.xml
          
      - name: Build Docker image
        run: |
          cd bg-identity-ai
          docker build -t bg-identity-ai:${{ github.sha }} .
          
      - name: Run integration tests
        run: |
          cd bg-identity-ai
          docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit
          
  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to staging  
        run: echo "Deploy identity AI service to staging"
```

### **Week 2: Inter-Service Communication (Days 8-14)**

#### **🌐 Day 8-10: API Gateway Implementation**

**4.1 Extend bg-web as Central API Gateway**
```typescript
// bg-web/src/lib/ai-services/service-registry.ts
export interface ServiceConfig {
  name: string;
  baseUrl: string;
  healthEndpoint: string;
  timeout: number;
  retries: number;
  circuitBreaker: {
    failureThreshold: number;
    resetTimeout: number;
  };
}

export const AI_SERVICES: Record<string, ServiceConfig> = {
  identity: {
    name: 'bg-identity-ai',
    baseUrl: process.env.IDENTITY_AI_URL || 'http://localhost:8001',
    healthEndpoint: '/health',
    timeout: 10000,
    retries: 3,
    circuitBreaker: {
      failureThreshold: 5,
      resetTimeout: 60000,
    },
  },
  threat: {
    name: 'bg-threat-ai',
    baseUrl: process.env.THREAT_AI_URL || 'http://localhost:8002', 
    healthEndpoint: '/health',
    timeout: 5000,
    retries: 3,
    circuitBreaker: {
      failureThreshold: 5,
      resetTimeout: 60000,
    },
  },
  dashboard: {
    name: 'bg-ai-dashboard',
    baseUrl: process.env.AI_DASHBOARD_URL || 'http://localhost:3001',
    healthEndpoint: '/api/health',
    timeout: 5000,
    retries: 2,
    circuitBreaker: {
      failureThreshold: 3,
      resetTimeout: 30000,
    },
  },
};

// bg-web/src/lib/ai-services/service-client.ts
export class AIServiceClient {
  private circuitBreaker: Map<string, CircuitBreakerState> = new Map();
  
  constructor(private config: ServiceConfig) {
    this.initCircuitBreaker();
  }

  async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ServiceResponse<T>> {
    // Check circuit breaker state
    if (this.isCircuitOpen()) {
      throw new ServiceUnavailableError(this.config.name);
    }

    const url = `${this.config.baseUrl}${endpoint}`;
    
    // Add service authentication and tracing headers
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${await this.getServiceToken()}`,
      'X-Correlation-ID': generateCorrelationId(),
      'X-Service-Name': 'bg-web',
      'X-Service-Version': process.env.SERVICE_VERSION || '1.0.0',
      ...options.headers,
    };

    try {
      const response = await this.withRetry(() =>
        fetch(url, { 
          ...options, 
          headers, 
          signal: AbortSignal.timeout(this.config.timeout) 
        })
      );

      this.recordSuccess();
      return this.processResponse<T>(response);
      
    } catch (error) {
      this.recordFailure();
      throw this.handleError(error);
    }
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.config.retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError!;
  }
}
```

**4.2 Service Discovery & Health Monitoring**
```typescript
// bg-web/src/lib/ai-services/service-monitor.ts
export class ServiceMonitor {
  private services = new Map<string, ServiceStatus>();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(private services: ServiceConfig[]) {
    this.startHealthChecking();
  }

  async checkServiceHealth(service: ServiceConfig): Promise<ServiceStatus> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(
        `${service.baseUrl}${service.healthEndpoint}`,
        { 
          signal: AbortSignal.timeout(3000),
          headers: {
            'Authorization': `Bearer ${await this.getServiceToken()}`,
          },
        }
      );
      
      const responseTime = Date.now() - startTime;
      const healthData = await response.json();
      
      return {
        name: service.name,
        status: response.ok ? 'healthy' : 'unhealthy',
        lastCheck: new Date(),
        responseTime,
        version: response.headers.get('X-Service-Version'),
        details: healthData,
      };
      
    } catch (error) {
      return {
        name: service.name,
        status: 'down',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getAllServiceStatus(): Promise<Record<string, ServiceStatus>> {
    const statuses = await Promise.all(
      this.services.map(service => this.checkServiceHealth(service))
    );
    
    return Object.fromEntries(
      statuses.map(status => [status.name, status])
    );
  }

  private startHealthChecking(): void {
    this.healthCheckInterval = setInterval(async () => {
      const statuses = await this.getAllServiceStatus();
      
      // Update service registry with current statuses
      for (const [serviceName, status] of Object.entries(statuses)) {
        this.services.set(serviceName, status);
        
        // Emit health events for monitoring
        await this.eventBus.publish({
          id: generateId(),
          type: 'service.health.updated',
          source: 'service-monitor',
          timestamp: new Date(),
          data: { serviceName, status },
        });
      }
    }, 30000); // Check every 30 seconds
  }
}
```

#### **📡 Day 11-12: Event Bus & Message Queue**

**5.1 Redis-based Event System**
```typescript
// bg-web/src/lib/events/ai-event-bus.ts
export interface AIEvent {
  id: string;
  type: string;
  source: string;
  timestamp: Date;
  data: Record<string, unknown>;
  correlationId?: string;
  userId?: string;
  sessionId?: string;
}

export class AIEventBus {
  constructor(
    private redis: Redis,
    private logger: Logger
  ) {}

  async publish(event: AIEvent): Promise<void> {
    const channel = `ai:events:${event.type}`;
    const message = JSON.stringify({
      ...event,
      timestamp: event.timestamp.toISOString(),
    });

    try {
      await this.redis.publish(channel, message);
      
      this.logger.info('Event published', {
        component: 'ai-event-bus',
        action: 'publish',
        eventType: event.type,
        eventId: event.id,
        correlationId: event.correlationId,
      });
      
    } catch (error) {
      this.logger.error('Failed to publish event', {
        component: 'ai-event-bus',
        action: 'publish_failed',
        eventType: event.type,
        eventId: event.id,
      }, error as Error);
      
      throw error;
    }
  }

  async subscribe(
    eventType: string,
    handler: (event: AIEvent) => Promise<void>
  ): Promise<void> {
    const channel = `ai:events:${eventType}`;
    
    await this.redis.subscribe(channel);
    
    this.redis.on('message', async (receivedChannel, message) => {
      if (receivedChannel === channel) {
        try {
          const event = JSON.parse(message) as AIEvent;
          event.timestamp = new Date(event.timestamp);
          
          await handler(event);
          
          this.logger.debug('Event processed', {
            component: 'ai-event-bus',
            action: 'event_processed',
            eventType: event.type,
            eventId: event.id,
          });
          
        } catch (error) {
          this.logger.error('Failed to process event', {
            component: 'ai-event-bus',
            action: 'process_failed',
            channel: receivedChannel,
          }, error as Error);
        }
      }
    });
  }

  async subscribeToPattern(
    pattern: string,
    handler: (event: AIEvent) => Promise<void>
  ): Promise<void> {
    await this.redis.psubscribe(`ai:events:${pattern}`);
    
    this.redis.on('pmessage', async (pattern, channel, message) => {
      try {
        const event = JSON.parse(message) as AIEvent;
        event.timestamp = new Date(event.timestamp);
        await handler(event);
      } catch (error) {
        this.logger.error('Pattern subscription handler failed', {}, error as Error);
      }
    });
  }
}

// Event type definitions for AI services
export const AI_EVENTS = {
  // Identity Verification Events
  IDENTITY_VERIFICATION_STARTED: 'identity.verification.started',
  IDENTITY_VERIFICATION_COMPLETED: 'identity.verification.completed',
  IDENTITY_VERIFICATION_FAILED: 'identity.verification.failed',
  BIOMETRIC_CAPTURED: 'identity.biometric.captured',
  DOCUMENT_SCANNED: 'identity.document.scanned',
  LIVENESS_DETECTED: 'identity.liveness.detected',
  
  // Threat Detection Events  
  THREAT_DETECTED: 'threat.detected',
  THREAT_RESOLVED: 'threat.resolved',
  ANOMALY_DETECTED: 'behavioral.anomaly.detected',
  SUSPICIOUS_ACTIVITY: 'security.suspicious.activity',
  ATTACK_PREVENTED: 'security.attack.prevented',
  
  // ML Model Events
  MODEL_RETRAINED: 'ml.model.retrained',
  MODEL_DEPLOYED: 'ml.model.deployed',
  MODEL_PERFORMANCE_DEGRADED: 'ml.model.performance.degraded',
  
  // System Events
  SERVICE_STARTED: 'system.service.started',
  SERVICE_STOPPED: 'system.service.stopped',
  SERVICE_HEALTH_CHANGED: 'system.service.health.changed',
} as const;
```

#### **🗄️ Day 13-14: Database Schema Extensions**

**6.1 AI-Specific Database Schema**
```sql
-- database/init-ai-schemas.sql
-- AI Identity Verification Schema
CREATE SCHEMA IF NOT EXISTS ai_identity;

-- Verification Sessions Table
CREATE TABLE ai_identity.verification_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  verification_type VARCHAR(50) NOT NULL CHECK (verification_type IN ('facial', 'document', 'liveness', 'voice', 'multi_modal')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
  confidence_score DECIMAL(5,4) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
  verification_data JSONB DEFAULT '{}',
  ai_analysis JSONB DEFAULT '{}',
  processing_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour'),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Biometric Templates Table (encrypted storage)
CREATE TABLE ai_identity.biometric_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  template_type VARCHAR(50) NOT NULL CHECK (template_type IN ('facial', 'voice', 'fingerprint', 'iris')),
  encrypted_template BYTEA NOT NULL, -- Encrypted biometric template
  template_hash VARCHAR(64) NOT NULL, -- SHA-256 hash for duplicate detection
  quality_score DECIMAL(5,4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Threat Detection Schema
CREATE SCHEMA IF NOT EXISTS ai_threat;

-- Threat Events Table
CREATE TABLE ai_threat.threat_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id VARCHAR(255),
  event_type VARCHAR(50) NOT NULL,
  event_category VARCHAR(30) NOT NULL CHECK (event_category IN ('anomaly', 'fraud', 'intrusion', 'malware', 'phishing', 'behavioral')),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  threat_score INTEGER CHECK (threat_score >= 0 AND threat_score <= 100),
  confidence_level VARCHAR(20) CHECK (confidence_level IN ('low', 'medium', 'high')),
  indicators JSONB DEFAULT '{}', -- Threat indicators and IOCs
  ai_analysis JSONB DEFAULT '{}', -- ML model analysis results
  network_info JSONB DEFAULT '{}', -- IP, location, device info
  response_actions JSONB DEFAULT '{}', -- Actions taken automatically
  human_reviewed BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  false_positive BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Behavioral Baselines Table
CREATE TABLE ai_threat.behavioral_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  behavior_type VARCHAR(50) NOT NULL CHECK (behavior_type IN ('login_pattern', 'navigation', 'typing', 'transaction', 'location')),
  baseline_data JSONB NOT NULL, -- ML-computed baseline patterns
  confidence_score DECIMAL(5,4),
  sample_size INTEGER,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ML Model Performance Schema
CREATE SCHEMA IF NOT EXISTS ai_ml;

-- Model Metrics Table
CREATE TABLE ai_ml.model_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name VARCHAR(100) NOT NULL,
  model_version VARCHAR(20) NOT NULL,
  service_name VARCHAR(50) NOT NULL,
  metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN ('accuracy', 'precision', 'recall', 'f1_score', 'auc_roc', 'processing_time', 'memory_usage')),
  metric_value DECIMAL(10,6),
  test_dataset_size INTEGER,
  evaluation_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  model_config JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Service Communication Audit
CREATE TABLE ai_ml.service_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id UUID,
  from_service VARCHAR(50) NOT NULL,
  to_service VARCHAR(50) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  request_size_bytes INTEGER,
  response_size_bytes INTEGER,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX idx_verification_sessions_user_id ON ai_identity.verification_sessions(user_id);
CREATE INDEX idx_verification_sessions_status ON ai_identity.verification_sessions(status);
CREATE INDEX idx_verification_sessions_created_at ON ai_identity.verification_sessions(created_at);

CREATE INDEX idx_biometric_templates_user_id ON ai_identity.biometric_templates(user_id);
CREATE INDEX idx_biometric_templates_type ON ai_identity.biometric_templates(template_type);
CREATE INDEX idx_biometric_templates_hash ON ai_identity.biometric_templates(template_hash);

CREATE INDEX idx_threat_events_user_id ON ai_threat.threat_events(user_id);
CREATE INDEX idx_threat_events_severity ON ai_threat.threat_events(severity);
CREATE INDEX idx_threat_events_created_at ON ai_threat.threat_events(created_at);
CREATE INDEX idx_threat_events_category ON ai_threat.threat_events(event_category);

CREATE INDEX idx_behavioral_baselines_user_id ON ai_threat.behavioral_baselines(user_id);
CREATE INDEX idx_behavioral_baselines_type ON ai_threat.behavioral_baselines(behavior_type);

CREATE INDEX idx_model_metrics_name_version ON ai_ml.model_metrics(model_name, model_version);
CREATE INDEX idx_model_metrics_service ON ai_ml.model_metrics(service_name);
CREATE INDEX idx_model_metrics_timestamp ON ai_ml.model_metrics(evaluation_timestamp);

CREATE INDEX idx_service_comms_correlation ON ai_ml.service_communications(correlation_id);
CREATE INDEX idx_service_comms_services ON ai_ml.service_communications(from_service, to_service);
CREATE INDEX idx_service_comms_created_at ON ai_ml.service_communications(created_at);

-- Row Level Security
ALTER TABLE ai_identity.verification_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_identity.biometric_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_threat.behavioral_baselines ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY identity_verification_policy ON ai_identity.verification_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY biometric_templates_policy ON ai_identity.biometric_templates
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY behavioral_baselines_policy ON ai_threat.behavioral_baselines
  FOR ALL USING (auth.uid() = user_id);
```

### **Week 3: Security & Monitoring Integration (Days 15-21)**

#### **🔐 Day 15-17: Inter-Service Authentication**

**7.1 JWT-based Service Authentication**
```typescript
// bg-web/src/lib/ai-services/service-auth.ts
export class ServiceAuthentication {
  private serviceTokens = new Map<string, string>();
  private tokenRefreshTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private jwtSecret: string,
    private logger: Logger
  ) {}

  async generateServiceToken(serviceName: string): Promise<string> {
    const payload: ServiceTokenPayload = {
      sub: serviceName,
      iss: 'bg-web',
      aud: 'ai-services',
      exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
      iat: Math.floor(Date.now() / 1000),
      scope: this.getServiceScopes(serviceName),
      correlationId: generateCorrelationId(),
    };

    const token = jwt.sign(payload, this.jwtSecret, {
      algorithm: 'HS256',
    });

    // Cache token and set up refresh
    this.serviceTokens.set(serviceName, token);
    this.scheduleTokenRefresh(serviceName);

    this.logger.info('Service token generated', {
      component: 'service-auth',
      action: 'generate_token',
      serviceName,
      expiresAt: new Date(payload.exp * 1000),
    });

    return token;
  }

  async validateServiceToken(token: string): Promise<ServiceTokenPayload> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as ServiceTokenPayload;
      
      // Validate scope and audience
      if (payload.aud !== 'ai-services' || payload.iss !== 'bg-web') {
        throw new Error('Invalid token audience or issuer');
      }

      this.logger.debug('Service token validated', {
        component: 'service-auth',
        action: 'validate_token',
        serviceName: payload.sub,
      });

      return payload;
      
    } catch (error) {
      this.logger.warn('Service token validation failed', {
        component: 'service-auth',
        action: 'validate_failed',
      }, error as Error);
      
      throw new UnauthorizedError('Invalid service token');
    }
  }

  async getServiceToken(serviceName: string): Promise<string> {
    let token = this.serviceTokens.get(serviceName);
    
    if (!token || this.isTokenExpiringSoon(token)) {
      token = await this.generateServiceToken(serviceName);
    }
    
    return token;
  }

  private getServiceScopes(serviceName: string): string[] {
    const scopes = {
      'bg-identity-ai': [
        'identity:read',
        'identity:write', 
        'biometrics:process',
        'verification:manage',
        'templates:store',
      ],
      'bg-threat-ai': [
        'threat:read',
        'threat:write',
        'behavioral:analyze',
        'events:process',
        'responses:execute',
      ],
      'bg-ai-dashboard': [
        'ai:read',
        'metrics:read',
        'alerts:read',
        'reports:generate',
        'monitoring:access',
      ],
    };
    
    return scopes[serviceName as keyof typeof scopes] || [];
  }

  private scheduleTokenRefresh(serviceName: string): void {
    // Clear existing timer
    const existingTimer = this.tokenRefreshTimers.get(serviceName);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule refresh 10 minutes before expiration
    const refreshTimer = setTimeout(async () => {
      try {
        await this.generateServiceToken(serviceName);
      } catch (error) {
        this.logger.error('Token refresh failed', {
          component: 'service-auth',
          action: 'refresh_failed',
          serviceName,
        }, error as Error);
      }
    }, 50 * 60 * 1000); // 50 minutes

    this.tokenRefreshTimers.set(serviceName, refreshTimer);
  }
}
```

#### **📊 Day 18-21: Monitoring & Testing**

**8.1 Distributed Tracing Implementation**
```typescript
// bg-web/src/lib/monitoring/distributed-tracing.ts
export class DistributedTracing {
  constructor(
    private logger: Logger,
    private redis: Redis
  ) {}

  async createTrace(operationName: string, metadata?: Record<string, unknown>): Promise<TraceContext> {
    const traceId = generateTraceId();
    const spanId = generateSpanId();
    
    const context: TraceContext = {
      traceId,
      spanId,
      operationName,
      startTime: Date.now(),
      service: 'bg-web',
      metadata: metadata || {},
    };

    await this.storeSpan(context);
    
    this.logger.info('Trace started', {
      component: 'distributed-tracing',
      action: 'trace_started',
      traceId,
      spanId,
      operationName,
    });

    return context;
  }

  async createChildSpan(
    parentContext: TraceContext,
    operationName: string,
    metadata?: Record<string, unknown>
  ): Promise<TraceContext> {
    const childContext: TraceContext = {
      ...parentContext,
      spanId: generateSpanId(),
      parentSpanId: parentContext.spanId,
      operationName,
      startTime: Date.now(),
      metadata: metadata || {},
    };

    await this.storeSpan(childContext);
    
    return childContext;
  }

  async finishSpan(
    context: TraceContext, 
    result?: 'success' | 'error',
    error?: Error
  ): Promise<void> {
    const endTime = Date.now();
    const duration = endTime - context.startTime;

    const span: CompletedSpan = {
      ...context,
      endTime,
      duration,
      result: result || 'success',
      error: error?.message,
    };

    await this.storeCompletedSpan(span);

    this.logger.info('Span completed', {
      component: 'distributed-tracing',
      action: 'span_completed',
      traceId: context.traceId,
      spanId: context.spanId,
      duration,
      result,
    });

    // Send to external monitoring if configured
    if (process.env.JAEGER_ENDPOINT) {
      await this.sendToJaeger(span);
    }
  }

  async getTrace(traceId: string): Promise<CompletedSpan[]> {
    const spans = await this.redis.lrange(`trace:${traceId}`, 0, -1);
    return spans.map(span => JSON.parse(span));
  }

  private async storeSpan(context: TraceContext): Promise<void> {
    await this.redis.hset(`span:${context.spanId}`, {
      traceId: context.traceId,
      spanId: context.spanId,
      parentSpanId: context.parentSpanId || '',
      operationName: context.operationName,
      service: context.service,
      startTime: context.startTime,
      metadata: JSON.stringify(context.metadata),
    });

    // Set expiration (24 hours)
    await this.redis.expire(`span:${context.spanId}`, 86400);
  }
}
```

**8.2 Comprehensive Integration Tests**
```typescript
// tests/integration/ai-services-integration.test.ts
describe('AI Services Integration Tests', () => {
  let testServices: TestServiceManager;
  let apiGateway: APIGatewayClient;
  let eventBus: AIEventBus;

  beforeAll(async () => {
    // Start all services in test mode
    testServices = new TestServiceManager();
    await testServices.startAll();
    
    apiGateway = new APIGatewayClient('http://localhost:3000');
    eventBus = new AIEventBus(testRedis, testLogger);
  });

  afterAll(async () => {
    await testServices.stopAll();
  });

  describe('Service Discovery & Health', () => {
    it('should discover all AI services', async () => {
      const services = await apiGateway.getServiceRegistry();
      
      expect(services).toHaveProperty('identity');
      expect(services).toHaveProperty('threat');
      expect(services).toHaveProperty('dashboard');
      
      for (const service of Object.values(services)) {
        expect(service.status).toBe('healthy');
      }
    });

    it('should handle service failures gracefully', async () => {
      // Stop identity service
      await testServices.stop('bg-identity-ai');
      
      // Wait for health check to detect failure
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Request should fail gracefully with circuit breaker
      const result = await apiGateway.post('/api/ai/identity/verify', {
        userId: 'test-user',
        type: 'facial',
      });
      
      expect(result.error).toBe('Service temporarily unavailable');
      expect(result.status).toBe(503);
    });
  });

  describe('Inter-Service Authentication', () => {
    it('should authenticate between services', async () => {
      const token = await serviceAuth.generateServiceToken('bg-identity-ai');
      
      const response = await fetch('http://localhost:8001/test-auth', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      expect(response.ok).toBe(true);
      
      const result = await response.json();
      expect(result.authenticated).toBe(true);
      expect(result.service).toBe('bg-identity-ai');
    });

    it('should reject invalid tokens', async () => {
      const response = await fetch('http://localhost:8001/test-auth', {
        headers: {
          'Authorization': 'Bearer invalid-token',
        },
      });
      
      expect(response.status).toBe(401);
    });
  });

  describe('Event System', () => {
    it('should propagate events between services', async () => {
      const eventPromise = new Promise<AIEvent>((resolve) => {
        eventBus.subscribe('identity.verification.completed', resolve);
      });
      
      // Start verification through API gateway
      await apiGateway.post('/api/ai/identity/verify', {
        userId: 'test-user',
        type: 'facial',
        imageData: 'base64-test-image',
      });
      
      // Wait for completion event
      const event = await eventPromise;
      expect(event.type).toBe('identity.verification.completed');
      expect(event.data).toHaveProperty('userId', 'test-user');
    });

    it('should handle event processing failures', async () => {
      // Subscribe with failing handler
      const failingHandler = jest.fn().mockRejectedValue(new Error('Handler failed'));
      await eventBus.subscribe('test.event', failingHandler);
      
      // Publish event
      await eventBus.publish({
        id: generateId(),
        type: 'test.event',
        source: 'test',
        timestamp: new Date(),
        data: { test: true },
      });
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Handler should have been called but error logged
      expect(failingHandler).toHaveBeenCalled();
      // Error should be logged but not crash the system
    });
  });

  describe('Database Integration', () => {
    it('should store AI data in correct schemas', async () => {
      const verificationResult = await apiGateway.post('/api/ai/identity/verify', {
        userId: 'test-user',
        type: 'facial',
        imageData: 'base64-test-image',
      });
      
      // Check data was stored in ai_identity schema
      const sessions = await testDb.query(
        'SELECT * FROM ai_identity.verification_sessions WHERE user_id = $1',
        ['test-user']
      );
      
      expect(sessions.rows).toHaveLength(1);
      expect(sessions.rows[0].verification_type).toBe('facial');
    });

    it('should maintain data consistency across services', async () => {
      // Start identity verification
      const verificationResponse = await apiGateway.post('/api/ai/identity/verify', {
        userId: 'test-user',
        type: 'facial',
      });
      
      const sessionId = verificationResponse.data.sessionId;
      
      // Simulate threat detection during verification
      await apiGateway.post('/api/ai/threat/analyze', {
        userId: 'test-user',
        sessionId,
        eventType: 'suspicious_verification_attempt',
      });
      
      // Check both services recorded the session
      const identityRecord = await testDb.query(
        'SELECT * FROM ai_identity.verification_sessions WHERE session_token = $1',
        [sessionId]
      );
      
      const threatRecord = await testDb.query(
        'SELECT * FROM ai_threat.threat_events WHERE session_id = $1',
        [sessionId]
      );
      
      expect(identityRecord.rows).toHaveLength(1);
      expect(threatRecord.rows).toHaveLength(1);
    });
  });

  describe('Performance & Monitoring', () => {
    it('should track distributed traces across services', async () => {
      const traceId = generateTraceId();
      
      const response = await apiGateway.post('/api/ai/identity/verify', {
        userId: 'test-user',
        type: 'facial',
      }, {
        headers: {
          'X-Trace-ID': traceId,
        },
      });
      
      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check trace was collected
      const trace = await distributedTracing.getTrace(traceId);
      expect(trace.length).toBeGreaterThan(1);
      
      // Should have spans from multiple services
      const services = [...new Set(trace.map(span => span.service))];
      expect(services).toContain('bg-web');
      expect(services).toContain('bg-identity-ai');
    });

    it('should meet performance requirements', async () => {
      const startTime = Date.now();
      
      await apiGateway.post('/api/ai/identity/verify', {
        userId: 'test-user',
        type: 'facial',
        imageData: 'base64-test-image',
      });
      
      const duration = Date.now() - startTime;
      
      // Should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
    });
  });
});
```

---

## 🎯 **Phase 1 Success Criteria & Deliverables**

### **✅ Success Criteria**
- [ ] All 4 AI services start successfully with single `docker-compose up` command
- [ ] Services authenticate and communicate through API gateway with <200ms latency
- [ ] Event system propagates messages between services with 99.9% reliability
- [ ] Health monitoring detects service failures within 30 seconds
- [ ] Integration tests achieve 90%+ success rate across all scenarios
- [ ] Database schema supports AI operations with proper indexing and security
- [ ] Distributed tracing captures 100% of service interactions
- [ ] Development environment setup completed in <30 minutes by new developers

### **📦 Deliverables**
1. **4 New Containerized Services** with complete CI/CD pipelines
2. **Central API Gateway** in bg-web with service orchestration and circuit breakers
3. **Event-Driven Architecture** with Redis pub/sub message queue
4. **Secure Inter-Service Authentication** with JWT-based tokens and scope validation
5. **Extended Database Schema** with AI-specific tables, indexes, and row-level security
6. **Distributed Monitoring System** with tracing, health checks, and performance metrics
7. **Comprehensive Integration Test Suite** with 90%+ coverage of service interactions
8. **Complete Documentation** for architecture, deployment, and development workflows

### **🔧 Technical Artifacts**
- **Docker Configuration**: Multi-service docker-compose with networking and volumes
- **GitHub Actions Workflows**: Automated testing and deployment for each service
- **Database Migrations**: SQL scripts for AI schema creation and indexing
- **Monitoring Dashboards**: Service health and performance visualization
- **Security Policies**: JWT scopes, database RLS, and service communication protocols
- **Testing Framework**: Integration, performance, and reliability test suites

---

**🚀 READY FOR EXECUTION**: All planning complete, detailed implementation guide ready, team can begin immediately.

**Risk Level**: ⚠️ **LOW** - Building on proven Phase 3 foundation with incremental enhancements  
**Complexity**: 🔧 **MEDIUM** - Well-defined microservices patterns with established tools  
**Team Requirements**: 👥 **3-4 developers** (can work in parallel on different services)