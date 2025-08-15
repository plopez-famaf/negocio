import React from 'react';
import { Box, Text } from 'ink';
import { StatusIndicator } from './StatusIndicator.js';
import { Table } from './Table.js';
import { ProgressBar } from './ProgressBar.js';
import type { DashboardData, MetricsData } from '../types/index.js';

interface DashboardProps {
  data: DashboardData;
  metrics?: MetricsData;
  title?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  data, 
  metrics, 
  title = 'ThreatGuard Dashboard' 
}) => {
  const threatRows = [
    ['Malware', data.threatDistribution.malware],
    ['Phishing', data.threatDistribution.phishing],
    ['Intrusion', data.threatDistribution.intrusion],
    ['Anomaly', data.threatDistribution.anomaly],
    ['Vulnerability', data.threatDistribution.vulnerability],
  ];

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🛡️  {title}
        </Text>
      </Box>

      {/* Status Row */}
      <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <Box flexDirection="column">
          <Text>
            <Text color="white">Status: </Text>
            <StatusIndicator status={data.systemStatus} />
          </Text>
          <Text color="gray">
            Last Update: {new Date(data.lastUpdate).toLocaleTimeString()}
          </Text>
        </Box>
        
        <Box flexDirection="column">
          <Text>
            <Text color="yellow">Active Threats: </Text>
            <Text color="red" bold>
              {data.activeThreats}
            </Text>
          </Text>
          <Text>
            <Text color="blue">Total Events: </Text>
            <Text color="white">
              {data.totalEvents.toLocaleString()}
            </Text>
          </Text>
        </Box>
      </Box>

      {/* Critical Alerts */}
      {data.criticalAlerts > 0 && (
        <Box marginBottom={1}>
          <Text color="red" bold>
            ⚠️  {data.criticalAlerts} Critical Alert{data.criticalAlerts > 1 ? 's' : ''}
          </Text>
        </Box>
      )}

      {/* Threat Distribution */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>Threat Distribution:</Text>
      </Box>
      
      <Box marginBottom={1}>
        <Table
          headers={['Type', 'Count']}
          rows={threatRows}
          maxWidth={50}
        />
      </Box>

      {/* System Metrics */}
      {metrics && (
        <>
          <Box marginBottom={1}>
            <Text color="cyan" bold>System Metrics:</Text>
          </Box>
          
          <Box flexDirection="column" marginBottom={1}>
            <Box marginBottom={1}>
              <Text color="white">CPU Usage: </Text>
              <ProgressBar 
                percentage={metrics.cpuUsage} 
                width={20} 
                color={metrics.cpuUsage > 80 ? 'red' : metrics.cpuUsage > 60 ? 'yellow' : 'green'}
              />
              <Text color="gray"> {metrics.cpuUsage.toFixed(1)}%</Text>
            </Box>
            
            <Box marginBottom={1}>
              <Text color="white">Memory: </Text>
              <ProgressBar 
                percentage={metrics.memoryUsage} 
                width={20}
                color={metrics.memoryUsage > 80 ? 'red' : metrics.memoryUsage > 60 ? 'yellow' : 'green'}
              />
              <Text color="gray"> {metrics.memoryUsage.toFixed(1)}%</Text>
            </Box>
            
            <Box flexDirection="row">
              <Box marginRight={4}>
                <Text color="white">Network: </Text>
                <Text color="cyan">{metrics.networkActivity.toFixed(1)} MB/s</Text>
              </Box>
              <Box marginRight={4}>
                <Text color="white">Response: </Text>
                <Text color="green">{metrics.responseTime}ms</Text>
              </Box>
              <Box>
                <Text color="white">Uptime: </Text>
                <Text color="blue">{formatUptime(metrics.uptime)}</Text>
              </Box>
            </Box>
          </Box>
        </>
      )}

      {/* Footer */}
      <Box marginTop={1}>
        <Text color="gray">
          Press 'q' to quit, 'r' to refresh, 'h' for help
        </Text>
      </Box>
    </Box>
  );
};

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}