/**
 * ThreatGuard Agent - Configuration Manager
 * Zero-config intelligent configuration generation
 */

import { Logger } from '../../common/logger';
import { 
    AgentConfig,
    DiscoveryResult,
    SecurityProfile,
    CollectionConfig,
    TransmissionConfig,
    ManagementConfig,
    SecurityConfig,
    PerformanceConfig,
    FilterConfig,
    ParserConfig,
    LogSource,
    ComplianceFramework,
    AgentOptions
} from '../../common/types';
import { machineId } from 'node-machine-id';
import { hostname } from 'os';

export class ConfigManager {
    private logger: Logger;
    private options: AgentOptions;

    constructor(options: AgentOptions) {
        this.options = options;
        this.logger = new Logger('ConfigManager');
    }

    /**
     * Generate complete agent configuration from discovery results
     */
    public async generateConfiguration(discoveryResult: DiscoveryResult): Promise<AgentConfig> {
        try {
            this.logger.info('⚙️ Generating zero-config agent configuration...');
            
            const agentId = `tg-${await machineId()}-${Date.now()}`;
            
            // Generate configuration components
            const securityProfile = this.generateSecurityProfile(discoveryResult);
            const collectionConfig = this.generateCollectionConfig(discoveryResult, securityProfile);
            const transmissionConfig = this.generateTransmissionConfig(discoveryResult, securityProfile);
            const managementConfig = this.generateManagementConfig(discoveryResult);
            const securityConfig = this.generateSecurityConfig(discoveryResult, securityProfile);
            const performanceConfig = this.generatePerformanceConfig(discoveryResult);

            const config: AgentConfig = {
                agentId,
                version: '2.0.1',
                organization: discoveryResult.organization,
                profile: securityProfile,
                system: discoveryResult.system,
                collection: collectionConfig,
                transmission: transmissionConfig,
                management: managementConfig,
                security: securityConfig,
                performance: performanceConfig,
                generatedAt: new Date().toISOString()
            };

            this.logger.info('✅ Configuration generated successfully');
            this.logger.debug(`📊 Profile: ${securityProfile.name}`);
            this.logger.debug(`📋 Sources: ${collectionConfig.sources.length}`);
            this.logger.debug(`🔒 Security Level: ${securityProfile.securityLevel}`);

            return config;

        } catch (error) {
            this.logger.error('❌ Failed to generate configuration:', error);
            throw error;
        }
    }

    /**
     * Generate security profile based on discovery results
     */
    private generateSecurityProfile(discoveryResult: DiscoveryResult): SecurityProfile {
        const { organization, securityTools, complianceRequirements } = discoveryResult;

        // Determine security level based on organization and compliance
        let securityLevel: 'basic' | 'standard' | 'enhanced' | 'maximum' = 'standard';
        
        if (complianceRequirements.includes('pci_dss') || 
            complianceRequirements.includes('hipaa') ||
            complianceRequirements.includes('sox')) {
            securityLevel = 'maximum';
        } else if (complianceRequirements.length > 0) {
            securityLevel = 'enhanced';
        } else if (securityTools.length > 2) {
            securityLevel = 'enhanced';
        }

        // Determine filtering level
        let filteringLevel: 'minimal' | 'standard' | 'aggressive' = 'standard';
        if (securityLevel === 'maximum') {
            filteringLevel = 'aggressive';
        } else if (securityLevel === 'basic') {
            filteringLevel = 'minimal';
        }

        // Required sources based on compliance
        const requiredSources = this.getRequiredSources(complianceRequirements);

        const profile: SecurityProfile = {
            name: this.generateProfileName(organization, complianceRequirements, securityLevel),
            description: this.generateProfileDescription(complianceRequirements, securityLevel),
            securityLevel,
            complianceProfiles: complianceRequirements,
            requiredSources,
            filteringLevel,
            encryptionRequired: securityLevel === 'maximum' || securityLevel === 'enhanced',
            retentionPeriod: this.getRetentionPeriod(complianceRequirements)
        };

        this.logger.debug(`🔧 Generated security profile: ${profile.name} (${profile.securityLevel})`);
        return profile;
    }

