import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger } from '@/lib/logger';
import { ThreatDetectionService } from './threat-detection-service';
import jwt from 'jsonwebtoken';

export interface StreamEvent {
  type: 'threat' | 'behavior' | 'network' | 'intelligence' | 'system';
  timestamp: string;
  data: any;
  metadata: {
    source: string;
    correlationId: string;
    userId?: string;
  };
}

export interface ClientFilter {
  eventTypes: string[];
  severity: string[];
  sources: string[];
  userId?: string;
}

export class WebSocketStreamService {
  private io: SocketIOServer;
  private threatService: ThreatDetectionService;
  private clientFilters: Map<string, ClientFilter> = new Map();
  private streamingInterval?: NodeJS.Timeout;

  constructor(server: HttpServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.threatService = new ThreatDetectionService();
    this.setupSocketHandlers();
    this.startEventStreaming();

    logger.info('WebSocket streaming service initialized', {
      transports: ['websocket', 'polling'],
      cors: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000']
    });
  }

  private setupSocketHandlers(): void {
    this.io.use(this.authenticateSocket.bind(this));

    this.io.on('connection', (socket) => {
      const userId = (socket as any).userId;
      logger.info('Client connected to threat stream', {
        socketId: socket.id,
        userId
      });

      // Set default filters
      this.clientFilters.set(socket.id, {
        eventTypes: ['threat', 'behavior', 'network'],
        severity: ['medium', 'high', 'critical'],
        sources: [],
        userId
      });

      // Handle client filter updates
      socket.on('update_filters', (filters: Partial<ClientFilter>) => {
        this.updateClientFilters(socket.id, filters);
        socket.emit('filters_updated', this.clientFilters.get(socket.id));
      });

      // Handle threat detection requests
      socket.on('request_threat_scan', async (data: { targets: string[], options?: any }) => {
        try {
          const result = await this.threatService.detectThreatsRealtime(
            data.targets.map(t => ({ target: t, timestamp: new Date().toISOString() })),
            'websocket_client',
            userId
          );

          socket.emit('threat_scan_result', result);
        } catch (error) {
          socket.emit('threat_scan_error', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      // Handle behavioral analysis requests
      socket.on('request_behavior_analysis', async (data: {
        target: string;
        timeRange?: { start: string; end: string };
        analysisType?: string;
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

          socket.emit('behavior_analysis_result', result);
        } catch (error) {
          socket.emit('behavior_analysis_error', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      // Handle network monitoring requests
      socket.on('request_network_monitoring', async (data: { targets: string[], options?: any }) => {
        try {
          const result = await this.threatService.monitorNetwork(data.targets, data.options || {});
          socket.emit('network_monitoring_result', result);
        } catch (error) {
          socket.emit('network_monitoring_error', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      // Handle client heartbeat
      socket.on('heartbeat', () => {
        socket.emit('heartbeat_response', {
          timestamp: new Date().toISOString(),
          status: 'connected'
        });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        logger.info('Client disconnected from threat stream', {
          socketId: socket.id,
          userId
        });
        this.clientFilters.delete(socket.id);
      });
    });
  }

  private async authenticateSocket(socket: any, next: (err?: Error) => void): Promise<void> {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
      
      if (!decoded.sub) {
        return next(new Error('Invalid token payload'));
      }

      socket.userId = decoded.sub;
      socket.userRole = decoded.role || 'user';
      
      logger.debug('Socket authenticated successfully', {
        socketId: socket.id,
        userId: socket.userId,
        role: socket.userRole
      });

      next();
    } catch (error) {
      logger.error('Socket authentication failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        socketId: socket.id
      });
      next(new Error('Authentication failed'));
    }
  }

  private updateClientFilters(socketId: string, newFilters: Partial<ClientFilter>): void {
    const currentFilters = this.clientFilters.get(socketId);
    if (currentFilters) {
      this.clientFilters.set(socketId, {
        ...currentFilters,
        ...newFilters
      });
      
      logger.debug('Client filters updated', {
        socketId,
        filters: this.clientFilters.get(socketId)
      });
    }
  }

  private startEventStreaming(): void {
    // Stream events every 2-5 seconds
    this.streamingInterval = setInterval(() => {
      this.generateAndBroadcastEvents();
    }, Math.random() * 3000 + 2000);

    logger.info('Real-time event streaming started');
  }

  private generateAndBroadcastEvents(): void {
    if (this.io.sockets.sockets.size === 0) {
      // No connected clients, skip event generation
      return;
    }

    // Generate various types of events
    const eventTypes = ['threat', 'behavior', 'network', 'intelligence', 'system'];
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    
    const event = this.generateStreamEvent(eventType);
    this.broadcastEvent(event);
  }

  private generateStreamEvent(type: string): StreamEvent {
    const correlationId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let data: any;
    let source: string;

    switch (type) {
      case 'threat':
        data = this.generateThreatEventData();
        source = 'threat_detector';
        break;
      case 'behavior':
        data = this.generateBehaviorEventData();
        source = 'behavior_analyzer';
        break;
      case 'network':
        data = this.generateNetworkEventData();
        source = 'network_monitor';
        break;
      case 'intelligence':
        data = this.generateIntelligenceEventData();
        source = 'threat_intelligence';
        break;
      case 'system':
        data = this.generateSystemEventData();
        source = 'system_monitor';
        break;
      default:
        data = { message: 'Unknown event type' };
        source = 'unknown';
    }

    return {
      type: type as any,
      timestamp: new Date().toISOString(),
      data,
      metadata: {
        source,
        correlationId
      }
    };
  }

  private generateThreatEventData(): any {
    const severities = ['low', 'medium', 'high', 'critical'];
    const threatTypes = ['malware', 'intrusion', 'anomaly', 'suspicious_activity'];
    
    return {
      id: `threat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: threatTypes[Math.floor(Math.random() * threatTypes.length)],
      severity: severities[Math.floor(Math.random() * severities.length)],
      source: `192.168.1.${Math.floor(Math.random() * 255)}`,
      target: `server-${Math.floor(Math.random() * 10)}`,
      description: this.getRandomThreatDescription(),
      riskScore: Math.random() * 10,
      status: 'active'
    };
  }

  private generateBehaviorEventData(): any {
    const patterns = ['login_anomaly', 'access_pattern_change', 'privilege_escalation', 'data_access_spike'];
    
    return {
      id: `behavior_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      target: `user_${Math.floor(Math.random() * 1000)}`,
      pattern: patterns[Math.floor(Math.random() * patterns.length)],
      confidence: 0.7 + Math.random() * 0.3,
      anomalyScore: Math.random(),
      description: this.getRandomBehaviorDescription()
    };
  }

  private generateNetworkEventData(): any {
    const eventTypes = ['connection', 'traffic', 'intrusion', 'port_scan'];
    
    return {
      id: `network_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      eventType: eventTypes[Math.floor(Math.random() * eventTypes.length)],
      sourceIp: `192.168.1.${Math.floor(Math.random() * 255)}`,
      destIp: `10.0.0.${Math.floor(Math.random() * 255)}`,
      protocol: ['tcp', 'udp', 'icmp'][Math.floor(Math.random() * 3)],
      port: Math.floor(Math.random() * 65535),
      bytes: Math.floor(Math.random() * 10000),
      blocked: Math.random() > 0.7
    };
  }

  private generateIntelligenceEventData(): any {
    const indicators = ['ip', 'domain', 'hash', 'url'];
    const reputations = ['clean', 'suspicious', 'malicious', 'unknown'];
    
    return {
      id: `intel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      indicator: this.generateRandomIndicator(),
      type: indicators[Math.floor(Math.random() * indicators.length)],
      reputation: reputations[Math.floor(Math.random() * reputations.length)],
      confidence: Math.random(),
      source: 'threat_intelligence_feed'
    };
  }

  private generateSystemEventData(): any {
    const systemEvents = ['health_check', 'service_restart', 'performance_alert', 'configuration_change'];
    
    return {
      id: `system_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      event: systemEvents[Math.floor(Math.random() * systemEvents.length)],
      service: 'bg-threat-ai',
      status: Math.random() > 0.8 ? 'warning' : 'info',
      message: this.getRandomSystemMessage()
    };
  }

  private broadcastEvent(event: StreamEvent): void {
    this.io.sockets.sockets.forEach((socket) => {
      const filters = this.clientFilters.get(socket.id);
      if (filters && this.eventMatchesFilters(event, filters)) {
        socket.emit('stream_event', event);
        
        // Also emit specific event type
        socket.emit(`${event.type}_event`, event.data);
      }
    });

    logger.debug('Event broadcasted to clients', {
      eventType: event.type,
      correlationId: event.metadata.correlationId,
      connectedClients: this.io.sockets.sockets.size
    });
  }

  private eventMatchesFilters(event: StreamEvent, filters: ClientFilter): boolean {
    // Check event type filter
    if (!filters.eventTypes.includes(event.type)) {
      return false;
    }

    // Check severity filter (if event has severity)
    if (event.data.severity && !filters.severity.includes(event.data.severity)) {
      return false;
    }

    // Check source filter (if specified)
    if (filters.sources.length > 0 && !filters.sources.includes(event.metadata.source)) {
      return false;
    }

    return true;
  }

  // Broadcast custom events
  public broadcastThreatAlert(threatData: any): void {
    const event: StreamEvent = {
      type: 'threat',
      timestamp: new Date().toISOString(),
      data: threatData,
      metadata: {
        source: 'custom_threat_alert',
        correlationId: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }
    };

    this.broadcastEvent(event);
  }

  public broadcastSystemStatus(statusData: any): void {
    const event: StreamEvent = {
      type: 'system',
      timestamp: new Date().toISOString(),
      data: statusData,
      metadata: {
        source: 'system_status',
        correlationId: `status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }
    };

    this.broadcastEvent(event);
  }

  // Utility methods for generating random data
  private getRandomThreatDescription(): string {
    const descriptions = [
      'Suspicious network traffic detected',
      'Malware signature identified',
      'Unauthorized access attempt',
      'Anomalous user behavior detected',
      'Potential data exfiltration',
      'Intrusion attempt blocked',
      'Privilege escalation detected'
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  }

  private getRandomBehaviorDescription(): string {
    const descriptions = [
      'User login pattern deviation detected',
      'Unusual data access pattern',
      'Off-hours system access',
      'Multiple failed authentication attempts',
      'Suspicious file modification activity'
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  }

  private getRandomSystemMessage(): string {
    const messages = [
      'System health check completed successfully',
      'Service performance within normal parameters',
      'Configuration update applied',
      'Background maintenance task completed',
      'Memory usage threshold alert'
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  private generateRandomIndicator(): string {
    const types = ['ip', 'domain', 'hash'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    switch (type) {
      case 'ip':
        return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
      case 'domain':
        return `suspicious-domain-${Math.random().toString(36).substr(2, 8)}.com`;
      case 'hash':
        return Math.random().toString(36).substr(2, 32);
      default:
        return 'unknown';
    }
  }

  // Get connection statistics
  public getConnectionStats(): any {
    return {
      totalConnections: this.io.sockets.sockets.size,
      connectedClients: Array.from(this.io.sockets.sockets.values()).map(socket => ({
        socketId: socket.id,
        userId: (socket as any).userId,
        connected: socket.connected,
        filters: this.clientFilters.get(socket.id)
      }))
    };
  }

  // Cleanup
  public cleanup(): void {
    if (this.streamingInterval) {
      clearInterval(this.streamingInterval);
    }
    
    this.io.close();
    logger.info('WebSocket streaming service cleaned up');
  }
}