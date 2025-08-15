import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './useWebSocket.js';
import type { ThreatEvent } from '../types/index.js';

interface UseThreatStreamOptions {
  url?: string;
  token?: string;
  maxEvents?: number;
  filters?: {
    severity?: string[];
    type?: string[];
    sources?: string[];
  };
}

interface UseThreatStreamReturn {
  events: ThreatEvent[];
  connectionStatus: any;
  connect: (url: string, token: string) => Promise<void>;
  disconnect: () => void;
  clearEvents: () => void;
  updateFilters: (filters: any) => void;
  isConnected: boolean;
}

export function useThreatStream(options: UseThreatStreamOptions = {}): UseThreatStreamReturn {
  const [events, setEvents] = useState<ThreatEvent[]>([]);
  const { maxEvents = 100 } = options;

  const { client, connectionStatus, connect, disconnect, isConnected } = useWebSocket({
    autoReconnect: true,
    reconnectAttempts: 5,
    filters: {
      eventTypes: ['threat'],
      severity: options.filters?.severity || ['low', 'medium', 'high', 'critical'],
      sources: options.filters?.sources || [],
    },
  });

  // Handle incoming threat events
  useEffect(() => {
    if (!client) return;

    const handleThreatEvent = (event: ThreatEvent) => {
      setEvents(prev => {
        const newEvents = [event, ...prev];
        // Keep only the latest events
        return newEvents.slice(0, maxEvents);
      });
    };

    const handleStreamEvent = (event: any) => {
      if (event.type === 'threat') {
        handleThreatEvent(event.data);
      }
    };

    // Legacy event handlers for backward compatibility
    client.on('threat', handleThreatEvent);
    client.on('threat_event', handleThreatEvent);
    client.on('stream_event', handleStreamEvent);

    return () => {
      client.off('threat', handleThreatEvent);
      client.off('threat_event', handleThreatEvent);
      client.off('stream_event', handleStreamEvent);
    };
  }, [client, maxEvents]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const updateFilters = useCallback((filters: any) => {
    if (client && client.isConnected()) {
      client.updateFilters(filters);
    }
  }, [client]);

  return {
    events,
    connectionStatus,
    connect,
    disconnect,
    clearEvents,
    updateFilters,
    isConnected,
  };
}