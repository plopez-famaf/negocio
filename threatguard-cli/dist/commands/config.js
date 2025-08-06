"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupConfigCommands = setupConfigCommands;
const inquirer_1 = __importDefault(require("inquirer"));
const config_1 = require("@/utils/config");
const logger_1 = require("@/utils/logger");
function setupConfigCommands(program) {
    const configCommand = program
        .command('config')
        .description('Configuration management commands');
    // Set configuration value
    configCommand
        .command('set <key> <value>')
        .description('Set a configuration value')
        .action((key, value) => {
        try {
            // Parse value based on key type
            let parsedValue = value;
            if (key.includes('.')) {
                // Handle nested configuration keys
                const [section, subKey] = key.split('.');
                const currentSection = config_1.configManager.get(section) || {};
                // Parse boolean values
                if (value === 'true')
                    parsedValue = true;
                else if (value === 'false')
                    parsedValue = false;
                // Parse numbers
                else if (!isNaN(Number(value)))
                    parsedValue = Number(value);
                currentSection[subKey] = parsedValue;
                config_1.configManager.set(section, currentSection);
            }
            else {
                // Parse boolean values
                if (value === 'true')
                    parsedValue = true;
                else if (value === 'false')
                    parsedValue = false;
                // Parse numbers
                else if (!isNaN(Number(value)))
                    parsedValue = Number(value);
                config_1.configManager.set(key, parsedValue);
            }
            logger_1.logger.success(`Configuration updated: ${key} = ${parsedValue}`);
        }
        catch (error) {
            logger_1.logger.error(`Failed to set configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });
    // Get configuration value
    configCommand
        .command('get [key]')
        .description('Get configuration value(s)')
        .option('--format <format>', 'Output format (json, table)', 'table')
        .action((key, options) => {
        try {
            if (key) {
                const value = key.includes('.') ?
                    getNestedConfig(key) :
                    config_1.configManager.get(key);
                if (value === undefined) {
                    logger_1.logger.warning(`Configuration key '${key}' not found`);
                }
                else {
                    if (options.format === 'json') {
                        console.log(JSON.stringify({ [key]: value }, null, 2));
                    }
                    else {
                        logger_1.logger.info(`${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
                    }
                }
            }
            else {
                // Show all configuration
                const allConfig = config_1.configManager.get();
                if (options.format === 'json') {
                    console.log(JSON.stringify(allConfig, null, 2));
                }
                else {
                    logger_1.logger.title('Current Configuration:');
                    displayConfigRecursive(allConfig);
                }
            }
        }
        catch (error) {
            logger_1.logger.error(`Failed to get configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });
    // Delete configuration value
    configCommand
        .command('delete <key>')
        .alias('del')
        .description('Delete a configuration value')
        .option('-f, --force', 'Force deletion without confirmation')
        .action(async (key, options) => {
        try {
            const currentValue = key.includes('.') ?
                getNestedConfig(key) :
                config_1.configManager.get(key);
            if (currentValue === undefined) {
                logger_1.logger.warning(`Configuration key '${key}' not found`);
                return;
            }
            // Confirmation unless forced
            if (!options.force) {
                const answer = await inquirer_1.default.prompt([
                    {
                        type: 'confirm',
                        name: 'confirm',
                        message: `Delete configuration '${key}'?`,
                        default: false
                    }
                ]);
                if (!answer.confirm) {
                    logger_1.logger.info('Deletion cancelled');
                    return;
                }
            }
            if (key.includes('.')) {
                // Handle nested configuration keys
                const [section, subKey] = key.split('.');
                const currentSection = config_1.configManager.get(section) || {};
                delete currentSection[subKey];
                config_1.configManager.set(section, currentSection);
            }
            else {
                config_1.configManager.delete(key);
            }
            logger_1.logger.success(`Configuration deleted: ${key}`);
        }
        catch (error) {
            logger_1.logger.error(`Failed to delete configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });
    // Reset configuration
    configCommand
        .command('reset')
        .description('Reset configuration to defaults')
        .option('-f, --force', 'Force reset without confirmation')
        .action(async (options) => {
        try {
            if (!options.force) {
                const answer = await inquirer_1.default.prompt([
                    {
                        type: 'confirm',
                        name: 'confirm',
                        message: 'Reset all configuration to defaults? This will remove your API token.',
                        default: false
                    }
                ]);
                if (!answer.confirm) {
                    logger_1.logger.info('Reset cancelled');
                    return;
                }
            }
            config_1.configManager.clear();
            logger_1.logger.success('Configuration reset to defaults');
            logger_1.logger.warning('You will need to login again: threatguard auth login');
        }
        catch (error) {
            logger_1.logger.error(`Failed to reset configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });
    // Interactive configuration setup
    configCommand
        .command('setup')
        .description('Interactive configuration setup')
        .action(async () => {
        logger_1.logger.title('ThreatGuard CLI Configuration Setup');
        const answers = await inquirer_1.default.prompt([
            {
                type: 'input',
                name: 'apiUrl',
                message: 'API URL:',
                default: config_1.configManager.getApiUrl(),
                validate: (input) => {
                    const urlRegex = /^https?:\/\/.+/;
                    return urlRegex.test(input) || 'Please enter a valid URL';
                }
            },
            {
                type: 'list',
                name: 'theme',
                message: 'Terminal theme:',
                choices: [
                    { name: 'Dark theme (recommended)', value: 'dark' },
                    { name: 'Light theme', value: 'light' }
                ],
                default: config_1.configManager.getPreferences().theme
            },
            {
                type: 'list',
                name: 'outputFormat',
                message: 'Default output format:',
                choices: [
                    { name: 'Table format (recommended)', value: 'table' },
                    { name: 'JSON format', value: 'json' },
                    { name: 'Plain text', value: 'text' }
                ],
                default: config_1.configManager.getPreferences().outputFormat
            },
            {
                type: 'confirm',
                name: 'realTimeUpdates',
                message: 'Enable real-time updates?',
                default: config_1.configManager.getPreferences().realTimeUpdates
            },
            {
                type: 'confirm',
                name: 'notifications',
                message: 'Enable notifications?',
                default: config_1.configManager.getPreferences().notifications
            },
            {
                type: 'number',
                name: 'defaultLimit',
                message: 'Default result limit:',
                default: 20,
                validate: (input) => input > 0 || 'Please enter a positive number'
            }
        ]);
        // Apply configuration
        config_1.configManager.set('apiUrl', answers.apiUrl);
        config_1.configManager.setPreference('theme', answers.theme);
        config_1.configManager.setPreference('outputFormat', answers.outputFormat);
        config_1.configManager.setPreference('realTimeUpdates', answers.realTimeUpdates);
        config_1.configManager.setPreference('notifications', answers.notifications);
        // Set default limit in preferences (custom setting)
        const preferences = config_1.configManager.getPreferences();
        preferences.defaultLimit = answers.defaultLimit;
        config_1.configManager.set('preferences', preferences);
        logger_1.logger.success('Configuration updated successfully!');
        // Check if user is authenticated
        if (!config_1.configManager.isAuthenticated()) {
            logger_1.logger.info('To get started, please login: threatguard auth login');
        }
    });
    // Show configuration file path
    configCommand
        .command('path')
        .description('Show configuration file path')
        .action(() => {
        // This would show the actual config file path
        const configPath = process.env.HOME + '/.config/threatguard-cli/config.json';
        logger_1.logger.info(`Configuration file: ${configPath}`);
        // Check if file exists
        const fs = require('fs');
        if (fs.existsSync(configPath)) {
            const stats = fs.statSync(configPath);
            logger_1.logger.info(`Last modified: ${stats.mtime.toLocaleString()}`);
            logger_1.logger.info(`File size: ${stats.size} bytes`);
        }
        else {
            logger_1.logger.warning('Configuration file does not exist yet');
        }
    });
    // Validate configuration
    configCommand
        .command('validate')
        .description('Validate current configuration')
        .action(async () => {
        logger_1.logger.title('Configuration Validation');
        const config = config_1.configManager.get();
        const issues = [];
        const warnings = [];
        // Check API URL
        if (!config.apiUrl) {
            issues.push('API URL is not configured');
        }
        else {
            try {
                new URL(config.apiUrl);
                logger_1.logger.success('✓ API URL format is valid');
            }
            catch {
                issues.push('API URL format is invalid');
            }
        }
        // Check authentication
        if (!config_1.configManager.isAuthenticated()) {
            warnings.push('Not authenticated - run: threatguard auth login');
        }
        else {
            logger_1.logger.success('✓ Authentication token is present');
        }
        // Check preferences
        const prefs = config.preferences || {};
        if (!['dark', 'light'].includes(prefs.theme)) {
            warnings.push('Invalid theme preference');
        }
        else {
            logger_1.logger.success('✓ Theme preference is valid');
        }
        if (!['table', 'json', 'text'].includes(prefs.outputFormat)) {
            warnings.push('Invalid output format preference');
        }
        else {
            logger_1.logger.success('✓ Output format preference is valid');
        }
        // Report results
        if (issues.length === 0 && warnings.length === 0) {
            logger_1.logger.success('Configuration is valid!');
        }
        else {
            if (issues.length > 0) {
                logger_1.logger.newLine();
                logger_1.logger.error('Issues found:');
                issues.forEach(issue => logger_1.logger.error(`  • ${issue}`));
            }
            if (warnings.length > 0) {
                logger_1.logger.newLine();
                logger_1.logger.warning('Warnings:');
                warnings.forEach(warning => logger_1.logger.warning(`  • ${warning}`));
            }
            logger_1.logger.newLine();
            logger_1.logger.info('Run: threatguard config setup - to fix configuration issues');
        }
    });
}
// Helper functions
function getNestedConfig(key) {
    const [section, subKey] = key.split('.');
    const sectionData = config_1.configManager.get(section);
    return sectionData ? sectionData[subKey] : undefined;
}
function displayConfigRecursive(obj, prefix = '') {
    Object.entries(obj).forEach(([key, value]) => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            logger_1.logger.subtitle(`${fullKey}:`);
            displayConfigRecursive(value, fullKey);
        }
        else {
            const displayValue = typeof value === 'string' && key.toLowerCase().includes('token')
                ? '***hidden***'
                : JSON.stringify(value);
            logger_1.logger.info(`  ${fullKey}: ${displayValue}`);
        }
    });
}
//# sourceMappingURL=config.js.map