#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const figlet_1 = __importDefault(require("figlet"));
const chalk_1 = __importDefault(require("chalk"));
const logger_1 = require("@/utils/logger");
const config_1 = require("@/utils/config");
const auth_1 = require("@/commands/auth");
const threat_1 = require("@/commands/threat");
const behavior_1 = require("@/commands/behavior");
const network_1 = require("@/commands/network");
const intel_1 = require("@/commands/intel");
const config_2 = require("@/commands/config");
const interactive_1 = require("@/ui/interactive");
async function main() {
    const program = new commander_1.Command();
    // Display banner
    console.log(chalk_1.default.cyan(figlet_1.default.textSync('ThreatGuard', { horizontalLayout: 'full' })));
    console.log(chalk_1.default.gray('Real-time Threat Detection & Behavioral Analysis Platform\n'));
    // Configure main program
    program
        .name('threatguard')
        .description('Console-based threat detection and behavioral analysis platform')
        .version('1.0.0')
        .option('-v, --verbose', 'Enable verbose logging')
        .option('--api-url <url>', 'API base URL')
        .hook('preAction', (thisCommand) => {
        const options = thisCommand.opts();
        if (options.verbose) {
            process.env.DEBUG = 'true';
        }
        if (options.apiUrl) {
            config_1.configManager.set('apiUrl', options.apiUrl);
        }
    });
    // Setup command groups
    (0, auth_1.setupAuthCommands)(program);
    (0, threat_1.setupThreatCommands)(program);
    (0, behavior_1.setupBehaviorCommands)(program);
    (0, network_1.setupNetworkCommands)(program);
    (0, intel_1.setupIntelCommands)(program);
    (0, config_2.setupConfigCommands)(program);
    // Interactive mode (no subcommand)
    program
        .action(async () => {
        // Check authentication
        if (!config_1.configManager.isAuthenticated()) {
            logger_1.logger.warning('You are not authenticated. Please run: threatguard auth login');
            process.exit(1);
        }
        // Start interactive mode
        await (0, interactive_1.startInteractiveMode)();
    });
    // Parse arguments
    try {
        await program.parseAsync();
    }
    catch (error) {
        if (error instanceof Error) {
            logger_1.logger.error(`Command failed: ${error.message}`);
        }
        else {
            logger_1.logger.error('An unexpected error occurred');
        }
        process.exit(1);
    }
}
// Handle uncaught errors
process.on('uncaughtException', (error) => {
    logger_1.logger.error(`Uncaught exception: ${error.message}`);
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    logger_1.logger.error(`Unhandled rejection: ${reason}`);
    process.exit(1);
});
// Handle graceful shutdown
process.on('SIGINT', () => {
    logger_1.logger.info('Shutting down gracefully...');
    process.exit(0);
});
process.on('SIGTERM', () => {
    logger_1.logger.info('Shutting down gracefully...');
    process.exit(0);
});
// Run the CLI
if (require.main === module) {
    main();
}
//# sourceMappingURL=index.js.map