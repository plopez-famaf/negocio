import { logger } from '@/lib/logger';
import { StreamEvent } from '@/types/threat';

export interface StreamChannel {
  id: string;
  type: 'threat' | 'behavior' | 'network' | 'intelligence' | 'system' | 'custom';
  filters: AdvancedFilter[];
  priority: 'low' | 'normal' | 'high' | 'critical';
  aggregationWindow?: number; // milliseconds
  clientId: string;
  lastActivity: string;
  eventCount: number;
}

export interface AdvancedFilter {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'regex' | 'ml_relevance';
  value: any;
  weight?: number; // for ML relevance scoring
}

export interface EventAggregation {
  windowId: string;
  events: StreamEvent[];
  aggregatedAt: string;
  totalEvents: number;
  summary: {
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    uniqueSources: string[];
    timeRange: { start: string; end: string };
  };
}

export interface StreamMetrics {
  channelId: string;
  eventsProcessed: number;
  eventsFiltered: number;
  eventsAggregated: number;
  averageLatency: number;
  throughputPerSecond: number;
  filterEfficiency: number;
  clientCapacity: 'low' | 'normal' | 'high';
}

export class EnhancedStreamManager {
  private channels: Map<string, StreamChannel> = new Map();
  private eventBuffer: Map<string, StreamEvent[]> = new Map();
  private aggregationTimers: Map<string, NodeJS.Timeout> = new Map();
  private channelMetrics: Map<string, StreamMetrics> = new Map();
  private mlRelevanceScorer?: MLRelevanceScorer;

  constructor() {
    this.initializeMLScorer();
    this.startMetricsCollection();
    
    logger.info('Enhanced Stream Manager initialized', {
      features: [
        'stream_multiplexing',
        'event_aggregation',
        'smart_filtering',
        'adaptive_throttling',
        'ml_relevance_scoring'
      ]
    });
  }

  /**
   * Create a new stream channel with advanced configuration
   */
  createChannel(config: {
    clientId: string;
    type: StreamChannel['type'];
    priority: StreamChannel['priority'];
    filters: AdvancedFilter[];
    aggregationWindow?: number;
  }): StreamChannel {
    const channelId = `${config.clientId}_${config.type}_${Date.now()}`;
    
    const channel: StreamChannel = {
      id: channelId,
      type: config.type,
      filters: config.filters,
      priority: config.priority,
      aggregationWindow: config.aggregationWindow || 5000, // 5 seconds default
      clientId: config.clientId,
      lastActivity: new Date().toISOString(),
      eventCount: 0
    };

    this.channels.set(channelId, channel);
    this.eventBuffer.set(channelId, []);
    this.initializeChannelMetrics(channelId);

    // Set up aggregation timer if needed
    if (channel.aggregationWindow && channel.aggregationWindow > 0) {
      this.setupAggregationTimer(channelId, channel.aggregationWindow);
    }

    logger.info('Stream channel created', {
      channelId,
      clientId: config.clientId,
      type: config.type,
      priority: config.priority,
      filtersCount: config.filters.length,
      aggregationWindow: channel.aggregationWindow
    });

    return channel;
  }

