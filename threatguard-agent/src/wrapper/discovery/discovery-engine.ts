/**
 * ThreatGuard Agent - Discovery Engine
 * Zero-config automatic system discovery and profiling
 */

import { EventEmitter } from 'events';
import { platform, hostname, arch, release, totalmem, freemem, cpus } from 'os';
import { machineId } from 'node-machine-id';
import { Logger } from '../../common/logger';
import { 
    DiscoveryResult, 
    SystemInfo, 
    OrganizationInfo, 
    SecurityTool,
    LogSource,
    ComplianceFramework,
    Recommendation,
    DiscoveryError,
    AgentOptions,
    DiscoveryProgress
} from '../../common/types';
import { WindowsDiscovery } from '../../platform/windows/windows-discovery';
import { LinuxDiscovery } from '../../platform/linux/linux-discovery';
import { MacOSDiscovery } from '../../platform/macos/macos-discovery';

export class DiscoveryEngine extends EventEmitter {
    private logger: Logger;
    private options: AgentOptions;
    private platformDiscovery: WindowsDiscovery | LinuxDiscovery | MacOSDiscovery;

    constructor(options: AgentOptions) {
        super();
        this.options = options;
        this.logger = new Logger('DiscoveryEngine');

        // Initialize platform-specific discovery
        const currentPlatform = platform();
        switch (currentPlatform) {
            case 'win32':
                this.platformDiscovery = new WindowsDiscovery(options);
                break;
            case 'linux':
                this.platformDiscovery = new LinuxDiscovery(options);
                break;
            case 'darwin':
                this.platformDiscovery = new MacOSDiscovery(options);
                break;
            default:
                throw new Error(`Unsupported platform: ${currentPlatform}`);
        }
    }

    /**
     * Perform comprehensive system discovery
     */
    public async discover(): Promise<DiscoveryResult> {
        const startTime = Date.now();
        const errors: DiscoveryError[] = [];

        try {
            this.logger.info('🔍 Starting comprehensive system discovery...');
            this.emitProgress('initialization', 0, 'Initializing discovery engine');

            // Phase 1: Basic system information
            this.emitProgress('system_info', 10, 'Gathering basic system information');
            const systemInfo = await this.gatherSystemInfo();

            // Phase 2: Organization detection
            this.emitProgress('organization', 25, 'Detecting organization');
            const organizationInfo = await this.detectOrganization(systemInfo);

            // Phase 3: Security tools discovery
            this.emitProgress('security_tools', 40, 'Discovering security tools');
            const securityTools = await this.discoverSecurityTools();

            // Phase 4: Log sources identification
            this.emitProgress('log_sources', 60, 'Identifying log sources');
            const logSources = await this.identifyLogSources(securityTools);

            // Phase 5: Compliance requirements analysis
            this.emitProgress('compliance', 80, 'Analyzing compliance requirements');
            const complianceRequirements = await this.analyzeComplianceRequirements(
                organizationInfo, 
                securityTools
            );

            // Phase 6: Generate recommendations
            this.emitProgress('recommendations', 90, 'Generating recommendations');
            const recommendations = await this.generateRecommendations(
                systemInfo,
                organizationInfo,
                securityTools,
                logSources,
                complianceRequirements
            );

            // Calculate overall confidence
            const confidence = this.calculateConfidence(
                organizationInfo,
                securityTools,
                logSources,
                errors
            );

            this.emitProgress('complete', 100, 'Discovery completed successfully');

            const discoveryTime = Date.now() - startTime;
            this.logger.info(`✅ Discovery completed in ${discoveryTime}ms with ${confidence}% confidence`);

            const result: DiscoveryResult = {
                system: systemInfo,
                organization: organizationInfo,
                securityTools,
                logSources,
                complianceRequirements,
                recommendations,
                confidence,
                discoveryTime,
                errors
            };

            this.emit('discovery-complete', result);
            return result;

        } catch (error) {
            this.logger.error('❌ Discovery failed:', error);
            errors.push({
                source: 'DiscoveryEngine',
                error: error instanceof Error ? error.message : String(error),
                severity: 'critical',
                recoverable: false
            });

            throw error;
        }
    }

