import Conf from 'conf';
import { CLIConfig } from '@/types';

class ConfigManager {
  private config: Conf<CLIConfig>;

  constructor() {
    this.config = new Conf<CLIConfig>({
      projectName: 'threatguard-cli',
      defaults: {
        apiUrl: 'https://api.threatguard.ai',
        preferences: {
          theme: 'dark',
          outputFormat: 'table',
          realTimeUpdates: true,
          notifications: true,
        },
      },
    });
  }

  get(key?: keyof CLIConfig): any {
    return key ? this.config.get(key) : this.config.store;
  }

  set(key: keyof CLIConfig | Partial<CLIConfig>, value?: any): void {
    if (typeof key === 'object') {
      Object.entries(key).forEach(([k, v]) => {
        this.config.set(k as keyof CLIConfig, v);
      });
    } else {
      this.config.set(key, value);
    }
  }

  delete(key: keyof CLIConfig): void {
    this.config.delete(key);
  }

  clear(): void {
    this.config.clear();
  }

  has(key: keyof CLIConfig): boolean {
    return this.config.has(key);
  }

  getApiUrl(): string {
    return this.get('apiUrl') || 'https://api.threatguard.ai';
  }

  getToken(): string | undefined {
    return this.get('token');
  }

  setToken(token: string): void {
    this.set('token', token);
  }

  getUserId(): string | undefined {
    return this.get('userId');
  }

  setUserId(userId: string): void {
    this.set('userId', userId);
  }

  isAuthenticated(): boolean {
    return this.has('token') && this.has('userId');
  }

  logout(): void {
    this.delete('token');
    this.delete('userId');
  }

  getPreferences() {
    return this.get('preferences') || {
      theme: 'dark',
      outputFormat: 'table',
      realTimeUpdates: true,
      notifications: true,
    };
  }

  setPreference(key: keyof CLIConfig['preferences'], value: any): void {
    const preferences = this.getPreferences();
    preferences[key] = value;
    this.set('preferences', preferences);
  }
}

export const configManager = new ConfigManager();