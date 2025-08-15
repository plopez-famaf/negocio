// Core UI Components using React/Ink
export { Dashboard } from './components/Dashboard.js';
export { ThreatMonitor } from './components/ThreatMonitor.js';
export { StatusIndicator } from './components/StatusIndicator.js';
export { ProgressBar } from './components/ProgressBar.js';
export { Table } from './components/Table.js';
export { Spinner } from './components/Spinner.js';
export { Alert } from './components/Alert.js';

// Interactive Components
export { InteractiveDashboard } from './components/InteractiveDashboard.js';
export { CommandPrompt } from './components/CommandPrompt.js';
export { LiveMetrics } from './components/LiveMetrics.js';

// Hooks for CLI state management
export { useWebSocket } from './hooks/useWebSocket.js';
export { useConfig } from './hooks/useConfig.js';
export { useThreatStream } from './hooks/useThreatStream.js';

// Types
export type { ThreatEvent, DashboardData, MetricsData } from './types/index.js';