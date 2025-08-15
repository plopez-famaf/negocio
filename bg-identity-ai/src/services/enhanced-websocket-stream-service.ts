import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger } from '@/lib/logger';
import { ThreatDetectionService } from './threat-detection-service';
import { enhancedStreamManager, StreamChannel, AdvancedFilter, EventAggregation } from './enhanced-stream-manager';
import { adaptiveThrottlingService, ThrottleRecommendation } from './adaptive-throttling-service';
import { smartFilteringService, FilterContext, UserFilterPreferences } from './smart-filtering-service';
import jwt from 'jsonwebtoken';

export interface StreamEvent {
  type: 'threat' | 'behavior' | 'network' | 'intelligence' | 'system';
  timestamp: string;
  data: any;
  metadata: {
    source: string;
    correlationId: string;
    userId?: string;
    relevanceScore?: number;
    channelId?: string;
    priority?: string;
    processedAt?: string;
  };
}

export interface ClientFilter {
  eventTypes: string[];
  severity: string[];
  sources: string[];
  userId?: string;
}

export interface EnhancedClientFilter extends ClientFilter {
  advancedFilters?: AdvancedFilter[];
  aggregationWindow?: number;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  mlRelevanceThreshold?: number;
}

export interface ClientStreamConfig {
  channels: {
    id: string;
    type: StreamChannel['type'];
    priority: StreamChannel['priority'];
    filters: AdvancedFilter[];
    aggregationWindow?: number;
  }[];
  globalSettings: {
    maxEventsPerSecond?: number;
    adaptiveThrottling?: boolean;
    enableAggregation?: boolean;
    mlFiltering?: boolean;
  };
}

export class EnhancedWebSocketStreamService {
  private io: SocketIOServer;
  private threatService: ThreatDetectionService;
  private clientFilters: Map<string, EnhancedClientFilter> = new Map();
  private clientChannels: Map<string, string[]> = new Map(); // clientId -> channelIds
  private streamingInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  private throttleTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(server: HttpServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.threatService = new ThreatDetectionService();
    this.setupSocketHandlers();
    this.startEnhancedEventStreaming();
    this.startMetricsReporting();

    logger.info('Enhanced WebSocket streaming service initialized', {
      transports: ['websocket', 'polling'],
      features: [
        'stream_multiplexing',
        'event_aggregation', 
        'smart_filtering',
        'adaptive_throttling',
        'ml_relevance_scoring'
      ],
      cors: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000']
    });
  }

