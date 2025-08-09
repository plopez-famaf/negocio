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
export declare class ThreatDetectionService {
    private complianceManager;
    constructor();
    detectThreatsRealtime(events: any[], source: string, userId: string): Promise<ThreatDetectionResult>;
    analyzeBehavior(request: BehaviorAnalysisRequest): Promise<BehaviorAnalysisResult>;
    monitorNetwork(targets: string[], options: any): Promise<NetworkMonitoringResult>;
    queryThreatIntelligence(indicators: string[], sources?: string[]): Promise<ThreatIntelligenceResult>;
    correlateThreats(events: ThreatEvent[], timeWindow?: string, correlationRules?: any): Promise<any>;
    getThreatHistory(filters: any): Promise<ThreatEvent[]>;
    getRiskProfile(target: string): Promise<any>;
    private calculateThreatProbability;
    private generateThreatEvent;
    private generateThreatDescription;
    private calculateOverallRiskScore;
    private generateBehaviorPattern;
    private calculateBehaviorRiskScore;
    private generateRecommendations;
    private generateNetworkEvent;
    private getTopSources;
    private getTopTargets;
    private detectIndicatorType;
    private generateReputationScore;
    private generateThreatContext;
    private findThreatCorrelations;
    private generateRandomThreatEvent;
    private simulateProcessingDelay;
    cleanup(): Promise<void>;
}
//# sourceMappingURL=threat-detection-service.d.ts.map