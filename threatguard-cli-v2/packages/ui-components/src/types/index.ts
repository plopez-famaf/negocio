export interface ThreatEvent {
  id: string;
  type: 'malware' | 'phishing' | 'intrusion' | 'anomaly' | 'vulnerability';
  severity: 'low' | 'medium' | 'high' | 'critical';
  target: string;
  description: string;
  timestamp: string;
  source: string;
  metadata: Record<string, any>;
}

export interface DashboardData {
  activeThreats: number;
  totalEvents: number;
  criticalAlerts: number;
  systemStatus: 'online' | 'offline' | 'degraded';
  lastUpdate: string;
  threatDistribution: {
    malware: number;
    phishing: number;
    intrusion: number;
    anomaly: number;
    vulnerability: number;
  };
}

export interface MetricsData {
  cpuUsage: number;
  memoryUsage: number;
  networkActivity: number;
  threatLevel: number;
  responseTime: number;
  uptime: number;
}

export interface ConnectionStatus {
  connected: boolean;
  url?: string;
  readyState?: number;
  reconnectAttempts: number;
  lastConnected?: Date;
  lastError?: string;
}

export interface TableData {
  headers: string[];
  rows: (string | number | boolean)[][];
}

export type AlertType = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps {
  type: AlertType;
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
}