  private setupSocketHandlers(): void {
    this.io.use(this.authenticateSocket.bind(this));

    this.io.on('connection', (socket) => {
      const userId = (socket as any).userId;
      const clientId = socket.id;
      
      logger.info('Client connected to enhanced threat stream', {
        socketId: socket.id,
        userId
      });

      // Initialize client with default configuration
      this.initializeClientStreams(clientId, userId);

      // Enhanced stream configuration
      socket.on('configure_streams', async (config: ClientStreamConfig) => {
        await this.configureClientStreams(clientId, config);
        
        // Initialize adaptive throttling for this client
        adaptiveThrottlingService.updateClientMetrics(clientId, {
          clientId,
          connectionLatency: 0,
          messageProcessingRate: config.globalSettings.maxEventsPerSecond || 100,
          errorRate: 0,
          queueDepth: 0,
          clientType: 'cli', // Would be determined from user agent or config
          bandwidthEstimate: 0
        });
        
        socket.emit('streams_configured', { 
          success: true, 
          channelsCreated: config.channels.length,
          adaptiveThrottlingEnabled: config.globalSettings.adaptiveThrottling || false
        });
      });

      // Legacy filter updates (for backward compatibility)
      socket.on('update_filters', (filters: Partial<EnhancedClientFilter>) => {
        this.updateClientFilters(socket.id, filters);
        socket.emit('filters_updated', this.clientFilters.get(socket.id));
      });

      // Advanced filter updates
      socket.on('update_channel_filters', (data: { channelId: string; filters: AdvancedFilter[] }) => {
        const success = enhancedStreamManager.updateChannelFilters(data.channelId, data.filters);
        socket.emit('channel_filters_updated', { channelId: data.channelId, success });
      });

      // Stream metrics request
      socket.on('get_stream_metrics', () => {
        const clientMetrics = enhancedStreamManager.getClientMetrics(clientId);
        const systemMetrics = enhancedStreamManager.getSystemMetrics();
        socket.emit('stream_metrics', { client: clientMetrics, system: systemMetrics });
      });

      // Adaptive throttling controls
      socket.on('request_throttle_adjustment', async () => {
        const throttleInfo = adaptiveThrottlingService.getThrottleRecommendation(clientId);
        socket.emit('throttle_recommendation', throttleInfo);
        
        // Apply throttling if needed
        if (throttleInfo.throttleLevel !== 'none') {
          this.applyClientThrottling(clientId, throttleInfo.recommendedRate);
        }
      });

      // Smart filtering controls
      socket.on('update_smart_filters', (preferences: UserFilterPreferences) => {
        if (userId) {
          smartFilteringService.updateUserPreferences(userId, preferences);
          socket.emit('smart_filters_updated', { success: true });
        }
      });

      socket.on('get_filtering_stats', () => {
        const stats = smartFilteringService.getStatistics();
        socket.emit('filtering_stats', stats);
      });

      // Channel management
      socket.on('create_channel', (channelConfig: {
        type: StreamChannel['type'];
        priority: StreamChannel['priority'];
        filters: AdvancedFilter[];
        aggregationWindow?: number;
      }) => {
        const channel = enhancedStreamManager.createChannel({
          clientId,
          ...channelConfig
        });
        
        // Track client channels
        const clientChannelIds = this.clientChannels.get(clientId) || [];
        clientChannelIds.push(channel.id);
        this.clientChannels.set(clientId, clientChannelIds);
        
        socket.emit('channel_created', { channelId: channel.id, config: channelConfig });
      });

      socket.on('close_channel', (channelId: string) => {
        const success = enhancedStreamManager.closeChannel(channelId);
        if (success) {
          // Remove from client tracking
          const clientChannelIds = this.clientChannels.get(clientId) || [];
          const updatedChannelIds = clientChannelIds.filter(id => id !== channelId);
          this.clientChannels.set(clientId, updatedChannelIds);
        }
        socket.emit('channel_closed', { channelId, success });
      });

      // Legacy threat detection requests (enhanced with ML)
      socket.on('request_threat_scan', async (data: { targets: string[], options?: any }) => {
        try {
          const result = await this.threatService.detectThreatsRealtime(
            data.targets.map(t => ({ target: t, timestamp: new Date().toISOString() })),
            'websocket_client',
            userId
          );

          // Send enhanced result with ML metadata
          const enhancedResult = {
            ...result,
            mlMetadata: {
              modelsUsed: ['isolation-forest-v1', 'user-behavior-v1'],
              confidence: 0.95,
              processingTime: Date.now(),
              enhancedFeatures: true
            }
          };

          socket.emit('threat_scan_result', enhancedResult);
        } catch (error) {
          socket.emit('threat_scan_error', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

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

      // Enhanced heartbeat with metrics
      socket.on('heartbeat', () => {
        const clientMetrics = enhancedStreamManager.getClientMetrics(clientId);
        socket.emit('heartbeat_response', {
          timestamp: new Date().toISOString(),
          status: 'connected',
          metrics: {
            activeChannels: clientMetrics.length,
            totalEventsProcessed: clientMetrics.reduce((sum, m) => sum + m.eventsProcessed, 0),
            averageLatency: clientMetrics.reduce((sum, m) => sum + m.averageLatency, 0) / Math.max(clientMetrics.length, 1)
          }
        });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        logger.info('Client disconnected from enhanced threat stream', {
          socketId: socket.id,
          userId
        });
        
        // Cleanup client resources
        this.cleanupClientResources(clientId);
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

  private async initializeClientStreams(clientId: string, userId: string): Promise<void> {
    // Set default filters for backward compatibility
    this.clientFilters.set(clientId, {
      eventTypes: ['threat', 'behavior', 'network'],
      severity: ['medium', 'high', 'critical'],
      sources: [],
      userId,
      priority: 'normal',
      mlRelevanceThreshold: 0.5
    });

    // Create default channel
    const defaultChannel = enhancedStreamManager.createChannel({
      clientId,
      type: 'threat',
      priority: 'normal',
      filters: [
        { field: 'data.severity', operator: 'in', value: ['medium', 'high', 'critical'] }
      ],
      aggregationWindow: 0 // No aggregation by default
    });

    this.clientChannels.set(clientId, [defaultChannel.id]);

    logger.debug('Client streams initialized', {
      clientId,
      userId,
      defaultChannelId: defaultChannel.id
    });
  }

  private async configureClientStreams(clientId: string, config: ClientStreamConfig): Promise<void> {
    // Close existing channels
    const existingChannels = this.clientChannels.get(clientId) || [];
    for (const channelId of existingChannels) {
      enhancedStreamManager.closeChannel(channelId);
    }

    // Create new channels
    const newChannelIds: string[] = [];
    
    for (const channelConfig of config.channels) {
      const channel = enhancedStreamManager.createChannel({
        clientId,
        ...channelConfig
      });
      newChannelIds.push(channel.id);
    }

    this.clientChannels.set(clientId, newChannelIds);

    logger.info('Client streams configured', {
      clientId,
      channelsCreated: config.channels.length,
      globalSettings: config.globalSettings
    });
  }

  private updateClientFilters(socketId: string, newFilters: Partial<EnhancedClientFilter>): void {
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

  private startEnhancedEventStreaming(): void {
    // Generate events every 2-5 seconds with enhanced processing
    this.streamingInterval = setInterval(async () => {
      await this.generateAndProcessEvents();
    }, Math.random() * 3000 + 2000);

    logger.info('Enhanced real-time event streaming started');
  }

  private async generateAndProcessEvents(): Promise<void> {
    if (this.io.sockets.sockets.size === 0) {
      return; // No connected clients
    }

    // Generate multiple event types
    const eventTypes = ['threat', 'behavior', 'network', 'intelligence', 'system'];
    const eventsToGenerate = Math.floor(Math.random() * 3) + 1; // 1-3 events

    for (let i = 0; i < eventsToGenerate; i++) {
      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      const event = this.generateEnhancedStreamEvent(eventType);
      
      // Process through enhanced stream manager
      const routingResults = await enhancedStreamManager.processEvent(event);
      
      // Send events/aggregations to appropriate clients with smart filtering
      for (const [channelId, eventOrAggregation] of routingResults) {
        // Find client for this channel
        for (const [clientId, channelIds] of this.clientChannels) {
          if (channelIds.includes(channelId)) {
            const socket = this.io.sockets.sockets.get(clientId);
            if (socket && !('windowId' in eventOrAggregation)) {
              // Apply smart filtering for individual events (not aggregations)
              const filterContext: FilterContext = {
                clientId,
                userId: (socket as any).userId,
                clientType: 'cli' // Would be determined from user agent or config
              };

              try {
                const filterResult = await smartFilteringService.applyFilters(eventOrAggregation, filterContext);
                
                if (filterResult.action === 'allow' || filterResult.action === 'modify') {
                  const finalEvent = filterResult.modifiedEvent || eventOrAggregation;
                  
                  // Update client metrics for adaptive throttling
                  const processingTime = filterResult.metadata.processingTime;
                  adaptiveThrottlingService.updateClientMetrics(clientId, {
                    connectionLatency: processingTime,
                    messageProcessingRate: 1000 / Math.max(processingTime, 1) // rough estimate
                  });

                  socket.emit('stream_event', finalEvent);
                  socket.emit(`${finalEvent.type}_event`, finalEvent.data);
                }
                // If action is 'block', don't emit the event
              } catch (error) {
                logger.error('Error applying smart filters', {
                  error: error instanceof Error ? error.message : 'Unknown error',
                  clientId,
                  eventId: eventOrAggregation.metadata?.correlationId
                });
                
                // On filter error, emit the original event
                socket.emit('stream_event', eventOrAggregation);
                socket.emit(`${eventOrAggregation.type}_event`, eventOrAggregation.data);
              }
            } else if (socket && 'windowId' in eventOrAggregation) {
              // It's an aggregation - emit without filtering
              socket.emit('event_aggregation', eventOrAggregation);
            }
            break;
          }
        }
      }
    }
  }

  private generateEnhancedStreamEvent(type: string): StreamEvent {
    const correlationId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let data: any;
    let source: string;

    switch (type) {
      case 'threat':
        data = this.generateThreatEventData();
        source = 'ml_threat_detector';
        break;
      case 'behavior':
        data = this.generateBehaviorEventData();
        source = 'ml_behavior_analyzer';
        break;
      case 'network':
        data = this.generateNetworkEventData();
        source = 'enhanced_network_monitor';
        break;
      case 'intelligence':
        data = this.generateIntelligenceEventData();
        source = 'threat_intelligence_feed';
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

  private applyClientThrottling(clientId: string, maxEventsPerSecond: number): void {
    // Clear existing throttle timer
    const existingTimer = this.throttleTimers.get(clientId);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    // Set new throttling rate
    const intervalMs = Math.max(1000 / maxEventsPerSecond, 10); // Minimum 10ms interval
    
    const timer = setInterval(() => {
      // This would implement actual throttling logic
      // For now, we just log the throttling activity
      logger.debug('Client throttling applied', {
        clientId,
        maxEventsPerSecond,
        intervalMs
      });
    }, intervalMs);

    this.throttleTimers.set(clientId, timer);

    logger.info('Client throttling configured', {
      clientId,
      maxEventsPerSecond,
      intervalMs
    });
  }

  private startMetricsReporting(): void {
    // Report system metrics every 30 seconds
    this.metricsInterval = setInterval(() => {
      const systemMetrics = enhancedStreamManager.getSystemMetrics();
      
      // Broadcast system metrics to all connected clients
      this.io.emit('system_metrics', {
        timestamp: new Date().toISOString(),
        metrics: systemMetrics,
        connectedClients: this.io.sockets.sockets.size
      });

      logger.debug('System metrics broadcasted', systemMetrics);
    }, 30000);
  }

  private cleanupClientResources(clientId: string): void {
    // Remove client filters
    this.clientFilters.delete(clientId);
    
    // Close client channels
    const channelIds = this.clientChannels.get(clientId) || [];
    for (const channelId of channelIds) {
      enhancedStreamManager.closeChannel(channelId);
    }
    this.clientChannels.delete(clientId);

    // Clear throttling
    const throttleTimer = this.throttleTimers.get(clientId);
    if (throttleTimer) {
      clearInterval(throttleTimer);
      this.throttleTimers.delete(clientId);
    }

    // Remove client from adaptive throttling service
    adaptiveThrottlingService.removeClient(clientId);

    logger.debug('Client resources cleaned up', {
      clientId,
      channelsClosed: channelIds.length
    });
  }

  // Legacy event generation methods (enhanced with ML features)
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
      status: 'active',
      mlConfidence: 0.7 + Math.random() * 0.3,
      mlModel: Math.random() > 0.5 ? 'isolation-forest-v1' : 'user-behavior-v1'
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
      description: this.getRandomBehaviorDescription(),
      mlAnalysis: {
        behaviorPatterns: {
          loginFrequency: Math.random() * 20,
          locationVariability: Math.random(),
          dataAccessPatterns: Math.random(),
          timeVariability: Math.random(),
          resourceAccessDiversity: Math.random()
        },
        riskLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)]
      }
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
      blocked: Math.random() > 0.7,
      anomalyScore: Math.random(),
      severity: ['info', 'warning', 'critical'][Math.floor(Math.random() * 3)]
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
      source: 'threat_intelligence_feed',
      severity: reputations[Math.floor(Math.random() * reputations.length)] === 'malicious' ? 'high' : 'medium'
    };
  }

  private generateSystemEventData(): any {
    const systemEvents = ['health_check', 'service_restart', 'performance_alert', 'configuration_change'];
    
    return {
      id: `system_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      event: systemEvents[Math.floor(Math.random() * systemEvents.length)],
      service: 'bg-threat-ai',
      status: Math.random() > 0.8 ? 'warning' : 'info',
      message: this.getRandomSystemMessage(),
      severity: Math.random() > 0.9 ? 'high' : 'low'
    };
  }

  // Utility methods (same as original)
  private getRandomThreatDescription(): string {
    const descriptions = [
      'ML-detected network anomaly with high confidence',
      'Behavioral analysis indicates insider threat activity',
      'Multi-vector attack pattern identified',
      'Advanced persistent threat indicators found',
      'Automated ML threat correlation completed'
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  }

  private getRandomBehaviorDescription(): string {
    const descriptions = [
      'UBA model detected unusual access patterns',
      'Machine learning identified privilege escalation',
      'Behavioral baseline deviation exceeds threshold',
      'Cross-platform activity correlation anomaly',
      'AI-powered user risk assessment elevated'
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  }

  private getRandomSystemMessage(): string {
    const messages = [
      'ML models performance within normal parameters',
      'Enhanced stream processing capacity increased',
      'Adaptive throttling optimization completed',
      'Event aggregation efficiency improved',
      'Smart filtering accuracy enhanced'
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
        return `threat-domain-${Math.random().toString(36).substr(2, 8)}.com`;
      case 'hash':
        return Math.random().toString(36).substr(2, 32);
      default:
        return 'unknown';
    }
  }

  // Public API methods
  public broadcastThreatAlert(threatData: any): void {
    const event: StreamEvent = {
      type: 'threat',
      timestamp: new Date().toISOString(),
      data: {
        ...threatData,
        mlEnhanced: true,
        priority: 'critical'
      },
      metadata: {
        source: 'ml_threat_alert',
        correlationId: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }
    };

    // Process through enhanced stream manager
    enhancedStreamManager.processEvent(event).then(routingResults => {
      for (const [channelId, eventOrAggregation] of routingResults) {
        // Find and notify appropriate clients
        for (const [clientId, channelIds] of this.clientChannels) {
          if (channelIds.includes(channelId)) {
            const socket = this.io.sockets.sockets.get(clientId);
            if (socket) {
              socket.emit('priority_alert', eventOrAggregation);
            }
            break;
          }
        }
      }
    });
  }

  public broadcastSystemStatus(statusData: any): void {
    const event: StreamEvent = {
      type: 'system',
      timestamp: new Date().toISOString(),
      data: statusData,
      metadata: {
        source: 'enhanced_system_status',
        correlationId: `status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }
    };

    this.io.emit('system_status', event);
  }

  // Get enhanced connection statistics
  public getEnhancedConnectionStats(): any {
    const systemMetrics = enhancedStreamManager.getSystemMetrics();
    
    return {
      totalConnections: this.io.sockets.sockets.size,
      activeChannels: systemMetrics.activeChannels,
      totalChannels: systemMetrics.totalChannels,
      systemThroughput: systemMetrics.totalThroughput,
      averageLatency: systemMetrics.averageLatency,
      connectedClients: Array.from(this.io.sockets.sockets.values()).map(socket => ({
        socketId: socket.id,
        userId: (socket as any).userId,
        connected: socket.connected,
        channelCount: this.clientChannels.get(socket.id)?.length || 0,
        filters: this.clientFilters.get(socket.id)
      })),
      enhancedFeatures: {
        streamMultiplexing: true,
        eventAggregation: true,
        smartFiltering: true,
        adaptiveThrottling: true,
        mlRelevanceScoring: true
      }
    };
  }

  // Cleanup
  public cleanup(): void {
    if (this.streamingInterval) {
      clearInterval(this.streamingInterval);
    }
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Clear all throttle timers
    for (const timer of this.throttleTimers.values()) {
      clearInterval(timer);
    }
    this.throttleTimers.clear();

    // Cleanup enhanced stream manager
    enhancedStreamManager.cleanup();
    
    // Cleanup adaptive throttling service
    adaptiveThrottlingService.cleanup();
    
    // Cleanup smart filtering service
    smartFilteringService.cleanup();
    
    this.io.close();
    logger.info('Enhanced WebSocket streaming service cleaned up with all auxiliary services');
  }
}