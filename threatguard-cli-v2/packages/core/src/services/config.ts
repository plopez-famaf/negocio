import { homedir } from 'os';
import { join } from 'path';
import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { constants } from 'fs';
import { z } from 'zod';
import { schemas, type CLIConfig, type UserPreferences } from '../types/index.js';

export interface ConfigManagerOptions {
  configDir?: string;
  configFileName?: string;
  autoSave?: boolean;
  encryptSensitiveData?: boolean;
}

export class ConfigManagerError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'ConfigManagerError';
  }
}

export class ConfigManager {
  private config: CLIConfig;
  private configPath: string;
  private options: Required<ConfigManagerOptions>;
  private dirty: boolean = false;

  constructor(options: ConfigManagerOptions = {}) {
    this.options = {
      configDir: join(homedir(), '.threatguard'),
      configFileName: 'config.json',
      autoSave: true,
      encryptSensitiveData: false,
      ...options,
    };

    this.configPath = join(this.options.configDir, this.options.configFileName);
    
    // Initialize with default config
    this.config = {
      apiUrl: 'http://localhost:3002',
      preferences: {
        theme: 'dark',
        outputFormat: 'table',
        verbose: false,
        autoReconnect: true,
        maxRetries: 3,
        timeout: 30000,
        pageSize: 20,
        dateFormat: 'iso',
        timezone: 'local',
        colorOutput: true,
        soundNotifications: false,
      },
      profiles: {},
      recentCommands: [],
      version: '2.0.0',
    };
  }

