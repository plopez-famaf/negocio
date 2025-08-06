import { AuthCredentials, AuthToken, ThreatScanResult, BehaviorAnalysisRequest, BehaviorAnalysisResult, NetworkScanTarget, NetworkEvent, ThreatIntelligenceQuery, ThreatIntelligenceResult, ReportRequest, ReportResult } from '@/types';
declare class APIClient {
    private client;
    constructor();
    private setupInterceptors;
    login(credentials: AuthCredentials): Promise<AuthToken>;
    logout(): Promise<void>;
    validateToken(): Promise<boolean>;
    startThreatScan(targets: string[], options?: any): Promise<ThreatScanResult>;
    getThreatScanStatus(scanId: string): Promise<ThreatScanResult>;
    getThreats(filters?: any): Promise<any[]>;
    analyzeBehavior(request: BehaviorAnalysisRequest): Promise<BehaviorAnalysisResult>;
    getBehaviorPatterns(target: string, timeRange?: any): Promise<any[]>;
    scanNetwork(target: NetworkScanTarget): Promise<any>;
    getNetworkEvents(filters?: any): Promise<NetworkEvent[]>;
    queryThreatIntel(query: ThreatIntelligenceQuery): Promise<ThreatIntelligenceResult>;
    generateReport(request: ReportRequest): Promise<ReportResult>;
    getReportStatus(reportId: string): Promise<ReportResult>;
    getSystemHealth(): Promise<any>;
    getMetrics(timeRange?: any): Promise<any>;
}
export declare const apiClient: APIClient;
export {};
//# sourceMappingURL=api.d.ts.map