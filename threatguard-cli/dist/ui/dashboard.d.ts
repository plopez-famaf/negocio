import blessed from 'blessed';
export declare class ThreatDashboard {
    private screen;
    private container;
    private widgets;
    private metrics;
    constructor(screen: blessed.Widgets.Screen);
    private createContainer;
    private createWidgets;
    private createMetricsRow;
    private createMainContentArea;
    private formatMetricWidget;
    initialize(): Promise<void>;
    private setupKeyBindings;
    private cycleFocus;
    private expandCurrentWidget;
    updateMetrics(): Promise<void>;
    private updateMetricWidgets;
    private updateThreatsPanel;
    private updateActivityPanel;
    show(): void;
    hide(): void;
    focus(): void;
    refresh(): Promise<void>;
    cleanup(): void;
}
//# sourceMappingURL=dashboard.d.ts.map