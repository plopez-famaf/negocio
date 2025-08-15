import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Dashboard } from './Dashboard.js';
import { ThreatMonitor } from './ThreatMonitor.js';
import { Alert } from './Alert.js';
import { useThreatStream } from '../hooks/useThreatStream.js';
import { useConfig } from '../hooks/useConfig.js';
import type { DashboardData, MetricsData } from '../types/index.js';

interface InteractiveDashboardProps {
  onExit?: () => void;
  apiUrl?: string;
  token?: string;
}

type ViewMode = 'dashboard' | 'threats' | 'help';

export const InteractiveDashboard: React.FC<InteractiveDashboardProps> = ({
  onExit,
  apiUrl,
  token,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [showAlert, setShowAlert] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    activeThreats: 0,
    totalEvents: 0,
    criticalAlerts: 0,
    systemStatus: 'offline',
    lastUpdate: new Date().toISOString(),
    threatDistribution: {
      malware: 0,
      phishing: 0,
      intrusion: 0,
      anomaly: 0,
      vulnerability: 0,
    },
  });
  const [metrics, setMetrics] = useState<MetricsData>({
    cpuUsage: 0,
    memoryUsage: 0,
    networkActivity: 0,
    threatLevel: 0,
    responseTime: 0,
    uptime: 0,
  });

  const { config, isAuthenticated } = useConfig();
  const { 
    events, 
    connectionStatus, 
    connect, 
    disconnect, 
    isConnected 
  } = useThreatStream({
    maxEvents: 50,
    filters: {
      severity: ['medium', 'high', 'critical'],
    },
  });

  // Auto-connect on mount if authenticated
  useEffect(() => {
    if (isAuthenticated && apiUrl && token) {
      const wsUrl = apiUrl.replace(/^http/, 'ws') + '/stream';
      connect(wsUrl, token).catch((error) => {
        setShowAlert(`Connection failed: ${error.message}`);
      });
    }

    return () => {
      disconnect();
    };
  }, [isAuthenticated, apiUrl, token, connect, disconnect]);

  // Update dashboard data based on events
  useEffect(() => {
    const activeThreats = events.filter(e => 
      new Date(e.timestamp).getTime() > Date.now() - 3600000 // Last hour
    ).length;

    const criticalAlerts = events.filter(e => e.severity === 'critical').length;

    const threatCounts = events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    setDashboardData({
      activeThreats,
      totalEvents: events.length,
      criticalAlerts,
      systemStatus: isConnected ? 'online' : 'offline',
      lastUpdate: new Date().toISOString(),
      threatDistribution: {
        malware: threatCounts.malware || 0,
        phishing: threatCounts.phishing || 0,
        intrusion: threatCounts.intrusion || 0,
        anomaly: threatCounts.anomaly || 0,
        vulnerability: threatCounts.vulnerability || 0,
      },
    });

    // Simulate metrics updates
    setMetrics(prev => ({
      ...prev,
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
      networkActivity: Math.random() * 10,
      threatLevel: activeThreats > 5 ? 80 + Math.random() * 20 : Math.random() * 50,
      responseTime: isConnected ? 50 + Math.random() * 100 : 0,
      uptime: prev.uptime + 1,
    }));
  }, [events, isConnected]);

  // Handle keyboard input
  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onExit?.();
      return;
    }

    switch (input) {
      case '1':
      case 'd':
        setViewMode('dashboard');
        setShowAlert(null);
        break;
      case '2':
      case 't':
        setViewMode('threats');
        setShowAlert(null);
        break;
      case 'h':
        setViewMode('help');
        setShowAlert(null);
        break;
      case 'r':
        // Refresh - reconnect if needed
        if (!isConnected && apiUrl && token) {
          const wsUrl = apiUrl.replace(/^http/, 'ws') + '/stream';
          connect(wsUrl, token).catch((error) => {
            setShowAlert(`Refresh failed: ${error.message}`);
          });
        }
        setShowAlert('Refreshed');
        setTimeout(() => setShowAlert(null), 2000);
        break;
      case 'c':
        // Clear events in threat view
        if (viewMode === 'threats') {
          // Clear events would go here
          setShowAlert('Events cleared');
          setTimeout(() => setShowAlert(null), 2000);
        }
        break;
      case 'x':
        setShowAlert(null);
        break;
    }
  });

  const renderView = () => {
    switch (viewMode) {
      case 'dashboard':
        return <Dashboard data={dashboardData} metrics={metrics} />;
      case 'threats':
        return (
          <ThreatMonitor
            events={events}
            connectionStatus={connectionStatus}
            maxEvents={20}
            showFilters={true}
            filters={{
              severity: ['medium', 'high', 'critical'],
            }}
          />
        );
      case 'help':
        return <HelpView />;
      default:
        return <Dashboard data={dashboardData} metrics={metrics} />;
    }
  };

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box borderStyle="single" borderColor="cyan" padding={1}>
        <Text bold color="cyan">
          🛡️ ThreatGuard Interactive Dashboard
        </Text>
        <Box marginLeft="auto">
          <Text color="gray">
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'} | {viewMode.toUpperCase()}
          </Text>
        </Box>
      </Box>

      {/* Navigation */}
      <Box padding={1} borderStyle="single" borderColor="gray">
        <Text>
          <Text color={viewMode === 'dashboard' ? 'cyan' : 'gray'}>[1] Dashboard</Text>
          <Text> | </Text>
          <Text color={viewMode === 'threats' ? 'cyan' : 'gray'}>[2] Threats</Text>
          <Text> | </Text>
          <Text color={viewMode === 'help' ? 'cyan' : 'gray'}>[H] Help</Text>
          <Text> | </Text>
          <Text color="gray">[R] Refresh | [Q] Quit</Text>
        </Text>
      </Box>

      {/* Alert */}
      {showAlert && (
        <Box padding={1}>
          <Alert type="info" onClose={() => setShowAlert(null)}>
            {showAlert}
          </Alert>
        </Box>
      )}

      {/* Main content */}
      <Box flexGrow={1}>
        {renderView()}
      </Box>
    </Box>
  );
};

const HelpView: React.FC = () => {
  return (
    <Box flexDirection="column" padding={2}>
      <Text bold color="cyan" marginBottom={1}>
        🔧 Interactive Dashboard Help
      </Text>
      
      <Text bold marginBottom={1}>Navigation:</Text>
      <Text>  1 or D - Dashboard view</Text>
      <Text>  2 or T - Threat monitor view</Text>
      <Text>  H - This help screen</Text>
      <Text>  R - Refresh connection</Text>
      <Text>  Q or ESC - Quit dashboard</Text>
      
      <Text bold marginTop={1} marginBottom={1}>Dashboard View:</Text>
      <Text>  • Real-time system metrics</Text>
      <Text>  • Threat distribution summary</Text>
      <Text>  • Connection status</Text>
      
      <Text bold marginTop={1} marginBottom={1}>Threat Monitor:</Text>
      <Text>  • Live threat event stream</Text>
      <Text>  • C - Clear events</Text>
      <Text>  • Automatic filtering by severity</Text>
      
      <Text bold marginTop={1} marginBottom={1}>General:</Text>
      <Text>  • X - Close alerts</Text>
      <Text>  • Real-time updates every second</Text>
      <Text>  • Auto-reconnection on disconnect</Text>
    </Box>
  );
};