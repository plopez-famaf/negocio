# Cyber SaaS Services - Project Structure & Requirements

## Overview

The services branch contains all backend microservices for the cybersecurity platform. Each service is designed to be independently deployable, scalable, and maintainable.

## Complete Services Structure

```
cyber-saas/services/
├── shared/                          # Shared libraries and utilities
│   ├── typescript/
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   │   ├── jwt.ts
│   │   │   │   ├── permissions.ts
│   │   │   │   └── middleware.ts
│   │   │   ├── database/
│   │   │   │   ├── client.ts
│   │   │   │   ├── migrations.ts
│   │   │   │   └── models.ts
│   │   │   ├── messaging/
│   │   │   │   ├── kafka.ts
│   │   │   │   ├── redis.ts
│   │   │   │   └── events.ts
│   │   │   ├── monitoring/
│   │   │   │   ├── logger.ts
│   │   │   │   ├── metrics.ts
│   │   │   │   └── tracing.ts
│   │   │   ├── utils/
│   │   │   │   ├── errors.ts
│   │   │   │   ├── validation.ts
│   │   │   │   └── crypto.ts
│   │   │   └── types/
│   │   │       ├── common.ts
│   │   │       ├── events.ts
│   │   │       └── api.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── python/
│   │   ├── cybersec_common/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── database.py
│   │   │   ├── messaging.py
│   │   │   ├── monitoring.py
│   │   │   └── utils.py
│   │   ├── setup.py
│   │   └── requirements.txt
│   └── go/
│       ├── pkg/
│       │   ├── auth/
│       │   ├── database/
│       │   ├── messaging/
│       │   └── monitoring/
│       └── go.mod
│
├── auth/                            # Authentication & Authorization Service
│   ├── src/
│   │   ├── index.ts
│   │   ├── server.ts
│   │   ├── config/
│   │   │   ├── index.ts
│   │   │   └── database.ts
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── organizations.controller.ts
│   │   │   └── permissions.controller.ts
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   ├── token.service.ts
│   │   │   ├── user.service.ts
│   │   │   └── organization.service.ts
│   │   ├── models/
│   │   │   ├── user.model.ts
│   │   │   ├── organization.model.ts
│   │   │   ├── session.model.ts
│   │   │   └── role.model.ts
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── rate-limit.middleware.ts
│   │   │   └── validation.middleware.ts
│   │   ├── routes/
│   │   │   ├── index.ts
│   │   │   ├── auth.routes.ts
│   │   │   └── admin.routes.ts
│   │   ├── utils/
│   │   │   ├── password.ts
│   │   │   ├── otp.ts
│   │   │   └── email.ts
│   │   └── types/
│   │       └── index.ts
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── fixtures/
│   ├── migrations/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── README.md
│
├── ingestion/                       # High-Performance Data Ingestion Service
│   ├── cmd/
│   │   └── server/
│   │       └── main.go
│   ├── internal/
│   │   ├── api/
│   │   │   ├── grpc/
│   │   │   │   ├── server.go
│   │   │   │   └── handlers.go
│   │   │   └── rest/
│   │   │       ├── server.go
│   │   │       ├── handlers.go
│   │   │       └── middleware.go
│   │   ├── collector/
│   │   │   ├── agent.go
│   │   │   ├── webhook.go
│   │   │   ├── syslog.go
│   │   │   └── cloud.go
│   │   ├── processor/
│   │   │   ├── pipeline.go
│   │   │   ├── validator.go
│   │   │   ├── enricher.go
│   │   │   ├── normalizer.go
│   │   │   └── router.go
│   │   ├── storage/
│   │   │   ├── writer.go
│   │   │   ├── timeseries.go
│   │   │   ├── queue.go
│   │   │   └── batch.go
│   │   ├── tenant/
│   │   │   ├── context.go
│   │   │   ├── limiter.go
│   │   │   └── quota.go
│   │   └── config/
│   │       └── config.go
│   ├── pkg/
│   │   ├── protocol/
│   │   │   ├── event.go
│   │   │   └── schema.go
│   │   ├── compression/
│   │   │   └── compress.go
│   │   └── metrics/
│   │       └── collector.go
│   ├── proto/
│   │   └── ingestion.proto
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── load/
│   ├── scripts/
│   │   └── generate-proto.sh
│   ├── Dockerfile
│   ├── go.mod
│   ├── go.sum
│   ├── .env.example
│   └── README.md
│
├── detection/                       # Threat Detection & Analysis Engine
│   ├── src/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── server.py
│   │   │   ├── routes.py
│   │   │   └── schemas.py
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── engine.py
│   │   │   ├── scheduler.py
│   │   │   └── context.py
│   │   ├── detectors/
│   │   │   ├── __init__.py
│   │   │   ├── base.py
│   │   │   ├── rules/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── rule_engine.py
│   │   │   │   ├── mitre_attack.py
│   │   │   │   ├── suspicious_process.py
│   │   │   │   ├── network_anomaly.py
│   │   │   │   └── privilege_escalation.py
│   │   │   ├── ml/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── anomaly_detector.py
│   │   │   │   ├── behavior_analysis.py
│   │   │   │   ├── models/
│   │   │   │   │   ├── autoencoder.py
│   │   │   │   │   └── isolation_forest.py
│   │   │   │   └── feature_extraction.py
│   │   │   └── correlation/
│   │   │       ├── __init__.py
│   │   │       ├── event_correlator.py
│   │   │       └── timeline_builder.py
│   │   ├── processors/
│   │   │   ├── __init__.py
│   │   │   ├── stream_processor.py
│   │   │   ├── batch_processor.py
│   │   │   └── event_enricher.py
│   │   ├── integrations/
│   │   │   ├── __init__.py
│   │   │   ├── threat_intel.py
│   │   │   ├── ioc_matcher.py
│   │   │   └── misp_client.py
│   │   ├── storage/
│   │   │   ├── __init__.py
│   │   │   ├── event_store.py
│   │   │   ├── rule_store.py
│   │   │   └── cache.py
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── logger.py
│   │       ├── metrics.py
│   │       └── helpers.py
│   ├── rules/
│   │   ├── default/
│   │   │   ├── windows.yaml
│   │   │   ├── linux.yaml
│   │   │   └── network.yaml
│   │   └── custom/
│   ├── models/
│   │   └── pretrained/
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── fixtures/
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── .env.example
│   └── README.md
│
├── analytics/                       # Analytics & Reporting Service
│   ├── src/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── app.py
│   │   │   ├── routes/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── reports.py
│   │   │   │   ├── dashboards.py
│   │   │   │   ├── metrics.py
│   │   │   │   └── export.py
│   │   │   └── schemas/
│   │   │       ├── __init__.py
│   │   │       ├── report.py
│   │   │       └── metric.py
│   │   ├── analytics/
│   │   │   ├── __init__.py
│   │   │   ├── aggregator.py
│   │   │   ├── calculator.py
│   │   │   ├── trend_analyzer.py
│   │   │   └── risk_scorer.py
│   │   ├── reports/
│   │   │   ├── __init__.py
│   │   │   ├── generator.py
│   │   │   ├── templates/
│   │   │   │   ├── executive_summary.py
│   │   │   │   ├── compliance_report.py
│   │   │   │   ├── incident_report.py
│   │   │   │   └── threat_landscape.py
│   │   │   └── scheduler.py
│   │   ├── queries/
│   │   │   ├── __init__.py
│   │   │   ├── timeseries.py
│   │   │   ├── aggregations.py
│   │   │   └── sql/
│   │   │       ├── dashboards.sql
│   │   │       └── reports.sql
│   │   ├── export/
│   │   │   ├── __init__.py
│   │   │   ├── pdf_generator.py
│   │   │   ├── csv_exporter.py
│   │   │   └── templates/
│   │   └── storage/
│   │       ├── __init__.py
│   │       ├── cache.py
│   │       └── repository.py
│   ├── tests/
│   ├── requirements.txt
│   ├── Dockerfile
│   └── README.md
│
├── alerts/                          # Alert Management & Notification Service
│   ├── src/
│   │   ├── index.ts
│   │   ├── server.ts
│   │   ├── config/
│   │   │   └── index.ts
│   │   ├── controllers/
│   │   │   ├── alerts.controller.ts
│   │   │   ├── rules.controller.ts
│   │   │   └── incidents.controller.ts
│   │   ├── services/
│   │   │   ├── alert.service.ts
│   │   │   ├── notification.service.ts
│   │   │   ├── escalation.service.ts
│   │   │   └── incident.service.ts
│   │   ├── processors/
│   │   │   ├── alert-processor.ts
│   │   │   ├── deduplication.ts
│   │   │   ├── grouping.ts
│   │   │   └── enrichment.ts
│   │   ├── channels/
│   │   │   ├── email.channel.ts
│   │   │   ├── sms.channel.ts
│   │   │   ├── slack.channel.ts
│   │   │   ├── teams.channel.ts
│   │   │   ├── webhook.channel.ts
│   │   │   └── mobile.channel.ts
│   │   ├── models/
│   │   │   ├── alert.model.ts
│   │   │   ├── rule.model.ts
│   │   │   ├── incident.model.ts
│   │   │   └── notification.model.ts
│   │   ├── queues/
│   │   │   ├── alert.queue.ts
│   │   │   └── notification.queue.ts
│   │   └── templates/
│   │       ├── email/
│   │       └── slack/
│   ├── tests/
│   ├── package.json
│   ├── Dockerfile
│   └── README.md
│
├── billing/                         # Billing & Subscription Management
│   ├── src/
│   │   ├── index.ts
│   │   ├── server.ts
│   │   ├── config/
│   │   │   ├── index.ts
│   │   │   └── stripe.ts
│   │   ├── controllers/
│   │   │   ├── subscription.controller.ts
│   │   │   ├── invoice.controller.ts
│   │   │   ├── usage.controller.ts
│   │   │   └── webhook.controller.ts
│   │   ├── services/
│   │   │   ├── subscription.service.ts
│   │   │   ├── billing.service.ts
│   │   │   ├── usage.service.ts
│   │   │   └── payment.service.ts
│   │   ├── models/
│   │   │   ├── subscription.model.ts
│   │   │   ├── invoice.model.ts
│   │   │   ├── usage.model.ts
│   │   │   └── payment.model.ts
│   │   ├── jobs/
│   │   │   ├── usage-calculator.ts
│   │   │   ├── invoice-generator.ts
│   │   │   └── payment-retry.ts
│   │   ├── integrations/
│   │   │   ├── stripe.client.ts
│   │   │   └── tax.service.ts
│   │   └── utils/
│   │       ├── pricing.ts
│   │       └── metering.ts
│   ├── tests/
│   ├── package.json
│   ├── Dockerfile
│   └── README.md
│
├── scheduler/                       # Job Scheduling & Task Management
│   ├── src/
│   │   ├── index.ts
│   │   ├── server.ts
│   │   ├── config/
│   │   ├── jobs/
│   │   │   ├── report-generation.ts
│   │   │   ├── data-retention.ts
│   │   │   ├── model-training.ts
│   │   │   ├── backup.ts
│   │   │   └── health-check.ts
│   │   ├── scheduler/
│   │   │   ├── cron-scheduler.ts
│   │   │   ├── job-manager.ts
│   │   │   └── worker-pool.ts
│   │   ├── models/
│   │   │   ├── job.model.ts
│   │   │   └── schedule.model.ts
│   │   └── monitoring/
│   │       └── job-metrics.ts
│   ├── package.json
│   ├── Dockerfile
│   └── README.md
│
├── gateway/                         # API Gateway Service
│   ├── src/
│   │   ├── index.ts
│   │   ├── server.ts
│   │   ├── config/
│   │   │   ├── routes.ts
│   │   │   └── services.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   ├── rate-limit.ts
│   │   │   ├── cors.ts
│   │   │   ├── logging.ts
│   │   │   └── error-handler.ts
│   │   ├── proxy/
│   │   │   ├── http-proxy.ts
│   │   │   ├── grpc-proxy.ts
│   │   │   └── websocket-proxy.ts
│   │   ├── routes/
│   │   │   └── index.ts
│   │   └── utils/
│   │       ├── circuit-breaker.ts
│   │       └── load-balancer.ts
│   ├── package.json
│   ├── Dockerfile
│   └── README.md
│
├── integration/                     # Third-Party Integration Service
│   ├── src/
│   │   ├── index.ts
│   │   ├── server.ts
│   │   ├── connectors/
│   │   │   ├── aws/
│   │   │   │   ├── cloudtrail.ts
│   │   │   │   ├── guardduty.ts
│   │   │   │   └── security-hub.ts
│   │   │   ├── azure/
│   │   │   │   ├── sentinel.ts
│   │   │   │   └── activity-logs.ts
│   │   │   ├── google/
│   │   │   │   └── chronicle.ts
│   │   │   ├── office365/
│   │   │   │   └── management-api.ts
│   │   │   ├── siem/
│   │   │   │   ├── splunk.ts
│   │   │   │   └── elastic.ts
│   │   │   └── ticketing/
│   │   │       ├── jira.ts
│   │   │       └── servicenow.ts
│   │   ├── mappers/
│   │   │   ├── event-mapper.ts
│   │   │   └── field-mapper.ts
│   │   ├── sync/
│   │   │   ├── sync-manager.ts
│   │   │   └── sync-scheduler.ts
│   │   └── models/
│   │       └── integration.model.ts
│   ├── package.json
│   ├── Dockerfile
│   └── README.md
│
├── websocket/                       # Real-time WebSocket Service
│   ├── src/
│   │   ├── index.ts
│   │   ├── server.ts
│   │   ├── handlers/
│   │   │   ├── connection.handler.ts
│   │   │   ├── subscription.handler.ts
│   │   │   └── message.handler.ts
│   │   ├── rooms/
│   │   │   ├── room-manager.ts
│   │   │   └── organization-room.ts
│   │   ├── middleware/
│   │   │   └── auth.middleware.ts
│   │   └── events/
│   │       ├── event-emitter.ts
│   │       └── event-types.ts
│   ├── package.json
│   ├── Dockerfile
│   └── README.md
│
├── ml-training/                     # ML Model Training Service
│   ├── src/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── training/
│   │   │   ├── __init__.py
│   │   │   ├── trainer.py
│   │   │   ├── pipelines/
│   │   │   │   ├── anomaly_detection.py
│   │   │   │   ├── threat_classification.py
│   │   │   │   └── behavior_analysis.py
│   │   │   └── evaluation.py
│   │   ├── data/
│   │   │   ├── __init__.py
│   │   │   ├── loader.py
│   │   │   ├── preprocessor.py
│   │   │   └── augmentation.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── registry.py
│   │   │   └── versioning.py
│   │   └── serving/
│   │       ├── __init__.py
│   │       └── model_server.py
│   ├── notebooks/
│   │   ├── exploratory/
│   │   └── experiments/
│   ├── requirements.txt
│   ├── Dockerfile
│   └── README.md
│
├── docker-compose.yml               # Development environment
├── docker-compose.prod.yml          # Production environment
├── Makefile                         # Common commands
└── README.md                        # Services documentation
```

