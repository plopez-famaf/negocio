import chalk from 'chalk';
import Table from 'cli-table3';
import asciichart from 'asciichart';
import moment from 'moment';
import { ThreatEvent, BehaviorPattern, NetworkEvent, ThreatIntelligenceResult } from '@/types';

export class OutputFormatter {
  
  // Format threat events
  formatThreat(threat: ThreatEvent): string {
    const severityColor = this.getSeverityColor(threat.severity);
    const statusIcon = this.getStatusIcon(threat.status);
    
    return `${statusIcon} ${severityColor(threat.type.toUpperCase())} - ${threat.description}
   Source: ${chalk.cyan(threat.source)}${threat.target ? ` → ${chalk.cyan(threat.target)}` : ''}
   Risk: ${this.formatRiskScore(threat.riskScore)} | ${chalk.gray(moment(threat.timestamp).fromNow())}`;
  }

  // Format threat table
  formatThreatsTable(threats: ThreatEvent[]): string {
    const table = new Table({
      head: ['Time', 'Type', 'Severity', 'Source', 'Target', 'Risk', 'Status'],
      colWidths: [12, 15, 10, 20, 20, 8, 12]
    });

    threats.forEach(threat => {
      table.push([
        moment(threat.timestamp).format('HH:mm:ss'),
        threat.type,
        this.getSeverityColor(threat.severity)(threat.severity),
        threat.source,
        threat.target || '-',
        this.formatRiskScore(threat.riskScore),
        this.getStatusIcon(threat.status) + ' ' + threat.status
      ]);
    });

    return table.toString();
  }

  // Format behavioral patterns
  formatBehaviorPattern(pattern: BehaviorPattern): string {
    const confidenceBar = this.createBar(pattern.confidence, 10);
    const anomalyBar = this.createBar(pattern.anomalyScore, 10);
    
    return `${chalk.magenta('🧠')} Pattern: ${chalk.bold(pattern.pattern)}
   Target: ${chalk.cyan(pattern.target)}
   Confidence: ${confidenceBar} ${(pattern.confidence * 100).toFixed(1)}%
   Anomaly Score: ${anomalyBar} ${pattern.anomalyScore.toFixed(2)}
   Deviations: ${pattern.deviations.join(', ')}
   Time: ${chalk.gray(moment(pattern.timestamp).fromNow())}`;
  }

  // Format network events table
  formatNetworkEventsTable(events: NetworkEvent[]): string {
    const table = new Table({
      head: ['Time', 'Type', 'Source', 'Destination', 'Protocol', 'Bytes', 'Status'],
      colWidths: [12, 15, 18, 18, 8, 10, 10]
    });

    events.forEach(event => {
      const destination = event.destIp && event.destPort 
        ? `${event.destIp}:${event.destPort}`
        : event.destIp || '-';
      
      const status = event.blocked ? chalk.red('BLOCKED') : chalk.green('ALLOWED');
      
      table.push([
        moment(event.timestamp).format('HH:mm:ss'),
        event.eventType,
        `${event.sourceIp}${event.sourcePort ? `:${event.sourcePort}` : ''}`,
        destination,
        event.protocol,
        this.formatBytes(event.bytes),
        status
      ]);
    });

    return table.toString();
  }

  // Format threat intelligence result
  formatThreatIntel(result: ThreatIntelligenceResult): string {
    const reputationColor = this.getReputationColor(result.reputation);
    const confidenceBar = this.createBar(result.confidence, 10);
    
    let output = `${reputationColor('●')} Query: ${chalk.bold(result.query)} (${result.type})
   Reputation: ${reputationColor(result.reputation.toUpperCase())}
   Confidence: ${confidenceBar} ${(result.confidence * 100).toFixed(1)}%`;

    if (result.context.country) {
      output += `\n   Location: ${result.context.country}`;
    }
    
    if (result.context.organization) {
      output += `\n   Organization: ${result.context.organization}`;
    }

    if (result.sources.length > 0) {
      output += '\n   Sources:';
      result.sources.forEach(source => {
        const sourceColor = this.getReputationColor(source.reputation);
        output += `\n     • ${source.name}: ${sourceColor(source.reputation)}`;
        if (source.tags.length > 0) {
          output += ` [${source.tags.join(', ')}]`;
        }
      });
    }

    return output;
  }

  // Create ASCII charts
  createChart(data: number[], title?: string, config?: any): string {
    const chartConfig = {
      height: 10,
      colors: [chalk.cyan],
      ...config
    };
    
    let output = '';
    if (title) {
      output += chalk.bold(title) + '\n';
    }
    
    output += asciichart.plot(data, chartConfig);
    return output;
  }

  // Format metrics summary
  formatMetricsSummary(metrics: any): string {
    const table = new Table({
      head: ['Metric', 'Value', 'Status'],
      colWidths: [25, 15, 15]
    });

    Object.entries(metrics).forEach(([key, value]: [string, any]) => {
      let status = chalk.green('●');
      if (typeof value === 'object' && value.status) {
        switch (value.status) {
          case 'warning':
            status = chalk.yellow('●');
            break;
          case 'critical':
            status = chalk.red('●');
            break;
          case 'healthy':
          default:
            status = chalk.green('●');
        }
      }

      const displayValue = typeof value === 'object' ? value.value : value;
      table.push([key, displayValue, status]);
    });

    return table.toString();
  }

  // Utility methods
  private getSeverityColor(severity: string): chalk.Chalk {
    switch (severity) {
      case 'critical':
        return chalk.red;
      case 'high':
        return chalk.orange;
      case 'medium':
        return chalk.yellow;
      case 'low':
        return chalk.blue;
      default:
        return chalk.white;
    }
  }

  private getReputationColor(reputation: string): chalk.Chalk {
    switch (reputation) {
      case 'malicious':
        return chalk.red;
      case 'suspicious':
        return chalk.yellow;
      case 'clean':
        return chalk.green;
      default:
        return chalk.gray;
    }
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'active':
        return '🚨';
      case 'investigating':
        return '🔍';
      case 'resolved':
        return '✅';
      case 'false_positive':
        return '❌';
      default:
        return '❓';
    }
  }

  private formatRiskScore(score: number): string {
    if (score >= 8) return chalk.red(`${score}/10`);
    if (score >= 6) return chalk.orange(`${score}/10`);
    if (score >= 4) return chalk.yellow(`${score}/10`);
    return chalk.blue(`${score}/10`);
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  private createBar(value: number, length: number = 10, char: string = '█'): string {
    const filled = Math.round(value * length);
    const empty = length - filled;
    
    return chalk.green(char.repeat(filled)) + chalk.gray('░'.repeat(empty));
  }

  // JSON output
  formatJSON(data: any): string {
    return JSON.stringify(data, null, 2);
  }

  // CSV output
  formatCSV(data: any[]): string {
    if (!data.length) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',') 
            ? `"${value}"` 
            : value;
        }).join(',')
      )
    ];
    
    return csvRows.join('\n');
  }
}

export const formatter = new OutputFormatter();