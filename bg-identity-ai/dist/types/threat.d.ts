export interface ThreatEvent {
    id: string;
    timestamp: string;
    type: 'malware' | 'intrusion' | 'anomaly' | 'behavioral' | 'network';
    severity: 'low' | 'medium' | 'high' | 'critical';
    source: string;
    target?: string;
    description: string;
    riskScore: number;
    status: 'active' | 'resolved' | 'false_positive' | 'investigating';
    metadata: {
        correlationId: string;
        source: string;
        [key: string]: any;
    };
}
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
export interface ThreatDetectionRequest {
    target: string;
    timestamp: string;
}
export interface BehaviorAnalysisRequest {
    target: string;
    timeRange: {
        start: string;
        end: string;
    };
    analysisType: 'user' | 'system' | 'network';
    metrics: string[];
}
export interface NetworkMonitoringOptions {
    duration?: number;
    filters?: string[];
    realtime?: boolean;
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
//# sourceMappingURL=threat.d.ts.map