## Service Requirements & Specifications

### 1. Auth Service (Node.js/TypeScript)

**Purpose**: Handle authentication, authorization, and user management

**Key Requirements**:
- JWT token generation and validation
- OAuth2/OIDC support (Google, Microsoft)
- Multi-factor authentication (TOTP, SMS)
- RBAC with dynamic permissions
- Session management with Redis
- Password policies and rotation
- API key management
- SAML 2.0 for enterprise SSO

**Technical Stack**:
- Framework: Express.js or Fastify
- Database: PostgreSQL with TypeORM
- Cache: Redis for sessions
- Auth Libraries: Passport.js, node-jsonwebtoken
- Email: SendGrid for notifications

**API Endpoints**:
```
POST   /auth/login
POST   /auth/logout
POST   /auth/refresh
POST   /auth/register
POST   /auth/forgot-password
POST   /auth/reset-password
POST   /auth/verify-email
POST   /auth/mfa/enable
POST   /auth/mfa/verify
GET    /auth/me
PUT    /auth/profile
GET    /auth/sessions
DELETE /auth/sessions/:id
```

### 2. Ingestion Service (Go)

**Purpose**: High-performance event collection and initial processing

**Key Requirements**:
- Handle 100K+ events/second
- Multi-protocol support (HTTP, gRPC, Syslog)
- Schema validation with protobuf
- Data compression (LZ4, Snappy)
- Tenant-based rate limiting
- Batch processing for efficiency
- Dead letter queue for failed events
- Metrics and monitoring

