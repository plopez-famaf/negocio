export interface CLIConfig {
    apiUrl: string;
    token?: string;
    userId?: string;
    preferences: {
        theme: 'dark' | 'light';
        outputFormat: 'json' | 'table' | 'text';
        realTimeUpdates: boolean;
        notifications: boolean;
    };
}
export interface AuthCredentials {
    email: string;
    password: string;
}
export interface AuthToken {
    token: string;
    expiresAt: string;
    userId: string;
    permissions: string[];
}
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
export interface ThreatScanResult {
    scanId: string;
    startTime: string;
    endTime?: string;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    targetsScanned: number;
    threatsFound: number;
    threats: ThreatEvent[];
    summary: {
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
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
export interface NetworkScanTarget {
    network: string;
    ports?: number[];
    timeout?: number;
    includePorts?: boolean;
}
export interface ThreatIntelligenceQuery {
    type: 'ip' | 'domain' | 'hash' | 'url';
    value: string;
    sources?: string[];
}
export interface ThreatIntelligenceResult {
    query: string;
    type: string;
    reputation: 'clean' | 'suspicious' | 'malicious' | 'unknown';
    confidence: number;
    sources: {
        name: string;
        reputation: string;
        lastSeen?: string;
        tags: string[];
    }[];
    context: {
        country?: string;
        asn?: string;
        organization?: string;
        category?: string[];
    };
}
export interface StreamEvent {
    type: 'threat' | 'behavior' | 'network' | 'system';
    timestamp: string;
    data: any;
    metadata: {
        source: string;
        correlationId: string;
    };
}
export interface ReportRequest {
    type: 'threats' | 'behavior' | 'network' | 'intelligence' | 'summary';
    timeRange: {
        start: string;
        end: string;
    };
    format: 'json' | 'csv' | 'pdf' | 'html';
    filters?: Record<string, any>;
    includeCharts?: boolean;
}
export interface ReportResult {
    reportId: string;
    type: string;
    generatedAt: string;
    timeRange: {
        start: string;
        end: string;
    };
    format: string;
    size: number;
    downloadUrl?: string;
    data?: any;
}
export interface CommandContext {
    config: CLIConfig;
    output: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
    spinner: (text: string) => {
        stop: (symbol?: string) => void;
    };
}
export interface CommandOptions {
    [key: string]: any;
}
export interface TerminalMetrics {
    threatsActive: number;
    riskScore: number;
    systemStatus: 'healthy' | 'warning' | 'critical';
    lastUpdate: string;
    uptime: string;
}
export interface DashboardWidget {
    id: string;
    title: string;
    type: 'metric' | 'chart' | 'log' | 'table';
    position: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    data: any;
    updateInterval?: number;
}
export interface APIResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
//# sourceMappingURL=index.d.ts.map