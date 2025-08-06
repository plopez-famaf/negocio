export type LogLevel = 'info' | 'success' | 'warning' | 'error' | 'debug';
declare class Logger {
    private debugMode;
    private formatMessage;
    private getLevelColor;
    info(message: string): void;
    success(message: string): void;
    warning(message: string): void;
    error(message: string): void;
    debug(message: string): void;
    title(message: string): void;
    subtitle(message: string): void;
    dim(message: string): void;
    highlight(message: string): void;
    threat(severity: 'low' | 'medium' | 'high' | 'critical', message: string): void;
    security(message: string): void;
    network(message: string): void;
    behavior(message: string): void;
    intelligence(message: string): void;
    progress(current: number, total: number, message?: string): void;
    private createProgressBar;
    clearLine(): void;
    newLine(): void;
    hr(char?: string, length?: number): void;
}
export declare const logger: Logger;
export {};
//# sourceMappingURL=logger.d.ts.map