**Technical Stack**:
- Framework: Native Go with gorilla/mux or gin
- Message Queue: Kafka or Redis Streams
- Storage: TimescaleDB for time-series
- Monitoring: Prometheus metrics

**Interfaces**:
```protobuf
service IngestionService {
  rpc SendEvent(Event) returns (EventResponse);
  rpc SendBatch(EventBatch) returns (BatchResponse);
  rpc StreamEvents(stream Event) returns (StreamResponse);
}

message Event {
  string id = 1;
  string organization_id = 2;
  google.protobuf.Timestamp timestamp = 3;
  string type = 4;
  string severity = 5;
  string source = 6;
  google.protobuf.Struct data = 7;
}
```

### 3. Detection Service (Python)

**Purpose**: Real-time threat detection and analysis

**Key Requirements**:
- Rule-based detection engine
- ML-based anomaly detection
- MITRE ATT&CK framework mapping
- Custom detection rules (YAML/Sigma)
- Event correlation and timeline building
- Integration with threat intelligence feeds
- Low-latency processing (<1 minute)
- Model versioning and A/B testing

**Technical Stack**:
- Framework: FastAPI
- ML Libraries: scikit-learn, TensorFlow/PyTorch
- Message Queue: Kafka consumer
- Cache: Redis for hot data
- Rule Engine: Custom or Rules engines

