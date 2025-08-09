# Service Implementation Guide
## Console-First Threat Detection Platform

**Target Audience:** Platform Developers, DevOps Engineers, and Security Architects  
**Focus:** Practical implementation patterns and console-first design principles  
**Last Updated:** August 2025

---

## Table of Contents
1. [Console-First Design Philosophy](#console-first-design-philosophy)
2. [Service Architecture](#service-architecture)
3. [API Implementation Patterns](#api-implementation-patterns)
4. [WebSocket Real-time Integration](#websocket-real-time-integration)
5. [Performance Implementation](#performance-implementation)
6. [Security Implementation](#security-implementation)
7. [Development Workflow](#development-workflow)
8. [Deployment Patterns](#deployment-patterns)

---

## Console-First Design Philosophy

### Why Console-First?

**Target Users:** Security analysts, SOC teams, DevSecOps engineers who prefer terminal-based workflows over web interfaces.

**Core Benefits:**
- **Speed**: Direct command execution without UI navigation overhead
- **Automation**: Easy scripting and automation integration
- **Efficiency**: Keyboard-driven workflows optimized for security professionals
- **Real-time**: Live data streaming without browser refresh cycles
- **Resource Efficiency**: Minimal client-side resource consumption

### Design Principles

#### 1. Terminal-Native Experience
```bash
# Commands should feel natural to security professionals
threatguard threat scan 192.168.1.0/24
threatguard behavior analyze user123 --since 24h
threatguard intel query malicious-domain.com

# Not web-thinking translated to CLI
threatguard --action=threat_scan --target=192.168.1.0/24  # ❌ Verbose
```

#### 2. Real-time by Default
```typescript
// CLI should stream live updates, not poll
interface CLIStreamConfig {
  realTimeUpdates: true;          // Default streaming mode
  updateFrequency: '50ms';        // Sub-second updates
  bufferSize: 1000;              // Event buffering
  autoRefresh: false;            // No polling-based updates
}
```

#### 3. Professional Security Workflow
```bash
# Incident Response Workflow Example
threatguard threat list --severity critical --since 1h     # Assess current threats
threatguard behavior analyze compromised-user              # Investigate user
threatguard network events --source 192.168.1.50 --live   # Monitor network
threatguard intel query suspicious-hash-value             # Check intelligence
```

---

## Service Architecture

### Current Implementation: bg-threat-ai (Port 3002)

#### Service Stack
```typescript
interface ServiceStack {
  runtime: 'Node.js 18+ with TypeScript';
  framework: 'Express.js with async/await';
  webSocket: 'Socket.IO for real-time communication';
  authentication: 'JWT with RSA256 signatures';
  caching: 'Redis for performance optimization';
  logging: 'Winston with structured logging';
  validation: 'Zod schemas for type-safe APIs';
}
```

#### Directory Structure
```
bg-identity-ai/  (renamed from bg-threat-ai)
├── src/
│   ├── index.ts                    # Service entry point
│   ├── routes/
│   │   ├── health.ts              # Health check endpoints
│   │   └── threat.ts              # Threat detection APIs
│   ├── services/
│   │   ├── threat-detection-service.ts    # Core ML pipeline
│   │   └── websocket-stream-service.ts   # Real-time streaming
│   ├── middleware/
│   │   ├── auth.ts                # JWT authentication
│   │   └── error-handler.ts       # Centralized error handling
│   ├── types/
│   │   ├── threat.ts              # TypeScript interfaces
│   │   └── global.d.ts            # Global type definitions
│   └── lib/
│       ├── logger.ts              # Structured logging
│       └── compliance/            # GDPR/SOX compliance
├── package.json                    # Dependencies and scripts
└── .env                           # Environment configuration
```

### Service Communication Architecture

#### API Layer Design
```typescript
// RESTful APIs for direct commands
interface APIDesign {
  pattern: 'REST with JSON responses';
  authentication: 'Bearer JWT tokens';
  rateLimit: 'Memory-based with Redis fallback';
  validation: 'Zod schemas with error details';
  caching: 'Redis with TTL-based invalidation';
  monitoring: 'Correlation IDs for request tracing';
}

// WebSocket for real-time streams
interface WebSocketDesign {
  transport: 'Socket.IO with fallback to polling';
  authentication: 'JWT in handshake or headers';
  events: 'Bi-directional with filtering support';
  reconnection: 'Automatic with exponential backoff';
  scaling: 'Sticky sessions for multi-instance';
}
```

---

## API Implementation Patterns

### RESTful Endpoint Implementation

#### 1. Health Check Pattern
```typescript
// /health - Basic health check (sub-10ms target)
router.get('/', (req, res) => {
  const healthCheck = {
    service: 'bg-threat-ai',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '2.0.0'
  };

  logger.info('Health check requested', healthCheck);
  res.status(200).json(healthCheck);
});

// /health/ready - Readiness check with dependencies
router.get('/ready', async (req, res) => {
  try {
    // Check external dependencies
    const redisStatus = await checkRedisConnection();
    const dbStatus = await checkDatabaseConnection();
    
    if (redisStatus && dbStatus) {
      res.status(200).json({
        service: 'bg-threat-ai',
        ready: true,
        timestamp: new Date().toISOString(),
        dependencies: { redis: redisStatus, database: dbStatus }
      });
    } else {
      res.status(503).json({
        service: 'bg-threat-ai',
        ready: false,
        dependencies: { redis: redisStatus, database: dbStatus }
      });
    }
  } catch (error) {
    res.status(503).json({
      service: 'bg-threat-ai',
      ready: false,
      error: error.message
    });
  }
});
```

#### 2. Threat Detection Endpoint Pattern
```typescript
// POST /api/threat/detect-realtime - Real-time threat analysis
router.post('/detect-realtime', async (req, res) => {
  const startTime = performance.now();
  
  try {
    // 1. Validate input (Zod schema)
    const validatedData = threatDetectionSchema.parse(req.body);
    const { events, source, timestamp } = validatedData;
    const userId = req.user?.id;
    
    // 2. Authentication check
    if (!userId) {
      return res.status(401).json({ 
        error: 'User not authenticated',
        correlationId: req.correlationId
      });
    }

    // 3. Log request with correlation ID
    logger.info('Real-time threat detection requested', {
      userId,
      eventCount: events.length,
      source,
      correlationId: req.correlationId
    });

    // 4. Call service layer (target: <100ms)
    const result = await threatService.detectThreatsRealtime(
      events, 
      source, 
      userId
    );
    
    // 5. Performance monitoring
    const processingTime = performance.now() - startTime;
    
    // 6. Log completion with metrics
    logger.info('Real-time threat detection completed', {
      userId,
      threatsFound: result.threatsDetected,
      riskScore: result.overallRiskScore,
      processingTime: `${processingTime.toFixed(2)}ms`,
      correlationId: req.correlationId
    });

    // 7. Return structured response
    res.json({
      ...result,
      metadata: {
        processingTime: `${processingTime.toFixed(2)}ms`,
        correlationId: req.correlationId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    // Centralized error handling
    logger.error('Real-time threat detection failed', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      correlationId: req.correlationId
    });
    
    res.status(500).json({ 
      error: 'Real-time threat detection failed',
      correlationId: req.correlationId
    });
  }
});
```

#### 3. Input Validation with Zod
```typescript
import { z } from 'zod';

// Threat detection request schema
export const threatDetectionSchema = z.object({
  events: z.array(z.object({
    target: z.string().min(1),
    timestamp: z.string().datetime(),
    metadata: z.record(z.any()).optional()
  })).min(1).max(1000), // Reasonable limits
  
  source: z.string().min(1).max(100),
  timestamp: z.string().datetime(),
  options: z.object({
    deepAnalysis: z.boolean().optional(),
    threshold: z.number().min(0).max(1).optional()
  }).optional()
});

// Behavioral analysis request schema
export const behaviorAnalysisSchema = z.object({
  target: z.string().min(1),
  timeRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime()
  }),
  analysisType: z.enum(['user', 'network', 'system', 'application']),
  metrics: z.array(z.string()).optional()
});

// Request validation middleware
export const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code
          }))
        });
      } else {
        res.status(400).json({ error: 'Invalid request data' });
      }
    }
  };
};
```

### Authentication Implementation

#### JWT Authentication Pattern
```typescript
import jwt from 'jsonwebtoken';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  correlationId?: string;
}

export const authMiddleware = (
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
): void => {
  const startTime = performance.now();
  
  // Generate correlation ID for request tracing
  req.correlationId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    logger.warn('Authentication failed: No token provided', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      correlationId: req.correlationId
    });
    return res.status(401).json({ 
      error: 'Access denied. No token provided.',
      correlationId: req.correlationId
    });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET not configured', {
        correlationId: req.correlationId
      });
      return res.status(500).json({ 
        error: 'Server configuration error',
        correlationId: req.correlationId
      });
    }

    // Verify token (with caching for performance)
    const decoded = jwt.verify(token, jwtSecret) as any;
    req.user = {
      id: decoded.id || decoded.sub,
      email: decoded.email,
      role: decoded.role || 'user'
    };
    
    const authTime = performance.now() - startTime;
    
    logger.info('User authenticated successfully', {
      userId: req.user.id,
      email: req.user.email,
      authTime: `${authTime.toFixed(2)}ms`,
      correlationId: req.correlationId
    });
    
    next();
  } catch (error) {
    const authTime = performance.now() - startTime;
    
    logger.warn('Authentication failed: Invalid token', {
      error: error.message,
      ip: req.ip,
      authTime: `${authTime.toFixed(2)}ms`,
      correlationId: req.correlationId
    });
    
    return res.status(401).json({ 
      error: 'Invalid token.',
      correlationId: req.correlationId
    });
  }
};
```

---

## WebSocket Real-time Integration

### Socket.IO Implementation

#### 1. WebSocket Server Setup
```typescript
// WebSocket service initialization
export class WebSocketStreamService {
  private io: SocketIOServer;
  private threatService: ThreatDetectionService;
  private clientFilters: Map<string, ClientFilter> = new Map();

  constructor(server: HttpServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,        // 60 seconds
      pingInterval: 25000,       // 25 seconds
      upgradeTimeout: 10000,     // 10 seconds
      allowUpgrades: true
    });

    this.threatService = new ThreatDetectionService();
    this.setupSocketHandlers();
    this.startEventStreaming();
  }

  private setupSocketHandlers(): void {
    // Authentication middleware for WebSocket
    this.io.use(this.authenticateSocket.bind(this));

    this.io.on('connection', (socket) => {
      const userId = (socket as any).userId;
      const socketId = socket.id;

      logger.info('Client connected to threat stream', {
        socketId,
        userId,
        transport: socket.conn.transport.name
      });

      // Set default event filters
      this.clientFilters.set(socketId, {
        eventTypes: ['threat', 'behavior', 'network'],
        severity: ['medium', 'high', 'critical'],
        sources: [],
        userId
      });

      // Handle real-time command requests
      this.setupSocketCommands(socket, userId);

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        logger.info('Client disconnected from threat stream', {
          socketId,
          userId,
          reason
        });
        this.clientFilters.delete(socketId);
      });
    });
  }

  private setupSocketCommands(socket: any, userId: string): void {
    // Real-time threat scanning
    socket.on('request_threat_scan', async (data: { 
      targets: string[], 
      options?: any 
    }) => {
      try {
        const result = await this.threatService.detectThreatsRealtime(
          data.targets.map(t => ({ 
            target: t, 
            timestamp: new Date().toISOString() 
          })),
          'websocket_client',
          userId
        );

        socket.emit('threat_scan_result', {
          ...result,
          requestId: data.requestId,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        socket.emit('threat_scan_error', {
          requestId: data.requestId,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Live behavioral analysis
    socket.on('request_behavior_analysis', async (data: {
      target: string;
      timeRange?: { start: string; end: string };
      analysisType?: string;
      requestId?: string;
    }) => {
      try {
        const result = await this.threatService.analyzeBehavior({
          target: data.target,
          timeRange: data.timeRange || {
            start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString()
          },
          analysisType: data.analysisType as any || 'user',
          metrics: []
        });

        socket.emit('behavior_analysis_result', {
          ...result,
          requestId: data.requestId,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        socket.emit('behavior_analysis_error', {
          requestId: data.requestId,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Update client event filters
    socket.on('update_filters', (filters: Partial<ClientFilter>) => {
      this.updateClientFilters(socket.id, filters);
      socket.emit('filters_updated', this.clientFilters.get(socket.id));
    });

    // Client heartbeat for connection monitoring
    socket.on('heartbeat', () => {
      socket.emit('heartbeat_response', {
        timestamp: new Date().toISOString(),
        status: 'connected'
      });
    });
  }

  // Real-time event streaming to connected clients
  private startEventStreaming(): void {
    this.streamingInterval = setInterval(() => {
      this.generateAndBroadcastEvents();
    }, Math.random() * 3000 + 2000); // 2-5 second intervals

    logger.info('Real-time event streaming started');
  }

  private generateAndBroadcastEvents(): void {
    if (this.io.sockets.sockets.size === 0) {
      return; // No connected clients
    }

    const event = this.generateStreamEvent();
    this.broadcastEvent(event);
  }

  private broadcastEvent(event: StreamEvent): void {
    this.io.sockets.sockets.forEach((socket) => {
      const filters = this.clientFilters.get(socket.id);
      if (filters && this.eventMatchesFilters(event, filters)) {
        socket.emit('stream_event', event);
        socket.emit(`${event.type}_event`, event.data);
      }
    });

    logger.debug('Event broadcasted to clients', {
      eventType: event.type,
      correlationId: event.metadata.correlationId,
      connectedClients: this.io.sockets.sockets.size
    });
  }
}
```

#### 2. CLI WebSocket Client Integration
```typescript
// CLI-side WebSocket client (in threatguard-cli)
export class ThreatStreamClient {
  private socket: io.Socket;
  private eventHandlers: Map<string, Function> = new Map();

  constructor(apiUrl: string, authToken: string) {
    this.socket = io(apiUrl, {
      auth: { token: authToken },
      transports: ['websocket', 'polling'],
      autoConnect: false
    });

    this.setupEventHandlers();
  }

  async connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.socket.connect();

      this.socket.on('connect', () => {
        console.log('✅ Connected to ThreatGuard stream');
        resolve(true);
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Stream connection failed:', error.message);
        reject(error);
      });

      // Set connection timeout
      setTimeout(() => reject(new Error('Connection timeout')), 10000);
    });
  }

  // Real-time threat monitoring for CLI
  startThreatMonitoring(filters?: Partial<ClientFilter>): void {
    if (filters) {
      this.socket.emit('update_filters', filters);
    }

    this.socket.on('stream_event', (event: StreamEvent) => {
      this.displayEvent(event);
    });

    this.socket.on('threat_event', (threatData: any) => {
      this.displayThreatAlert(threatData);
    });

    console.log('🔍 Starting real-time threat monitoring...');
    console.log('Press Ctrl+C to stop monitoring\n');
  }

  // Execute threat scan with real-time results
  async scanThreats(targets: string[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = `scan_${Date.now()}`;

      this.socket.emit('request_threat_scan', {
        targets,
        requestId,
        options: { deepAnalysis: true }
      });

      this.socket.once('threat_scan_result', (result) => {
        if (result.requestId === requestId) {
          resolve(result);
        }
      });

      this.socket.once('threat_scan_error', (error) => {
        if (error.requestId === requestId) {
          reject(new Error(error.error));
        }
      });

      // Request timeout
      setTimeout(() => reject(new Error('Scan request timeout')), 30000);
    });
  }

  private displayEvent(event: StreamEvent): void {
    const timestamp = new Date(event.timestamp).toLocaleTimeString();
    const typeColor = this.getEventTypeColor(event.type);
    
    console.log(
      `${timestamp} ${typeColor}[${event.type.toUpperCase()}]${'\x1b[0m'} ${event.data.description || 'Event detected'}`
    );
  }

  private displayThreatAlert(threatData: any): void {
    const severity = threatData.severity || 'medium';
    const severityColor = this.getSeverityColor(severity);
    
    console.log(`\n🚨 ${severityColor}THREAT ALERT${'\x1b[0m'}`);
    console.log(`   Type: ${threatData.type}`);
    console.log(`   Severity: ${severity.toUpperCase()}`);
    console.log(`   Target: ${threatData.target || threatData.source}`);
    console.log(`   Risk Score: ${threatData.riskScore}/10`);
    console.log(`   Description: ${threatData.description}\n`);
  }

  private getEventTypeColor(type: string): string {
    const colors = {
      threat: '\x1b[31m',    // Red
      behavior: '\x1b[33m',  // Yellow
      network: '\x1b[34m',   // Blue
      intelligence: '\x1b[35m', // Magenta
      system: '\x1b[36m'     // Cyan
    };
    return colors[type] || '\x1b[37m'; // White default
  }

  private getSeverityColor(severity: string): string {
    const colors = {
      low: '\x1b[32m',      // Green
      medium: '\x1b[33m',   // Yellow
      high: '\x1b[31m',     // Red
      critical: '\x1b[41m'  // Red background
    };
    return colors[severity] || '\x1b[37m'; // White default
  }
}
```

---

## Performance Implementation

### Response Time Optimization

#### 1. Redis Caching Implementation
```typescript
import Redis from 'ioredis';

export class ThreatCacheManager {
  private redis: Redis;
  private localCache: Map<string, { data: any, expiry: number }> = new Map();

  constructor() {
    // Redis configuration optimized for performance
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      
      // Performance optimizations
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      connectTimeout: 10000,
      commandTimeout: 5000,
      
      // Connection pool settings
      maxmemoryPolicy: 'allkeys-lru',
      keepAlive: 30000,
    });

    // Handle Redis connection events
    this.setupRedisEventHandlers();
  }

  async cacheFeatureVector(key: string, features: any, ttl: number = 300): Promise<void> {
    try {
      const serializedFeatures = JSON.stringify(features);
      await this.redis.setex(key, ttl, serializedFeatures);
      
      // Also cache locally for ultra-fast access
      this.localCache.set(key, {
        data: features,
        expiry: Date.now() + (ttl * 1000)
      });
    } catch (error) {
      logger.warn('Redis cache write failed, using local cache only', { error: error.message });
      this.localCache.set(key, {
        data: features,
        expiry: Date.now() + (ttl * 1000)
      });
    }
  }

  async getFeatureVector(key: string): Promise<any | null> {
    // Try local cache first (sub-millisecond access)
    const localData = this.localCache.get(key);
    if (localData && localData.expiry > Date.now()) {
      return localData.data;
    }

    try {
      // Fall back to Redis
      const cached = await this.redis.get(key);
      if (cached) {
        const data = JSON.parse(cached);
        
        // Update local cache
        this.localCache.set(key, {
          data,
          expiry: Date.now() + 300000 // 5 minutes
        });
        
        return data;
      }
    } catch (error) {
      logger.warn('Redis cache read failed', { error: error.message });
    }

    return null;
  }

  async cacheThreatIntelligence(indicator: string, intelligence: any, ttl: number = 14400): Promise<void> {
    const key = `threat_intel:${indicator}`;
    await this.cacheFeatureVector(key, intelligence, ttl);
  }

  async getThreatIntelligence(indicator: string): Promise<any | null> {
    const key = `threat_intel:${indicator}`;
    return await this.getFeatureVector(key);
  }

  // Cleanup expired local cache entries
  private cleanupLocalCache(): void {
    const now = Date.now();
    for (const [key, value] of this.localCache.entries()) {
      if (value.expiry <= now) {
        this.localCache.delete(key);
      }
    }
  }

  private setupRedisEventHandlers(): void {
    this.redis.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    this.redis.on('error', (error) => {
      logger.error('Redis connection error', { error: error.message });
    });

    // Cleanup local cache every 5 minutes
    setInterval(() => {
      this.cleanupLocalCache();
    }, 300000);
  }
}
```

#### 2. Feature Extraction Optimization
```typescript
export class OptimizedFeatureExtractor {
  private cache: ThreatCacheManager;
  private computationQueue: Map<string, Promise<any>> = new Map();

  constructor() {
    this.cache = new ThreatCacheManager();
  }

  async extractFeatures(event: RawSecurityEvent): Promise<ProcessedFeatures> {
    const startTime = performance.now();
    
    // Create cache key based on event characteristics
    const cacheKey = this.createFeatureCacheKey(event);
    
    // Check if computation is already in progress
    if (this.computationQueue.has(cacheKey)) {
      return await this.computationQueue.get(cacheKey)!;
    }
    
    // Check cache first
    const cachedFeatures = await this.cache.getFeatureVector(cacheKey);
    if (cachedFeatures) {
      logger.debug('Feature cache hit', { 
        cacheKey, 
        extractionTime: `${(performance.now() - startTime).toFixed(2)}ms` 
      });
      return cachedFeatures;
    }

    // Compute features if not cached
    const computationPromise = this.computeFeatures(event);
    this.computationQueue.set(cacheKey, computationPromise);

    try {
      const features = await computationPromise;
      
      // Cache the computed features
      await this.cache.cacheFeatureVector(cacheKey, features, 300); // 5 minutes TTL
      
      const extractionTime = performance.now() - startTime;
      logger.debug('Features extracted and cached', { 
        cacheKey, 
        extractionTime: `${extractionTime.toFixed(2)}ms` 
      });

      return features;
    } finally {
      // Remove from computation queue
      this.computationQueue.delete(cacheKey);
    }
  }

  private async computeFeatures(event: RawSecurityEvent): Promise<ProcessedFeatures> {
    // Parallel feature computation for performance
    const [temporalFeatures, networkFeatures, behavioralFeatures] = await Promise.all([
      this.extractTemporalFeatures(event),
      this.extractNetworkFeatures(event),
      this.extractBehavioralFeatures(event)
    ]);

    return {
      temporal: temporalFeatures,
      network: networkFeatures,
      behavioral: behavioralFeatures,
      contextual: await this.extractContextualFeatures(event)
    };
  }

  private createFeatureCacheKey(event: RawSecurityEvent): string {
    // Create deterministic cache key based on relevant event fields
    const keyFields = [
      event.source_ip,
      event.dest_ip,
      event.protocol,
      event.port,
      Math.floor(new Date(event.timestamp).getTime() / 300000) // 5-minute time buckets
    ];
    
    return `features:${keyFields.join(':')}`;
  }

  private async extractTemporalFeatures(event: RawSecurityEvent): Promise<TemporalFeatures> {
    const eventTime = new Date(event.timestamp);
    
    return {
      hour_of_day: eventTime.getHours(),
      day_of_week: eventTime.getDay(),
      time_since_last_event: await this.calculateTimeSinceLastEvent(event.source_ip),
      event_frequency_1h: await this.calculateEventFrequency(event.source_ip, 3600),
      event_frequency_24h: await this.calculateEventFrequency(event.source_ip, 86400)
    };
  }

  private async calculateTimeSinceLastEvent(sourceIp: string): Promise<number> {
    const lastEventKey = `last_event:${sourceIp}`;
    const lastEventTime = await this.cache.getFeatureVector(lastEventKey);
    
    const now = Date.now();
    if (lastEventTime) {
      const timeDiff = now - lastEventTime;
      await this.cache.cacheFeatureVector(lastEventKey, now, 86400); // 24 hours TTL
      return timeDiff / 1000; // Return in seconds
    } else {
      await this.cache.cacheFeatureVector(lastEventKey, now, 86400);
      return 0;
    }
  }
}
```

---

## Security Implementation

### Input Validation and Sanitization

```typescript
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

export class SecurityValidator {
  static sanitizeString(input: string, maxLength: number = 1000): string {
    if (typeof input !== 'string') {
      throw new Error('Input must be a string');
    }
    
    // Truncate to max length
    let sanitized = input.substring(0, maxLength);
    
    // Remove null bytes and control characters
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // HTML sanitization
    sanitized = DOMPurify.sanitize(sanitized, { 
      ALLOWED_TAGS: [], 
      ALLOWED_ATTR: [] 
    });
    
    // Additional XSS prevention
    sanitized = validator.escape(sanitized);
    
    return sanitized.trim();
  }

  static validateIPAddress(ip: string): boolean {
    return validator.isIP(ip, 4) || validator.isIP(ip, 6);
  }

  static validateDomain(domain: string): boolean {
    return validator.isFQDN(domain, {
      require_tld: true,
      allow_underscores: false,
      allow_trailing_dot: false
    });
  }

  static sanitizeThreatEvent(event: any): RawSecurityEvent {
    return {
      timestamp: validator.isISO8601(event.timestamp) ? event.timestamp : new Date().toISOString(),
      source_ip: this.validateIPAddress(event.source_ip) ? event.source_ip : '0.0.0.0',
      dest_ip: this.validateIPAddress(event.dest_ip) ? event.dest_ip : '0.0.0.0',
      protocol: this.sanitizeString(event.protocol, 10).toLowerCase(),
      port: Math.max(0, Math.min(65535, parseInt(event.port) || 0)),
      bytes_transferred: Math.max(0, parseInt(event.bytes_transferred) || 0),
      event_type: this.sanitizeString(event.event_type, 50),
      user_agent: event.user_agent ? this.sanitizeString(event.user_agent, 500) : undefined,
      user_id: event.user_id ? this.sanitizeString(event.user_id, 100) : undefined
    };
  }
}
```

### Rate Limiting Implementation

```typescript
export class RateLimiter {
  private memoryStore: Map<string, { count: number, resetTime: number }> = new Map();
  private redis?: ThreatCacheManager;

  constructor(useRedis: boolean = true) {
    if (useRedis) {
      this.redis = new ThreatCacheManager();
    }
  }

  async checkRateLimit(
    identifier: string, 
    limit: number = 100, 
    windowMs: number = 60000
  ): Promise<{ allowed: boolean, remaining: number, resetTime: number }> {
    
    if (this.redis) {
      return await this.checkRedisRateLimit(identifier, limit, windowMs);
    } else {
      return this.checkMemoryRateLimit(identifier, limit, windowMs);
    }
  }

  private checkMemoryRateLimit(
    identifier: string,
    limit: number,
    windowMs: number
  ): { allowed: boolean, remaining: number, resetTime: number } {
    const now = Date.now();
    const record = this.memoryStore.get(identifier);

    if (!record || now > record.resetTime) {
      // New window or expired record
      const newRecord = {
        count: 1,
        resetTime: now + windowMs
      };
      this.memoryStore.set(identifier, newRecord);
      
      return {
        allowed: true,
        remaining: limit - 1,
        resetTime: newRecord.resetTime
      };
    }

    if (record.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime
      };
    }

    record.count++;
    this.memoryStore.set(identifier, record);

    return {
      allowed: true,
      remaining: limit - record.count,
      resetTime: record.resetTime
    };
  }

  private async checkRedisRateLimit(
    identifier: string,
    limit: number,
    windowMs: number
  ): Promise<{ allowed: boolean, remaining: number, resetTime: number }> {
    const key = `rate_limit:${identifier}`;
    const now = Date.now();
    const resetTime = now + windowMs;

    try {
      // Use Redis pipeline for atomic operations
      const pipeline = this.redis!.redis.multi();
      
      pipeline.incr(key);
      pipeline.expire(key, Math.ceil(windowMs / 1000));
      pipeline.ttl(key);
      
      const results = await pipeline.exec();
      
      if (results && results[0] && results[2]) {
        const count = results[0][1] as number;
        const ttl = results[2][1] as number;
        const actualResetTime = ttl > 0 ? now + (ttl * 1000) : resetTime;

        return {
          allowed: count <= limit,
          remaining: Math.max(0, limit - count),
          resetTime: actualResetTime
        };
      } else {
        throw new Error('Redis pipeline execution failed');
      }
    } catch (error) {
      logger.warn('Redis rate limiting failed, falling back to memory', { 
        error: error.message 
      });
      return this.checkMemoryRateLimit(identifier, limit, windowMs);
    }
  }

  // Rate limiting middleware
  createMiddleware(
    limit: number = 100, 
    windowMs: number = 60000,
    keyGenerator?: (req: Request) => string
  ) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const identifier = keyGenerator ? keyGenerator(req) : req.ip;
      
      const result = await this.checkRateLimit(identifier, limit, windowMs);
      
      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', result.resetTime);
      
      if (!result.allowed) {
        logger.warn('Rate limit exceeded', {
          identifier,
          limit,
          resetTime: result.resetTime
        });
        
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        });
      }
      
      next();
    };
  }
}
```

---

## Development Workflow

### Local Development Setup

#### 1. Environment Configuration
```bash
# .env file for bg-threat-ai service
PORT=3002
NODE_ENV=development
LOG_LEVEL=debug

# JWT Authentication
JWT_SECRET=development-secret-key-replace-in-production

# Redis Configuration (optional for development)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# bg-web API Integration
BG_WEB_API_URL=http://localhost:3000
BG_WEB_API_KEY=dev_secret_2024_threat_detection
```

#### 2. Development Scripts
```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc && tsc-alias",
    "start": "node dist/index.js",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "type-check": "tsc --noEmit"
  }
}
```

#### 3. Testing Patterns
```typescript
// Example: Threat detection service test
describe('ThreatDetectionService', () => {
  let service: ThreatDetectionService;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    mockRedis = createMockRedis();
    service = new ThreatDetectionService();
  });

  describe('detectThreatsRealtime', () => {
    it('should detect threats in real-time with sub-100ms performance', async () => {
      const startTime = performance.now();
      
      const events = [
        {
          target: '192.168.1.100',
          timestamp: new Date().toISOString()
        }
      ];

      const result = await service.detectThreatsRealtime(
        events, 
        'test_source', 
        'user123'
      );

      const processingTime = performance.now() - startTime;
      
      expect(processingTime).toBeLessThan(100); // Performance requirement
      expect(result).toHaveProperty('threatsDetected');
      expect(result).toHaveProperty('overallRiskScore');
      expect(typeof result.overallRiskScore).toBe('number');
      expect(result.overallRiskScore).toBeGreaterThanOrEqual(0);
      expect(result.overallRiskScore).toBeLessThanOrEqual(10);
    });

    it('should handle invalid input gracefully', async () => {
      await expect(
        service.detectThreatsRealtime([], 'test_source', 'user123')
      ).rejects.toThrow('Events array cannot be empty');
    });
  });
});
```

#### 4. Performance Testing
```typescript
// Performance benchmark test
describe('Performance Benchmarks', () => {
  it('should meet API response time requirements', async () => {
    const measurements = [];
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      await request(app)
        .get('/health')
        .expect(200);
      
      const duration = performance.now() - startTime;
      measurements.push(duration);
    }

    const averageTime = measurements.reduce((a, b) => a + b) / measurements.length;
    const p95Time = measurements.sort((a, b) => a - b)[Math.floor(measurements.length * 0.95)];

    console.log(`Average response time: ${averageTime.toFixed(2)}ms`);
    console.log(`P95 response time: ${p95Time.toFixed(2)}ms`);

    expect(averageTime).toBeLessThan(50);  // Average < 50ms
    expect(p95Time).toBeLessThan(100);     // P95 < 100ms
  });
});
```

---

## Deployment Patterns

### Production Deployment

#### 1. Docker Configuration
```dockerfile
# Dockerfile for bg-threat-ai service
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY . .
RUN npm run build

FROM node:18-alpine AS runtime

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

USER nodejs
EXPOSE 3002

CMD ["node", "dist/index.js"]
```

#### 2. Production Configuration
```yaml
# docker-compose.production.yml
version: '3.8'
services:
  bg-threat-ai:
    build: 
      context: ./bg-identity-ai
      dockerfile: Dockerfile
    ports:
      - "3002:3002"
    environment:
      NODE_ENV: production
      PORT: 3002
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      - redis
      - postgres
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '0.5'
          memory: 1G

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --maxmemory 2gb --maxmemory-policy allkeys-lru
    restart: unless-stopped
    volumes:
      - redis_data:/data

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: threatguard
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  redis_data:
  postgres_data:
```

#### 3. Monitoring and Alerting
```typescript
// Production monitoring setup
export class ProductionMonitor {
  private metricsCollector: MetricsCollector;

  constructor() {
    this.metricsCollector = new MetricsCollector();
    this.setupHealthChecks();
    this.setupMetrics();
  }

  private setupHealthChecks(): void {
    // Deep health check every 30 seconds
    setInterval(async () => {
      const health = await this.performHealthCheck();
      
      if (!health.healthy) {
        await this.sendAlert('HEALTH_CHECK_FAILED', health);
      }
    }, 30000);
  }

  private async performHealthCheck(): Promise<HealthStatus> {
    const checks = await Promise.allSettled([
      this.checkRedisConnection(),
      this.checkDatabaseConnection(),
      this.checkMemoryUsage(),
      this.checkResponseTimes()
    ]);

    const healthStatus = {
      healthy: checks.every(check => check.status === 'fulfilled'),
      timestamp: new Date().toISOString(),
      checks: {
        redis: checks[0].status === 'fulfilled',
        database: checks[1].status === 'fulfilled', 
        memory: checks[2].status === 'fulfilled',
        responseTime: checks[3].status === 'fulfilled'
      }
    };

    return healthStatus;
  }

  private async sendAlert(alertType: string, data: any): Promise<void> {
    // Integration with monitoring services
    logger.error('Production Alert', { alertType, data });
    
    // Send to external monitoring (PagerDuty, Slack, etc.)
    // This would integrate with your monitoring infrastructure
  }
}
```

---

## Conclusion

This Service Implementation Guide provides the practical patterns and code examples needed to build and deploy the console-first threat detection platform. The implementation focuses on:

**Key Implementation Principles:**
- **Performance First**: Sub-100ms API responses with Redis caching
- **Security by Design**: JWT authentication, input validation, and rate limiting
- **Real-time Integration**: WebSocket streaming with <50ms latency
- **Production Ready**: Comprehensive monitoring, error handling, and deployment patterns

**Next Steps for Developers:**
1. Set up local development environment using provided patterns
2. Implement additional threat detection algorithms following the ML pipeline patterns
3. Enhance WebSocket functionality for advanced CLI interactions
4. Contribute to performance optimizations and security hardening
5. Integrate with external threat intelligence feeds and security tools

The console-first approach differentiates ThreatGuard in the cybersecurity market by providing security professionals with the terminal-native experience they prefer, while maintaining enterprise-grade performance and security standards.