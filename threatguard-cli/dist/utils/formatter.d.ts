import { ThreatEvent, BehaviorPattern, NetworkEvent, ThreatIntelligenceResult } from '@/types';
export declare class OutputFormatter {
    formatThreat(threat: ThreatEvent): string;
    formatThreatsTable(threats: ThreatEvent[]): string;
    formatBehaviorPattern(pattern: BehaviorPattern): string;
    formatNetworkEventsTable(events: NetworkEvent[]): string;
    formatThreatIntel(result: ThreatIntelligenceResult): string;
    createChart(data: number[], title?: string, config?: any): string;
    formatMetricsSummary(metrics: any): string;
    private getSeverityColor;
    private getReputationColor;
    private getStatusIcon;
    private formatRiskScore;
    private formatBytes;
    private createBar;
    formatJSON(data: any): string;
    formatCSV(data: any[]): string;
}
export declare const formatter: OutputFormatter;
//# sourceMappingURL=formatter.d.ts.map