**Detection Types**:
```yaml
# Example detection rule
title: Suspicious PowerShell Execution
id: ae7fbf8e-f3cb-49fd-8db4-5f3bed522c71
status: production
description: Detects suspicious PowerShell execution patterns
references:
    - https://attack.mitre.org/techniques/T1059/001/
tags:
    - attack.execution
    - attack.t1059.001
detection:
    selection:
        EventID: 4688
        NewProcessName|endswith: '\powershell.exe'
        CommandLine|contains|all:
            - '-nop'
            - '-w hidden'
            - '-enc'
    condition: selection
falsepositives:
    - Administrative scripts
level: high
```

### 4. Analytics Service (Python)

**Purpose**: Data aggregation, reporting, and business intelligence

**Key Requirements**:
- Scheduled report generation
- Real-time dashboard queries
- Compliance report templates (PCI, HIPAA)
- Trend analysis and forecasting
- Risk scoring algorithms
- Data export capabilities (PDF, CSV)
- Caching for expensive queries
- Multi-tenant data isolation

**Technical Stack**:
- Framework: FastAPI
- Query Engine: SQLAlchemy with TimescaleDB
- Report Generation: ReportLab (PDF), Jinja2
- Cache: Redis with TTL
- Task Queue: Celery for async jobs

**Report Types**:
- Executive Summary (weekly/monthly)
- Compliance Reports (PCI-DSS, HIPAA)
- Incident Reports
- Threat Landscape Analysis
- Security Posture Assessment
- Asset Inventory Reports