  async load(): Promise<void> {
    try {
      // Ensure config directory exists
      await this.ensureConfigDir();

      // Check if config file exists
      await access(this.configPath, constants.F_OK);
      
      // Read and parse config file
      const configData = await readFile(this.configPath, 'utf-8');
      const parsedConfig = JSON.parse(configData);
      
      // Validate and merge with defaults
      const validatedConfig = schemas.CLIConfig.parse(parsedConfig);
      this.config = { ...this.config, ...validatedConfig };
      
      this.dirty = false;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // Config file doesn't exist, create with defaults
        await this.save();
      } else if (error instanceof z.ZodError) {
        throw new ConfigManagerError(
          `Invalid configuration format: ${error.issues.map(i => i.message).join(', ')}`,
          'INVALID_CONFIG'
        );
      } else {
        throw new ConfigManagerError(
          `Failed to load configuration: ${error.message}`,
          'LOAD_FAILED'
        );
      }
    }
  }

  async save(): Promise<void> {
    try {
      await this.ensureConfigDir();
      
      // Validate config before saving
      const validatedConfig = schemas.CLIConfig.parse(this.config);
      
      const configData = JSON.stringify(validatedConfig, null, 2);
      await writeFile(this.configPath, configData, 'utf-8');
      
      this.dirty = false;
    } catch (error) {
      throw new ConfigManagerError(
        `Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SAVE_FAILED'
      );
    }
  }

  private async ensureConfigDir(): Promise<void> {
    try {
      await access(this.options.configDir, constants.F_OK);
    } catch {
      await mkdir(this.options.configDir, { recursive: true });
    }
  }

  private markDirty(): void {
    this.dirty = true;
    if (this.options.autoSave) {
      // Debounced auto-save
      setTimeout(() => {
        if (this.dirty) {
          this.save().catch(console.error);
        }
      }, 1000);
    }
  }

  // Configuration getters
  getConfig(): CLIConfig {
    return { ...this.config };
  }

  getApiUrl(): string {
    return this.config.apiUrl;
  }

  getToken(): string | undefined {
    return this.config.token;
  }

  getUserId(): string | undefined {
    return this.config.userId;
  }

  getPreferences(): UserPreferences {
    return { ...this.config.preferences };
  }

  getCurrentProfile(): string | undefined {
    return this.config.currentProfile;
  }

  getProfile(name: string): any {
    return this.config.profiles?.[name];
  }

  getProfiles(): Record<string, any> {
    return { ...this.config.profiles };
  }

  getRecentCommands(limit: number = 10): string[] {
    return this.config.recentCommands?.slice(0, limit) || [];
  }

  // Configuration setters
  setApiUrl(url: string): void {
    try {
      // Validate URL format
      new URL(url);
      this.config.apiUrl = url;
      this.markDirty();
    } catch {
      throw new ConfigManagerError('Invalid API URL format', 'INVALID_URL');
    }
  }

  setToken(token: string): void {
    this.config.token = token;
    this.markDirty();
  }

  setUserId(userId: string): void {
    this.config.userId = userId;
    this.markDirty();
  }

  updatePreferences(preferences: Partial<UserPreferences>): void {
    try {
      const updated = { ...this.config.preferences, ...preferences };
      const validated = schemas.UserPreferences.parse(updated);
      this.config.preferences = validated;
      this.markDirty();
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ConfigManagerError(
          `Invalid preferences: ${error.issues.map(i => i.message).join(', ')}`,
          'INVALID_PREFERENCES'
        );
      }
      throw error;
    }
  }

  setCurrentProfile(profileName: string): void {
    if (!this.config.profiles?.[profileName]) {
      throw new ConfigManagerError(`Profile '${profileName}' does not exist`, 'PROFILE_NOT_FOUND');
    }
    this.config.currentProfile = profileName;
    this.markDirty();
  }

  saveProfile(name: string, profile: any): void {
    if (!this.config.profiles) {
      this.config.profiles = {};
    }
    this.config.profiles[name] = profile;
    this.markDirty();
  }

  deleteProfile(name: string): void {
    if (!this.config.profiles?.[name]) {
      throw new ConfigManagerError(`Profile '${name}' does not exist`, 'PROFILE_NOT_FOUND');
    }
    
    delete this.config.profiles[name];
    
    // If this was the current profile, clear it
    if (this.config.currentProfile === name) {
      this.config.currentProfile = undefined;
    }
    
    this.markDirty();
  }

  addRecentCommand(command: string): void {
    if (!this.config.recentCommands) {
      this.config.recentCommands = [];
    }
    
    // Remove if already exists
    const index = this.config.recentCommands.indexOf(command);
    if (index !== -1) {
      this.config.recentCommands.splice(index, 1);
    }
    
    // Add to beginning
    this.config.recentCommands.unshift(command);
    
    // Keep only last 50 commands
    this.config.recentCommands = this.config.recentCommands.slice(0, 50);
    
    this.markDirty();
  }

  clearRecentCommands(): void {
    this.config.recentCommands = [];
    this.markDirty();
  }

  // Authentication helpers
  isAuthenticated(): boolean {
    return !!this.config.token;
  }

  logout(): void {
    this.config.token = undefined;
    this.config.userId = undefined;
    this.markDirty();
  }

  // Reset and maintenance
  reset(): void {
    this.config = {
      apiUrl: 'http://localhost:3002',
      preferences: {
        theme: 'dark',
        outputFormat: 'table',
        verbose: false,
        autoReconnect: true,
        maxRetries: 3,
        timeout: 30000,
        pageSize: 20,
        dateFormat: 'iso',
        timezone: 'local',
        colorOutput: true,
        soundNotifications: false,
      },
      profiles: {},
      recentCommands: [],
      version: '2.0.0',
    };
    this.markDirty();
  }

  async backup(backupPath?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultBackupPath = join(this.options.configDir, `config-backup-${timestamp}.json`);
    const targetPath = backupPath || defaultBackupPath;

    try {
      const configData = JSON.stringify(this.config, null, 2);
      await writeFile(targetPath, configData, 'utf-8');
      return targetPath;
    } catch (error) {
      throw new ConfigManagerError(
        `Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'BACKUP_FAILED'
      );
    }
  }

  async restore(backupPath: string): Promise<void> {
    try {
      const backupData = await readFile(backupPath, 'utf-8');
      const parsedConfig = JSON.parse(backupData);
      const validatedConfig = schemas.CLIConfig.parse(parsedConfig);
      
      this.config = validatedConfig;
      await this.save();
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ConfigManagerError(
          `Invalid backup format: ${error.issues.map(i => i.message).join(', ')}`,
          'INVALID_BACKUP'
        );
      }
      throw new ConfigManagerError(
        `Failed to restore from backup: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'RESTORE_FAILED'
      );
    }
  }

  // Configuration validation
  validate(): { valid: boolean; errors: string[] } {
    try {
      schemas.CLIConfig.parse(this.config);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
        };
      }
      return { valid: false, errors: ['Unknown validation error'] };
    }
  }

  // Configuration info
  getConfigPath(): string {
    return this.configPath;
  }

  getConfigSize(): Promise<number> {
    return readFile(this.configPath, 'utf-8')
      .then(data => Buffer.byteLength(data, 'utf-8'))
      .catch(() => 0);
  }

  isDirty(): boolean {
    return this.dirty;
  }
}

// Factory function for creating configured config manager
export function createConfigManager(options?: ConfigManagerOptions): ConfigManager {
  return new ConfigManager(options);
}

// Export for backward compatibility
export { ConfigManager as default };