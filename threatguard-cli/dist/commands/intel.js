"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupIntelCommands = setupIntelCommands;
const inquirer_1 = __importDefault(require("inquirer"));
const ora_1 = __importDefault(require("ora"));
const api_1 = require("@/services/api");
const config_1 = require("@/utils/config");
const logger_1 = require("@/utils/logger");
const formatter_1 = require("@/utils/formatter");
function setupIntelCommands(program) {
    const intelCommand = program
        .command('intel')
        .description('Threat intelligence commands');
    // Query command
    intelCommand
        .command('query <indicator>')
        .description('Query threat intelligence for an indicator')
        .option('-t, --type <type>', 'Indicator type (ip, domain, hash, url)', 'auto')
        .option('-s, --sources <sources...>', 'Specific intelligence sources to query')
        .option('--format <format>', 'Output format (table, json)', 'table')
        .option('--verbose', 'Include detailed source information')
        .action(async (indicator, options) => {
        if (!config_1.configManager.isAuthenticated()) {
            logger_1.logger.error('Please login first: threatguard auth login');
            process.exit(1);
        }
        try {
            // Auto-detect indicator type if not specified
            let indicatorType = options.type;
            if (indicatorType === 'auto') {
                indicatorType = detectIndicatorType(indicator);
            }
            const query = {
                type: indicatorType,
                value: indicator,
                sources: options.sources
            };
            logger_1.logger.info(`Querying threat intelligence for: ${indicator} (${indicatorType})`);
            const spinner = (0, ora_1.default)('Gathering intelligence...').start();
            const result = await api_1.apiClient.queryThreatIntel(query);
            spinner.stop();
            if (options.format === 'json') {
                console.log(formatter_1.formatter.formatJSON(result));
            }
            else {
                console.log(formatter_1.formatter.formatThreatIntel(result));
                if (options.verbose && result.sources.length > 0) {
                    logger_1.logger.newLine();
                    logger_1.logger.title('Source Details:');
                    result.sources.forEach(source => {
                        logger_1.logger.info(`${source.name}:`);
                        logger_1.logger.info(`  Reputation: ${source.reputation}`);
                        logger_1.logger.info(`  Last Seen: ${source.lastSeen || 'Unknown'}`);
                        if (source.tags.length > 0) {
                            logger_1.logger.info(`  Tags: ${source.tags.join(', ')}`);
                        }
                        logger_1.logger.newLine();
                    });
                }
            }
            // Provide recommendations based on reputation
            if (result.reputation === 'malicious') {
                logger_1.logger.security('RECOMMENDATION: Block this indicator immediately');
            }
            else if (result.reputation === 'suspicious') {
                logger_1.logger.warning('RECOMMENDATION: Monitor this indicator closely');
            }
            else if (result.reputation === 'clean') {
                logger_1.logger.success('RECOMMENDATION: Indicator appears safe');
            }
        }
        catch (error) {
            logger_1.logger.error(`Intelligence query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            process.exit(1);
        }
    });
    // Batch query command
    intelCommand
        .command('batch <file>')
        .description('Query threat intelligence for indicators from a file')
        .option('--format <format>', 'Input file format (text, csv, json)', 'text')
        .option('--output <file>', 'Output results to file')
        .option('--concurrent <number>', 'Number of concurrent queries', '5')
        .action(async (file, options) => {
        if (!config_1.configManager.isAuthenticated()) {
            logger_1.logger.error('Please login first: threatguard auth login');
            process.exit(1);
        }
        try {
            // Read indicators from file
            const fs = require('fs');
            let indicators = [];
            if (!fs.existsSync(file)) {
                logger_1.logger.error(`File not found: ${file}`);
                process.exit(1);
            }
            const fileContent = fs.readFileSync(file, 'utf8');
            switch (options.format) {
                case 'text':
                    indicators = fileContent.split('\n')
                        .map((line) => line.trim())
                        .filter((line) => line.length > 0);
                    break;
                case 'csv':
                    indicators = fileContent.split('\n')
                        .slice(1) // Skip header
                        .map((line) => line.split(',')[0].trim())
                        .filter((line) => line.length > 0);
                    break;
                case 'json':
                    const jsonData = JSON.parse(fileContent);
                    indicators = Array.isArray(jsonData) ? jsonData : jsonData.indicators || [];
                    break;
            }
            if (indicators.length === 0) {
                logger_1.logger.error('No indicators found in file');
                process.exit(1);
            }
            logger_1.logger.info(`Processing ${indicators.length} indicators...`);
            const results = [];
            const concurrent = parseInt(options.concurrent);
            // Process indicators in batches
            for (let i = 0; i < indicators.length; i += concurrent) {
                const batch = indicators.slice(i, i + concurrent);
                const batchPromises = batch.map(async (indicator) => {
                    try {
                        const query = {
                            type: detectIndicatorType(indicator),
                            value: indicator
                        };
                        const result = await api_1.apiClient.queryThreatIntel(query);
                        logger_1.logger.info(`✓ ${indicator}: ${result.reputation}`);
                        return { indicator, ...result };
                    }
                    catch (error) {
                        logger_1.logger.error(`✗ ${indicator}: Query failed`);
                        return { indicator, error: error instanceof Error ? error.message : 'Unknown error' };
                    }
                });
                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);
                // Show progress
                logger_1.logger.progress(Math.min(i + concurrent, indicators.length), indicators.length);
            }
            logger_1.logger.success(`Completed processing ${indicators.length} indicators`);
            // Output results
            if (options.output) {
                fs.writeFileSync(options.output, JSON.stringify(results, null, 2));
                logger_1.logger.success(`Results saved to: ${options.output}`);
            }
            else {
                // Display summary
                const summary = {
                    malicious: results.filter(r => r.reputation === 'malicious').length,
                    suspicious: results.filter(r => r.reputation === 'suspicious').length,
                    clean: results.filter(r => r.reputation === 'clean').length,
                    unknown: results.filter(r => r.reputation === 'unknown').length,
                    errors: results.filter(r => r.error).length
                };
                logger_1.logger.newLine();
                console.log(formatter_1.formatter.formatMetricsSummary(summary));
            }
        }
        catch (error) {
            logger_1.logger.error(`Batch intelligence query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            process.exit(1);
        }
    });
    // Search command
    intelCommand
        .command('search <term>')
        .description('Search threat intelligence databases')
        .option('-c, --category <category>', 'Search category (malware, apt, campaign)')
        .option('-l, --limit <number>', 'Number of results to return', '20')
        .option('--since <time>', 'Results since time (e.g., 24h, 7d)', '30d')
        .action(async (term, options) => {
        if (!config_1.configManager.isAuthenticated()) {
            logger_1.logger.error('Please login first: threatguard auth login');
            process.exit(1);
        }
        try {
            logger_1.logger.info(`Searching threat intelligence for: "${term}"`);
            const spinner = (0, ora_1.default)('Searching intelligence databases...').start();
            // This would be a search endpoint in the real API
            const searchResults = await api_1.apiClient.getThreats({
                search: term,
                category: options.category,
                limit: parseInt(options.limit),
                since: options.since
            });
            spinner.stop();
            if (searchResults.length === 0) {
                logger_1.logger.info('No threat intelligence found matching your search');
                return;
            }
            logger_1.logger.success(`Found ${searchResults.length} intelligence items`);
            searchResults.forEach((item, index) => {
                logger_1.logger.info(`${index + 1}. ${item.title || item.description}`);
                if (item.category)
                    logger_1.logger.dim(`   Category: ${item.category}`);
                if (item.tags)
                    logger_1.logger.dim(`   Tags: ${item.tags.join(', ')}`);
                if (item.confidence)
                    logger_1.logger.dim(`   Confidence: ${item.confidence}%`);
                logger_1.logger.dim(`   Source: ${item.source} | ${new Date(item.timestamp).toLocaleDateString()}`);
                logger_1.logger.newLine();
            });
        }
        catch (error) {
            logger_1.logger.error(`Intelligence search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            process.exit(1);
        }
    });
    // Feed command to list available feeds
    intelCommand
        .command('feeds')
        .description('List available threat intelligence feeds')
        .option('--status', 'Show feed status and statistics')
        .action(async (options) => {
        if (!config_1.configManager.isAuthenticated()) {
            logger_1.logger.error('Please login first: threatguard auth login');
            process.exit(1);
        }
        try {
            // Get system health which includes feed information
            const health = await api_1.apiClient.getSystemHealth();
            const feeds = health.threatIntelligence?.feeds || [];
            if (feeds.length === 0) {
                logger_1.logger.info('No threat intelligence feeds configured');
                return;
            }
            logger_1.logger.title('Available Threat Intelligence Feeds:');
            feeds.forEach((feed) => {
                const statusIcon = feed.status === 'active' ? '✅' : '❌';
                logger_1.logger.info(`${statusIcon} ${feed.name}`);
                logger_1.logger.dim(`   Description: ${feed.description}`);
                logger_1.logger.dim(`   Type: ${feed.type} | Update Frequency: ${feed.updateFrequency}`);
                if (options.status) {
                    logger_1.logger.dim(`   Last Update: ${feed.lastUpdate || 'Never'}`);
                    logger_1.logger.dim(`   Total Records: ${feed.recordCount || 0}`);
                    logger_1.logger.dim(`   Quality Score: ${feed.qualityScore || 'Unknown'}/10`);
                }
                logger_1.logger.newLine();
            });
        }
        catch (error) {
            logger_1.logger.error(`Failed to get threat intelligence feeds: ${error instanceof Error ? error.message : 'Unknown error'}`);
            process.exit(1);
        }
    });
    // Interactive intelligence analysis
    intelCommand
        .command('analyze')
        .description('Interactive threat intelligence analysis')
        .action(async () => {
        if (!config_1.configManager.isAuthenticated()) {
            logger_1.logger.error('Please login first: threatguard auth login');
            process.exit(1);
        }
        logger_1.logger.title('Interactive Threat Intelligence Analysis');
        const answers = await inquirer_1.default.prompt([
            {
                type: 'list',
                name: 'analysisType',
                message: 'Select analysis type:',
                choices: [
                    { name: 'Single indicator lookup', value: 'single' },
                    { name: 'IOC correlation analysis', value: 'correlation' },
                    { name: 'Campaign attribution', value: 'attribution' },
                    { name: 'Threat landscape overview', value: 'landscape' }
                ]
            }
        ]);
        switch (answers.analysisType) {
            case 'single':
                await performSingleLookup();
                break;
            case 'correlation':
                await performCorrelationAnalysis();
                break;
            case 'attribution':
                await performAttributionAnalysis();
                break;
            case 'landscape':
                await performLandscapeAnalysis();
                break;
        }
    });
}
// Helper functions
function detectIndicatorType(indicator) {
    // IP address
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(indicator)) {
        return 'ip';
    }
    // Domain
    if (/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(indicator)) {
        return 'domain';
    }
    // URL
    if (/^https?:\/\//.test(indicator)) {
        return 'url';
    }
    // Hash (MD5, SHA1, SHA256)
    if (/^[a-fA-F0-9]{32}$/.test(indicator) ||
        /^[a-fA-F0-9]{40}$/.test(indicator) ||
        /^[a-fA-F0-9]{64}$/.test(indicator)) {
        return 'hash';
    }
    // Default to domain if unsure
    return 'domain';
}
async function performSingleLookup() {
    const answers = await inquirer_1.default.prompt([
        {
            type: 'input',
            name: 'indicator',
            message: 'Enter indicator to lookup:',
            validate: (input) => input.length > 0 || 'Please enter an indicator'
        }
    ]);
    try {
        const query = {
            type: detectIndicatorType(answers.indicator),
            value: answers.indicator
        };
        const spinner = (0, ora_1.default)('Looking up indicator...').start();
        const result = await api_1.apiClient.queryThreatIntel(query);
        spinner.stop();
        console.log(formatter_1.formatter.formatThreatIntel(result));
        if (result.reputation === 'malicious') {
            logger_1.logger.security('This indicator is flagged as malicious!');
        }
    }
    catch (error) {
        logger_1.logger.error(`Lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
async function performCorrelationAnalysis() {
    const answers = await inquirer_1.default.prompt([
        {
            type: 'input',
            name: 'indicators',
            message: 'Enter indicators to correlate (comma-separated):',
            validate: (input) => input.split(',').length >= 2 || 'Please enter at least 2 indicators'
        }
    ]);
    try {
        const indicators = answers.indicators.split(',').map((i) => i.trim());
        logger_1.logger.info(`Correlating ${indicators.length} indicators...`);
        const spinner = (0, ora_1.default)('Performing correlation analysis...').start();
        // Query each indicator
        const results = [];
        for (const indicator of indicators) {
            const query = {
                type: detectIndicatorType(indicator),
                value: indicator
            };
            try {
                const result = await api_1.apiClient.queryThreatIntel(query);
                results.push({ indicator, ...result });
            }
            catch (error) {
                results.push({ indicator, error: 'Query failed' });
            }
        }
        spinner.stop();
        // Analyze correlations
        const maliciousCount = results.filter(r => r.reputation === 'malicious').length;
        const suspiciousCount = results.filter(r => r.reputation === 'suspicious').length;
        logger_1.logger.success('Correlation Analysis Complete');
        logger_1.logger.info(`Malicious indicators: ${maliciousCount}/${results.length}`);
        logger_1.logger.info(`Suspicious indicators: ${suspiciousCount}/${results.length}`);
        if (maliciousCount > 0) {
            logger_1.logger.security('Multiple malicious indicators detected - possible coordinated threat!');
        }
    }
    catch (error) {
        logger_1.logger.error(`Correlation analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
async function performAttributionAnalysis() {
    logger_1.logger.info('Attribution analysis feature coming soon...');
    logger_1.logger.info('This will help identify threat actors and campaign connections');
}
async function performLandscapeAnalysis() {
    try {
        logger_1.logger.info('Generating threat landscape overview...');
        const spinner = (0, ora_1.default)('Analyzing current threat landscape...').start();
        const threats = await api_1.apiClient.getThreats({ limit: 100, since: '24h' });
        spinner.stop();
        if (threats.length === 0) {
            logger_1.logger.info('No recent threats found for landscape analysis');
            return;
        }
        // Analyze threat types
        const threatTypes = {};
        const severityCount = {};
        threats.forEach(threat => {
            threatTypes[threat.type] = (threatTypes[threat.type] || 0) + 1;
            severityCount[threat.severity] = (severityCount[threat.severity] || 0) + 1;
        });
        logger_1.logger.title('Current Threat Landscape (Last 24 Hours)');
        logger_1.logger.info(`Total Threats: ${threats.length}`);
        logger_1.logger.newLine();
        logger_1.logger.subtitle('Threat Types:');
        Object.entries(threatTypes).forEach(([type, count]) => {
            logger_1.logger.info(`${type}: ${count} (${((count / threats.length) * 100).toFixed(1)}%)`);
        });
        logger_1.logger.newLine();
        logger_1.logger.subtitle('Severity Distribution:');
        Object.entries(severityCount).forEach(([severity, count]) => {
            logger_1.logger.info(`${severity}: ${count} (${((count / threats.length) * 100).toFixed(1)}%)`);
        });
    }
    catch (error) {
        logger_1.logger.error(`Landscape analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
//# sourceMappingURL=intel.js.map