### 5. Alerts Service (Node.js/TypeScript)

**Purpose**: Alert management, routing, and incident handling

**Key Requirements**:
- Multi-channel notifications (Email, SMS, Slack, etc.)
- Alert deduplication and grouping
- Escalation policies
- On-call scheduling
- Alert suppression windows
- Template management
- Delivery tracking and retry
- Integration with ticketing systems

**Technical Stack**:
- Framework: Express.js with Bull queue
- Database: PostgreSQL
- Queue: Redis with Bull
- Notifications: SendGrid, Twilio, Slack SDK

**Alert Flow**:
```typescript
interface Alert {
  id: string;
  organizationId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  source: string;
  timestamp: Date;
  metadata: Record<string, any>;
  status: 'new' | 'acknowledged' | 'resolved';
}

interface AlertRule {
  id: string;
  name: string;
  conditions: Condition[];
  actions: Action[];
  schedule?: Schedule;
  enabled: boolean;
}
```

### 6. Billing Service (Node.js/TypeScript)

**Purpose**: Subscription management and usage tracking

**Key Requirements**:
- Stripe integration for payments
- Usage-based billing support
- Subscription lifecycle management
- Invoice generation
- Payment retry logic
- Dunning management
- Tax calculation
- Revenue recognition
- Webhooks for payment events

**Technical Stack**:
- Framework: Express.js
- Payment: Stripe SDK
- Database: PostgreSQL
- Queue: Bull for async jobs
- Monitoring: Custom metrics

**Billing Models**:
```typescript
interface Subscription {
  id: string;
  organizationId: string;
  planId: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

interface UsageRecord {
  subscriptionId: string;
  metric: 'events' | 'users' | 'assets';
  quantity: number;
  timestamp: Date;
}
```

### 7. Gateway Service (Node.js/TypeScript)

**Purpose**: API gateway for routing and cross-cutting concerns

**Key Requirements**:
- Request routing to microservices
- Authentication/authorization
- Rate limiting per tenant
- Request/response transformation
- Circuit breaker pattern
- Load balancing
- API versioning
- Request logging and tracing

**Technical Stack**:
- Framework: Express.js or Fastify
- Proxy: http-proxy-middleware
- Cache: Redis for rate limiting
- Monitoring: OpenTelemetry

### 8. Integration Service (Node.js/TypeScript)

**Purpose**: Third-party service integrations

**Key Requirements**:
- Cloud provider integrations (AWS, Azure, GCP)
- SIEM integrations (Splunk, Elastic)
- Ticketing system sync (Jira, ServiceNow)
- OAuth2 token management
- Webhook receivers
- Data transformation and mapping
- Retry logic with exponential backoff
- Integration health monitoring

**Supported Integrations**:
- AWS: CloudTrail, GuardDuty, Security Hub
- Azure: Sentinel, Activity Logs
- Google: Chronicle, Cloud Audit Logs
- Office 365: Management API
- Slack/Teams: Notifications
- SIEM: Splunk, Elastic, QRadar
- Ticketing: Jira, ServiceNow, PagerDuty

### 9. WebSocket Service (Node.js/TypeScript)

**Purpose**: Real-time bidirectional communication

**Key Requirements**:
- WebSocket connection management
- Room-based subscriptions
- Event broadcasting
- Connection authentication
- Heartbeat/keepalive
- Horizontal scaling with Redis pub/sub
- Message delivery guarantees
- Bandwidth optimization

**Technical Stack**:
- Framework: Socket.io or native ws
- Scaling: Redis adapter
- Authentication: JWT tokens

**Event Types**:
```typescript
enum EventType {
  ALERT_CREATED = 'alert.created',
  ALERT_UPDATED = 'alert.updated',
  INCIDENT_CREATED = 'incident.created',
  THREAT_DETECTED = 'threat.detected',
  SYSTEM_STATUS = 'system.status',
  DASHBOARD_UPDATE = 'dashboard.update'
}
```

### 10. ML Training Service (Python)

**Purpose**: Train and update ML models

**Key Requirements**:
- Automated model training pipelines
- Hyperparameter tuning
- Model versioning and registry
- A/B testing framework
- Feature engineering pipelines
- Model evaluation and metrics
- Distributed training support
- Model serving preparation

**Technical Stack**:
- Framework: FastAPI + Celery
- ML: scikit-learn, TensorFlow, PyTorch
- MLOps: MLflow or Kubeflow
- Storage: S3 for models
- Compute: GPU support for deep learning

