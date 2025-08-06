"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupAuthCommands = setupAuthCommands;
const inquirer_1 = __importDefault(require("inquirer"));
const api_1 = require("@/services/api");
const config_1 = require("@/utils/config");
const logger_1 = require("@/utils/logger");
function setupAuthCommands(program) {
    const authCommand = program
        .command('auth')
        .description('Authentication commands');
    // Login command
    authCommand
        .command('login')
        .description('Login to ThreatGuard platform')
        .option('-e, --email <email>', 'Email address')
        .option('-p, --password <password>', 'Password')
        .action(async (options) => {
        try {
            let { email, password } = options;
            // If credentials not provided via options, prompt for them
            if (!email || !password) {
                const answers = await inquirer_1.default.prompt([
                    {
                        type: 'input',
                        name: 'email',
                        message: 'Email:',
                        when: () => !email,
                        validate: (input) => {
                            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                            return emailRegex.test(input) || 'Please enter a valid email address';
                        }
                    },
                    {
                        type: 'password',
                        name: 'password',
                        message: 'Password:',
                        when: () => !password,
                        mask: '*'
                    }
                ]);
                email = email || answers.email;
                password = password || answers.password;
            }
            logger_1.logger.info('Authenticating...');
            const tokenData = await api_1.apiClient.login({ email, password });
            logger_1.logger.success(`Logged in successfully as ${email}`);
            logger_1.logger.info(`Token expires: ${new Date(tokenData.expiresAt).toLocaleString()}`);
            // Display permissions if available
            if (tokenData.permissions.length > 0) {
                logger_1.logger.info(`Permissions: ${tokenData.permissions.join(', ')}`);
            }
        }
        catch (error) {
            logger_1.logger.error(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            process.exit(1);
        }
    });
    // Logout command
    authCommand
        .command('logout')
        .description('Logout from ThreatGuard platform')
        .action(async () => {
        try {
            if (!config_1.configManager.isAuthenticated()) {
                logger_1.logger.warning('You are not currently logged in');
                return;
            }
            await api_1.apiClient.logout();
            logger_1.logger.success('Logged out successfully');
        }
        catch (error) {
            logger_1.logger.error(`Logout failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });
    // Status command
    authCommand
        .command('status')
        .description('Show authentication status')
        .action(async () => {
        if (!config_1.configManager.isAuthenticated()) {
            logger_1.logger.warning('Not authenticated');
            logger_1.logger.info('Run: threatguard auth login');
            return;
        }
        const userId = config_1.configManager.getUserId();
        const apiUrl = config_1.configManager.getApiUrl();
        logger_1.logger.info(`Authenticated as: ${userId}`);
        logger_1.logger.info(`API URL: ${apiUrl}`);
        // Validate token
        try {
            const isValid = await api_1.apiClient.validateToken();
            if (isValid) {
                logger_1.logger.success('Token is valid');
            }
            else {
                logger_1.logger.warning('Token is invalid or expired. Please login again.');
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to validate token');
        }
    });
    // Whoami command
    authCommand
        .command('whoami')
        .description('Display current user information')
        .action(async () => {
        if (!config_1.configManager.isAuthenticated()) {
            logger_1.logger.warning('Not authenticated');
            return;
        }
        try {
            const health = await api_1.apiClient.getSystemHealth();
            logger_1.logger.info(`User ID: ${config_1.configManager.getUserId()}`);
            logger_1.logger.info(`API URL: ${config_1.configManager.getApiUrl()}`);
            if (health.user) {
                logger_1.logger.info(`Role: ${health.user.role || 'user'}`);
                logger_1.logger.info(`Plan: ${health.user.plan || 'free'}`);
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to get user information');
        }
    });
}
//# sourceMappingURL=auth.js.map