  /**
   * Process and route events to appropriate channels
   */
  async processEvent(event: StreamEvent): Promise<Map<string, StreamEvent | EventAggregation>> {
    const routingResults = new Map<string, StreamEvent | EventAggregation>();
    const startTime = Date.now();

    // Find matching channels
    const matchingChannels = await this.findMatchingChannels(event);

    for (const channel of matchingChannels) {
      try {
        // Apply smart filtering
        const relevanceScore = await this.calculateRelevanceScore(event, channel);
        
        if (relevanceScore < this.getFilterThreshold(channel)) {
          this.updateChannelMetrics(channel.id, { eventsFiltered: 1 });
          continue;
        }

        // Enhance event with relevance metadata
        const enhancedEvent = {
          ...event,
          metadata: {
            ...event.metadata,
            relevanceScore,
            channelId: channel.id,
            priority: channel.priority,
            processedAt: new Date().toISOString()
          }
        };

        // Handle based on aggregation settings
        if (channel.aggregationWindow && channel.aggregationWindow > 0) {
          // Add to aggregation buffer
          this.addToAggregationBuffer(channel.id, enhancedEvent);
        } else {
          // Send immediately
          routingResults.set(channel.id, enhancedEvent);
        }

        // Update channel metrics
        this.updateChannelMetrics(channel.id, { 
          eventsProcessed: 1, 
          averageLatency: Date.now() - startTime 
        });

        // Update channel activity
        channel.lastActivity = new Date().toISOString();
        channel.eventCount++;

      } catch (error) {
        logger.error('Error processing event for channel', {
          channelId: channel.id,
          eventId: event.metadata?.correlationId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return routingResults;
  }

  /**
   * Update channel filters dynamically
   */
  updateChannelFilters(channelId: string, filters: AdvancedFilter[]): boolean {
    const channel = this.channels.get(channelId);
    if (!channel) {
      return false;
    }

    channel.filters = filters;
    channel.lastActivity = new Date().toISOString();

    logger.debug('Channel filters updated', {
      channelId,
      filtersCount: filters.length,
      clientId: channel.clientId
    });

    return true;
  }

  /**
   * Get channel performance metrics
   */
  getChannelMetrics(channelId: string): StreamMetrics | null {
    return this.channelMetrics.get(channelId) || null;
  }

  /**
   * Get all channel metrics for a client
   */
  getClientMetrics(clientId: string): StreamMetrics[] {
    const clientMetrics: StreamMetrics[] = [];
    
    for (const [channelId, channel] of this.channels) {
      if (channel.clientId === clientId) {
        const metrics = this.channelMetrics.get(channelId);
        if (metrics) {
          clientMetrics.push(metrics);
        }
      }
    }

    return clientMetrics;
  }

  /**
   * Adaptive throttling based on client capacity
   */
  async adaptiveThrottling(clientId: string): Promise<{
    recommendedRate: number;
    throttleLevel: 'none' | 'light' | 'moderate' | 'heavy';
    reason: string;
  }> {
    const clientChannels = Array.from(this.channels.values())
      .filter(channel => channel.clientId === clientId);

    if (clientChannels.length === 0) {
      return {
        recommendedRate: 1000,
        throttleLevel: 'none',
        reason: 'No active channels'
      };
    }

    // Calculate client load metrics
    const totalThroughput = clientChannels.reduce((sum, channel) => {
      const metrics = this.channelMetrics.get(channel.id);
      return sum + (metrics?.throughputPerSecond || 0);
    }, 0);

    const averageLatency = clientChannels.reduce((sum, channel) => {
      const metrics = this.channelMetrics.get(channel.id);
      return sum + (metrics?.averageLatency || 0);
    }, 0) / clientChannels.length;

    // Determine throttling strategy
    if (averageLatency > 1000) { // > 1 second latency
      return {
        recommendedRate: Math.max(totalThroughput * 0.5, 10),
        throttleLevel: 'heavy',
        reason: 'High client latency detected'
      };
    } else if (averageLatency > 500) {
      return {
        recommendedRate: Math.max(totalThroughput * 0.7, 50),
        throttleLevel: 'moderate',
        reason: 'Moderate client latency'
      };
    } else if (totalThroughput > 1000) {
      return {
        recommendedRate: Math.max(totalThroughput * 0.8, 100),
        throttleLevel: 'light',
        reason: 'High throughput volume'
      };
    }

    return {
      recommendedRate: totalThroughput,
      throttleLevel: 'none',
      reason: 'Client performing optimally'
    };
  }

  /**
   * Close channel and cleanup resources
   */
  closeChannel(channelId: string): boolean {
    const channel = this.channels.get(channelId);
    if (!channel) {
      return false;
    }

    // Clear aggregation timer
    const timer = this.aggregationTimers.get(channelId);
    if (timer) {
      clearInterval(timer);
      this.aggregationTimers.delete(channelId);
    }

    // Cleanup resources
    this.channels.delete(channelId);
    this.eventBuffer.delete(channelId);
    this.channelMetrics.delete(channelId);

    logger.info('Stream channel closed', {
      channelId,
      clientId: channel.clientId,
      totalEvents: channel.eventCount
    });

    return true;
  }

  /**
   * Close all channels for a client
   */
  closeClientChannels(clientId: string): number {
    let closedCount = 0;
    
    for (const [channelId, channel] of this.channels) {
      if (channel.clientId === clientId) {
        this.closeChannel(channelId);
        closedCount++;
      }
    }

    return closedCount;
  }

  // Private helper methods

  private async findMatchingChannels(event: StreamEvent): Promise<StreamChannel[]> {
    const matchingChannels: StreamChannel[] = [];

    for (const channel of this.channels.values()) {
      // Type-based matching
      if (channel.type !== 'custom' && channel.type !== event.type) {
        continue;
      }

      // Apply filters
      const filtersMatch = await this.applyFilters(event, channel.filters);
      if (filtersMatch) {
        matchingChannels.push(channel);
      }
    }

    // Sort by priority
    return matchingChannels.sort((a, b) => {
      const priorityOrder = { 'critical': 4, 'high': 3, 'normal': 2, 'low': 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private async applyFilters(event: StreamEvent, filters: AdvancedFilter[]): Promise<boolean> {
    if (filters.length === 0) return true;

    for (const filter of filters) {
      const fieldValue = this.getFieldValue(event, filter.field);
      
      switch (filter.operator) {
        case 'equals':
          if (fieldValue !== filter.value) return false;
          break;
        case 'contains':
          if (typeof fieldValue === 'string' && !fieldValue.includes(filter.value)) return false;
          break;
        case 'greater_than':
          if (typeof fieldValue === 'number' && fieldValue <= filter.value) return false;
          break;
        case 'less_than':
          if (typeof fieldValue === 'number' && fieldValue >= filter.value) return false;
          break;
        case 'in':
          if (Array.isArray(filter.value) && !filter.value.includes(fieldValue)) return false;
          break;
        case 'regex':
          if (typeof fieldValue === 'string') {
            const regex = new RegExp(filter.value);
            if (!regex.test(fieldValue)) return false;
          }
          break;
        case 'ml_relevance':
          // ML relevance is handled separately
          break;
      }
    }

    return true;
  }

  private async calculateRelevanceScore(event: StreamEvent, channel: StreamChannel): Promise<number> {
    let baseScore = 0.5; // Default relevance

    // Priority-based scoring
    const severityScore = this.getSeverityScore(event);
    const typeScore = event.type === channel.type ? 0.3 : 0.1;
    
    baseScore = severityScore * 0.4 + typeScore + 0.3;

    // ML-based relevance (if available)
    if (this.mlRelevanceScorer) {
      try {
        const mlScore = await this.mlRelevanceScorer.calculateRelevance(event, channel);
        baseScore = (baseScore + mlScore) / 2; // Average with ML score
      } catch (error) {
        logger.warn('ML relevance scoring failed, using base score', {
          eventId: event.metadata?.correlationId,
          channelId: channel.id
        });
      }
    }

    return Math.max(0, Math.min(1, baseScore));
  }

  private getSeverityScore(event: StreamEvent): number {
    if (!event.data?.severity) return 0.5;
    
    const severityScores = {
      'critical': 1.0,
      'high': 0.8,
      'medium': 0.6,
      'low': 0.3,
      'info': 0.1
    };
    
    return severityScores[event.data.severity as keyof typeof severityScores] || 0.5;
  }

  private getFilterThreshold(channel: StreamChannel): number {
    // Dynamic thresholds based on priority
    const thresholds = {
      'critical': 0.9,
      'high': 0.7,
      'normal': 0.5,
      'low': 0.3
    };
    
    return thresholds[channel.priority];
  }

  private getFieldValue(event: StreamEvent, fieldPath: string): any {
    const fields = fieldPath.split('.');
    let value: any = event;
    
    for (const field of fields) {
      if (value && typeof value === 'object') {
        value = value[field];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  private addToAggregationBuffer(channelId: string, event: StreamEvent): void {
    const buffer = this.eventBuffer.get(channelId);
    if (buffer) {
      buffer.push(event);
    }
  }

  private setupAggregationTimer(channelId: string, windowMs: number): void {
    const timer = setInterval(() => {
      this.processAggregationWindow(channelId);
    }, windowMs);
    
    this.aggregationTimers.set(channelId, timer);
  }

  private processAggregationWindow(channelId: string): void {
    const buffer = this.eventBuffer.get(channelId);
    if (!buffer || buffer.length === 0) return;

    const windowId = `${channelId}_${Date.now()}`;
    const events = [...buffer]; // Copy events
    buffer.length = 0; // Clear buffer

    // Create aggregation
    const aggregation: EventAggregation = {
      windowId,
      events,
      aggregatedAt: new Date().toISOString(),
      totalEvents: events.length,
      summary: this.createEventSummary(events)
    };

    // Emit aggregation (this would be handled by the WebSocket service)
    this.emitAggregation(channelId, aggregation);

    // Update metrics
    this.updateChannelMetrics(channelId, { eventsAggregated: events.length });
  }

  private createEventSummary(events: StreamEvent[]): EventAggregation['summary'] {
    const summary = {
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      uniqueSources: new Set<string>(),
      timeRange: {
        start: events[0]?.timestamp || new Date().toISOString(),
        end: events[events.length - 1]?.timestamp || new Date().toISOString()
      }
    };

    for (const event of events) {
      // Count by severity
      switch (event.data?.severity) {
        case 'critical':
          summary.criticalCount++;
          break;
        case 'high':
          summary.highCount++;
          break;
        case 'medium':
          summary.mediumCount++;
          break;
        case 'low':
          summary.lowCount++;
          break;
      }

      // Track unique sources
      if (event.metadata?.source) {
        summary.uniqueSources.add(event.metadata.source);
      }
    }

    return {
      ...summary,
      uniqueSources: Array.from(summary.uniqueSources)
    };
  }

  private emitAggregation(channelId: string, aggregation: EventAggregation): void {
    // This would be implemented by the WebSocket service
    // For now, just log the aggregation
    logger.debug('Event aggregation ready', {
      channelId,
      windowId: aggregation.windowId,
      totalEvents: aggregation.totalEvents,
      criticalEvents: aggregation.summary.criticalCount
    });
  }

  private initializeChannelMetrics(channelId: string): void {
    this.channelMetrics.set(channelId, {
      channelId,
      eventsProcessed: 0,
      eventsFiltered: 0,
      eventsAggregated: 0,
      averageLatency: 0,
      throughputPerSecond: 0,
      filterEfficiency: 0,
      clientCapacity: 'normal'
    });
  }

  private updateChannelMetrics(channelId: string, updates: Partial<StreamMetrics>): void {
    const metrics = this.channelMetrics.get(channelId);
    if (!metrics) return;

    // Update metrics with running averages
    if (updates.eventsProcessed) {
      metrics.eventsProcessed += updates.eventsProcessed;
    }
    
    if (updates.eventsFiltered) {
      metrics.eventsFiltered += updates.eventsFiltered;
    }
    
    if (updates.eventsAggregated) {
      metrics.eventsAggregated += updates.eventsAggregated;
    }
    
    if (updates.averageLatency && metrics.eventsProcessed > 0) {
      metrics.averageLatency = ((metrics.averageLatency * (metrics.eventsProcessed - 1)) + updates.averageLatency) / metrics.eventsProcessed;
    }

    // Calculate derived metrics
    metrics.filterEfficiency = metrics.eventsProcessed > 0 
      ? (metrics.eventsFiltered / (metrics.eventsProcessed + metrics.eventsFiltered)) * 100
      : 0;

    // Update throughput (calculated periodically)
    const now = Date.now();
    const timeWindow = 60000; // 1 minute
    metrics.throughputPerSecond = metrics.eventsProcessed / (timeWindow / 1000);
  }

  private initializeMLScorer(): void {
    try {
      // Initialize ML relevance scorer if available
      // This would integrate with the ML models from Phase 1
      logger.debug('ML relevance scoring initialized');
    } catch (error) {
      logger.warn('ML relevance scoring not available, using rule-based scoring', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private startMetricsCollection(): void {
    // Update throughput metrics every minute
    setInterval(() => {
      for (const [channelId, metrics] of this.channelMetrics) {
        // Reset throughput calculation window
        const channel = this.channels.get(channelId);
        if (channel) {
          // Calculate throughput per second over the last minute
          // This is a simplified calculation - in production you'd track time windows
          metrics.throughputPerSecond = metrics.eventsProcessed / 60;
        }
      }
    }, 60000);
  }

  /**
   * Get system-wide streaming metrics
   */
  getSystemMetrics(): {
    totalChannels: number;
    activeChannels: number;
    totalThroughput: number;
    averageLatency: number;
    totalEventsProcessed: number;
  } {
    const activeChannels = Array.from(this.channels.values())
      .filter(channel => {
        const lastActivity = new Date(channel.lastActivity).getTime();
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        return lastActivity > fiveMinutesAgo;
      }).length;

    let totalThroughput = 0;
    let totalLatency = 0;
    let totalEventsProcessed = 0;
    let activeMetricsCount = 0;

    for (const metrics of this.channelMetrics.values()) {
      totalThroughput += metrics.throughputPerSecond;
      totalLatency += metrics.averageLatency;
      totalEventsProcessed += metrics.eventsProcessed;
      activeMetricsCount++;
    }

    return {
      totalChannels: this.channels.size,
      activeChannels,
      totalThroughput,
      averageLatency: activeMetricsCount > 0 ? totalLatency / activeMetricsCount : 0,
      totalEventsProcessed
    };
  }

  /**
   * Cleanup all resources
   */
  cleanup(): void {
    // Clear all timers
    for (const timer of this.aggregationTimers.values()) {
      clearInterval(timer);
    }
    
    // Clear all data structures
    this.channels.clear();
    this.eventBuffer.clear();
    this.aggregationTimers.clear();
    this.channelMetrics.clear();

    logger.info('Enhanced Stream Manager cleaned up', {
      message: 'All channels and resources released'
    });
  }
}

// ML Relevance Scorer interface (would be implemented separately)
interface MLRelevanceScorer {
  calculateRelevance(event: StreamEvent, channel: StreamChannel): Promise<number>;
}

// Singleton instance
export const enhancedStreamManager = new EnhancedStreamManager();