**Training Pipelines**:
```python
class TrainingPipeline:
    def __init__(self, config: TrainingConfig):
        self.config = config
        self.model_registry = ModelRegistry()
    
    async def train_anomaly_detector(self, 
                                   organization_id: str,
                                   training_data: DataFrame):
        # Feature engineering
        features = self.extract_features(training_data)
        
        # Model training
        model = IsolationForest(
            n_estimators=self.config.n_estimators,
            contamination=self.config.contamination
        )
        model.fit(features)
        
        # Evaluation
        metrics = self.evaluate_model(model, features)
        
        # Register model
        model_version = await self.model_registry.register(
            model=model,
            organization_id=organization_id,
            metrics=metrics,
            features=features.columns.tolist()
        )
        
        return model_version
```

### 11. Scheduler Service (Node.js/TypeScript)

**Purpose**: Cron jobs and scheduled tasks

**Key Requirements**:
- Cron expression support
- Job persistence and recovery
- Distributed job execution
- Job dependencies
- Retry policies
- Job monitoring and alerting
- Resource management
- Job history and logs

**Scheduled Jobs**:
- Report generation (daily/weekly/monthly)
- Data retention and cleanup
- Model retraining
- Backup operations
- Health checks
- Certificate renewal
- Usage calculation

## Shared Libraries Requirements

### TypeScript Shared Library

```typescript
// shared/typescript/src/auth/jwt.ts
export interface JWTPayload {
  sub: string;           // User ID
  org: string;           // Organization ID
  role: string;          // User role
  permissions: string[]; // Permissions array
  exp: number;          // Expiration
}

export class JWTService {
  private readonly secret: string;
  
  async sign(payload: JWTPayload): Promise<string> {}
  async verify(token: string): Promise<JWTPayload> {}
  async refresh(token: string): Promise<string> {}
}

// shared/typescript/src/database/client.ts
export class DatabaseClient {
  private pool: Pool;
  
  async query<T>(sql: string, params?: any[]): Promise<T[]> {}
  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {}
  async migrate(): Promise<void> {}
}

// shared/typescript/src/monitoring/logger.ts
export interface Logger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, error?: Error, meta?: any): void;
  debug(message: string, meta?: any): void;
}

// shared/typescript/src/types/events.ts
export interface SecurityEvent {
  id: string;
  organizationId: string;
  timestamp: Date;
  type: EventType;
  severity: Severity;
  source: string;
  data: Record<string, any>;
  metadata?: EventMetadata;
}

export enum EventType {
  AUTHENTICATION = 'authentication',
  NETWORK_TRAFFIC = 'network_traffic',
  FILE_ACCESS = 'file_access',
  PROCESS_EXECUTION = 'process_execution',
  CONFIGURATION_CHANGE = 'configuration_change'
}

export enum Severity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}
```

### Python Shared Library

```python
# shared/python/cybersec_common/auth.py
from typing import Dict, List, Optional
import jwt
from datetime import datetime, timedelta

class JWTService:
    def __init__(self, secret: str):
        self.secret = secret
    
    def sign(self, payload: Dict) -> str:
        """Sign JWT token"""
        return jwt.encode(payload, self.secret, algorithm='HS256')
    
    def verify(self, token: str) -> Dict:
        """Verify and decode JWT token"""
        return jwt.decode(token, self.secret, algorithms=['HS256'])

# shared/python/cybersec_common/database.py
from contextlib import asynccontextmanager
import asyncpg
from typing import List, Dict, Any

class DatabaseClient:
    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self.pool = None
    
    async def connect(self):
        self.pool = await asyncpg.create_pool(self.connection_string)
    
    async def execute(self, query: str, *args) -> str:
        async with self.pool.acquire() as conn:
            return await conn.execute(query, *args)
    
    @asynccontextmanager
    async def transaction(self):
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                yield conn

# shared/python/cybersec_common/monitoring.py
import logging
import json
from datetime import datetime
from pythonjsonlogger import jsonlogger

def setup_logger(name: str, level: str = 'INFO') -> logging.Logger:
    """Setup structured JSON logger"""
    logger = logging.getLogger(name)
    handler = logging.StreamHandler()
    formatter = jsonlogger.JsonFormatter()
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(level)
    return logger

class MetricsCollector:
    def __init__(self, service_name: str):
        self.service_name = service_name
    
    def increment(self, metric: str, value: int = 1, tags: Dict = None):
        """Increment a counter metric"""
        pass
    
    def gauge(self, metric: str, value: float, tags: Dict = None):
        """Set a gauge metric"""
        pass
    
    def histogram(self, metric: str, value: float, tags: Dict = None):
        """Record a histogram metric"""
        pass
```

### Go Shared Package

