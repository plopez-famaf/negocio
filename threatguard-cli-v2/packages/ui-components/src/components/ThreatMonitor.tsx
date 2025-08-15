import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { Table } from './Table.js';
import { StatusIndicator } from './StatusIndicator.js';
import { Spinner } from './Spinner.js';
import type { ThreatEvent, ConnectionStatus } from '../types/index.js';

interface ThreatMonitorProps {
  events: ThreatEvent[];
  connectionStatus: ConnectionStatus;
  maxEvents?: number;
  showFilters?: boolean;
  filters?: {
    severity?: string[];
    type?: string[];
  };
}

export const ThreatMonitor: React.FC<ThreatMonitorProps> = ({
  events,
  connectionStatus,
  maxEvents = 20,
  showFilters = true,
  filters,
}) => {
  const [displayEvents, setDisplayEvents] = useState<ThreatEvent[]>([]);

  useEffect(() => {
    let filtered = events;

    // Apply filters
    if (filters?.severity && filters.severity.length > 0) {
      filtered = filtered.filter(event => filters.severity!.includes(event.severity));
    }

    if (filters?.type && filters.type.length > 0) {
      filtered = filtered.filter(event => filters.type!.includes(event.type));
    }

    // Limit to max events
    setDisplayEvents(filtered.slice(0, maxEvents));
  }, [events, filters, maxEvents]);

  const formatThreatType = (type: string) => {
    const colors = {
      malware: 'red',
      phishing: 'magenta',
      intrusion: 'yellow',
      anomaly: 'cyan',
      vulnerability: 'orange',
    };
    return { color: colors[type as keyof typeof colors] || 'white', text: type.toUpperCase() };
  };

  const formatSeverity = (severity: string) => {
    const colors = {
      low: 'green',
      medium: 'yellow',
      high: 'orange',
      critical: 'red',
    };
    return { color: colors[severity as keyof typeof colors] || 'white', text: severity.toUpperCase() };
  };

  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);

    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const tableRows = displayEvents.map(event => {
    const typeDisplay = formatThreatType(event.type);
    const severityDisplay = formatSeverity(event.severity);
    
    return [
      formatRelativeTime(event.timestamp),
      event.type,
      event.severity,
      event.target || 'N/A',
      event.description.length > 30 ? event.description.substring(0, 30) + '...' : event.description,
    ];
  });

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <Text bold color="cyan">
          🔍 Threat Monitor
        </Text>
        <Box flexDirection="row">
          <Text color="white">Status: </Text>
          <StatusIndicator status={connectionStatus.connected ? 'online' : 'offline'} />
          {!connectionStatus.connected && (
            <Box marginLeft={1}>
              <Spinner />
              <Text color="yellow"> Reconnecting...</Text>
            </Box>
          )}
        </Box>
      </Box>

      {/* Filters */}
      {showFilters && (
        <Box marginBottom={1}>
          <Text color="gray">
            Filters: {filters?.severity?.join(', ') || 'all'} severity, {filters?.type?.join(', ') || 'all'} types
          </Text>
        </Box>
      )}

      {/* Events counter */}
      <Box marginBottom={1}>
        <Text>
          <Text color="blue">Events: </Text>
          <Text color="white">{displayEvents.length}</Text>
          {events.length !== displayEvents.length && (
            <Text color="gray"> (filtered from {events.length})</Text>
          )}
        </Text>
      </Box>

      {/* Events table */}
      {displayEvents.length === 0 ? (
        <Box justifyContent="center" marginY={2}>
          {connectionStatus.connected ? (
            <Text color="gray">No threats detected. Monitoring...</Text>
          ) : (
            <Box flexDirection="row">
              <Spinner />
              <Text color="yellow" marginLeft={1}>Connecting to threat stream...</Text>
            </Box>
          )}
        </Box>
      ) : (
        <Table
          headers={['Time', 'Type', 'Severity', 'Target', 'Description']}
          rows={tableRows}
          headerColor="cyan"
          alternateRows
        />
      )}

      {/* Footer */}
      <Box marginTop={1}>
        <Text color="gray">
          Showing {Math.min(displayEvents.length, maxEvents)} of {events.length} events • Press 'q' to quit
        </Text>
      </Box>
    </Box>
  );
};