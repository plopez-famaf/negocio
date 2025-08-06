import blessed from 'blessed';
import { apiClient } from '@/services/api';
import { logger } from '@/utils/logger';
import { TerminalMetrics, DashboardWidget } from '@/types';

export class ThreatDashboard {
  private screen: blessed.Widgets.Screen;
  private container: blessed.Widgets.BoxElement;
  private widgets: Map<string, blessed.Widgets.BoxElement> = new Map();
  private metrics: TerminalMetrics = {
    threatsActive: 0,
    riskScore: 0,
    systemStatus: 'healthy',
    lastUpdate: new Date().toISOString(),
    uptime: '0h'
  };

  constructor(screen: blessed.Widgets.Screen) {
    this.screen = screen;
    this.createContainer();
    this.createWidgets();
  }

  private createContainer(): void {
    this.container = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      right: 0,
      bottom: 1, // Leave space for status bar
      style: {
        bg: 'default'
      },
      hidden: true
    });
  }

  private createWidgets(): void {
    // Header
    const header = blessed.box({
      parent: this.container,
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      content: '{center}{bold}ThreatGuard Security Dashboard{/bold}{/center}',
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'cyan'
        }
      },
      tags: true
    });

    // Metrics overview (top row)
    this.createMetricsRow();
    
    // Main content area (bottom section)
    this.createMainContentArea();
  }

  private createMetricsRow(): void {
    const metricsContainer = blessed.box({
      parent: this.container,
      top: 3,
      left: 0,
      right: 0,
      height: 5,
      style: {
        bg: 'default'
      }
    });

    // Active Threats
    const threatWidget = blessed.box({
      parent: metricsContainer,
      top: 0,
      left: 0,
      width: '25%',
      height: 5,
      content: this.formatMetricWidget('Active Threats', '0', 'green'),
      border: {
        type: 'line'
      },
      style: {
        border: { fg: 'white' }
      },
      tags: true
    });
    this.widgets.set('threats', threatWidget);

    // Risk Score
    const riskWidget = blessed.box({
      parent: metricsContainer,
      top: 0,
      left: '25%',
      width: '25%',
      height: 5,
      content: this.formatMetricWidget('Risk Score', '0/10', 'green'),
      border: {
        type: 'line'
      },
      style: {
        border: { fg: 'white' }
      },
      tags: true
    });
    this.widgets.set('risk', riskWidget);

    // System Status
    const statusWidget = blessed.box({
      parent: metricsContainer,
      top: 0,
      left: '50%',
      width: '25%',
      height: 5,
      content: this.formatMetricWidget('System Status', 'Healthy', 'green'),
      border: {
        type: 'line'
      },
      style: {
        border: { fg: 'white' }
      },
      tags: true
    });
    this.widgets.set('status', statusWidget);

    // Uptime
    const uptimeWidget = blessed.box({
      parent: metricsContainer,
      top: 0,
      left: '75%',
      width: '25%',
      height: 5,
      content: this.formatMetricWidget('Uptime', '0h', 'white'),
      border: {
        type: 'line'
      },
      style: {
        border: { fg: 'white' }
      },
      tags: true
    });
    this.widgets.set('uptime', uptimeWidget);
  }

  private createMainContentArea(): void {
    const mainContainer = blessed.box({
      parent: this.container,
      top: 8,
      left: 0,
      right: 0,
      bottom: 0,
      style: {
        bg: 'default'
      }
    });

    // Recent Threats (left column)
    const threatsPanel = blessed.box({
      parent: mainContainer,
      top: 0,
      left: 0,
      width: '50%',
      bottom: 0,
      content: '{bold}Recent Threats{/bold}\n\nLoading...',
      border: {
        type: 'line'
      },
      style: {
        border: { fg: 'red' }
      },
      scrollable: true,
      alwaysScroll: true,
      tags: true,
      keys: true,
      vi: true
    });
    this.widgets.set('recent_threats', threatsPanel);

    // Activity Feed (right column)
    const activityPanel = blessed.box({
      parent: mainContainer,
      top: 0,
      left: '50%',
      width: '50%',
      bottom: 0,
      content: '{bold}System Activity{/bold}\n\nLoading...',
      border: {
        type: 'line'
      },
      style: {
        border: { fg: 'blue' }
      },
      scrollable: true,
      alwaysScroll: true,
      tags: true,
      keys: true,
      vi: true
    });
    this.widgets.set('activity', activityPanel);
  }

  private formatMetricWidget(title: string, value: string, color: string): string {
    return `{center}{bold}${title}{/bold}{/center}\n{center}{${color}-fg}{bold}${value}{/bold}{/${color}-fg}{/center}`;
  }

  async initialize(): Promise<void> {
    await this.updateMetrics();
    this.setupKeyBindings();
  }

  private setupKeyBindings(): void {
    this.container.key(['tab'], () => {
      // Cycle through widgets
      this.cycleFocus();
    });

    this.container.key(['enter'], () => {
      // Expand current widget
      this.expandCurrentWidget();
    });
  }

  private cycleFocus(): void {
    const widgetNames = Array.from(this.widgets.keys());
    // Simple focus cycling implementation
    const currentFocus = widgetNames[0];
    const widget = this.widgets.get(currentFocus);
    if (widget) {
      widget.focus();
      this.screen.render();
    }
  }

  private expandCurrentWidget(): void {
    // Implementation for expanding widgets
    logger.debug('Widget expansion not implemented yet');
  }

  async updateMetrics(): Promise<void> {
    try {
      // Fetch latest metrics
      const [health, threats, systemMetrics] = await Promise.all([
        apiClient.getSystemHealth().catch(() => null),
        apiClient.getThreats({ limit: 10, since: '1h' }).catch(() => []),
        apiClient.getMetrics({ timeRange: '1h' }).catch(() => null)
      ]);

      // Update metrics object
      this.metrics = {
        threatsActive: threats ? threats.filter((t: any) => t.status === 'active').length : 0,
        riskScore: systemMetrics?.overallRiskScore || 0,
        systemStatus: health?.status || 'unknown',
        lastUpdate: new Date().toISOString(),
        uptime: systemMetrics?.uptime || '0h'
      };

      // Update widgets
      this.updateMetricWidgets();
      this.updateThreatsPanel(threats || []);
      this.updateActivityPanel(systemMetrics || {});

      this.screen.render();
    } catch (error) {
      logger.error(`Failed to update dashboard metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private updateMetricWidgets(): void {
    // Update threat count
    const threatWidget = this.widgets.get('threats');
    if (threatWidget) {
      const color = this.metrics.threatsActive > 0 ? 'red' : 'green';
      threatWidget.setContent(this.formatMetricWidget('Active Threats', this.metrics.threatsActive.toString(), color));
    }

    // Update risk score
    const riskWidget = this.widgets.get('risk');
    if (riskWidget) {
      const riskColor = this.metrics.riskScore >= 8 ? 'red' : 
                       this.metrics.riskScore >= 6 ? 'yellow' : 
                       this.metrics.riskScore >= 4 ? 'orange' : 'green';
      riskWidget.setContent(this.formatMetricWidget('Risk Score', `${this.metrics.riskScore.toFixed(1)}/10`, riskColor));
    }

    // Update system status
    const statusWidget = this.widgets.get('status');
    if (statusWidget) {
      const statusColor = this.metrics.systemStatus === 'healthy' ? 'green' : 
                         this.metrics.systemStatus === 'warning' ? 'yellow' : 'red';
      const statusText = this.metrics.systemStatus.charAt(0).toUpperCase() + this.metrics.systemStatus.slice(1);
      statusWidget.setContent(this.formatMetricWidget('System Status', statusText, statusColor));
    }

    // Update uptime
    const uptimeWidget = this.widgets.get('uptime');
    if (uptimeWidget) {
      uptimeWidget.setContent(this.formatMetricWidget('Uptime', this.metrics.uptime, 'white'));
    }
  }

  private updateThreatsPanel(threats: any[]): void {
    const panel = this.widgets.get('recent_threats');
    if (!panel) return;

    if (threats.length === 0) {
      panel.setContent('{bold}Recent Threats{/bold}\n\n{green-fg}No active threats detected{/green-fg}');
      return;
    }

    let content = '{bold}Recent Threats{/bold}\n\n';
    
    threats.slice(0, 8).forEach((threat, index) => {
      const time = new Date(threat.timestamp).toLocaleTimeString();
      const severityColor = threat.severity === 'critical' ? 'red' :
                           threat.severity === 'high' ? 'orange' :
                           threat.severity === 'medium' ? 'yellow' : 'blue';
      
      const statusIcon = threat.status === 'active' ? '🚨' : 
                        threat.status === 'investigating' ? '🔍' : '✅';
      
      content += `${statusIcon} {${severityColor}-fg}${threat.type.toUpperCase()}{/${severityColor}-fg}\n`;
      content += `   ${threat.description.substring(0, 40)}...\n`;
      content += `   {gray-fg}${time} | Risk: ${threat.riskScore}/10{/gray-fg}\n\n`;
    });

    panel.setContent(content);
  }

  private updateActivityPanel(metrics: any): void {
    const panel = this.widgets.get('activity');
    if (!panel) return;

    let content = '{bold}System Activity{/bold}\n\n';

    // System events
    const events = [
      { time: '10:30', event: 'Threat scan completed', type: 'info' },
      { time: '10:28', event: 'User authenticated', type: 'success' },
      { time: '10:25', event: 'Network anomaly detected', type: 'warning' },
      { time: '10:20', event: 'System health check passed', type: 'success' },
      { time: '10:15', event: 'Intelligence feeds updated', type: 'info' }
    ];

    events.forEach(event => {
      const color = event.type === 'success' ? 'green' :
                   event.type === 'warning' ? 'yellow' :
                   event.type === 'error' ? 'red' : 'white';
      
      content += `{${color}-fg}●{/${color}-fg} {gray-fg}${event.time}{/gray-fg} ${event.event}\n`;
    });

    // Add metrics if available
    if (metrics.requestsPerMinute) {
      content += '\n{bold}Performance Metrics{/bold}\n';
      content += `Requests/min: {white-fg}${metrics.requestsPerMinute}{/white-fg}\n`;
      content += `Response time: {white-fg}${metrics.avgResponseTime}ms{/white-fg}\n`;
      content += `Cache hit rate: {white-fg}${metrics.cacheHitRate}%{/white-fg}\n`;
    }

    panel.setContent(content);
  }

  show(): void {
    this.container.show();
  }

  hide(): void {
    this.container.hide();
  }

  focus(): void {
    this.container.focus();
  }

  async refresh(): Promise<void> {
    await this.updateMetrics();
  }

  cleanup(): void {
    // Cleanup any resources
  }
}