    /**
     * Gather basic system information
     */
    private async gatherSystemInfo(): Promise<SystemInfo> {
        try {
            this.logger.debug('📊 Gathering system information...');

            const agentId = await machineId();
            const currentPlatform = platform();
            const osArch = arch();
            const osRelease = release();
            const cpuInfo = cpus();
            const totalMem = totalmem();
            const freeMem = freemem();

            // Platform-specific system information
            const platformSpecific = await this.platformDiscovery.gatherSystemInfo();

            const systemInfo: SystemInfo = {
                hostname: hostname(),
                platform: currentPlatform as 'windows' | 'linux' | 'darwin',
                architecture: osArch,
                osVersion: osRelease,
                osDistribution: platformSpecific.osDistribution,
                cpuCores: cpuInfo.length,
                totalMemory: Math.round(totalMem / 1024 / 1024), // MB
                availableMemory: Math.round(freeMem / 1024 / 1024), // MB
                diskSpace: platformSpecific.diskSpace,
                networkInterfaces: platformSpecific.networkInterfaces,
                installedSoftware: platformSpecific.installedSoftware,
                runningServices: platformSpecific.runningServices,
                securityTools: [], // Will be populated later
                capabilities: platformSpecific.capabilities
            };

            this.logger.debug(`✅ System info gathered: ${systemInfo.platform} ${systemInfo.osVersion}`);
            return systemInfo;

        } catch (error) {
            this.logger.error('❌ Failed to gather system information:', error);
            throw error;
        }
    }

    /**
     * Detect organization using multiple methods
     */
    private async detectOrganization(systemInfo: SystemInfo): Promise<OrganizationInfo> {
        try {
            this.logger.debug('🏢 Detecting organization...');

            // Try multiple detection methods
            const detectionMethods = [
                this.detectViaDomain.bind(this),
                this.detectViaCertificates.bind(this),
                this.detectViaDNS.bind(this),
                this.detectViaCloudMetadata.bind(this),
                this.detectViaNetworkScan.bind(this)
            ];

            let bestMatch: OrganizationInfo | null = null;
            let highestConfidence = 0;

            for (const method of detectionMethods) {
                try {
                    const result = await method(systemInfo);
                    if (result && result.detectionConfidence > highestConfidence) {
                        bestMatch = result;
                        highestConfidence = result.detectionConfidence;
                    }
                } catch (error) {
                    this.logger.debug(`Detection method failed: ${error}`);
                }
            }

            if (bestMatch) {
                this.logger.info(`🎯 Organization detected: ${bestMatch.name} (${bestMatch.detectionMethod})`);
                this.emit('organization-detected', bestMatch);
                return bestMatch;
            }

            // Fallback to manual approval queue
            const fallbackOrg: OrganizationInfo = {
                id: 'unknown',
                name: 'Unknown Organization',
                detectionMethod: 'manual',
                detectionConfidence: 0,
                complianceRequirements: []
            };

            this.logger.warn('⚠️ Organization not detected - using fallback');
            return fallbackOrg;

        } catch (error) {
            this.logger.error('❌ Organization detection failed:', error);
            throw error;
        }
    }

    /**
     * Discover installed security tools
     */
    private async discoverSecurityTools(): Promise<SecurityTool[]> {
        try {
            this.logger.debug('🛡️ Discovering security tools...');

            const securityTools = await this.platformDiscovery.discoverSecurityTools();

            this.logger.info(`✅ Found ${securityTools.length} security tools`);
            securityTools.forEach(tool => {
                this.logger.debug(`  - ${tool.name} (${tool.type}): ${tool.status}`);
            });

            return securityTools;

        } catch (error) {
            this.logger.error('❌ Security tools discovery failed:', error);
            return [];
        }
    }

    /**
     * Identify available log sources
     */
    private async identifyLogSources(securityTools: SecurityTool[]): Promise<LogSource[]> {
        try {
            this.logger.debug('📋 Identifying log sources...');

            const logSources = await this.platformDiscovery.identifyLogSources(securityTools);

            this.logger.info(`✅ Found ${logSources.length} log sources`);
            logSources.forEach(source => {
                this.logger.debug(`  - ${source.name} (${source.type}): ~${source.estimatedVolume} events/hour`);
            });

            return logSources;

        } catch (error) {
            this.logger.error('❌ Log sources identification failed:', error);
            return [];
        }
    }

    /**
     * Analyze compliance requirements
     */
    private async analyzeComplianceRequirements(
        organization: OrganizationInfo,
        securityTools: SecurityTool[]
    ): Promise<ComplianceFramework[]> {
        try {
            this.logger.debug('📋 Analyzing compliance requirements...');

            const requirements = await this.platformDiscovery.analyzeComplianceRequirements(
                organization,
                securityTools
            );

            this.logger.info(`✅ Identified ${requirements.length} compliance requirements`);
            requirements.forEach(req => {
                this.logger.debug(`  - ${req}`);
            });

            return requirements;

        } catch (error) {
            this.logger.error('❌ Compliance analysis failed:', error);
            return [];
        }
    }

