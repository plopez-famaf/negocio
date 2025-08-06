"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatter = exports.OutputFormatter = void 0;
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const asciichart_1 = __importDefault(require("asciichart"));
const moment_1 = __importDefault(require("moment"));
class OutputFormatter {
    // Format threat events
    formatThreat(threat) {
        const severityColor = this.getSeverityColor(threat.severity);
        const statusIcon = this.getStatusIcon(threat.status);
        return `${statusIcon} ${severityColor(threat.type.toUpperCase())} - ${threat.description}
   Source: ${chalk_1.default.cyan(threat.source)}${threat.target ? ` → ${chalk_1.default.cyan(threat.target)}` : ''}
   Risk: ${this.formatRiskScore(threat.riskScore)} | ${chalk_1.default.gray((0, moment_1.default)(threat.timestamp).fromNow())}`;
    }
    // Format threat table
    formatThreatsTable(threats) {
        const table = new cli_table3_1.default({
            head: ['Time', 'Type', 'Severity', 'Source', 'Target', 'Risk', 'Status'],
            colWidths: [12, 15, 10, 20, 20, 8, 12]
        });
        threats.forEach(threat => {
            table.push([
                (0, moment_1.default)(threat.timestamp).format('HH:mm:ss'),
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
    formatBehaviorPattern(pattern) {
        const confidenceBar = this.createBar(pattern.confidence, 10);
        const anomalyBar = this.createBar(pattern.anomalyScore, 10);
        return `${chalk_1.default.magenta('🧠')} Pattern: ${chalk_1.default.bold(pattern.pattern)}
   Target: ${chalk_1.default.cyan(pattern.target)}
   Confidence: ${confidenceBar} ${(pattern.confidence * 100).toFixed(1)}%
   Anomaly Score: ${anomalyBar} ${pattern.anomalyScore.toFixed(2)}
   Deviations: ${pattern.deviations.join(', ')}
   Time: ${chalk_1.default.gray((0, moment_1.default)(pattern.timestamp).fromNow())}`;
    }
    // Format network events table
    formatNetworkEventsTable(events) {
        const table = new cli_table3_1.default({
            head: ['Time', 'Type', 'Source', 'Destination', 'Protocol', 'Bytes', 'Status'],
            colWidths: [12, 15, 18, 18, 8, 10, 10]
        });
        events.forEach(event => {
            const destination = event.destIp && event.destPort
                ? `${event.destIp}:${event.destPort}`
                : event.destIp || '-';
            const status = event.blocked ? chalk_1.default.red('BLOCKED') : chalk_1.default.green('ALLOWED');
            table.push([
                (0, moment_1.default)(event.timestamp).format('HH:mm:ss'),
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
    formatThreatIntel(result) {
        const reputationColor = this.getReputationColor(result.reputation);
        const confidenceBar = this.createBar(result.confidence, 10);
        let output = `${reputationColor('●')} Query: ${chalk_1.default.bold(result.query)} (${result.type})
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
    createChart(data, title, config) {
        const chartConfig = {
            height: 10,
            colors: [chalk_1.default.cyan],
            ...config
        };
        let output = '';
        if (title) {
            output += chalk_1.default.bold(title) + '\n';
        }
        output += asciichart_1.default.plot(data, chartConfig);
        return output;
    }
    // Format metrics summary
    formatMetricsSummary(metrics) {
        const table = new cli_table3_1.default({
            head: ['Metric', 'Value', 'Status'],
            colWidths: [25, 15, 15]
        });
        Object.entries(metrics).forEach(([key, value]) => {
            let status = chalk_1.default.green('●');
            if (typeof value === 'object' && value.status) {
                switch (value.status) {
                    case 'warning':
                        status = chalk_1.default.yellow('●');
                        break;
                    case 'critical':
                        status = chalk_1.default.red('●');
                        break;
                    case 'healthy':
                    default:
                        status = chalk_1.default.green('●');
                }
            }
            const displayValue = typeof value === 'object' ? value.value : value;
            table.push([key, displayValue, status]);
        });
        return table.toString();
    }
    // Utility methods
    getSeverityColor(severity) {
        switch (severity) {
            case 'critical':
                return chalk_1.default.red;
            case 'high':
                return chalk_1.default.orange;
            case 'medium':
                return chalk_1.default.yellow;
            case 'low':
                return chalk_1.default.blue;
            default:
                return chalk_1.default.white;
        }
    }
    getReputationColor(reputation) {
        switch (reputation) {
            case 'malicious':
                return chalk_1.default.red;
            case 'suspicious':
                return chalk_1.default.yellow;
            case 'clean':
                return chalk_1.default.green;
            default:
                return chalk_1.default.gray;
        }
    }
    getStatusIcon(status) {
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
    formatRiskScore(score) {
        if (score >= 8)
            return chalk_1.default.red(`${score}/10`);
        if (score >= 6)
            return chalk_1.default.orange(`${score}/10`);
        if (score >= 4)
            return chalk_1.default.yellow(`${score}/10`);
        return chalk_1.default.blue(`${score}/10`);
    }
    formatBytes(bytes) {
        if (bytes === 0)
            return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    createBar(value, length = 10, char = '█') {
        const filled = Math.round(value * length);
        const empty = length - filled;
        return chalk_1.default.green(char.repeat(filled)) + chalk_1.default.gray('░'.repeat(empty));
    }
    // JSON output
    formatJSON(data) {
        return JSON.stringify(data, null, 2);
    }
    // CSV output
    formatCSV(data) {
        if (!data.length)
            return '';
        const headers = Object.keys(data[0]);
        const csvRows = [
            headers.join(','),
            ...data.map(row => headers.map(header => {
                const value = row[header];
                return typeof value === 'string' && value.includes(',')
                    ? `"${value}"`
                    : value;
            }).join(','))
        ];
        return csvRows.join('\n');
    }
}
exports.OutputFormatter = OutputFormatter;
exports.formatter = new OutputFormatter();
//# sourceMappingURL=formatter.js.map