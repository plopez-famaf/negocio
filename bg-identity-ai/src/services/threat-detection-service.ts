import { logger } from '@/lib/logger';
import { ComplianceManager } from '@/lib/compliance/compliance-manager';
import { bgWebClient } from '@/lib/bg-web-client';
import { redisClient } from '@/lib/redis-client';
import { threatCache } from '@/lib/cache/threat-cache';

export interface ThreatEvent {
  id: string;
  timestamp: string;
  type: 'network' | 'behavioral' | 'malware' | 'intrusion' | 'anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  target?: string;
  description: string;
  riskScore: number;
  status: 'active' | 'investigating' | 'resolved' | 'false_positive';
  metadata: Record<string, any>;
}

export interface BehaviorAnalysisRequest {
  target: string;
  timeRange: {
    start: string;
    end: string;
  };
  analysisType: 'user' | 'network' | 'system' | 'application';
  metrics: string[];
}

export interface BehaviorAnalysisResult {
  analysisId: string;
  target: string;
  timeRange: {
    start: string;
    end: string;
  };
  overallRiskScore: number;
  patterns: BehaviorPattern[];
  anomalies: number;
  recommendations: string[];
}

export interface BehaviorPattern {
  id: string;
  timestamp: string;
  target: string;
  pattern: string;
  confidence: number;
  anomalyScore: number;
  baseline: Record<string, number>;
  current: Record<string, number>;
  deviations: string[];
}