    /**
     * Generate collection configuration
     */
    private generateCollectionConfig(
        discoveryResult: DiscoveryResult, 
        securityProfile: SecurityProfile
    ): CollectionConfig {
        const { system, logSources } = discoveryResult;

        // Filter and prioritize log sources
        const prioritizedSources = this.prioritizeLogSources(logSources, securityProfile);

        // Generate intervals based on system performance and security level
        const intervals = this.generateIntervals(system, securityProfile);

        // Generate buffer sizes based on system memory
        const buffers = this.generateBufferSizes(system);

        // Generate filters for security-focused collection
        const filters = this.generateFilters(securityProfile, discoveryResult.securityTools);

        // Generate parsers for different log formats
        const parsers = this.generateParsers(prioritizedSources);

        // Generate tags for metadata
        const tags = this.generateTags(discoveryResult);

        const collectionConfig: CollectionConfig = {
            sources: prioritizedSources,
            intervals,
            buffers,
            filters,
            parsers,
            tags
        };

        this.logger.debug(`📊 Collection config: ${prioritizedSources.length} sources, ${filters.length} filters`);
        return collectionConfig;
    }

    /**
     * Generate transmission configuration
     */
    private generateTransmissionConfig(
        discoveryResult: DiscoveryResult,
        securityProfile: SecurityProfile
    ): TransmissionConfig {
        // Default transmission endpoints
        const endpoints = [
            {
                url: 'https://api.bg-threat.com/api/agents/ingest',
                weight: 100,
                active: true,
                headers: {
                    'User-Agent': 'ThreatGuard-Agent/2.0.1',
                    'X-Agent-ID': discoveryResult.system.hostname
                },
                authMethod: 'bearer' as const,
                authCredentials: {
                    token: 'auto-generated'  // Will be replaced with actual token
                }
            }
        ];

        // Determine batch size based on system capabilities and security level
        let batchSize = 1000;
        if (securityProfile.securityLevel === 'maximum') {
            batchSize = 100; // Smaller batches for high security
        } else if (discoveryResult.system.totalMemory > 8192) {
            batchSize = 5000; // Larger batches for high-memory systems
        }

        // Determine compression based on network and performance requirements
        let compression: 'gzip' | 'lz4' | 'snappy' | 'none' = 'gzip';
        if (discoveryResult.system.cpuCores > 8) {
            compression = 'lz4'; // Faster compression for high-CPU systems
        }

        const transmissionConfig: TransmissionConfig = {
            endpoints,
            protocol: 'https',
            format: 'json',
            compression,
            batchSize,
            flushInterval: securityProfile.securityLevel === 'maximum' ? 10 : 30, // seconds
            retryAttempts: 3,
            retryBackoff: 'exponential',
            healthCheckInterval: 60,
            tls: {
                enabled: true,
                version: '1.3',
                verifyHostname: true,
                verifyPeer: true
            }
        };

        this.logger.debug(`📡 Transmission config: ${compression} compression, ${batchSize} batch size`);
        return transmissionConfig;
    }

    /**
     * Generate management configuration
     */
    private generateManagementConfig(discoveryResult: DiscoveryResult): ManagementConfig {
        const managementConfig: ManagementConfig = {
            enabled: true,
            port: this.options.managementPort || 8888,
            interface: '127.0.0.1', // Localhost only for security
            authentication: 'api_key',
            apiKey: this.generateApiKey(),
            allowedIPs: ['127.0.0.1', '::1'],
            endpoints: [
                '/health',
                '/status',
                '/metrics',
                '/config/reload',
                '/logs/tail'
            ],
            remoteManagement: {
                enabled: true,
                serverUrl: 'https://api.bg-threat.com',
                registrationEndpoint: '/api/agents/register',
                configEndpoint: '/api/agents/config',
                heartbeatInterval: 300, // 5 minutes
                configSyncInterval: 900, // 15 minutes
                commandPollInterval: 60, // 1 minute
                authentication: {
                    method: 'jwt',
                    credentials: {
                        clientId: discoveryResult.organization.id,
                        secret: 'auto-generated'
                    },
                    refreshInterval: 3600 // 1 hour
                }
            }
        };

        this.logger.debug(`🌐 Management config: port ${managementConfig.port}, remote enabled`);
        return managementConfig;
    }

