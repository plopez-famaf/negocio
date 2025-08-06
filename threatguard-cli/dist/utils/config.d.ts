import { CLIConfig } from '@/types';
declare class ConfigManager {
    private config;
    constructor();
    get(key?: keyof CLIConfig): any;
    set(key: keyof CLIConfig | Partial<CLIConfig>, value?: any): void;
    delete(key: keyof CLIConfig): void;
    clear(): void;
    has(key: keyof CLIConfig): boolean;
    getApiUrl(): string;
    getToken(): string | undefined;
    setToken(token: string): void;
    getUserId(): string | undefined;
    setUserId(userId: string): void;
    isAuthenticated(): boolean;
    logout(): void;
    getPreferences(): any;
    setPreference(key: keyof CLIConfig['preferences'], value: any): void;
}
export declare const configManager: ConfigManager;
export {};
//# sourceMappingURL=config.d.ts.map