    /**
     * Generate optimization recommendations
     */
    private async generateRecommendations(
        systemInfo: SystemInfo,
        organization: OrganizationInfo,
        securityTools: SecurityTool[],
        logSources: LogSource[],
        compliance: ComplianceFramework[]
    ): Promise<Recommendation[]> {
        const recommendations: Recommendation[] = [];

        try {
            // Performance recommendations
            if (systemInfo.totalMemory < 4096) {
                recommendations.push({
                    type: 'performance',
                    priority: 'medium',
                    title: 'Low Memory Configuration',
                    description: 'System has limited memory available',
                    action: 'Enable memory optimization and reduce buffer sizes',
                    automated: true,
                    estimatedImpact: 'Reduced memory usage by 30%'
                });
            }

            // Security recommendations
            const hasEDR = securityTools.some(tool => tool.type === 'edr');
            if (!hasEDR) {
                recommendations.push({
                    type: 'security',
                    priority: 'high',
                    title: 'No EDR Solution Detected',
                    description: 'Endpoint Detection and Response solution not found',
                    action: 'Consider deploying EDR solution for enhanced security',
                    automated: false,
                    estimatedImpact: 'Improved threat detection and response capabilities'
                });
            }

            // Compliance recommendations
            if (compliance.includes('pci_dss')) {
                recommendations.push({
                    type: 'compliance',
                    priority: 'high',
                    title: 'PCI DSS Compliance',
                    description: 'PCI DSS compliance requirements detected',
                    action: 'Enable enhanced logging and encryption for payment data',
                    automated: true,
                    estimatedImpact: 'PCI DSS compliance maintained'
                });
            }

            // Integration recommendations
            const inactiveTools = securityTools.filter(tool => tool.status === 'inactive');
            if (inactiveTools.length > 0) {
                recommendations.push({
                    type: 'integration',
                    priority: 'medium',
                    title: 'Inactive Security Tools',
                    description: `${inactiveTools.length} security tools are inactive`,
                    action: 'Enable integration with inactive security tools',
                    automated: false,
                    estimatedImpact: 'Improved security visibility'
                });
            }

            this.logger.info(`✅ Generated ${recommendations.length} recommendations`);
            return recommendations;

        } catch (error) {
            this.logger.error('❌ Failed to generate recommendations:', error);
            return recommendations;
        }
    }

    /**
     * Calculate overall discovery confidence
     */
    private calculateConfidence(
        organization: OrganizationInfo,
        securityTools: SecurityTool[],
        logSources: LogSource[],
        errors: DiscoveryError[]
    ): number {
        let confidence = 100;

        // Reduce confidence based on organization detection
        if (organization.detectionConfidence < 50) {
            confidence -= 20;
        }

        // Reduce confidence based on errors
        const criticalErrors = errors.filter(e => e.severity === 'critical').length;
        const majorErrors = errors.filter(e => e.severity === 'error').length;
        const warnings = errors.filter(e => e.severity === 'warning').length;

        confidence -= (criticalErrors * 15) + (majorErrors * 10) + (warnings * 5);

        // Increase confidence based on successful discoveries
        if (securityTools.length > 0) {
            confidence += 5;
        }
        if (logSources.length > 5) {
            confidence += 5;
        }

        return Math.max(0, Math.min(100, confidence));
    }

    /**
     * Emit discovery progress
     */
    private emitProgress(phase: string, progress: number, message: string): void {
        const progressInfo: DiscoveryProgress = {
            phase,
            progress,
            message,
            timestamp: new Date().toISOString()
        };

        this.emit('discovery-progress', progressInfo);
        this.logger.debug(`📊 ${phase}: ${progress}% - ${message}`);
    }

    // Organization detection methods
    private async detectViaDomain(systemInfo: SystemInfo): Promise<OrganizationInfo | null> {
        // Implementation would check domain information
        // This is a placeholder for the actual implementation
        return null;
    }

    private async detectViaCertificates(systemInfo: SystemInfo): Promise<OrganizationInfo | null> {
        // Implementation would check certificate store
        return null;
    }

    private async detectViaDNS(systemInfo: SystemInfo): Promise<OrganizationInfo | null> {
        // Implementation would check DNS TXT records
        return null;
    }

    private async detectViaCloudMetadata(systemInfo: SystemInfo): Promise<OrganizationInfo | null> {
        // Implementation would check cloud instance metadata
        return null;
    }

    private async detectViaNetworkScan(systemInfo: SystemInfo): Promise<OrganizationInfo | null> {
        // Implementation would scan for local management services
        return null;
    }
}