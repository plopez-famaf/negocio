/**
 * ThreatGuard Agent - Fluent Bit Manager
 * Manages Fluent Bit lifecycle and configuration
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { Logger } from '../common/logger';
import { 
    AgentConfig,
    AgentOptions,
    FluentBitConfig,
    FluentBitServiceConfig,
    FluentBitInputConfig,
    FluentBitFilterConfig,
    FluentBitOutputConfig,
    FluentBitParserConfig
} from '../common/types';

export class FluentBitManager extends EventEmitter {
    private logger: Logger;
    private options: AgentOptions;
    private fluentBitProcess: ChildProcess | null = null;
    private configPath: string;
    private isRunning: boolean = false;
    private startTime: Date | null = null;

    constructor(options: AgentOptions) {
        super();
        this.options = options;
        this.logger = new Logger('FluentBitManager');
        this.configPath = join(process.cwd(), 'fluent-bit.conf');
    }

    /**
     * Start Fluent Bit with generated configuration
     */
    public async start(config: AgentConfig): Promise<void> {
        try {
            if (this.isRunning) {
                this.logger.warn('⚠️ Fluent Bit is already running');
                return;
            }

            this.logger.info('🚀 Starting Fluent Bit...');

            // Generate Fluent Bit configuration
            const fluentBitConfig = this.generateFluentBitConfig(config);
            await this.writeConfiguration(fluentBitConfig);

            // Start Fluent Bit process
            await this.startFluentBitProcess();

            this.isRunning = true;
            this.startTime = new Date();
            this.emit('collection-started');

            this.logger.info('✅ Fluent Bit started successfully');

        } catch (error) {
            this.logger.error('❌ Failed to start Fluent Bit:', error);
            this.emit('collection-error', error);
            throw error;
        }
    }

    /**
     * Stop Fluent Bit gracefully
     */
    public async stop(): Promise<void> {
        try {
            if (!this.isRunning || !this.fluentBitProcess) {
                this.logger.warn('⚠️ Fluent Bit is not running');
                return;
            }

            this.logger.info('🛑 Stopping Fluent Bit...');

            // Send SIGTERM for graceful shutdown
            this.fluentBitProcess.kill('SIGTERM');

            // Wait for process to exit
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    this.logger.warn('⚠️ Fluent Bit did not stop gracefully, forcing termination');
                    this.fluentBitProcess?.kill('SIGKILL');
                    reject(new Error('Fluent Bit shutdown timeout'));
                }, 10000); // 10 second timeout

                this.fluentBitProcess?.on('exit', () => {
                    clearTimeout(timeout);
                    resolve();
                });
            });

            this.isRunning = false;
            this.fluentBitProcess = null;
            this.startTime = null;
            this.emit('collection-stopped');

            this.logger.info('✅ Fluent Bit stopped successfully');

        } catch (error) {
            this.logger.error('❌ Failed to stop Fluent Bit:', error);
            throw error;
        }
    }

    /**
     * Reload Fluent Bit configuration
     */
    public async reload(config: AgentConfig): Promise<void> {
        try {
            this.logger.info('🔄 Reloading Fluent Bit configuration...');

            // Generate new configuration
            const fluentBitConfig = this.generateFluentBitConfig(config);
            await this.writeConfiguration(fluentBitConfig);

            if (this.isRunning && this.fluentBitProcess) {
                // Send SIGHUP to reload configuration
                this.fluentBitProcess.kill('SIGHUP');
                this.logger.info('✅ Fluent Bit configuration reloaded');
            } else {
                this.logger.info('✅ Configuration updated (will apply on next start)');
            }

            this.emit('config-reloaded');

        } catch (error) {
            this.logger.error('❌ Failed to reload Fluent Bit configuration:', error);
            throw error;
        }
    }

    /**
     * Get Fluent Bit status and metrics
     */
    public async getStatus(): Promise<any> {
        if (!this.isRunning || !this.fluentBitProcess) {
            return {
                status: 'stopped',
                uptime: 0
            };
        }

        const uptime = this.startTime 
            ? Date.now() - this.startTime.getTime()
            : 0;

        try {
            // Try to get metrics from Fluent Bit HTTP server
            const metrics = await this.getFluentBitMetrics();
            
            return {
                status: 'running',
                pid: this.fluentBitProcess.pid,
                uptime,
                metrics
            };

        } catch (error) {
            return {
                status: 'running',
                pid: this.fluentBitProcess.pid,
                uptime,
                metricsError: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Generate Fluent Bit configuration from agent config
     */
    private generateFluentBitConfig(config: AgentConfig): FluentBitConfig {
        this.logger.debug('⚙️ Generating Fluent Bit configuration...');

        // Service configuration
        const service: FluentBitServiceConfig = {
            flush: config.transmission.flushInterval,
            daemon: false, // Run in foreground for better process management
            logLevel: this.options.debugMode ? 'debug' : 'info',
            httpServer: true,
            httpListen: '127.0.0.1',
            httpPort: 2020,
            storageMetrics: true
        };

        // Input configurations
        const inputs = this.generateInputConfigs(config);

        // Filter configurations
        const filters = this.generateFilterConfigs(config);

        // Output configurations
        const outputs = this.generateOutputConfigs(config);

        // Parser configurations
        const parsers = this.generateParserConfigs(config);

        const fluentBitConfig: FluentBitConfig = {
            service,
            inputs,
            filters,
            outputs,
            parsers
        };

        this.logger.debug(`✅ Generated config with ${inputs.length} inputs, ${filters.length} filters, ${outputs.length} outputs`);
        return fluentBitConfig;
    }

    /**
     * Generate input configurations
     */
    private generateInputConfigs(config: AgentConfig): FluentBitInputConfig[] {
        const inputs: FluentBitInputConfig[] = [];

        for (const source of config.collection.sources) {
            switch (source.type) {
                case 'eventlog':
                    if (config.system.platform === 'windows') {
                        inputs.push({
                            name: 'winlog',
                            tag: `winlog.${source.id}`,
                            properties: {
                                channels: source.path,
                                interval_sec: config.collection.intervals.polling,
                                db: `winlog_${source.id}.db`
                            }
                        });
                    }
                    break;

                case 'file':
                    inputs.push({
                        name: 'tail',
                        tag: `file.${source.id}`,
                        properties: {
                            path: source.path,
                            parser: source.parser || 'default',
                            key: 'message',
                            refresh_interval: config.collection.intervals.polling,
                            rotate_wait: 5,
                            db: `tail_${source.id}.db`
                        }
                    });
                    break;

                case 'syslog':
                    if (config.system.platform === 'linux' || config.system.platform === 'darwin') {
                        inputs.push({
                            name: 'systemd',
                            tag: `systemd.${source.id}`,
                            properties: {
                                systemd_filter: '_SYSTEMD_UNIT=' + source.name,
                                strip_underscores: 'on',
                                db: `systemd_${source.id}.db`
                            }
                        });
                    }
                    break;

                case 'api':
                    inputs.push({
                        name: 'http',
                        tag: `api.${source.id}`,
                        properties: {
                            listen: '127.0.0.1',
                            port: '9880',
                            format: 'json'
                        }
                    });
                    break;
            }
        }

        return inputs;
    }

    /**
     * Generate filter configurations
     */
    private generateFilterConfigs(config: AgentConfig): FluentBitFilterConfig[] {
        const filters: FluentBitFilterConfig[] = [];

        // Add timestamp normalization
        filters.push({
            name: 'modify',
            match: '*',
            properties: {
                add: 'agent_id ' + config.agentId,
                add: 'hostname ' + config.system.hostname,
                add: 'organization ' + config.organization.name
            }
        });

        // Add security-specific filters
        for (const filterConfig of config.collection.filters) {
            if (filterConfig.enabled) {
                switch (filterConfig.type) {
                    case 'grep':
                        filters.push({
                            name: 'grep',
                            match: '*',
                            properties: {
                                regex: filterConfig.rules[0]?.condition || '.*'
                            }
                        });
                        break;

                    case 'modify':
                        filters.push({
                            name: 'modify',
                            match: '*',
                            properties: filterConfig.rules[0]?.parameters || {}
                        });
                        break;
                }
            }
        }

        return filters;
    }

    /**
     * Generate output configurations
     */
    private generateOutputConfigs(config: AgentConfig): FluentBitOutputConfig[] {
        const outputs: FluentBitOutputConfig[] = [];

        for (const endpoint of config.transmission.endpoints) {
            if (endpoint.active) {
                outputs.push({
                    name: 'http',
                    match: '*',
                    properties: {
                        host: new URL(endpoint.url).hostname,
                        port: new URL(endpoint.url).port || '443',
                        uri: new URL(endpoint.url).pathname,
                        format: 'json',
                        json_date_key: '@timestamp',
                        json_date_format: 'iso8601',
                        tls: config.transmission.tls.enabled ? 'on' : 'off',
                        tls_verify: config.transmission.tls.verifyPeer ? 'on' : 'off',
                        header_authorization: `Bearer ${endpoint.authCredentials?.token || 'auto-generated'}`,
                        compress: config.transmission.compression !== 'none' ? 'gzip' : 'off',
                        workers: 1
                    }
                });
            }
        }

        return outputs;
    }

    /**
     * Generate parser configurations
     */
    private generateParserConfigs(config: AgentConfig): FluentBitParserConfig[] {
        const parsers: FluentBitParserConfig[] = [];

        // Default parsers
        parsers.push({
            name: 'default',
            format: 'regex',
            regex: '^(?<timestamp>\\S+)\\s+(?<message>.*)$',
            timeKey: 'timestamp',
            timeFormat: '%Y-%m-%dT%H:%M:%S.%L%z',
            properties: {}
        });

        // Add custom parsers from config
        for (const parserConfig of config.collection.parsers) {
            parsers.push({
                name: parserConfig.name,
                format: parserConfig.format,
                regex: parserConfig.regex,
                timeKey: parserConfig.timeKey,
                timeFormat: parserConfig.timeFormat,
                timeKeepOriginal: parserConfig.timeKeepOriginal,
                properties: {}
            });
        }

        return parsers;
    }

    /**
     * Write Fluent Bit configuration to file
     */
    private async writeConfiguration(config: FluentBitConfig): Promise<void> {
        try {
            const configContent = this.generateConfigFile(config);
            await fs.writeFile(this.configPath, configContent, 'utf8');
            this.logger.debug(`✅ Configuration written to ${this.configPath}`);
        } catch (error) {
            this.logger.error('❌ Failed to write configuration:', error);
            throw error;
        }
    }

    /**
     * Generate Fluent Bit configuration file content
     */
    private generateConfigFile(config: FluentBitConfig): string {
        let content = '';

        // Service section
        content += '[SERVICE]\n';
        content += `    flush        ${config.service.flush}\n`;
        content += `    daemon       ${config.service.daemon ? 'on' : 'off'}\n`;
        content += `    log_level    ${config.service.logLevel}\n`;
        content += `    http_server  ${config.service.httpServer ? 'on' : 'off'}\n`;
        content += `    http_listen  ${config.service.httpListen}\n`;
        content += `    http_port    ${config.service.httpPort}\n`;
        content += `    storage.metrics ${config.service.storageMetrics ? 'on' : 'off'}\n`;
        content += '\n';

        // Input sections
        for (const input of config.inputs) {
            content += `[INPUT]\n`;
            content += `    name  ${input.name}\n`;
            if (input.tag) content += `    tag   ${input.tag}\n`;
            for (const [key, value] of Object.entries(input.properties)) {
                content += `    ${key}    ${value}\n`;
            }
            content += '\n';
        }

        // Filter sections
        for (const filter of config.filters) {
            content += `[FILTER]\n`;
            content += `    name   ${filter.name}\n`;
            content += `    match  ${filter.match}\n`;
            for (const [key, value] of Object.entries(filter.properties)) {
                content += `    ${key}    ${value}\n`;
            }
            content += '\n';
        }

        // Output sections
        for (const output of config.outputs) {
            content += `[OUTPUT]\n`;
            content += `    name   ${output.name}\n`;
            content += `    match  ${output.match}\n`;
            for (const [key, value] of Object.entries(output.properties)) {
                content += `    ${key}    ${value}\n`;
            }
            content += '\n';
        }

        return content;
    }

    /**
     * Start Fluent Bit process
     */
    private async startFluentBitProcess(): Promise<void> {
        return new Promise((resolve, reject) => {
            const fluentBitPath = this.getFluentBitPath();
            const args = ['-c', this.configPath];

            this.fluentBitProcess = spawn(fluentBitPath, args, {
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: false
            });

            // Handle process events
            this.fluentBitProcess.on('error', (error) => {
                this.logger.error('❌ Fluent Bit process error:', error);
                this.emit('collection-error', error);
                reject(error);
            });

            this.fluentBitProcess.on('exit', (code, signal) => {
                this.logger.info(`📊 Fluent Bit exited with code ${code}, signal ${signal}`);
                this.isRunning = false;
                this.emit('collection-stopped', { code, signal });
            });

            // Handle stdout/stderr
            this.fluentBitProcess.stdout?.on('data', (data) => {
                const message = data.toString().trim();
                if (message) {
                    this.logger.debug(`[FB-OUT] ${message}`);
                }
            });

            this.fluentBitProcess.stderr?.on('data', (data) => {
                const message = data.toString().trim();
                if (message) {
                    this.logger.debug(`[FB-ERR] ${message}`);
                }
            });

            // Wait a moment to ensure process started successfully
            setTimeout(() => {
                if (this.fluentBitProcess && this.fluentBitProcess.pid) {
                    resolve();
                } else {
                    reject(new Error('Fluent Bit failed to start'));
                }
            }, 2000);
        });
    }

    /**
     * Get Fluent Bit executable path
     */
    private getFluentBitPath(): string {
        // In a real implementation, this would find the Fluent Bit binary
        // For now, assume it's in PATH or bundled with the agent
        switch (process.platform) {
            case 'win32':
                return 'fluent-bit.exe';
            default:
                return 'fluent-bit';
        }
    }

    /**
     * Get metrics from Fluent Bit HTTP server
     */
    private async getFluentBitMetrics(): Promise<any> {
        try {
            // This would fetch metrics from Fluent Bit's HTTP server
            // For now, return mock metrics
            return {
                input_records: 1000,
                input_bytes: 500000,
                output_records: 950,
                output_bytes: 450000,
                filter_records: 50
            };
        } catch (error) {
            throw new Error('Failed to fetch Fluent Bit metrics');
        }
    }
}