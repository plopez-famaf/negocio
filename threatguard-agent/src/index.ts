#!/usr/bin/env node

/**
 * ThreatGuard Agent - Zero-Config Endpoint Collector
 * Entry point for the ThreatGuard Agent application
 */

import { program } from 'commander';
import { ThreatGuardAgent } from './wrapper/agent';
import { Logger } from './common/logger';
import { ConfigManager } from './wrapper/config/config-manager';
import { DiscoveryEngine } from './wrapper/discovery/discovery-engine';
import { ManagementService } from './wrapper/management/management-service';
import { platform } from 'os';

const logger = new Logger('ThreatGuardAgent');

async function main(): Promise<void> {
    try {
        logger.info('🚀 Starting ThreatGuard Agent v2.0.1');
        logger.info(`⚡ Platform: ${platform()}`);
        logger.info('🔍 Zero-config mode: Automatic discovery and configuration');

        // Initialize program
        program
            .name('threatguard-agent')
            .description('Zero-configuration endpoint security collector')
            .version('2.0.1')
            .option('-d, --debug', 'Enable debug logging')
            .option('-c, --config <path>', 'Custom configuration file (overrides auto-config)')
            .option('--dry-run', 'Perform discovery without starting collection')
            .option('--force-discovery', 'Force re-discovery even if config exists')
            .option('--management-port <port>', 'Local management API port', '8888')
            .option('--discovery-timeout <seconds>', 'Discovery timeout in seconds', '300');

        program.parse();
        const options = program.opts();

        // Configure logging
        if (options.debug) {
            Logger.setLevel('debug');
            logger.debug('🐛 Debug logging enabled');
        }

        // Initialize agent
        const agent = new ThreatGuardAgent({
            debugMode: options.debug || false,
            customConfigPath: options.config,
            dryRun: options.dryRun || false,
            forceDiscovery: options.forceDiscovery || false,
            managementPort: parseInt(options.managementPort),
            discoveryTimeout: parseInt(options.discoveryTimeout) * 1000
        });

        // Start agent
        await agent.start();

        // Handle graceful shutdown
        const shutdown = async (signal: string) => {
            logger.info(`📡 Received ${signal}, initiating graceful shutdown...`);
            try {
                await agent.stop();
                logger.info('✅ ThreatGuard Agent stopped successfully');
                process.exit(0);
            } catch (error) {
                logger.error('❌ Error during shutdown:', error);
                process.exit(1);
            }
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGHUP', () => {
            logger.info('📡 Received SIGHUP, reloading configuration...');
            agent.reloadConfiguration().catch(error => {
                logger.error('❌ Error reloading configuration:', error);
            });
        });

    } catch (error) {
        logger.error('❌ Fatal error starting ThreatGuard Agent:', error);
        process.exit(1);
    }
}

// Handle unhandled rejections and exceptions
process.on('unhandledRejection', (reason, promise) => {
    logger.error('🚨 Unhandled Promise Rejection:', { reason, promise });
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    logger.error('🚨 Uncaught Exception:', error);
    process.exit(1);
});

// Start the application
if (require.main === module) {
    main().catch((error) => {
        logger.error('❌ Application startup failed:', error);
        process.exit(1);
    });
}

export { main };