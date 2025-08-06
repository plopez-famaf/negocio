import blessed from 'blessed';
export declare class CommandInterface {
    private screen;
    private container;
    private outputBox;
    private inputBox;
    private commandHistory;
    private historyIndex;
    private currentDirectory;
    constructor(screen: blessed.Widgets.Screen);
    private createContainer;
    private createInterface;
    private getWelcomeMessage;
    private setupInputHandlers;
    private getAutocompleteSuggestions;
    private addToHistory;
    private executeCommand;
    private executeThreatGuardCommand;
    private appendToOutput;
    private clearOutput;
    private showHelp;
    private showHistory;
    initialize(): Promise<void>;
    show(): void;
    hide(): void;
    focus(): void;
    refresh(): Promise<void>;
    cleanup(): void;
}
//# sourceMappingURL=command-interface.d.ts.map