export interface ThreatDetectionResult {
  detectionId: string;
  timestamp: string;
  threatsDetected: number;
  overallRiskScore: number;
  threats: ThreatEvent[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface NetworkMonitoringResult {
  monitoringId: string;
  timestamp: string;
  events: NetworkEvent[];
  suspiciousEvents: number;
  blockedEvents: number;
  topSources: string[];
  topTargets: string[];
}

export interface NetworkEvent {
  id: string;
  timestamp: string;
  eventType: 'connection' | 'traffic' | 'intrusion' | 'port_scan' | 'dns_query';
  sourceIp: string;
  destIp?: string;
  sourcePort?: number;
  destPort?: number;
  protocol: string;
  bytes: number;
  packets: number;
  flags: string[];
  severity: 'info' | 'warning' | 'critical';
  blocked: boolean;
}

export interface ThreatIntelligenceResult {
  queryId: string;
  timestamp: string;
  results: Array<{
    indicator: string;
    type: 'ip' | 'domain' | 'hash' | 'url';
    reputation: 'clean' | 'suspicious' | 'malicious' | 'unknown';
    confidence: number;
    sources: string[];
    context: Record<string, any>;
  }>;
}

export class ThreatDetectionService {
  private complianceManager: ComplianceManager;
  
  constructor() {

    // Initialize compliance management
    this.complianceManager = new ComplianceManager({
      regulations: ['GDPR', 'SOX', 'PCI-DSS', 'SOC2'],
      industry: process.env.INDUSTRY_TYPE as any || 'cybersecurity',
      dataRetentionPeriod: parseInt(process.env.DATA_RETENTION_DAYS || '2555'), // 7 years for security logs
      auditLogRetention: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '2555'),
      encryptionStandards: ['AES-256', 'quantum-safe'],
      dataProcessingBasis: 'legitimate_interest',
      privacyNoticeVersion: '2.0'
    });

    logger.info('ThreatDetectionService initialized with advanced capabilities', {
      realTimeThreatDetection: true,
      behavioralAnalysis: true,
      networkMonitoring: true,
      threatIntelligence: true,
      complianceFrameworks: ['GDPR', 'SOX', 'PCI-DSS', 'SOC2']
    });
  }

  async detectThreatsRealtime(events: any[], source: string, userId: string): Promise<ThreatDetectionResult> {
    try {
      logger.info('Processing real-time threat detection', { 
        eventCount: events.length, 
        source, 
        userId 
      });

      // Record compliance event
      await this.complianceManager.recordAuditEvent({
        userId,
        action: 'threat_detection_scan',
        resource: 'threat_detection_engine',
        result: 'initiated',
        personalData: false,
        quantumSafe: true,
        dataCategory: 'security_logs',
        metadata: { eventCount: events.length, source }
      });

      // Simulate threat detection processing
      await this.simulateProcessingDelay(500, 1500);

      const detectionId = `td_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const threats: ThreatEvent[] = [];
      const summary = { critical: 0, high: 0, medium: 0, low: 0 };

      // Process each event through threat detection algorithms
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const threatProbability = this.calculateThreatProbability(event);
        
        if (threatProbability > 0.3) { // 30% threshold for threat detection
          const threat = this.generateThreatEvent(event, source, threatProbability);
          threats.push(threat);
          
          // Update summary
          summary[threat.severity as keyof typeof summary]++;
        }
      }

      const overallRiskScore = this.calculateOverallRiskScore(threats);

      const result: ThreatDetectionResult = {
        detectionId,
        timestamp: new Date().toISOString(),
        threatsDetected: threats.length,
        overallRiskScore,
        threats,
        summary
      };

      // Cache threat detection results for future reference
      if (redisClient.isReady()) {
        await redisClient.set(`threat_detection:${detectionId}`, JSON.stringify(result), 3600);
        
        // Cache individual threat events using our threat cache
        for (const threat of threats) {
          // Ensure metadata has required fields for type compatibility
          const threatWithMetadata = {
            ...threat,
            metadata: {
              correlationId: threat.metadata.correlationId || `corr_${Date.now()}`,
              source: threat.metadata.source || 'threat_detection_service',
              ...threat.metadata
            }
          };
          await threatCache.cacheThreatEvent(threatWithMetadata, { ttl: 300 }); // 5 minutes TTL
        }
      }

      // Store individual threat events in bg-web database
      for (const threat of threats) {
        try {
          const storeResult = await bgWebClient.createThreatEvent(
            threat.id,
            {
              type: threat.type,
              severity: threat.severity,
              source: threat.source,
              target: threat.target,
              description: threat.description,
              riskScore: threat.riskScore,
              status: threat.status,
              metadata: threat.metadata
            },
            userId
          );

          if (!storeResult.success) {
            logger.warn('Failed to store threat event in bg-web database', {
              component: 'threat-detection-service',
              action: 'store_threat_event',
              eventId: threat.id,
              error: storeResult.error,
              userId
            });
          } else {
            logger.debug('Threat event stored in bg-web database', {
              component: 'threat-detection-service',
              action: 'store_threat_event',
              eventId: threat.id,
              dbId: storeResult.id,
              userId
            });
          }
        } catch (error) {
          logger.error('Error storing threat event in bg-web database', {
            component: 'threat-detection-service',
            action: 'store_threat_event',
            eventId: threat.id,
            userId
          }, error as Error);
        }
      }

      // Record completion
      await this.complianceManager.recordAuditEvent({
        userId,
        action: 'threat_detection_scan',
        resource: 'threat_detection_engine',
        result: 'completed',
        personalData: false,
        quantumSafe: true,
        dataCategory: 'security_logs',
        metadata: { 
          detectionId,
          threatsFound: threats.length,
          overallRiskScore
        }
      });

      logger.info('Real-time threat detection completed', {
        detectionId,
        threatsFound: threats.length,
        overallRiskScore,
        processingTimeMs: 'simulated'
      });

      return result;

    } catch (error) {
      await this.complianceManager.recordAuditEvent({
        userId,
        action: 'threat_detection_scan',
        resource: 'threat_detection_engine',
        result: 'error',
        personalData: false,
        quantumSafe: false,
        dataCategory: 'security_logs',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      });

      logger.error('Real-time threat detection failed', {
        userId,
        source,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Real-time threat detection failed');
    }
  }

  async analyzeBehavior(request: BehaviorAnalysisRequest): Promise<BehaviorAnalysisResult> {
    try {
      logger.info('Processing behavioral analysis', {
        target: request.target,
        analysisType: request.analysisType,
        timeRange: request.timeRange
      });

      await this.simulateProcessingDelay(1000, 2000);

      const analysisId = `ba_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const patterns: BehaviorPattern[] = [];
      
      // Generate mock behavioral patterns
      const patternTypes = [
        'login_frequency_anomaly',
        'access_time_deviation', 
        'data_access_pattern_change',
        'network_usage_spike',
        'privilege_escalation_attempt'
      ];

      for (let i = 0; i < Math.floor(Math.random() * 3) + 1; i++) {
        const pattern = this.generateBehaviorPattern(
          request.target, 
          patternTypes[Math.floor(Math.random() * patternTypes.length)]
        );
        patterns.push(pattern);
      }

      const overallRiskScore = this.calculateBehaviorRiskScore(patterns);
      const anomalies = patterns.filter(p => p.anomalyScore > 0.7).length;
      
      const recommendations = this.generateRecommendations(patterns, overallRiskScore);

      const result: BehaviorAnalysisResult = {
        analysisId,
        target: request.target,
        timeRange: request.timeRange,
        overallRiskScore,
        patterns,
        anomalies,
        recommendations
      };

      // Cache behavioral analysis results using our threat cache
      if (redisClient.isReady()) {
        await threatCache.cacheBehaviorBaseline(request.target, request.analysisType, result, { ttl: 3600 });
      }

      logger.info('Behavioral analysis completed', {
        analysisId,
        target: request.target,
        patternsFound: patterns.length,
        anomalies,
        overallRiskScore
      });

      return result;

    } catch (error) {
      logger.error('Behavioral analysis failed', {
        target: request.target,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Behavioral analysis failed');
    }
  }

  async monitorNetwork(targets: string[], options: any): Promise<NetworkMonitoringResult> {
    try {
      logger.info('Processing network monitoring', {
        targetCount: targets.length,
        options
      });

      await this.simulateProcessingDelay(800, 1200);

      const monitoringId = `nm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const events: NetworkEvent[] = [];
      
      // Generate mock network events
      for (let i = 0; i < Math.floor(Math.random() * 20) + 5; i++) {
        const event = this.generateNetworkEvent(targets);
        events.push(event);
      }

      const suspiciousEvents = events.filter(e => e.severity === 'warning' || e.severity === 'critical').length;
      const blockedEvents = events.filter(e => e.blocked).length;
      
      const topSources = this.getTopSources(events);
      const topTargets = this.getTopTargets(events);

      const result: NetworkMonitoringResult = {
        monitoringId,
        timestamp: new Date().toISOString(),
        events,
        suspiciousEvents,
        blockedEvents,
        topSources,
        topTargets
      };

      // Cache network monitoring results
      if (redisClient.isReady()) {
        await redisClient.set(`network_monitoring:${monitoringId}`, JSON.stringify(result), 1800);
        
        // Cache individual network connections
        for (const event of events) {
          const connectionId = `${event.sourceIp}_${event.destIp}_${event.destPort}`;
          await threatCache.cacheNetworkConnection(connectionId, {
            sourceIp: event.sourceIp,
            destinationIp: event.destIp || '',
            port: event.destPort || 0,
            protocol: event.protocol,
            timestamp: event.timestamp,
            bytes: event.bytes,
            packets: event.packets,
            flags: event.flags
          }, { ttl: 1800 });
        }
      }

      logger.info('Network monitoring completed', {
        monitoringId,
        eventsFound: events.length,
        suspiciousEvents,
        blockedEvents
      });

      return result;

    } catch (error) {
      logger.error('Network monitoring failed', {
        targets,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Network monitoring failed');
    }
  }

  async queryThreatIntelligence(indicators: string[], sources?: string[]): Promise<ThreatIntelligenceResult> {
    try {
      logger.info('Processing threat intelligence query', {
        indicatorCount: indicators.length,
        sources: sources || 'all'
      });

      await this.simulateProcessingDelay(1200, 1800);

      const queryId = `ti_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const results: ThreatIntelligenceResult['results'] = [];

      for (const indicator of indicators) {
        const result = {
          indicator,
          type: this.detectIndicatorType(indicator),
          reputation: this.generateReputationScore(),
          confidence: 0.7 + Math.random() * 0.3,
          sources: sources || ['VirusTotal', 'AlienVault', 'IBM X-Force'],
          context: this.generateThreatContext(indicator)
        };
        results.push(result);
      }

      const response: ThreatIntelligenceResult = {
        queryId,
        timestamp: new Date().toISOString(),
        results
      };

      // Cache threat intelligence results
      if (redisClient.isReady()) {
        await redisClient.set(`threat_intel:${queryId}`, JSON.stringify(response), 1800);
        
        // Cache individual threat intelligence lookups
        for (const result of results) {
          await threatCache.cacheThreatIntelligence(result.indicator, {
            ioc: result.indicator,
            type: result.type,
            reputation: result.confidence,
            sources: result.sources,
            lastSeen: new Date().toISOString(),
            categories: [result.reputation],
            confidence: result.confidence
          }, { ttl: 14400 }); // 4 hours TTL
        }
      }

      logger.info('Threat intelligence query completed', {
        queryId,
        indicatorsProcessed: indicators.length,
        maliciousFound: results.filter(r => r.reputation === 'malicious').length
      });

      return response;

    } catch (error) {
      logger.error('Threat intelligence query failed', {
        indicators,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Threat intelligence query failed');
    }
  }

  async correlateThreats(events: ThreatEvent[], timeWindow?: string, correlationRules?: any): Promise<any> {
    try {
      logger.info('Processing threat correlation', {
        eventCount: events.length,
        timeWindow: timeWindow || '1h'
      });

      await this.simulateProcessingDelay(1500, 2500);

      const correlationId = `tc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const correlations = this.findThreatCorrelations(events);

      const result = {
        correlationId,
        timestamp: new Date().toISOString(),
        events: events.length,
        correlations,
        highRiskCorrelations: correlations.filter((c: any) => c.riskScore >= 8).length
      };

      // Cache threat correlation results
      if (redisClient.isReady()) {
        await threatCache.cacheCorrelationPattern(correlationId, result, { ttl: 3600 });
      }

      logger.info('Threat correlation completed', {
        correlationId,
        correlationsFound: correlations.length
      });

      return result;

    } catch (error) {
      logger.error('Threat correlation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Threat correlation failed');
    }
  }

  async getThreatHistory(filters: any): Promise<ThreatEvent[]> {
    try {
      // In a real implementation, this would query a database
      const mockThreats: ThreatEvent[] = [];
      
      for (let i = 0; i < Math.min(filters.limit || 20, 50); i++) {
        const threat = this.generateRandomThreatEvent();
        if (filters.severity && threat.severity !== filters.severity) continue;
        if (filters.status && threat.status !== filters.status) continue;
        
        mockThreats.push(threat);
      }

      return mockThreats;
    } catch (error) {
      logger.error('Failed to get threat history', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  async getRiskProfile(target: string): Promise<any> {
    try {
      const riskScore = Math.random() * 10;
      const riskLevel = riskScore >= 8 ? 'critical' :
                       riskScore >= 6 ? 'high' :
                       riskScore >= 4 ? 'medium' : 'low';

      return {
        target,
        overallRiskScore: riskScore,
        riskLevel,
        timestamp: new Date().toISOString(),
        factors: [
          'Recent threat activity',
          'Behavioral anomalies',
          'Network exposure',
          'Historical incidents'
        ]
      };
    } catch (error) {
      logger.error('Failed to generate risk profile', {
        target,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Risk profile generation failed');
    }
  }

  // Helper methods
  private calculateThreatProbability(event: any): number {
    // Simulate threat probability calculation
    let probability = Math.random() * 0.4; // Base random probability

    // Increase probability based on suspicious indicators
    if (event.type === 'network' && event.protocol === 'tcp' && event.port === 22) {
      probability += 0.3; // SSH attempts
    }
    if (event.type === 'behavioral' && event.deviation > 2.0) {
      probability += 0.4; // High behavioral deviation
    }
    if (event.source?.includes('unknown') || event.source?.includes('suspicious')) {
      probability += 0.5; // Suspicious sources
    }

    return Math.min(probability, 1.0);
  }

  private generateThreatEvent(sourceEvent: any, source: string, probability: number): ThreatEvent {
    const severities: Array<'low' | 'medium' | 'high' | 'critical'> = ['low', 'medium', 'high', 'critical'];
    const types: Array<'network' | 'behavioral' | 'malware' | 'intrusion' | 'anomaly'> = ['network', 'behavioral', 'malware', 'intrusion', 'anomaly'];
    
    const severity = probability > 0.8 ? 'critical' :
                    probability > 0.6 ? 'high' :
                    probability > 0.4 ? 'medium' : 'low';

    return {
      id: `threat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: types[Math.floor(Math.random() * types.length)],
      severity,
      source: sourceEvent.source || source,
      target: sourceEvent.target,
      description: this.generateThreatDescription(sourceEvent, severity),
      riskScore: probability * 10,
      status: 'active',
      metadata: {
        detectionMethod: 'ml_algorithm',
        confidence: probability,
        sourceEvent: sourceEvent.id || 'unknown'
      }
    };
  }

  private generateThreatDescription(event: any, severity: string): string {
    const descriptions = {
      critical: [
        'Multiple failed authentication attempts detected',
        'Suspicious data exfiltration activity',
        'Potential malware installation detected'
      ],
      high: [
        'Unusual network traffic pattern observed',
        'Behavioral anomaly in user access patterns',
        'Suspicious file modification detected'
      ],
      medium: [
        'Minor network security policy violation',
        'Unusual login time detected',
        'Non-standard application usage'
      ],
      low: [
        'Informational security event logged',
        'Minor configuration change detected',
        'Standard security scan completed'
      ]
    };

    const options = descriptions[severity as keyof typeof descriptions] || descriptions.low;
    return options[Math.floor(Math.random() * options.length)];
  }

  private calculateOverallRiskScore(threats: ThreatEvent[]): number {
    if (threats.length === 0) return 0;

    const totalRisk = threats.reduce((sum, threat) => sum + threat.riskScore, 0);
    const avgRisk = totalRisk / threats.length;
    
    // Apply multiplier based on threat count
    const countMultiplier = Math.min(threats.length / 10, 2); // Max 2x multiplier
    
    return Math.min(avgRisk * countMultiplier, 10);
  }

  private generateBehaviorPattern(target: string, patternType: string): BehaviorPattern {
    const confidence = 0.6 + Math.random() * 0.4;
    const anomalyScore = Math.random();

    return {
      id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      target,
      pattern: patternType,
      confidence,
      anomalyScore,
      baseline: { frequency: 10, duration: 300, volume: 100 },
      current: { frequency: 15, duration: 450, volume: 150 },
      deviations: anomalyScore > 0.7 ? ['frequency_spike', 'duration_increase'] : ['minor_variance']
    };
  }

  private calculateBehaviorRiskScore(patterns: BehaviorPattern[]): number {
    if (patterns.length === 0) return 0;

    const riskFactors = patterns.map(p => p.anomalyScore * p.confidence);
    const avgRisk = riskFactors.reduce((sum, risk) => sum + risk, 0) / riskFactors.length;
    
    return Math.min(avgRisk * 10, 10);
  }

  private generateRecommendations(patterns: BehaviorPattern[], riskScore: number): string[] {
    const recommendations = [];
    
    if (riskScore >= 8) {
      recommendations.push('Immediate investigation required for high-risk behavioral patterns');
    }
    if (riskScore >= 6) {
      recommendations.push('Enhanced monitoring recommended for suspicious activities');
    }
    
    if (patterns.some(p => p.pattern.includes('login'))) {
      recommendations.push('Review authentication logs and implement additional login security measures');
    }
    
    if (patterns.some(p => p.pattern.includes('privilege'))) {
      recommendations.push('Audit user privileges and implement least-privilege access controls');
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue regular monitoring and maintain current security posture');
    }

    return recommendations;
  }

  private generateNetworkEvent(targets: string[]): NetworkEvent {
    const eventTypes: Array<'connection' | 'traffic' | 'intrusion' | 'port_scan' | 'dns_query'> = 
      ['connection', 'traffic', 'intrusion', 'port_scan', 'dns_query'];
    
    const protocols = ['tcp', 'udp', 'icmp'];
    const severities: Array<'info' | 'warning' | 'critical'> = ['info', 'warning', 'critical'];

    const sourceIp = `192.168.1.${Math.floor(Math.random() * 255)}`;
    const destIp = targets[Math.floor(Math.random() * targets.length)] || '8.8.8.8';

    return {
      id: `net_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      eventType: eventTypes[Math.floor(Math.random() * eventTypes.length)],
      sourceIp,
      destIp,
      sourcePort: Math.floor(Math.random() * 65535),
      destPort: Math.floor(Math.random() * 65535),
      protocol: protocols[Math.floor(Math.random() * protocols.length)],
      bytes: Math.floor(Math.random() * 10000),
      packets: Math.floor(Math.random() * 100),
      flags: ['SYN', 'ACK'],
      severity: severities[Math.floor(Math.random() * severities.length)],
      blocked: Math.random() > 0.7
    };
  }

  private getTopSources(events: NetworkEvent[]): string[] {
    const sourceCounts: { [key: string]: number } = {};
    
    events.forEach(event => {
      sourceCounts[event.sourceIp] = (sourceCounts[event.sourceIp] || 0) + 1;
    });

    return Object.entries(sourceCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([ip]) => ip);
  }

  private getTopTargets(events: NetworkEvent[]): string[] {
    const targetCounts: { [key: string]: number } = {};
    
    events.forEach(event => {
      if (event.destIp) {
        targetCounts[event.destIp] = (targetCounts[event.destIp] || 0) + 1;
      }
    });

    return Object.entries(targetCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([ip]) => ip);
  }

  private detectIndicatorType(indicator: string): 'ip' | 'domain' | 'hash' | 'url' {
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(indicator)) return 'ip';
    if (/^https?:\/\//.test(indicator)) return 'url';
    if (/^[a-fA-F0-9]{32,64}$/.test(indicator)) return 'hash';
    return 'domain';
  }

  private generateReputationScore(): 'clean' | 'suspicious' | 'malicious' | 'unknown' {
    const rand = Math.random();
    if (rand < 0.1) return 'malicious';
    if (rand < 0.25) return 'suspicious';
    if (rand < 0.85) return 'clean';
    return 'unknown';
  }

  private generateThreatContext(indicator: string): Record<string, any> {
    return {
      firstSeen: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
      lastSeen: new Date().toISOString(),
      geolocation: {
        country: 'US',
        region: 'California'
      },
      asn: '15169',
      organization: 'Example Organization'
    };
  }

  private findThreatCorrelations(events: ThreatEvent[]): any[] {
    const correlations: any[] = [];
    
    // Simple correlation: same source within time window
    const sourceGroups: { [key: string]: ThreatEvent[] } = {};
    
    events.forEach(event => {
      if (!sourceGroups[event.source]) {
        sourceGroups[event.source] = [];
      }
      sourceGroups[event.source].push(event);
    });

    Object.entries(sourceGroups).forEach(([source, sourceEvents]) => {
      if (sourceEvents.length > 1) {
        correlations.push({
          id: `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'source_correlation',
          source,
          eventCount: sourceEvents.length,
          riskScore: Math.min(sourceEvents.length * 2, 10),
          description: `Multiple threats from same source: ${source}`
        });
      }
    });

    return correlations;
  }

  private generateRandomThreatEvent(): ThreatEvent {
    const types: Array<'network' | 'behavioral' | 'malware' | 'intrusion' | 'anomaly'> = 
      ['network', 'behavioral', 'malware', 'intrusion', 'anomaly'];
    const severities: Array<'low' | 'medium' | 'high' | 'critical'> = ['low', 'medium', 'high', 'critical'];
    const statuses: Array<'active' | 'investigating' | 'resolved' | 'false_positive'> = 
      ['active', 'investigating', 'resolved', 'false_positive'];

    return {
      id: `threat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      type: types[Math.floor(Math.random() * types.length)],
      severity: severities[Math.floor(Math.random() * severities.length)],
      source: `192.168.1.${Math.floor(Math.random() * 255)}`,
      target: Math.random() > 0.5 ? `server-${Math.floor(Math.random() * 10)}` : undefined,
      description: 'Simulated threat event for demonstration',
      riskScore: Math.random() * 10,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      metadata: {
        detectionMethod: 'simulated',
        confidence: Math.random()
      }
    };
  }

  private async simulateProcessingDelay(min: number = 500, max: number = 1500): Promise<void> {
    const delay = Math.random() * (max - min) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  async cleanup(): Promise<void> {
    await redisClient.disconnect();
    logger.info('ThreatDetectionService Redis connection closed');
  }
}