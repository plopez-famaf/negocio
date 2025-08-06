"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupBehaviorCommands = setupBehaviorCommands;
const inquirer_1 = __importDefault(require("inquirer"));
const ora_1 = __importDefault(require("ora"));
const api_1 = require("@/services/api");
const config_1 = require("@/utils/config");
const logger_1 = require("@/utils/logger");
const formatter_1 = require("@/utils/formatter");
function setupBehaviorCommands(program) {
    const behaviorCommand = program
        .command('behavior')
        .alias('behav')
        .description('Behavioral analysis commands');
    // Analyze command
    behaviorCommand
        .command('analyze <target>')
        .description('Analyze behavioral patterns for a target')
        .option('-t, --type <type>', 'Analysis type (user, network, system, application)', 'user')
        .option('--since <time>', 'Analyze patterns since (e.g., 1h, 24h, 7d)', '24h')
        .option('--until <time>', 'Analyze patterns until (e.g., now, 1h)', 'now')
        .option('-m, --metrics <metrics...>', 'Specific metrics to analyze')
        .option('--baseline <period>', 'Baseline period for comparison (e.g., 7d)', '7d')
        .option('--format <format>', 'Output format (table, json)', 'table')
        .action(async (target, options) => {
        if (!config_1.configManager.isAuthenticated()) {
            logger_1.logger.error('Please login first: threatguard auth login');
            process.exit(1);
        }
        try {
            // Parse time ranges
            const endTime = parseTimeReference(options.until);
            const startTime = parseTimeReference(options.since, endTime);
            const request = {
                target,
                timeRange: {
                    start: startTime.toISOString(),
                    end: endTime.toISOString()
                },
                analysisType: options.type,
                metrics: options.metrics || []
            };
            logger_1.logger.info(`Analyzing behavioral patterns for: ${target}`);
            logger_1.logger.info(`Time range: ${startTime.toLocaleString()} - ${endTime.toLocaleString()}`);
            const spinner = (0, ora_1.default)('Running behavioral analysis...').start();
            const result = await api_1.apiClient.analyzeBehavior(request);
            spinner.stop();
            logger_1.logger.success(`Analysis completed for ${target}`);
            logger_1.logger.info(`Overall Risk Score: ${formatter_1.formatter.formatRiskScore(result.overallRiskScore)}`);
            logger_1.logger.info(`Patterns Found: ${result.patterns.length}`);
            logger_1.logger.info(`Anomalies Detected: ${result.anomalies}`);
            if (result.patterns.length > 0) {
                logger_1.logger.newLine();
                logger_1.logger.title('Behavioral Patterns:');
                if (options.format === 'json') {
                    console.log(formatter_1.formatter.formatJSON(result.patterns));
                }
                else {
                    result.patterns.forEach(pattern => {
                        console.log(formatter_1.formatter.formatBehaviorPattern(pattern));
                        logger_1.logger.newLine();
                    });
                }
            }
            // Display recommendations
            if (result.recommendations.length > 0) {
                logger_1.logger.title('Recommendations:');
                result.recommendations.forEach((rec, index) => {
                    logger_1.logger.info(`${index + 1}. ${rec}`);
                });
            }
        }
        catch (error) {
            logger_1.logger.error(`Behavioral analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            process.exit(1);
        }
    });
    // Patterns command
    behaviorCommand
        .command('patterns <target>')
        .description('List behavioral patterns for a target')
        .option('--since <time>', 'Show patterns since (e.g., 1h, 24h)', '24h')
        .option('-l, --limit <number>', 'Number of patterns to show', '20')
        .option('--min-confidence <value>', 'Minimum confidence threshold (0-1)', '0.7')
        .option('--format <format>', 'Output format (table, json)', 'table')
        .action(async (target, options) => {
        if (!config_1.configManager.isAuthenticated()) {
            logger_1.logger.error('Please login first: threatguard auth login');
            process.exit(1);
        }
        try {
            const timeRange = {
                since: options.since,
                limit: parseInt(options.limit),
                minConfidence: parseFloat(options.minConfidence)
            };
            const patterns = await api_1.apiClient.getBehaviorPatterns(target, timeRange);
            if (patterns.length === 0) {
                logger_1.logger.info(`No behavioral patterns found for ${target}`);
                return;
            }
            logger_1.logger.success(`Found ${patterns.length} behavioral patterns for ${target}`);
            if (options.format === 'json') {
                console.log(formatter_1.formatter.formatJSON(patterns));
            }
            else {
                patterns.forEach(pattern => {
                    console.log(formatter_1.formatter.formatBehaviorPattern(pattern));
                    logger_1.logger.newLine();
                });
            }
        }
        catch (error) {
            logger_1.logger.error(`Failed to get behavioral patterns: ${error instanceof Error ? error.message : 'Unknown error'}`);
            process.exit(1);
        }
    });
    // Anomaly detection command
    behaviorCommand
        .command('anomalies')
        .description('Detect behavioral anomalies in real-time')
        .option('-t, --targets <targets...>', 'Specific targets to monitor')
        .option('--threshold <value>', 'Anomaly threshold (0-1)', '0.8')
        .option('--min-severity <level>', 'Minimum severity (low, medium, high, critical)', 'medium')
        .option('--live', 'Enable live monitoring mode')
        .action(async (options) => {
        if (!config_1.configManager.isAuthenticated()) {
            logger_1.logger.error('Please login first: threatguard auth login');
            process.exit(1);
        }
        logger_1.logger.info('Starting behavioral anomaly detection...');
        if (options.targets) {
            logger_1.logger.info(`Monitoring targets: ${options.targets.join(', ')}`);
        }
        else {
            logger_1.logger.info('Monitoring all targets');
        }
        logger_1.logger.info(`Anomaly threshold: ${options.threshold}`);
        logger_1.logger.hr();
        if (options.live) {
            logger_1.logger.info('Live monitoring mode - Press Ctrl+C to stop');
            const monitorInterval = setInterval(async () => {
                try {
                    // This would be replaced with WebSocket streaming
                    const filters = {
                        targets: options.targets,
                        threshold: parseFloat(options.threshold),
                        minSeverity: options.minSeverity,
                        since: '1m'
                    };
                    const patterns = await api_1.apiClient.getBehaviorPatterns('*', filters);
                    patterns
                        .filter(pattern => pattern.anomalyScore >= parseFloat(options.threshold))
                        .forEach(pattern => {
                        logger_1.logger.behavior(formatter_1.formatter.formatBehaviorPattern(pattern));
                    });
                }
                catch (error) {
                    logger_1.logger.error(`Anomaly detection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }, 10000); // Check every 10 seconds
            // Handle Ctrl+C
            process.on('SIGINT', () => {
                clearInterval(monitorInterval);
                logger_1.logger.info('\nStopping anomaly detection...');
                process.exit(0);
            });
        }
        else {
            // One-time anomaly detection
            try {
                const spinner = (0, ora_1.default)('Detecting anomalies...').start();
                const filters = {
                    targets: options.targets,
                    threshold: parseFloat(options.threshold),
                    since: '1h'
                };
                const patterns = await api_1.apiClient.getBehaviorPatterns('*', filters);
                const anomalies = patterns.filter(pattern => pattern.anomalyScore >= parseFloat(options.threshold));
                spinner.stop();
                if (anomalies.length === 0) {
                    logger_1.logger.success('No significant anomalies detected');
                }
                else {
                    logger_1.logger.warning(`Found ${anomalies.length} behavioral anomalies`);
                    logger_1.logger.newLine();
                    anomalies.forEach(anomaly => {
                        logger_1.logger.behavior(formatter_1.formatter.formatBehaviorPattern(anomaly));
                        logger_1.logger.newLine();
                    });
                }
            }
            catch (error) {
                logger_1.logger.error(`Anomaly detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                process.exit(1);
            }
        }
    });
    // Interactive behavioral analysis
    behaviorCommand
        .command('interactive')
        .alias('int')
        .description('Interactive behavioral analysis session')
        .action(async () => {
        if (!config_1.configManager.isAuthenticated()) {
            logger_1.logger.error('Please login first: threatguard auth login');
            process.exit(1);
        }
        logger_1.logger.title('Interactive Behavioral Analysis');
        const answers = await inquirer_1.default.prompt([
            {
                type: 'input',
                name: 'target',
                message: 'Enter target to analyze (IP, username, domain):',
                validate: (input) => input.length > 0 || 'Please enter a target'
            },
            {
                type: 'list',
                name: 'analysisType',
                message: 'Select analysis type:',
                choices: [
                    { name: 'User behavior analysis', value: 'user' },
                    { name: 'Network traffic patterns', value: 'network' },
                    { name: 'System behavior analysis', value: 'system' },
                    { name: 'Application usage patterns', value: 'application' }
                ]
            },
            {
                type: 'list',
                name: 'timeRange',
                message: 'Select time range:',
                choices: [
                    { name: 'Last hour', value: '1h' },
                    { name: 'Last 24 hours', value: '24h' },
                    { name: 'Last 7 days', value: '7d' },
                    { name: 'Last 30 days', value: '30d' }
                ]
            },
            {
                type: 'checkbox',
                name: 'metrics',
                message: 'Select metrics to analyze:',
                choices: [
                    'login_patterns',
                    'network_usage',
                    'data_access',
                    'system_calls',
                    'application_usage',
                    'file_access',
                    'privilege_escalation'
                ]
            },
            {
                type: 'confirm',
                name: 'detailed',
                message: 'Include detailed analysis?',
                default: true
            }
        ]);
        try {
            const endTime = new Date();
            const startTime = parseTimeReference(answers.timeRange, endTime);
            const request = {
                target: answers.target,
                timeRange: {
                    start: startTime.toISOString(),
                    end: endTime.toISOString()
                },
                analysisType: answers.analysisType,
                metrics: answers.metrics
            };
            const spinner = (0, ora_1.default)('Analyzing behavioral patterns...').start();
            const result = await api_1.apiClient.analyzeBehavior(request);
            spinner.stop();
            logger_1.logger.success(`Analysis completed for ${answers.target}`);
            logger_1.logger.info(`Risk Score: ${formatter_1.formatter.formatRiskScore(result.overallRiskScore)}`);
            if (result.patterns.length > 0) {
                logger_1.logger.newLine();
                logger_1.logger.title('Key Findings:');
                result.patterns.slice(0, 5).forEach(pattern => {
                    console.log(formatter_1.formatter.formatBehaviorPattern(pattern));
                    logger_1.logger.newLine();
                });
            }
            if (result.recommendations.length > 0) {
                logger_1.logger.title('Recommendations:');
                result.recommendations.forEach((rec, index) => {
                    logger_1.logger.info(`${index + 1}. ${rec}`);
                });
            }
        }
        catch (error) {
            logger_1.logger.error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });
}
// Helper function to parse time references
function parseTimeReference(timeRef, relativeTo = new Date()) {
    const now = relativeTo.getTime();
    if (timeRef === 'now') {
        return new Date(now);
    }
    const match = timeRef.match(/^(\d+)([hmwd])$/);
    if (!match) {
        throw new Error(`Invalid time reference: ${timeRef}`);
    }
    const [, value, unit] = match;
    const amount = parseInt(value);
    let milliseconds = 0;
    switch (unit) {
        case 'h':
            milliseconds = amount * 60 * 60 * 1000;
            break;
        case 'd':
            milliseconds = amount * 24 * 60 * 60 * 1000;
            break;
        case 'w':
            milliseconds = amount * 7 * 24 * 60 * 60 * 1000;
            break;
        case 'm':
            milliseconds = amount * 60 * 1000;
            break;
    }
    return new Date(now - milliseconds);
}
//# sourceMappingURL=behavior.js.map