```go
// shared/go/pkg/auth/jwt.go
package auth

import (
    "time"
    "github.com/golang-jwt/jwt/v4"
)

type Claims struct {
    UserID         string   `json:"sub"`
    OrganizationID string   `json:"org"`
    Role           string   `json:"role"`
    Permissions    []string `json:"permissions"`
    jwt.RegisteredClaims
}

type JWTService struct {
    secret []byte
}

func NewJWTService(secret string) *JWTService {
    return &JWTService{secret: []byte(secret)}
}

func (s *JWTService) GenerateToken(claims *Claims) (string, error) {
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString(s.secret)
}

func (s *JWTService) ValidateToken(tokenString string) (*Claims, error) {
    token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
        return s.secret, nil
    })
    
    if err != nil {
        return nil, err
    }
    
    if claims, ok := token.Claims.(*Claims); ok && token.Valid {
        return claims, nil
    }
    
    return nil, jwt.ErrSignatureInvalid
}

// shared/go/pkg/monitoring/metrics.go
package monitoring

import (
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promauto"
)

type Metrics struct {
    RequestsTotal   *prometheus.CounterVec
    RequestDuration *prometheus.HistogramVec
    ActiveRequests  *prometheus.GaugeVec
}

func NewMetrics(namespace, service string) *Metrics {
    return &Metrics{
        RequestsTotal: promauto.NewCounterVec(
            prometheus.CounterOpts{
                Namespace: namespace,
                Subsystem: service,
                Name:      "requests_total",
                Help:      "Total number of requests",
            },
            []string{"method", "endpoint", "status"},
        ),
        RequestDuration: promauto.NewHistogramVec(
            prometheus.HistogramOpts{
                Namespace: namespace,
                Subsystem: service,
                Name:      "request_duration_seconds",
                Help:      "Request duration in seconds",
                Buckets:   prometheus.DefBuckets,
            },
            []string{"method", "endpoint"},
        ),
        ActiveRequests: promauto.NewGaugeVec(
            prometheus.GaugeOpts{
                Namespace: namespace,
                Subsystem: service,
                Name:      "active_requests",
                Help:      "Number of active requests",
            },
            []string{"method", "endpoint"},
        ),
    }
}
```

## Development Environment Setup

### docker-compose.yml
```yaml
version: '3.8'

services:
  # Databases
  postgres:
    image: timescale/timescaledb:latest-pg15
    environment:
      POSTGRES_DB: cybersec_platform
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  # Message Queue
  kafka:
    image: confluentinc/cp-kafka:latest
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1

  zookeeper:
    image: confluentinc/cp-zookeeper:latest
    ports:
      - "2181:2181"
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000

  # Services
  auth:
    build: ./auth
    ports:
      - "3001:3000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/cybersec_platform
      REDIS_URL: redis://redis:6379
      JWT_SECRET: devsecret
    depends_on:
      - postgres
      - redis

  ingestion:
    build: ./ingestion
    ports:
      - "8080:8080"
      - "50051:50051"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/cybersec_platform
      KAFKA_BROKERS: kafka:9092
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - kafka
      - redis

  detection:
    build: ./detection
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/cybersec_platform
      KAFKA_BROKERS: kafka:9092
      REDIS_URL: redis://redis:6379
      MODEL_PATH: /models
    volumes:
      - ./detection/models:/models
    depends_on:
      - postgres
      - kafka
      - redis

  analytics:
    build: ./analytics
    ports:
      - "3003:3000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/cybersec_platform
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis

  alerts:
    build: ./alerts
    ports:
      - "3004:3000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/cybersec_platform
      REDIS_URL: redis://redis:6379
      KAFKA_BROKERS: kafka:9092
    depends_on:
      - postgres
      - redis
      - kafka

  # Monitoring
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards

volumes:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:
```

### Makefile
```makefile
.PHONY: help
help:
	@echo "Available commands:"
	@echo "  make setup        - Initial setup"
	@echo "  make dev         - Start development environment"
	@echo "  make test        - Run all tests"
	@echo "  make build       - Build all services"
	@echo "  make clean       - Clean up resources"

.PHONY: setup
setup:
	@echo "Setting up development environment..."
	@docker-compose pull
	@echo "Installing dependencies..."
	@$(MAKE) -C auth setup
	@$(MAKE) -C ingestion setup
	@$(MAKE) -C detection setup
	@$(MAKE) -C analytics setup
	@$(MAKE) -C alerts setup
	@echo "Setup complete!"

.PHONY: dev
dev:
	@echo "Starting development environment..."
	@docker-compose up -d postgres redis kafka
	@echo "Waiting for services..."
	@sleep 10
	@echo "Running migrations..."
	@$(MAKE) -C auth migrate
	@echo "Starting services..."
	@docker-compose up

.PHONY: test
test:
	@echo "Running tests..."
	@$(MAKE) -C auth test
	@$(MAKE) -C ingestion test
	@$(MAKE) -C detection test
	@$(MAKE) -C analytics test
	@$(MAKE) -C alerts test

.PHONY: build
build:
	@echo "Building services..."
	@docker-compose build

.PHONY: clean
clean:
	@echo "Cleaning up..."
	@docker-compose down -v
	@docker system prune -f
```

