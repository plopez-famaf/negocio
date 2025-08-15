import { useState, useEffect, useCallback, useRef } from 'react';
import { WebSocketClient, createWebSocketClient } from '@threatguard/core';
import type { ConnectionStatus } from '../types/index.js';

interface UseWebSocketOptions {
  url?: string;
  token?: string;
  autoReconnect?: boolean;
  reconnectAttempts?: number;
  filters?: {
    eventTypes?: string[];
    severity?: string[];
    sources?: string[];
  };
}

interface UseWebSocketReturn {
  client: WebSocketClient | null;
  connectionStatus: ConnectionStatus;
  connect: (url: string, token: string) => Promise<void>;
  disconnect: () => void;
  send: (message: any) => void;
  isConnected: boolean;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const [client, setClient] = useState<WebSocketClient | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    reconnectAttempts: 0,
  });

  const clientRef = useRef<WebSocketClient | null>(null);

  const updateConnectionStatus = useCallback((updates: Partial<ConnectionStatus>) => {
    setConnectionStatus(prev => ({ ...prev, ...updates }));
  }, []);

  const connect = useCallback(async (url: string, token: string) => {
    try {
      // Clean up existing client
      if (clientRef.current) {
        clientRef.current.disconnect();
      }

      // Create new client
      const newClient = createWebSocketClient({
        autoReconnect: options.autoReconnect ?? true,
        reconnectAttempts: options.reconnectAttempts ?? 5,
        filters: options.filters,
      });

      // Set up event listeners
      newClient.on('connected', (info: any) => {
        updateConnectionStatus({
          connected: true,
          url: info.url,
          lastConnected: new Date(),
          reconnectAttempts: 0,
          lastError: undefined,
        });
      });

      newClient.on('disconnected', (info: any) => {
        updateConnectionStatus({
          connected: false,
          lastError: info.reason,
        });
      });

      newClient.on('error', (error: any) => {
        updateConnectionStatus({
          lastError: error.message,
        });
      });

      newClient.on('reconnecting', (info: any) => {
        updateConnectionStatus({
          reconnectAttempts: info.attempt,
        });
      });

      // Connect
      await newClient.connect(url, token);
      
      clientRef.current = newClient;
      setClient(newClient);
      
    } catch (error) {
      updateConnectionStatus({
        connected: false,
        lastError: error instanceof Error ? error.message : 'Connection failed',
      });
      throw error;
    }
  }, [options.autoReconnect, options.reconnectAttempts, options.filters, updateConnectionStatus]);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
      setClient(null);
      updateConnectionStatus({
        connected: false,
      });
    }
  }, [updateConnectionStatus]);

  const send = useCallback((message: any) => {
    if (clientRef.current && clientRef.current.isConnected()) {
      clientRef.current.updateFilters(message); // Assuming this is the send method
    } else {
      throw new Error('WebSocket is not connected');
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
  }, []);

  return {
    client,
    connectionStatus,
    connect,
    disconnect,
    send,
    isConnected: connectionStatus.connected,
  };
}