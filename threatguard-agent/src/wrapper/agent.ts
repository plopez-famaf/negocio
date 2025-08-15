/**
 * ThreatGuard Agent - Main Agent Class
 * Orchestrates zero-config discovery, configuration, and Fluent Bit management
 */

import { EventEmitter } from 'events';
import { Logger } from '../common/logger';
import { DiscoveryEngine } from './discovery/discovery-engine';
import { ConfigManager } from './config/config-manager';
import { ManagementService } from './management/management-service';
import { FluentBitManager } from '../fluent-bit/fluent-bit-manager';
import { PlatformManager } from '../platform/platform-manager';
import { HealthMonitor } from '../common/health-monitor';
import { 
    AgentConfig, 
    AgentStatus, 
    DiscoveryResult,
    AgentOptions
} from '../common/types';

export class ThreatGuardAgent extends EventEmitter {
    private logger: Logger;
    private config: AgentConfig | null = null;
    private status: AgentStatus = 'initializing';
    private startTime: Date | null = null;

    // Core components
    private discoveryEngine: DiscoveryEngine;
    private configManager: ConfigManager;
    private managementService: ManagementService;
    private fluentBitManager: FluentBitManager;
    private platformManager: PlatformManager;
    private healthMonitor: HealthMonitor;

    // Configuration
    private options: AgentOptions;

    constructor(options: AgentOptions = {}) {
        super();

        this.options = {
            debugMode: false,
            dryRun: false,
            forceDiscovery: false,
            managementPort: 8888,
            discoveryTimeout: 300000, // 5 minutes
            ...options
        };

        this.logger = new Logger('ThreatGuardAgent');
        this.logger.info('🔧 Initializing ThreatGuard Agent components...');

        // Initialize components
        this.discoveryEngine = new DiscoveryEngine(this.options);
        this.configManager = new ConfigManager(this.options);
        this.managementService = new ManagementService(this.options);
        this.fluentBitManager = new FluentBitManager(this.options);
        this.platformManager = new PlatformManager(this.options);
        this.healthMonitor = new HealthMonitor(this.options);

        // Set up event handlers
        this.setupEventHandlers();

        this.logger.info('✅ ThreatGuard Agent components initialized');
    }

