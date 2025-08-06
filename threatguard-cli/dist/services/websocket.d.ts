export interface WebSocketClientOptions {
    autoReconnect?: boolean;
    reconnectAttempts?: number;
    reconnectInterval?: number;
    filters?: {
        eventTypes?: string[];
        severity?: string[];
        sources?: string[];
    };
}
export declare class WebSocketClient {
    private socket;
    private options;
    private connected;
    private eventHandlers;
    private reconnectAttempts;
    constructor(options?: WebSocketClientOptions);
    connect(): Promise<void>;
    private setupEventHandlers;
    private scheduleReconnect;
    updateFilters(filters: any): void;
    requestThreatScan(targets: string[], options?: any): void;
    requestBehaviorAnalysis(target: string, timeRange?: any, analysisType?: string): void;
    requestNetworkMonitoring(targets: string[], options?: any): void;
    sendHeartbeat(): void;
    on(event: string, callback: Function): void;
    off(event: string, callback?: Function): void;
    private emit;
    isConnected(): boolean;
    getConnectionInfo(): any;
    disconnect(): void;
    cleanup(): void;
}
export declare const wsClient: WebSocketClient;
//# sourceMappingURL=websocket.d.ts.map