    /**
     * Generate security configuration
     */
    private generateSecurityConfig(
        discoveryResult: DiscoveryResult,
        securityProfile: SecurityProfile
    ): SecurityConfig {
        const encryptionRequired = securityProfile.encryptionRequired;

        const securityConfig: SecurityConfig = {
            encryption: {
                algorithm: 'AES-256-GCM',
                keyDerivation: 'Argon2',
                keyRotationInterval: '30d',
                encryptAtRest: encryptionRequired,
                encryptInTransit: true
            },
            authentication: {
                required: true,
                methods: ['api_key', 'jwt'],
                tokenExpiration: '1h',
                refreshTokens: true
            },
            authorization: {
                enabled: securityProfile.securityLevel === 'maximum',
                roles: ['agent', 'admin'],
                permissions: {
                    agent: ['read:status', 'read:metrics'],
                    admin: ['read:*', 'write:config', 'write:control']
                },
                defaultRole: 'agent'
            },
            auditLogging: securityProfile.securityLevel !== 'basic',
            integrityChecking: encryptionRequired,
            antiTampering: securityProfile.securityLevel === 'maximum'
        };

        this.logger.debug(`🔒 Security config: ${securityConfig.encryption.algorithm}, audit: ${securityConfig.auditLogging}`);
        return securityConfig;
    }

    /**
     * Generate performance configuration
     */
    private generatePerformanceConfig(discoveryResult: DiscoveryResult): PerformanceConfig {
        const { system } = discoveryResult;

        // Calculate resource limits based on system capabilities
        const maxCpuPercent = Math.min(50, Math.max(10, system.cpuCores * 5)); // 5% per core, max 50%
        const maxMemoryMB = Math.min(512, Math.max(64, system.totalMemory * 0.1)); // 10% of total, max 512MB
        const workerThreads = Math.min(4, Math.max(1, system.cpuCores - 1));

        const performanceConfig: PerformanceConfig = {
            resourceLimits: {
                maxCpuPercent,
                maxMemoryMB,
                maxDiskMB: 100,
                maxNetworkKbps: 1024, // 1 Mbps
                maxFileDescriptors: 1024,
                maxConnections: 100
            },
            optimization: {
                enableCompression: true,
                enableCaching: system.totalMemory > 4096,
                enableBatching: true,
                enableMultithreading: system.cpuCores > 2,
                workerThreads,
                ioThreads: 2,
                networkThreads: 1
            },
            monitoring: {
                enabled: true,
                interval: 60, // seconds
                metrics: [
                    'cpu_usage',
                    'memory_usage',
                    'disk_usage',
                    'network_usage',
                    'events_processed',
                    'events_transmitted',
                    'error_rate'
                ],
                alertThresholds: {
                    cpu_usage: maxCpuPercent * 0.8,
                    memory_usage: maxMemoryMB * 0.8,
                    error_rate: 5
                },
                historicalData: true,
                retentionPeriod: '7d'
            },
            throttling: {
                enabled: true,
                cpuThreshold: maxCpuPercent * 0.7,
                memoryThreshold: maxMemoryMB * 0.7,
                networkThreshold: 800, // 800 Kbps
                throttlePercentage: 50,
                recoveryThreshold: 0.5
            }
        };

        this.logger.debug(`⚡ Performance config: ${maxCpuPercent}% CPU, ${maxMemoryMB}MB memory`);
        return performanceConfig;
    }

    // Helper methods

    private getRequiredSources(compliance: ComplianceFramework[]): string[] {
        const required: Set<string> = new Set();

        if (compliance.includes('pci_dss')) {
            required.add('authentication_logs');
            required.add('authorization_logs');
            required.add('data_access_logs');
            required.add('network_logs');
        }

        if (compliance.includes('hipaa')) {
            required.add('audit_logs');
            required.add('access_logs');
            required.add('security_logs');
        }

        if (compliance.includes('sox')) {
            required.add('database_logs');
            required.add('application_logs');
            required.add('system_logs');
        }

        return Array.from(required);
    }

    private getRetentionPeriod(compliance: ComplianceFramework[]): string {
        if (compliance.includes('sox')) return '7y';
        if (compliance.includes('hipaa')) return '6y';
        if (compliance.includes('pci_dss')) return '1y';
        return '90d';
    }

    private generateProfileName(
        organization: OrganizationInfo,
        compliance: ComplianceFramework[],
        securityLevel: string
    ): string {
        const complianceStr = compliance.length > 0 ? ` (${compliance.join(', ').toUpperCase()})` : '';
        return `${organization.name} ${securityLevel}${complianceStr}`;
    }