    /**
     * Start the ThreatGuard Agent with zero-config discovery
     */
    public async start(): Promise<void> {
        try {
            this.logger.info('🚀 Starting ThreatGuard Agent...');
            this.startTime = new Date();
            this.status = 'starting';
            this.emit('status-change', this.status);

            // Phase 1: System Discovery
            this.logger.info('🔍 Phase 1: Starting auto-discovery...');
            this.status = 'discovering';
            this.emit('status-change', this.status);

            const discoveryResult = await this.performDiscovery();
            this.logger.info('✅ Discovery completed successfully');

            // Phase 2: Configuration Generation
            this.logger.info('⚙️ Phase 2: Generating configuration...');
            this.status = 'configuring';
            this.emit('status-change', this.status);

            this.config = await this.configManager.generateConfiguration(discoveryResult);
            this.logger.info('✅ Configuration generated successfully');

            // Phase 3: Platform Setup
            this.logger.info('🔧 Phase 3: Setting up platform integration...');
            await this.platformManager.setup(this.config);
            this.logger.info('✅ Platform setup completed');

            // Phase 4: Start Management Service
            this.logger.info('🌐 Phase 4: Starting management service...');
            await this.managementService.start(this.config, this);
            this.logger.info(`✅ Management service started on port ${this.options.managementPort}`);

            // Phase 5: Start Fluent Bit (if not dry run)
            if (!this.options.dryRun) {
                this.logger.info('📊 Phase 5: Starting data collection...');
                this.status = 'starting-collection';
                this.emit('status-change', this.status);

                await this.fluentBitManager.start(this.config);
                this.logger.info('✅ Data collection started successfully');
            } else {
                this.logger.info('🔍 Dry run mode: Skipping data collection startup');
            }

            // Phase 6: Start Health Monitoring
            this.logger.info('💓 Phase 6: Starting health monitoring...');
            await this.healthMonitor.start(this.config, this);
            this.logger.info('✅ Health monitoring started');

            // Agent ready
            this.status = 'active';
            this.emit('status-change', this.status);
            this.emit('ready', this.config);

            this.logger.info('🎉 ThreatGuard Agent started successfully!');
            this.logger.info(`📊 Organization: ${this.config.organization.name}`);
            this.logger.info(`🔧 Profile: ${this.config.profile.name}`);
            this.logger.info(`📈 Collection sources: ${this.config.collection.sources.length}`);
            this.logger.info(`🌐 Management API: http://localhost:${this.options.managementPort}`);

            if (!this.options.dryRun) {
                this.logger.info('✅ Agent is collecting and transmitting data');
            }

        } catch (error) {
            this.status = 'error';
            this.emit('status-change', this.status);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Stop the ThreatGuard Agent gracefully
     */
    public async stop(): Promise<void> {
        try {
            this.logger.info('🛑 Stopping ThreatGuard Agent...');
            this.status = 'stopping';
            this.emit('status-change', this.status);

            // Stop components in reverse order
            if (this.healthMonitor) {
                await this.healthMonitor.stop();
                this.logger.info('✅ Health monitoring stopped');
            }

            if (this.fluentBitManager) {
                await this.fluentBitManager.stop();
                this.logger.info('✅ Data collection stopped');
            }

            if (this.managementService) {
                await this.managementService.stop();
                this.logger.info('✅ Management service stopped');
            }

            if (this.platformManager) {
                await this.platformManager.cleanup();
                this.logger.info('✅ Platform cleanup completed');
            }

            this.status = 'stopped';
            this.emit('status-change', this.status);
            this.emit('stopped');

            this.logger.info('✅ ThreatGuard Agent stopped successfully');

        } catch (error) {
            this.logger.error('❌ Error stopping ThreatGuard Agent:', error);
            this.status = 'error';
            this.emit('status-change', this.status);
            throw error;
        }
    }

    /**
     * Reload configuration (triggered by SIGHUP or management API)
     */
    public async reloadConfiguration(): Promise<void> {
        try {
            this.logger.info('🔄 Reloading configuration...');
            
            const previousStatus = this.status;
            this.status = 'reloading';
            this.emit('status-change', this.status);

            // Re-run discovery and configuration
            const discoveryResult = await this.performDiscovery();
            const newConfig = await this.configManager.generateConfiguration(discoveryResult);

            // Update Fluent Bit configuration
            if (!this.options.dryRun) {
                await this.fluentBitManager.reload(newConfig);
            }

            this.config = newConfig;
            this.status = previousStatus;
            this.emit('status-change', this.status);
            this.emit('config-reloaded', this.config);

            this.logger.info('✅ Configuration reloaded successfully');

        } catch (error) {
            this.logger.error('❌ Error reloading configuration:', error);
            this.status = 'error';
            this.emit('status-change', this.status);
            throw error;
        }
    }

    /**
     * Get current agent status
     */
    public getStatus(): {
        status: AgentStatus;
        uptime: number | null;
        config: AgentConfig | null;
        version: string;
    } {
        const uptime = this.startTime 
            ? Date.now() - this.startTime.getTime() 
            : null;

        return {
            status: this.status,
            uptime,
            config: this.config,
            version: '2.0.1'
        };
    }

    /**
     * Get health information
     */
    public async getHealth(): Promise<any> {
        return this.healthMonitor.getHealthInfo();
    }

    /**
     * Get metrics
     */
    public async getMetrics(): Promise<any> {
        return this.healthMonitor.getMetrics();
    }

    /**
     * Perform system discovery
     */
    private async performDiscovery(): Promise<DiscoveryResult> {
        const timeout = this.options.discoveryTimeout || 300000;
        
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Discovery timeout after ${timeout}ms`));
            }, timeout);

            this.discoveryEngine.discover()
                .then(result => {
                    clearTimeout(timer);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timer);
                    reject(error);
                });
        });
    }

    /**
     * Setup event handlers for components
     */
    private setupEventHandlers(): void {
        // Discovery engine events
        this.discoveryEngine.on('discovery-progress', (progress) => {
            this.emit('discovery-progress', progress);
        });

        this.discoveryEngine.on('organization-detected', (org) => {
            this.logger.info(`🏢 Organization detected: ${org.name}`);
            this.emit('organization-detected', org);
        });

        // Fluent Bit events
        this.fluentBitManager.on('collection-started', () => {
            this.logger.info('📊 Data collection started');
            this.emit('collection-started');
        });

        this.fluentBitManager.on('collection-error', (error) => {
            this.logger.error('❌ Collection error:', error);
            this.emit('collection-error', error);
        });

        // Health monitor events
        this.healthMonitor.on('health-change', (health) => {
            this.emit('health-change', health);
        });

        this.healthMonitor.on('performance-alert', (alert) => {
            this.logger.warn('⚠️ Performance alert:', alert);
            this.emit('performance-alert', alert);
        });

        // Management service events
        this.managementService.on('remote-command', (command) => {
            this.logger.info('📡 Remote command received:', command.type);
            this.emit('remote-command', command);
        });
    }
}