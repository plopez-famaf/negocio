import { Server as HttpServer } from 'http';
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
export declare class WebSocketStreamService {
    private io;
    private threatService;
    private clientFilters;
    private streamingInterval?;
    constructor(server: HttpServer);
    private setupSocketHandlers;
    private authenticateSocket;
    private updateClientFilters;
    private startEventStreaming;
    private generateAndBroadcastEvents;
    private generateStreamEvent;
    private generateThreatEventData;
    private generateBehaviorEventData;
    private generateNetworkEventData;
    private generateIntelligenceEventData;
    private generateSystemEventData;
    private broadcastEvent;
    private eventMatchesFilters;
    broadcastThreatAlert(threatData: any): void;
    broadcastSystemStatus(statusData: any): void;
    private getRandomThreatDescription;
    private getRandomBehaviorDescription;
    private getRandomSystemMessage;
    private generateRandomIndicator;
    getConnectionStats(): any;
    cleanup(): void;
}
//# sourceMappingURL=websocket-stream-service.d.ts.map