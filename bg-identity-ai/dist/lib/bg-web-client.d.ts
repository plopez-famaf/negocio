interface ThreatEventData {
    type: 'network' | 'behavioral' | 'malware' | 'intrusion' | 'anomaly';
    severity: 'low' | 'medium' | 'high' | 'critical';
    source: string;
    target?: string;
    description: string;
    riskScore: number;
    status?: 'active' | 'investigating' | 'resolved' | 'false_positive';
    metadata?: Record<string, any>;
}
/**
 * Client for communicating with bg-web threat detection APIs
 */
export declare class BgWebClient {
    private client;
    private baseUrl;
    private apiKey;
    private correlationId;
    constructor();
    /**
     * Store a threat event in bg-web database
     */
    createThreatEvent(eventId: string, threatData: ThreatEventData, userId?: string): Promise<{
        success: boolean;
        id?: string;
        error?: string;
    }>;
    /**
     * Query threat events from bg-web database
     */
    queryThreatEvents(filters?: {
        severity?: 'low' | 'medium' | 'high' | 'critical';
        status?: 'active' | 'investigating' | 'resolved' | 'false_positive';
        type?: 'network' | 'behavioral' | 'malware' | 'intrusion' | 'anomaly';
        riskScoreMin?: number;
        riskScoreMax?: number;
        page?: number;
        limit?: number;
    }): Promise<{
        success: boolean;
        data?: any[];
        total?: number;
        error?: string;
    }>;
    /**
     * Update threat event status
     */
    updateThreatEventStatus(eventId: string, status: 'active' | 'investigating' | 'resolved' | 'false_positive'): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Get threat statistics from bg-web
     */
    getThreatStatistics(timeRange?: {
        start?: string;
        end?: string;
    }): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    /**
     * Test connectivity to bg-web API
     */
    testConnection(): Promise<{
        success: boolean;
        responseTime?: number;
        error?: string;
    }>;
    private generateCorrelationId;
    /**
     * Set custom correlation ID for request tracking
     */
    setCorrelationId(correlationId: string): void;
    /**
     * Update authentication token
     */
    updateAuthToken(token: string): void;
    /**
     * Get current configuration
     */
    getConfig(): {
        baseUrl: string;
        correlationId: string;
        timeout: number;
    };
}
export declare const bgWebClient: BgWebClient;
export {};
//# sourceMappingURL=bg-web-client.d.ts.map