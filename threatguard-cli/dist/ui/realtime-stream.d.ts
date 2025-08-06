import blessed from 'blessed';
export declare class RealTimeStream {
    private screen;
    private container;
    private streamBox;
    private controlsBox;
    private filtersBox;
    private isStreaming;
    private streamBuffer;
    private filters;
    constructor(screen: blessed.Widgets.Screen);
    private createContainer;
    private createInterface;
    private getControlsContent;
    private getInitialStreamContent;
    private getFiltersContent;
    private setupKeyBindings;
    private toggleStream;
    private clearStream;
    private showFilterDialog;
    private getFilterDialogContent;
    private saveStream;
    private updateControls;
    initialize(): Promise<void>;
    private startMockStream;
    private addStreamEvent;
    updateStream(): Promise<void>;
    show(): void;
    hide(): void;
    focus(): void;
    refresh(): Promise<void>;
    cleanup(): void;
}
//# sourceMappingURL=realtime-stream.d.ts.map