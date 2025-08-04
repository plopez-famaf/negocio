'use client';

import { useState, useEffect } from 'react';
import { Shield, Brain, Activity, Users, AlertTriangle, TrendingUp } from 'lucide-react';
import { MetricsCard } from '@/components/dashboard/metrics-card';
import { RealTimeChart } from '@/components/dashboard/real-time-chart';
import { ThreatMap } from '@/components/dashboard/threat-map';
import { SystemStatus } from '@/components/dashboard/system-status';
import { AIModelStatus } from '@/components/dashboard/ai-model-status';
import { useSocket } from '@/hooks/use-socket';
import { useAuth } from '@/hooks/use-auth';

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const { socket, isConnected } = useSocket();
  const [metrics, setMetrics] = useState({
    totalThreats: 1247,
    activeThreats: 23,
    identityVerifications: 8934,
    systemLoad: 0.67
  });

  const [threatData, setThreatData] = useState([
    { time: '00:00', threats: 12, verifications: 45 },
    { time: '04:00', threats: 8, verifications: 34 },
    { time: '08:00', threats: 23, verifications: 89 },
    { time: '12:00', threats: 19, verifications: 67 },
    { time: '16:00', threats: 34, verifications: 123 },
    { time: '20:00', threats: 28, verifications: 98 },
  ]);

  useEffect(() => {
    if (socket && isConnected) {
      socket.on('system_metrics', (data) => {
        setMetrics(prev => ({
          ...prev,
          activeThreats: data.activeThreats,
          systemLoad: data.systemLoad
        }));
      });

      socket.on('threat_analysis', (data) => {
        if (data.analysis.threatDetected) {
          setMetrics(prev => ({
            ...prev,
            totalThreats: prev.totalThreats + 1,
            activeThreats: prev.activeThreats + 1
          }));
        }
      });

      // Request initial system metrics
      socket.emit('request_system_metrics');
    }
  }, [socket, isConnected]);

  if (isLoading) {
    return (
      <div className=\"flex items-center justify-center min-h-screen\">
        <div className=\"animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600\"></div>
      </div>
    );
  }

  return (
    <div className=\"min-h-screen bg-gray-50 p-6\">
      <div className=\"max-w-7xl mx-auto\">
        {/* Header */}
        <div className=\"mb-8\">
          <h1 className=\"text-3xl font-bold text-gray-900 mb-2\">
            BehaviorGuard AI Dashboard
          </h1>
          <p className=\"text-gray-600\">
            Real-time AI monitoring and analytics for identity verification and threat detection
          </p>
          <div className=\"flex items-center gap-2 mt-2\">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className=\"text-sm text-gray-500\">
              {isConnected ? 'Connected to AI services' : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className=\"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8\">
          <MetricsCard
            title=\"Total Threats Detected\"
            value={metrics.totalThreats.toLocaleString()}
            icon={<AlertTriangle className=\"w-6 h-6\" />}
            trend=\"+12%\"
            trendDirection=\"up\"
            color=\"red\"
          />
          <MetricsCard
            title=\"Active Threats\"
            value={metrics.activeThreats.toString()}
            icon={<Shield className=\"w-6 h-6\" />}
            trend={isConnected ? 'Live' : 'Offline'}
            trendDirection=\"neutral\"
            color=\"orange\"
          />
          <MetricsCard
            title=\"Identity Verifications\"
            value={metrics.identityVerifications.toLocaleString()}
            icon={<Users className=\"w-6 h-6\" />}
            trend=\"+8%\"
            trendDirection=\"up\"
            color=\"green\"
          />
          <MetricsCard
            title=\"System Load\"
            value={`${(metrics.systemLoad * 100).toFixed(1)}%`}
            icon={<Activity className=\"w-6 h-6\" />}
            trend={metrics.systemLoad > 0.8 ? 'High' : 'Normal'}
            trendDirection={metrics.systemLoad > 0.8 ? 'up' : 'neutral'}
            color=\"blue\"
          />
        </div>

        {/* Charts and Status */}
        <div className=\"grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8\">
          <RealTimeChart data={threatData} />
          <ThreatMap />
        </div>

        {/* System Status */}
        <div className=\"grid grid-cols-1 lg:grid-cols-2 gap-6\">
          <SystemStatus isConnected={isConnected} />
          <AIModelStatus />
        </div>
      </div>
    </div>
  );
}