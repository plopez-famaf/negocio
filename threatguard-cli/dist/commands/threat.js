"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupThreatCommands = setupThreatCommands;
const inquirer_1 = __importDefault(require("inquirer"));
const ora_1 = __importDefault(require("ora"));
const api_1 = require("@/services/api");
const config_1 = require("@/utils/config");
const logger_1 = require("@/utils/logger");
const formatter_1 = require("@/utils/formatter");
function setupThreatCommands(program) {
    const threatCommand = program
        .command('threat')
        .description('Threat detection and analysis commands');
    // Scan command
    threatCommand
        .command('scan')
        .description('Start a threat scan')
        .option('-t, --targets <targets...>', 'Target IPs, networks, or hostnames')
        .option('-n, --network <network>', 'Network CIDR to scan (e.g., 192.168.1.0/24)')
        .option('--timeout <seconds>', 'Scan timeout in seconds', '300')
        .option('--deep', 'Enable deep threat analysis')
        .option('--live', 'Show live scan results')
        .action(async (options) => {
        if (!config_1.configManager.isAuthenticated()) {
            logger_1.logger.error('Please login first: threatguard auth login');
            process.exit(1);
        }
        let targets = [];
        // Determine targets
        if (options.targets) {
            targets = options.targets;
        }
        else if (options.network) {
            targets = [options.network];
        }
        else {
            // Interactive target selection
            const answers = await inquirer_1.default.prompt([
                {
                    type: 'list',
                    name: 'scanType',
                    message: 'What would you like to scan?',
                    choices: [
                        { name: 'Network range (e.g., 192.168.1.0/24)', value: 'network' },
                        { name: 'Specific IP addresses', value: 'ips' },
                        { name: 'Domain names', value: 'domains' }
                    ]
                },
                {
                    type: 'input',
                    name: 'networkRange',
                    message: 'Enter network CIDR:',
                    when: (answers) => answers.scanType === 'network',
                    validate: (input) => {
                        const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
                        return cidrRegex.test(input) || 'Please enter a valid CIDR (e.g., 192.168.1.0/24)';
                    }
                },
                {
                    type: 'input',
                    name: 'targetList',
                    message: 'Enter targets (comma-separated):',
                    when: (answers) => answers.scanType !== 'network',
                    validate: (input) => input.length > 0 || 'Please enter at least one target'
                }
            ]);
            if (answers.networkRange) {
                targets = [answers.networkRange];
            }
            else if (answers.targetList) {
                targets = answers.targetList.split(',').map((t) => t.trim());
            }
        }
        if (targets.length === 0) {
            logger_1.logger.error('No targets specified for scanning');
            process.exit(1);
        }
        try {
            const scanOptions = {
                timeout: parseInt(options.timeout),
                deepAnalysis: options.deep || false,
                realTime: options.live || false
            };
            logger_1.logger.info(`Starting threat scan for: ${targets.join(', ')}`);
            const spinner = (0, ora_1.default)('Initializing scan...').start();
            const scanResult = await api_1.apiClient.startThreatScan(targets, scanOptions);
            spinner.text = `Scanning ${scanResult.targetsScanned} targets...`;
            // Poll for results
            let currentResult = scanResult;
            while (currentResult.status === 'running') {
                await new Promise(resolve => setTimeout(resolve, 2000));
                currentResult = await api_1.apiClient.getThreatScanStatus(scanResult.scanId);
                if (options.live && currentResult.threats.length > 0) {
                    spinner.stop();
                    currentResult.threats.forEach(threat => {
                        logger_1.logger.threat(threat.severity, formatter_1.formatter.formatThreat(threat));
                    });
                    spinner.start(`Scanning... ${currentResult.threatsFound} threats found`);
                }
            }
            spinner.stop();
            if (currentResult.status === 'completed') {
                logger_1.logger.success(`Scan completed! Found ${currentResult.threatsFound} threats`);
                // Display summary
                const summary = currentResult.summary;
                if (summary.critical > 0)
                    logger_1.logger.threat('critical', `Critical: ${summary.critical}`);
                if (summary.high > 0)
                    logger_1.logger.threat('high', `High: ${summary.high}`);
                if (summary.medium > 0)
                    logger_1.logger.threat('medium', `Medium: ${summary.medium}`);
                if (summary.low > 0)
                    logger_1.logger.threat('low', `Low: ${summary.low}`);
                // Display threats table if any found
                if (currentResult.threats.length > 0) {
                    logger_1.logger.newLine();
                    logger_1.logger.title('Threats Found:');
                    console.log(formatter_1.formatter.formatThreatsTable(currentResult.threats));
                }
            }
            else {
                logger_1.logger.error(`Scan failed with status: ${currentResult.status}`);
            }
        }
        catch (error) {
            logger_1.logger.error(`Threat scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            process.exit(1);
        }
    });
    // List threats command
    threatCommand
        .command('list')
        .alias('ls')
        .description('List recent threats')
        .option('-l, --limit <number>', 'Number of threats to show', '20')
        .option('-s, --severity <level>', 'Filter by severity (low, medium, high, critical)')
        .option('--status <status>', 'Filter by status (active, investigating, resolved)')
        .option('--format <format>', 'Output format (table, json)', 'table')
        .option('--since <time>', 'Show threats since (e.g., 1h, 24h, 7d)')
        .action(async (options) => {
        if (!config_1.configManager.isAuthenticated()) {
            logger_1.logger.error('Please login first: threatguard auth login');
            process.exit(1);
        }
        try {
            const filters = {
                limit: parseInt(options.limit)
            };
            if (options.severity)
                filters.severity = options.severity;
            if (options.status)
                filters.status = options.status;
            if (options.since)
                filters.since = options.since;
            const threats = await api_1.apiClient.getThreats(filters);
            if (threats.length === 0) {
                logger_1.logger.info('No threats found matching the criteria');
                return;
            }
            logger_1.logger.success(`Found ${threats.length} threats`);
            if (options.format === 'json') {
                console.log(formatter_1.formatter.formatJSON(threats));
            }
            else {
                console.log(formatter_1.formatter.formatThreatsTable(threats));
            }
        }
        catch (error) {
            logger_1.logger.error(`Failed to list threats: ${error instanceof Error ? error.message : 'Unknown error'}`);
            process.exit(1);
        }
    });
    // Watch command for real-time threats
    threatCommand
        .command('watch')
        .description('Watch for real-time threats')
        .option('-s, --severity <level>', 'Minimum severity to display (low, medium, high, critical)')
        .option('--sound', 'Play sound alerts for high/critical threats')
        .action(async (options) => {
        if (!config_1.configManager.isAuthenticated()) {
            logger_1.logger.error('Please login first: threatguard auth login');
            process.exit(1);
        }
        logger_1.logger.info('Starting real-time threat monitoring...');
        logger_1.logger.info('Press Ctrl+C to stop');
        logger_1.logger.hr();
        // This would connect to WebSocket stream
        // For now, simulate with polling
        const pollInterval = setInterval(async () => {
            try {
                const threats = await api_1.apiClient.getThreats({
                    limit: 5,
                    since: '5m',
                    severity: options.severity
                });
                threats.forEach(threat => {
                    logger_1.logger.threat(threat.severity, formatter_1.formatter.formatThreat(threat));
                    // Sound alert for critical threats
                    if (options.sound && (threat.severity === 'critical' || threat.severity === 'high')) {
                        process.stdout.write('\x07'); // ASCII bell
                    }
                });
            }
            catch (error) {
                logger_1.logger.error(`Failed to fetch threats: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }, 5000);
        // Handle Ctrl+C gracefully
        process.on('SIGINT', () => {
            clearInterval(pollInterval);
            logger_1.logger.info('\nStopping threat monitoring...');
            process.exit(0);
        });
    });
    // Status command
    threatCommand
        .command('status')
        .description('Show threat detection system status')
        .action(async () => {
        if (!config_1.configManager.isAuthenticated()) {
            logger_1.logger.error('Please login first: threatguard auth login');
            process.exit(1);
        }
        try {
            const health = await api_1.apiClient.getSystemHealth();
            const metrics = await api_1.apiClient.getMetrics({ timeRange: '1h' });
            logger_1.logger.title('Threat Detection System Status');
            // System health
            const status = health.services?.threatDetection?.status || 'unknown';
            const statusColor = status === 'healthy' ? 'success' : 'error';
            logger_1.logger[statusColor](`System Status: ${status.toUpperCase()}`);
            // Display metrics
            if (metrics) {
                logger_1.logger.newLine();
                console.log(formatter_1.formatter.formatMetricsSummary({
                    'Active Threats': metrics.activeThreats || 0,
                    'Threats Today': metrics.threatsToday || 0,
                    'System Uptime': metrics.uptime || 'Unknown',
                    'Detection Rate': `${metrics.detectionRate || 0}%`,
                    'False Positives': `${metrics.falsePositiveRate || 0}%`
                }));
            }
        }
        catch (error) {
            logger_1.logger.error(`Failed to get system status: ${error instanceof Error ? error.message : 'Unknown error'}`);
            process.exit(1);
        }
    });
}
//# sourceMappingURL=threat.js.map