    private generateProfileDescription(
        compliance: ComplianceFramework[],
        securityLevel: string
    ): string {
        let desc = `Auto-generated ${securityLevel} security profile`;
        if (compliance.length > 0) {
            desc += ` with ${compliance.join(', ').toUpperCase()} compliance requirements`;
        }
        return desc;
    }

    private prioritizeLogSources(sources: LogSource[], profile: SecurityProfile): LogSource[] {
        // Sort by priority and filter based on security profile
        return sources
            .filter(source => this.shouldIncludeSource(source, profile))
            .sort((a, b) => {
                const priorityOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            });
    }

    private shouldIncludeSource(source: LogSource, profile: SecurityProfile): boolean {
        // Always include critical and high priority sources
        if (source.priority === 'critical' || source.priority === 'high') {
            return true;
        }

        // Include medium priority for standard+ profiles
        if (source.priority === 'medium' && profile.securityLevel !== 'basic') {
            return true;
        }

        // Include low priority only for maximum security
        if (source.priority === 'low' && profile.securityLevel === 'maximum') {
            return true;
        }

        return false;
    }

    private generateIntervals(system: SystemInfo, profile: SecurityProfile): CollectionConfig['intervals'] {
        const basePolling = profile.securityLevel === 'maximum' ? 5 : 
                          profile.securityLevel === 'enhanced' ? 10 : 
                          profile.securityLevel === 'standard' ? 30 : 60;

        return {
            polling: basePolling,
            heartbeat: 300, // 5 minutes
            healthCheck: 60  // 1 minute
        };
    }

    private generateBufferSizes(system: SystemInfo): CollectionConfig['buffers'] {
        const memoryMB = system.totalMemory;
        
        let inputBuffer = '16MB';
        let outputBuffer = '32MB';
        let memoryLimit = '80MB';

        if (memoryMB < 2048) {
            // Low memory system
            inputBuffer = '8MB';
            outputBuffer = '16MB';
            memoryLimit = '40MB';
        } else if (memoryMB > 8192) {
            // High memory system
            inputBuffer = '32MB';
            outputBuffer = '64MB';
            memoryLimit = '160MB';
        }

        return {
            inputBuffer,
            outputBuffer,
            memoryLimit
        };
    }

    private generateFilters(profile: SecurityProfile, securityTools: any[]): FilterConfig[] {
        const filters: FilterConfig[] = [];

        // Security event filter
        filters.push({
            name: 'security_events',
            type: 'grep',
            rules: [
                {
                    condition: 'key_exists("EventID")',
                    action: 'include',
                    parameters: {}
                }
            ],
            enabled: true,
            priority: 1
        });

        // Noise reduction filter
        if (profile.filteringLevel === 'aggressive') {
            filters.push({
                name: 'noise_reduction',
                type: 'grep',
                rules: [
                    {
                        condition: 'regex_match("message", "heartbeat|health_check")',
                        action: 'exclude',
                        parameters: {}
                    }
                ],
                enabled: true,
                priority: 2
            });
        }

        return filters;
    }

    private generateParsers(sources: LogSource[]): ParserConfig[] {
        const parsers: ParserConfig[] = [];
        const seenFormats = new Set<string>();

        for (const source of sources) {
            if (!seenFormats.has(source.format)) {
                seenFormats.add(source.format);
                
                switch (source.format) {
                    case 'json':
                        parsers.push({
                            name: 'json_parser',
                            format: 'json',
                            timeKey: 'timestamp',
                            timeFormat: '%Y-%m-%dT%H:%M:%S.%L%z'
                        });
                        break;
                    case 'xml':
                        parsers.push({
                            name: 'xml_parser',
                            format: 'regex',
                            regex: '^(?<timestamp>\\S+)\\s+(?<message>.*)$',
                            timeKey: 'timestamp'
                        });
                        break;
                }
            }
        }

        return parsers;
    }

    private generateTags(discoveryResult: DiscoveryResult): Record<string, string> {
        return {
            hostname: discoveryResult.system.hostname,
            platform: discoveryResult.system.platform,
            organization: discoveryResult.organization.name,
            agent_version: '2.0.1',
            discovery_confidence: discoveryResult.confidence.toString()
        };
    }

    private generateApiKey(): string {
        return `tg_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;
    }
}