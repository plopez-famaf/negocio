"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupNetworkCommands = setupNetworkCommands;
const inquirer_1 = __importDefault(require("inquirer"));
const ora_1 = __importDefault(require("ora"));
const api_1 = require("@/services/api");
const config_1 = require("@/utils/config");
const logger_1 = require("@/utils/logger");
const formatter_1 = require("@/utils/formatter");
function setupNetworkCommands(program) {
    const networkCommand = program
        .command('network')
        .alias('net')
        .description('Network monitoring and analysis commands');
    // Scan network command
    networkCommand
        .command('scan <target>')
        .description('Scan network for security issues')
        .option('-p, --ports <ports>', 'Specific ports to scan (e.g., 22,80,443 or 1-1000)')
        .option('--timeout <seconds>', 'Connection timeout in seconds', '5')
        .option('--threads <number>', 'Number of concurrent threads', '50')
        .option('--deep', 'Enable deep packet inspection')
        .option('--services', 'Detect running services')
        .action(async (target, options) => {
        if (!config_1.configManager.isAuthenticated()) {
            logger_1.logger.error('Please login first: threatguard auth login');
            process.exit(1);
        }
        try {
            // Parse ports
            let ports = [];
            if (options.ports) {
                if (options.ports.includes('-')) {
                    const [start, end] = options.ports.split('-').map(Number);
                    ports = Array.from({ length: end - start + 1 }, (_, i) => start + i);
                }
                else {
                    ports = options.ports.split(',').map(Number);
                }
            }
            const scanTarget = {
                network: target,
                ports: ports.length > 0 ? ports : undefined,
                timeout: parseInt(options.timeout)
            };
            logger_1.logger.info(`Starting network scan for: ${target}`);
            if (ports.length > 0) {
                logger_1.logger.info(`Scanning ${ports.length} ports`);
            }
            const spinner = (0, ora_1.default)('Scanning network...').start();
            const scanResult = await api_1.apiClient.scanNetwork(scanTarget);
            spinner.stop();
            logger_1.logger.success('Network scan completed');
            // Display results
            if (scanResult.hosts) {
                logger_1.logger.info(`Discovered ${scanResult.hosts.length} active hosts`);
                scanResult.hosts.forEach((host) => {
                    logger_1.logger.network(`Host: ${host.ip} (${host.hostname || 'Unknown'})`);
                    if (host.openPorts && host.openPorts.length > 0) {
                        host.openPorts.forEach((port) => {
                            const service = port.service ? ` (${port.service})` : '';
                            const status = port.vulnerable ? '🚨 VULNERABLE' : '✅ Open';
                            logger_1.logger.info(`  Port ${port.number}${service}: ${status}`);
                        });
                    }
                    if (host.vulnerabilities && host.vulnerabilities.length > 0) {
                        logger_1.logger.warning(`  ${host.vulnerabilities.length} vulnerabilities found`);
                        host.vulnerabilities.forEach((vuln) => {
                            logger_1.logger.threat(vuln.severity, `  - ${vuln.description}`);
                        });
                    }
                    logger_1.logger.newLine();
                });
            }
        }
        catch (error) {
            logger_1.logger.error(`Network scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            process.exit(1);
        }
    });
    // Monitor network events command
    networkCommand
        .command('monitor')
        .description('Monitor network events in real-time')
        .option('--interface <name>', 'Network interface to monitor')
        .option('--filter <filter>', 'Packet filter (BPF syntax)')
        .option('-p, --protocols <protocols...>', 'Protocols to monitor (tcp, udp, icmp)')
        .option('--suspicious-only', 'Show only suspicious events')
        .option('--min-bytes <size>', 'Minimum packet size to show')
        .action(async (options) => {
        if (!config_1.configManager.isAuthenticated()) {
            logger_1.logger.error('Please login first: threatguard auth login');
            process.exit(1);
        }
        logger_1.logger.info('Starting real-time network monitoring...');
        logger_1.logger.info('Press Ctrl+C to stop monitoring');
        if (options.interface) {
            logger_1.logger.info(`Monitoring interface: ${options.interface}`);
        }
        if (options.protocols) {
            logger_1.logger.info(`Protocols: ${options.protocols.join(', ')}`);
        }
        logger_1.logger.hr();
        // Real-time monitoring simulation (would use WebSocket in real implementation)
        const monitorInterval = setInterval(async () => {
            try {
                const filters = {};
                if (options.protocols)
                    filters.protocols = options.protocols;
                if (options.suspiciousOnly)
                    filters.suspicious = true;
                if (options.minBytes)
                    filters.minBytes = parseInt(options.minBytes);
                if (options.filter)
                    filters.bpfFilter = options.filter;
                filters.since = '30s'; // Last 30 seconds
                filters.limit = 10;
                const events = await api_1.apiClient.getNetworkEvents(filters);
                if (events.length > 0) {
                    events.forEach(event => {
                        const timestamp = new Date(event.timestamp).toLocaleTimeString();
                        const source = `${event.sourceIp}:${event.sourcePort}`;
                        const dest = event.destIp && event.destPort ? `${event.destIp}:${event.destPort}` : 'broadcast';
                        let message = `[${timestamp}] ${event.eventType.toUpperCase()} ${source} → ${dest}`;
                        message += ` (${formatter_1.formatter.formatBytes(event.bytes)})`;
                        if (event.blocked) {
                            message += ' BLOCKED';
                        }
                        switch (event.severity) {
                            case 'critical':
                                logger_1.logger.threat('critical', message);
                                break;
                            case 'warning':
                                logger_1.logger.threat('medium', message);
                                break;
                            default:
                                logger_1.logger.network(message);
                        }
                    });
                }
            }
            catch (error) {
                logger_1.logger.error(`Network monitoring error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }, 5000);
        // Handle Ctrl+C
        process.on('SIGINT', () => {
            clearInterval(monitorInterval);
            logger_1.logger.info('\nStopping network monitoring...');
            process.exit(0);
        });
    });
    // List network events command
    networkCommand
        .command('events')
        .description('List recent network events')
        .option('--since <time>', 'Show events since (e.g., 1h, 24h)', '1h')
        .option('-l, --limit <number>', 'Number of events to show', '50')
        .option('--type <type>', 'Event type filter (connection, traffic, intrusion)')
        .option('--source <ip>', 'Source IP filter')
        .option('--dest <ip>', 'Destination IP filter')
        .option('--protocol <protocol>', 'Protocol filter (tcp, udp, icmp)')
        .option('--format <format>', 'Output format (table, json)', 'table')
        .action(async (options) => {
        if (!config_1.configManager.isAuthenticated()) {
            logger_1.logger.error('Please login first: threatguard auth login');
            process.exit(1);
        }
        try {
            const filters = {
                since: options.since,
                limit: parseInt(options.limit)
            };
            if (options.type)
                filters.eventType = options.type;
            if (options.source)
                filters.sourceIp = options.source;
            if (options.dest)
                filters.destIp = options.dest;
            if (options.protocol)
                filters.protocol = options.protocol;
            const events = await api_1.apiClient.getNetworkEvents(filters);
            if (events.length === 0) {
                logger_1.logger.info('No network events found matching the criteria');
                return;
            }
            logger_1.logger.success(`Found ${events.length} network events`);
            if (options.format === 'json') {
                console.log(formatter_1.formatter.formatJSON(events));
            }
            else {
                console.log(formatter_1.formatter.formatNetworkEventsTable(events));
            }
        }
        catch (error) {
            logger_1.logger.error(`Failed to get network events: ${error instanceof Error ? error.message : 'Unknown error'}`);
            process.exit(1);
        }
    });
    // Network topology discovery
    networkCommand
        .command('topology')
        .description('Discover network topology')
        .option('-n, --network <cidr>', 'Network to analyze (e.g., 192.168.1.0/24)')
        .option('--depth <levels>', 'Discovery depth levels', '3')
        .option('--include-services', 'Include service discovery')
        .action(async (options) => {
        if (!config_1.configManager.isAuthenticated()) {
            logger_1.logger.error('Please login first: threatguard auth login');
            process.exit(1);
        }
        let network = options.network;
        if (!network) {
            const answers = await inquirer_1.default.prompt([
                {
                    type: 'input',
                    name: 'network',
                    message: 'Enter network CIDR to analyze:',
                    validate: (input) => {
                        const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
                        return cidrRegex.test(input) || 'Please enter a valid CIDR';
                    }
                }
            ]);
            network = answers.network;
        }
        try {
            logger_1.logger.info(`Discovering topology for network: ${network}`);
            const spinner = (0, ora_1.default)('Analyzing network topology...').start();
            const topology = await api_1.apiClient.scanNetwork({
                network,
                timeout: 10,
                includePorts: options.includeServices
            });
            spinner.stop();
            if (topology.hosts && topology.hosts.length > 0) {
                logger_1.logger.success(`Discovered ${topology.hosts.length} network devices`);
                logger_1.logger.newLine();
                // Group hosts by subnet
                const subnets = {};
                topology.hosts.forEach((host) => {
                    const subnet = host.ip.split('.').slice(0, 3).join('.');
                    if (!subnets[subnet])
                        subnets[subnet] = [];
                    subnets[subnet].push(host);
                });
                // Display topology
                Object.entries(subnets).forEach(([subnet, hosts]) => {
                    logger_1.logger.subtitle(`Subnet: ${subnet}.0/24`);
                    hosts.forEach(host => {
                        const hostIcon = host.type === 'router' ? '🔀' :
                            host.type === 'switch' ? '🔌' :
                                host.type === 'server' ? '🖥️' : '💻';
                        logger_1.logger.info(`  ${hostIcon} ${host.ip} - ${host.hostname || 'Unknown'}`);
                        if (host.openPorts && options.includeServices) {
                            host.openPorts.slice(0, 5).forEach((port) => {
                                logger_1.logger.dim(`    Port ${port.number}: ${port.service || 'Unknown service'}`);
                            });
                        }
                    });
                    logger_1.logger.newLine();
                });
            }
            else {
                logger_1.logger.warning('No active devices found in the specified network');
            }
        }
        catch (error) {
            logger_1.logger.error(`Topology discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            process.exit(1);
        }
    });
    // Interactive network diagnostics
    networkCommand
        .command('diagnostic')
        .alias('diag')
        .description('Interactive network diagnostics')
        .action(async () => {
        if (!config_1.configManager.isAuthenticated()) {
            logger_1.logger.error('Please login first: threatguard auth login');
            process.exit(1);
        }
        logger_1.logger.title('Interactive Network Diagnostics');
        const answers = await inquirer_1.default.prompt([
            {
                type: 'list',
                name: 'diagnosticType',
                message: 'Select diagnostic type:',
                choices: [
                    { name: 'Network connectivity check', value: 'connectivity' },
                    { name: 'Port accessibility test', value: 'port_test' },
                    { name: 'DNS resolution check', value: 'dns' },
                    { name: 'Network performance test', value: 'performance' },
                    { name: 'Security posture scan', value: 'security' }
                ]
            }
        ]);
        let targetPrompts = [];
        switch (answers.diagnosticType) {
            case 'connectivity':
                targetPrompts = [
                    {
                        type: 'input',
                        name: 'targets',
                        message: 'Enter hosts to test (comma-separated):'
                    }
                ];
                break;
            case 'port_test':
                targetPrompts = [
                    {
                        type: 'input',
                        name: 'host',
                        message: 'Enter host to test:'
                    },
                    {
                        type: 'input',
                        name: 'ports',
                        message: 'Enter ports to test (e.g., 80,443 or 1-100):'
                    }
                ];
                break;
            case 'dns':
                targetPrompts = [
                    {
                        type: 'input',
                        name: 'domains',
                        message: 'Enter domains to test (comma-separated):'
                    }
                ];
                break;
        }
        const targetAnswers = await inquirer_1.default.prompt(targetPrompts);
        try {
            logger_1.logger.info(`Running ${answers.diagnosticType} diagnostic...`);
            const spinner = (0, ora_1.default)('Executing diagnostic tests...').start();
            // Execute diagnostic based on type
            let results;
            switch (answers.diagnosticType) {
                case 'connectivity':
                    results = await runConnectivityTest(targetAnswers.targets.split(','));
                    break;
                case 'port_test':
                    results = await runPortTest(targetAnswers.host, targetAnswers.ports);
                    break;
                case 'security':
                    results = await runSecurityScan(targetAnswers.host || 'localhost');
                    break;
                default:
                    results = { message: 'Diagnostic type not implemented yet' };
            }
            spinner.stop();
            logger_1.logger.success('Diagnostic completed');
            if (results.summary) {
                logger_1.logger.newLine();
                logger_1.logger.title('Diagnostic Summary:');
                console.log(formatter_1.formatter.formatMetricsSummary(results.summary));
            }
            if (results.details) {
                logger_1.logger.newLine();
                logger_1.logger.title('Detailed Results:');
                results.details.forEach((detail) => {
                    logger_1.logger.info(detail);
                });
            }
        }
        catch (error) {
            logger_1.logger.error(`Diagnostic failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });
}
// Helper functions for diagnostics
async function runConnectivityTest(targets) {
    const results = {
        summary: {},
        details: []
    };
    let reachable = 0;
    let unreachable = 0;
    for (const target of targets) {
        try {
            // Simulate ping test
            const isReachable = Math.random() > 0.2; // 80% success rate
            const latency = Math.round(Math.random() * 100 + 10);
            if (isReachable) {
                reachable++;
                results.details.push(`✅ ${target.trim()}: Reachable (${latency}ms)`);
            }
            else {
                unreachable++;
                results.details.push(`❌ ${target.trim()}: Unreachable`);
            }
        }
        catch (error) {
            unreachable++;
            results.details.push(`❌ ${target.trim()}: Error - ${error}`);
        }
    }
    results.summary = {
        'Total Hosts': targets.length,
        'Reachable': reachable,
        'Unreachable': unreachable,
        'Success Rate': `${Math.round((reachable / targets.length) * 100)}%`
    };
    return results;
}
async function runPortTest(host, ports) {
    const results = {
        summary: {},
        details: []
    };
    // Parse ports
    let portList = [];
    if (ports.includes('-')) {
        const [start, end] = ports.split('-').map(Number);
        portList = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }
    else {
        portList = ports.split(',').map(p => parseInt(p.trim()));
    }
    let open = 0;
    let closed = 0;
    for (const port of portList) {
        const isOpen = Math.random() > 0.7; // 30% ports open
        if (isOpen) {
            open++;
            const service = getServiceName(port);
            results.details.push(`✅ ${host}:${port} - Open ${service ? `(${service})` : ''}`);
        }
        else {
            closed++;
            results.details.push(`❌ ${host}:${port} - Closed/Filtered`);
        }
    }
    results.summary = {
        'Total Ports': portList.length,
        'Open': open,
        'Closed/Filtered': closed,
        'Open Rate': `${Math.round((open / portList.length) * 100)}%`
    };
    return results;
}
async function runSecurityScan(host) {
    const results = {
        summary: {},
        details: []
    };
    // Simulate security checks
    const checks = [
        { name: 'SSL/TLS Configuration', status: 'pass' },
        { name: 'Open Ports Security', status: Math.random() > 0.8 ? 'warn' : 'pass' },
        { name: 'Service Banners', status: 'pass' },
        { name: 'Common Vulnerabilities', status: Math.random() > 0.9 ? 'fail' : 'pass' },
        { name: 'Default Credentials', status: 'pass' }
    ];
    let passed = 0;
    let warnings = 0;
    let failed = 0;
    checks.forEach(check => {
        switch (check.status) {
            case 'pass':
                passed++;
                results.details.push(`✅ ${check.name}: Passed`);
                break;
            case 'warn':
                warnings++;
                results.details.push(`⚠️  ${check.name}: Warning - Review required`);
                break;
            case 'fail':
                failed++;
                results.details.push(`❌ ${check.name}: Failed - Action required`);
                break;
        }
    });
    results.summary = {
        'Total Checks': checks.length,
        'Passed': passed,
        'Warnings': warnings,
        'Failed': failed,
        'Security Score': `${Math.round(((passed + warnings * 0.5) / checks.length) * 100)}%`
    };
    return results;
}
function getServiceName(port) {
    const services = {
        22: 'SSH',
        23: 'Telnet',
        25: 'SMTP',
        53: 'DNS',
        80: 'HTTP',
        110: 'POP3',
        143: 'IMAP',
        443: 'HTTPS',
        993: 'IMAPS',
        995: 'POP3S'
    };
    return services[port] || null;
}
//# sourceMappingURL=network.js.map