## Service Communication Patterns

### Event-Driven Architecture
```yaml
Event Flows:
  Security Event:
    1. Agent/Sensor → Ingestion Service (HTTP/gRPC)
    2. Ingestion → Kafka (raw-events topic)
    3. Detection Service → Kafka Consumer
    4. Detection → Kafka (alerts topic)
    5. Alerts Service → Kafka Consumer
    6. Alerts → Notification Channels

  Analytics Request:
    1. Dashboard → Gateway → Analytics Service
    2. Analytics → TimescaleDB (query)
    3. Analytics → Redis (cache)
    4. Analytics → Dashboard (response)

Topics:
  - raw-events: Raw security events
  - processed-events: Enriched events
  - alerts: Security alerts
  - incidents: Security incidents
  - metrics: System metrics
  - audit-logs: Audit trail
```

### Service Dependencies
```yaml
Auth Service:
  Depends on:
    - PostgreSQL (user data)
    - Redis (sessions)
  Used by:
    - All other services (JWT validation)

Ingestion Service:
  Depends on:
    - Kafka (event publishing)
    - TimescaleDB (storage)
    - Redis (rate limiting)
  Used by:
    - Agents and sensors

Detection Service:
  Depends on:
    - Kafka (event consumption)
    - Redis (hot data cache)
    - ML Models (S3/local)
  Produces:
    - Alerts to Kafka

Analytics Service:
  Depends on:
    - TimescaleDB (queries)
    - Redis (cache)
  Used by:
    - Dashboard
    - Scheduler (reports)

Alerts Service:
  Depends on:
    - Kafka (alert consumption)
    - PostgreSQL (rules)
    - External APIs (notifications)
  Integrates with:
    - Email (SendGrid)
    - SMS (Twilio)
    - Slack/Teams
```

## Testing Strategy

### Unit Testing
```typescript
// Example: Auth Service Test
describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepo: jest.Mocked<UserRepository>;
  
  beforeEach(() => {
    mockUserRepo = createMockRepository();
    authService = new AuthService(mockUserRepo);
  });
  
  describe('login', () => {
    it('should return JWT token for valid credentials', async () => {
      const user = { id: '123', email: 'test@example.com', password: 'hashed' };
      mockUserRepo.findByEmail.mockResolvedValue(user);
      
      const result = await authService.login('test@example.com', 'password');
      
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('refreshToken');
    });
  });
});
```

### Integration Testing
```python
# Example: Detection Service Test
import pytest
from fastapi.testclient import TestClient
from src.main import app
from src.detectors.rules import RuleEngine

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def sample_event():
    return {
        "id": "test-123",
        "organization_id": "org-123",
        "type": "process_execution",
        "data": {
            "process_name": "powershell.exe",
            "command_line": "-nop -w hidden -enc SGVsbG8gV29ybGQ="
        }
    }

def test_detect_suspicious_powershell(client, sample_event):
    response = client.post("/detect", json=sample_event)
    assert response.status_code == 200
    
    result = response.json()
    assert result["detected"] == True
    assert result["severity"] == "high"
    assert "T1059.001" in result["mitre_tactics"]
```

### Load Testing
```yaml
# k6 load test script
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 1000 },
    { duration: '2m', target: 0 },
  ],
};

export default function () {
  const payload = JSON.stringify({
    type: 'network_traffic',
    source: 'firewall',
    data: {
      src_ip: '192.168.1.100',
      dst_ip: '10.0.0.1',
      bytes: 1024,
    },
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ${__ENV.API_TOKEN}',
    },
  };

  const res = http.post('http://localhost:8080/api/events', payload, params);
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

## Deployment Considerations

### Container Optimization
```dockerfile
# Example: Multi-stage build for Go service
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main ./cmd/server

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/main .
COPY --from=builder /app/configs ./configs
EXPOSE 8080 50051
CMD ["./main"]
```

### Resource Requirements
```yaml
Service Resource Allocation:
  Auth Service:
    CPU: 0.5-1 core
    Memory: 512MB-1GB
    Replicas: 2-3
    
  Ingestion Service:
    CPU: 2-4 cores
    Memory: 2-4GB
    Replicas: 3-10 (auto-scaling)
    
  Detection Service:
    CPU: 2-4 cores
    Memory: 4-8GB
    GPU: Optional for ML
    Replicas: 2-5
    
  Analytics Service:
    CPU: 1-2 cores
    Memory: 2-4GB
    Replicas: 2-3
    
  Alerts Service:
    CPU: 0.5-1 core
    Memory: 512MB-1GB
    Replicas: 2-3
```

This comprehensive structure provides a solid foundation for building a scalable, maintainable microservices architecture for the cybersecurity SaaS platform. Each service is designed to be independently deployable with clear interfaces and responsibilities.