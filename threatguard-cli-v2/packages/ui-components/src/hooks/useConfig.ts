import { useState, useEffect, useCallback } from 'react';
import { ConfigManager, createConfigManager } from '@threatguard/core';
import type { CLIConfig, UserPreferences } from '@threatguard/core';

interface UseConfigReturn {
  config: CLIConfig;
  isLoaded: boolean;
  isAuthenticated: boolean;
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  setApiUrl: (url: string) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
  configManager: ConfigManager;
}

export function useConfig(): UseConfigReturn {
  const [configManager] = useState(() => createConfigManager());
  const [config, setConfig] = useState<CLIConfig>({
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
  });
  const [isLoaded, setIsLoaded] = useState(false);

  // Load configuration on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        await configManager.load();
        setConfig(configManager.getConfig());
        setIsLoaded(true);
      } catch (error) {
        console.error('Failed to load configuration:', error);
        setIsLoaded(true); // Still mark as loaded to prevent infinite loading
      }
    };

    loadConfig();
  }, [configManager]);

  const updatePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
    try {
      configManager.updatePreferences(updates);
      await configManager.save();
      setConfig(configManager.getConfig());
    } catch (error) {
      throw new Error(`Failed to update preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [configManager]);

  const setApiUrl = useCallback(async (url: string) => {
    try {
      configManager.setApiUrl(url);
      await configManager.save();
      setConfig(configManager.getConfig());
    } catch (error) {
      throw new Error(`Failed to set API URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [configManager]);

  const logout = useCallback(async () => {
    try {
      configManager.logout();
      await configManager.save();
      setConfig(configManager.getConfig());
    } catch (error) {
      throw new Error(`Failed to logout: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [configManager]);

  const reload = useCallback(async () => {
    try {
      await configManager.load();
      setConfig(configManager.getConfig());
    } catch (error) {
      throw new Error(`Failed to reload configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [configManager]);

  return {
    config,
    isLoaded,
    isAuthenticated: configManager.isAuthenticated(),
    preferences: config.preferences,
    updatePreferences,
    setApiUrl,
    logout,
    reload,
    configManager,
  };
}