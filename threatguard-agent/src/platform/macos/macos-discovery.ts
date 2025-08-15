/**
 * ThreatGuard Agent - macOS Discovery
 * macOS-specific system discovery implementation
 */

import { Logger } from '../../common/logger';
import { 
    SystemInfo,
    SecurityTool,
    LogSource,
    ComplianceFramework,
    NetworkInterface,
    InstalledSoftware,
    RunningService,
    SystemCapabilities,
    OrganizationInfo,
    AgentOptions
} from '../../common/types';
import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';

export class MacOSDiscovery {
    private logger: Logger;
    private options: AgentOptions;

    constructor(options: AgentOptions) {
        this.options = options;
        this.logger = new Logger('MacOSDiscovery');
    }

    /**
     * Gather macOS-specific system information
     */
    public async gatherSystemInfo(): Promise<Partial<SystemInfo>> {
        this.logger.debug('📊 Gathering macOS system information...');

        try {
            const [
                osDistribution,
                diskSpace,
                networkInterfaces,
                installedSoftware,
                runningServices,
                capabilities
            ] = await Promise.all([
                this.getOSDistribution(),
                this.getDiskSpace(),
                this.getNetworkInterfaces(),
                this.getInstalledSoftware(),
                this.getRunningServices(),
                this.getSystemCapabilities()
            ]);

            return {
                osDistribution,
                diskSpace,
                networkInterfaces,
                installedSoftware,
                runningServices,
                capabilities
            };

        } catch (error) {
            this.logger.error('❌ Failed to gather macOS system info:', error);
            throw error;
        }
    }

    /**
     * Discover macOS security tools
     */
    public async discoverSecurityTools(): Promise<SecurityTool[]> {
        this.logger.debug('🛡️ Discovering macOS security tools...');

        const securityTools: SecurityTool[] = [];

        try {
            // Check for common macOS security tools
            const toolChecks = [
                this.checkXProtect(),
                this.checkGatekeeper(),
                this.checkSIP(),
                this.checkFirewall(),
                this.checkCrowdStrike(),
                this.checkSentinelOne(),
                this.checkCarbonBlack(),
                this.checkSymantec(),
                this.checkMcAfee(),
                this.checkTrendMicro(),
                this.checkBitdefender(),
                this.checkMalwareBytes(),
                this.checkJamf(),
                this.checkKandji(),
                this.checkMosyle()
            ];

            const results = await Promise.allSettled(toolChecks);
            
            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    securityTools.push(result.value);
                }
            });

            return securityTools;

        } catch (error) {
            this.logger.error('❌ Failed to discover macOS security tools:', error);
            return securityTools;
        }
    }

    /**
     * Identify macOS log sources
     */
    public async identifyLogSources(securityTools: SecurityTool[]): Promise<LogSource[]> {
        this.logger.debug('📋 Identifying macOS log sources...');

        const logSources: LogSource[] = [];

        try {
            // System logs
            const systemLogs = await this.getSystemLogs();
            logSources.push(...systemLogs);

            // Security tool specific logs
            for (const tool of securityTools) {
                const toolLogs = await this.getSecurityToolLogs(tool);
                logSources.push(...toolLogs);
            }

            // Application logs
            const appLogs = await this.getApplicationLogs();
            logSources.push(...appLogs);

            // Web server logs (if applicable)
            const webLogs = await this.getWebServerLogs();
            logSources.push(...webLogs);

            return logSources;

        } catch (error) {
            this.logger.error('❌ Failed to identify macOS log sources:', error);
            return logSources;
        }
    }

    /**
     * Analyze compliance requirements for macOS
     */
    public async analyzeComplianceRequirements(
        organization: OrganizationInfo,
        securityTools: SecurityTool[]
    ): Promise<ComplianceFramework[]> {
        const requirements: ComplianceFramework[] = [];

        try {
            // Check for payment processing software (PCI DSS)
            const paymentSoftware = await this.detectPaymentSoftware();
            if (paymentSoftware.length > 0) {
                requirements.push('pci_dss');
            }

            // Check for healthcare software (HIPAA)
            const healthcareSoftware = await this.detectHealthcareSoftware();
            if (healthcareSoftware.length > 0) {
                requirements.push('hipaa');
            }

            // Check for financial software (SOX)
            const financialSoftware = await this.detectFinancialSoftware();
            if (financialSoftware.length > 0) {
                requirements.push('sox');
            }

            // Check for enterprise management (ISO 27001)
            const hasMDM = securityTools.some(tool => tool.type === 'mdm');
            if (hasMDM) {
                requirements.push('iso_27001');
            }

            return requirements;

        } catch (error) {
            this.logger.error('❌ Failed to analyze macOS compliance requirements:', error);
            return requirements;
        }
    }

    // Private helper methods

    private async getOSDistribution(): Promise<string> {
        try {
            const result = execSync('sw_vers -productName && sw_vers -productVersion', { encoding: 'utf8' });
            const lines = result.trim().split('\n');
            return lines.join(' ');
        } catch (error) {
            return 'macOS (Unknown Version)';
        }
    }

    private async getDiskSpace(): Promise<number> {
        try {
            const result = execSync('df / | tail -n1 | awk \'{print $4}\'', { encoding: 'utf8' });
            // Convert from 512-byte blocks to MB
            return Math.round(parseInt(result.trim()) * 512 / 1024 / 1024);
        } catch (error) {
            return 0;
        }
    }

    private async getNetworkInterfaces(): Promise<NetworkInterface[]> {
        try {
            const interfaces: NetworkInterface[] = [];
            
            // Get interface list
            const ifResult = execSync('networksetup -listallhardwareports', { encoding: 'utf8' });
            const sections = ifResult.split('Hardware Port: ').slice(1);
            
            for (const section of sections) {
                const lines = section.split('\n');
                const portName = lines[0];
                const deviceMatch = lines.find(line => line.startsWith('Device: '));
                
                if (deviceMatch) {
                    const device = deviceMatch.replace('Device: ', '');
                    
                    try {
                        // Get IP address for this interface
                        const ipResult = execSync(`ifconfig ${device} | grep 'inet ' | awk '{print $2}'`, 
                            { encoding: 'utf8' });
                        const ip = ipResult.trim();
                        
                        if (ip && ip !== '127.0.0.1') {
                            interfaces.push({
                                name: device,
                                type: portName.toLowerCase().includes('wi-fi') ? 'wireless' : 'ethernet',
                                address: ip
                            });
                        }
                    } catch {
                        // Skip if can't get IP
                    }
                }
            }

            return interfaces;

        } catch (error) {
            return [];
        }
    }

    private async getInstalledSoftware(): Promise<InstalledSoftware[]> {
        try {
            const software: InstalledSoftware[] = [];

            // Get applications from /Applications
            try {
                const apps = await fs.readdir('/Applications');
                for (const app of apps) {
                    if (app.endsWith('.app')) {
                        const appName = app.replace('.app', '');
                        
                        // Try to get version from Info.plist
                        let version = 'Unknown';
                        try {
                            const plistPath = `/Applications/${app}/Contents/Info.plist`;
                            if (existsSync(plistPath)) {
                                const plistResult = execSync(`plutil -p "${plistPath}" | grep CFBundleShortVersionString`, 
                                    { encoding: 'utf8' });
                                const versionMatch = plistResult.match(/"([^"]+)"/);
                                if (versionMatch) {
                                    version = versionMatch[1];
                                }
                            }
                        } catch {
                            // Keep default version
                        }

                        software.push({
                            name: appName,
                            version,
                            vendor: 'Unknown',
                            category: 'application'
                        });
                    }
                }
            } catch {
                // Skip if can't read Applications
            }

            // Get Homebrew packages if available
            try {
                if (existsSync('/opt/homebrew/bin/brew') || existsSync('/usr/local/bin/brew')) {
                    const brewResult = execSync('brew list --versions', { encoding: 'utf8' });
                    const lines = brewResult.split('\n');
                    
                    for (const line of lines) {
                        if (line.trim()) {
                            const parts = line.split(' ');
                            if (parts.length >= 2) {
                                software.push({
                                    name: parts[0],
                                    version: parts[1],
                                    vendor: 'Homebrew',
                                    category: 'package'
                                });
                            }
                        }
                    }
                }
            } catch {
                // Skip if Homebrew not available
            }

            return software;

        } catch (error) {
            return [];
        }
    }

    private async getRunningServices(): Promise<RunningService[]> {
        try {
            const services: RunningService[] = [];

            // Get launchd services
            try {
                const result = execSync('launchctl list', { encoding: 'utf8' });
                const lines = result.split('\n').slice(1); // Skip header

                for (const line of lines) {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 3) {
                        const pid = parts[0];
                        const status = parts[1];
                        const label = parts[2];

                        if (pid !== '-' && status === '0') {
                            services.push({
                                name: label,
                                displayName: label,
                                status: 'running',
                                startType: 'auto',
                                logSources: []
                            });
                        }
                    }
                }
            } catch {
                // Fallback to ps
                const result = execSync('ps aux', { encoding: 'utf8' });
                const lines = result.split('\n').slice(1); // Skip header

                for (const line of lines) {
                    const parts = line.split(/\s+/);
                    if (parts.length >= 11) {
                        const command = parts.slice(10).join(' ');
                        const processName = parts[10].split('/').pop() || parts[10];
                        
                        services.push({
                            name: processName,
                            displayName: command,
                            status: 'running',
                            startType: 'unknown',
                            logSources: []
                        });
                    }
                }
            }

            return services;

        } catch (error) {
            return [];
        }
    }

    private async getSystemCapabilities(): Promise<SystemCapabilities> {
        return {
            windowsEventLogs: false,
            syslogGeneration: true,
            wmiQueries: false,
            osquerySupport: existsSync('/usr/local/bin/osqueryi') || existsSync('/opt/homebrew/bin/osqueryi'),
            containerRuntime: existsSync('/usr/local/bin/docker') || existsSync('/opt/homebrew/bin/docker'),
            virtualizationSupport: true, // Most Macs support virtualization
            networkMonitoring: true,
            performanceCounters: false,
            registryAccess: false,
            fileSystemMonitoring: true
        };
    }

    // Security tool detection methods

    private async checkXProtect(): Promise<SecurityTool | null> {
        try {
            if (existsSync('/System/Library/CoreServices/XProtect.bundle')) {
                return {
                    name: 'XProtect',
                    type: 'antivirus',
                    vendor: 'Apple',
                    status: 'active',
                    integrationMethod: 'syslog',
                    logSources: []
                };
            }
        } catch (error) {
            // Continue
        }
        return null;
    }

    private async checkGatekeeper(): Promise<SecurityTool | null> {
        try {
            const result = execSync('spctl --status', { encoding: 'utf8' });
            return {
                name: 'Gatekeeper',
                type: 'application_control',
                vendor: 'Apple',
                status: result.includes('enabled') ? 'active' : 'inactive',
                integrationMethod: 'syslog',
                logSources: []
            };
        } catch (error) {
            return null;
        }
    }

    private async checkSIP(): Promise<SecurityTool | null> {
        try {
            const result = execSync('csrutil status', { encoding: 'utf8' });
            return {
                name: 'System Integrity Protection',
                type: 'system_protection',
                vendor: 'Apple',
                status: result.includes('enabled') ? 'active' : 'inactive',
                integrationMethod: 'syslog',
                logSources: []
            };
        } catch (error) {
            return null;
        }
    }

    private async checkFirewall(): Promise<SecurityTool | null> {
        try {
            const result = execSync('/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate', 
                { encoding: 'utf8' });
            return {
                name: 'macOS Firewall',
                type: 'firewall',
                vendor: 'Apple',
                status: result.includes('enabled') ? 'active' : 'inactive',
                integrationMethod: 'syslog',
                logSources: []
            };
        } catch (error) {
            return null;
        }
    }

    private async checkCrowdStrike(): Promise<SecurityTool | null> {
        try {
            if (existsSync('/Applications/Falcon.app') || 
                await this.isProcessRunning('com.crowdstrike.falcon.Agent')) {
                return {
                    name: 'CrowdStrike Falcon',
                    type: 'edr',
                    vendor: 'CrowdStrike',
                    status: 'active',
                    integrationMethod: 'api',
                    logSources: [
                        {
                            id: 'crowdstrike-falcon-mac',
                            name: 'CrowdStrike Falcon EDR',
                            type: 'file',
                            path: '/var/log/crowdstrike/falcon.log',
                            format: 'json',
                            priority: 'high',
                            estimatedVolume: 500
                        }
                    ]
                };
            }
        } catch (error) {
            // Continue
        }
        return null;
    }

    private async checkSentinelOne(): Promise<SecurityTool | null> {
        try {
            if (existsSync('/Applications/SentinelOne.app') || 
                await this.isProcessRunning('com.sentinelone.sentineld')) {
                return {
                    name: 'SentinelOne',
                    type: 'edr',
                    vendor: 'SentinelOne',
                    status: 'active',
                    integrationMethod: 'api',
                    logSources: [
                        {
                            id: 'sentinelone-mac',
                            name: 'SentinelOne Agent',
                            type: 'file',
                            path: '/var/log/sentinelone/agent.log',
                            format: 'json',
                            priority: 'high',
                            estimatedVolume: 400
                        }
                    ]
                };
            }
        } catch (error) {
            // Continue
        }
        return null;
    }

    private async checkCarbonBlack(): Promise<SecurityTool | null> {
        try {
            if (existsSync('/Applications/Carbon Black Cloud.app') || 
                await this.isProcessRunning('com.bit9.carbonblack.daemon')) {
                return {
                    name: 'Carbon Black',
                    type: 'edr',
                    vendor: 'VMware',
                    status: 'active',
                    integrationMethod: 'api',
                    logSources: []
                };
            }
        } catch (error) {
            // Continue
        }
        return null;
    }

    private async checkSymantec(): Promise<SecurityTool | null> {
        try {
            if (existsSync('/Applications/Symantec Endpoint Protection.app')) {
                return {
                    name: 'Symantec Endpoint Protection',
                    type: 'antivirus',
                    vendor: 'Symantec',
                    status: 'active',
                    integrationMethod: 'api',
                    logSources: []
                };
            }
        } catch (error) {
            // Continue
        }
        return null;
    }

    private async checkMcAfee(): Promise<SecurityTool | null> {
        try {
            if (existsSync('/Applications/McAfee Endpoint Security for Mac.app')) {
                return {
                    name: 'McAfee Endpoint Security',
                    type: 'antivirus',
                    vendor: 'McAfee',
                    status: 'active',
                    integrationMethod: 'api',
                    logSources: []
                };
            }
        } catch (error) {
            // Continue
        }
        return null;
    }

    private async checkTrendMicro(): Promise<SecurityTool | null> {
        try {
            if (existsSync('/Applications/Trend Micro Security.app')) {
                return {
                    name: 'Trend Micro Security',
                    type: 'antivirus',
                    vendor: 'Trend Micro',
                    status: 'active',
                    integrationMethod: 'api',
                    logSources: []
                };
            }
        } catch (error) {
            // Continue
        }
        return null;
    }

    private async checkBitdefender(): Promise<SecurityTool | null> {
        try {
            if (existsSync('/Applications/Bitdefender Antivirus for Mac.app')) {
                return {
                    name: 'Bitdefender Antivirus',
                    type: 'antivirus',
                    vendor: 'Bitdefender',
                    status: 'active',
                    integrationMethod: 'api',
                    logSources: []
                };
            }
        } catch (error) {
            // Continue
        }
        return null;
    }

    private async checkMalwareBytes(): Promise<SecurityTool | null> {
        try {
            if (existsSync('/Applications/Malwarebytes.app')) {
                return {
                    name: 'Malwarebytes',
                    type: 'antivirus',
                    vendor: 'Malwarebytes',
                    status: 'active',
                    integrationMethod: 'api',
                    logSources: []
                };
            }
        } catch (error) {
            // Continue
        }
        return null;
    }

    private async checkJamf(): Promise<SecurityTool | null> {
        try {
            if (existsSync('/usr/local/bin/jamf') || 
                await this.isProcessRunning('com.jamfsoftware.jamf.daemon')) {
                return {
                    name: 'Jamf Pro',
                    type: 'mdm',
                    vendor: 'Jamf',
                    status: 'active',
                    integrationMethod: 'api',
                    logSources: [
                        {
                            id: 'jamf-policy',
                            name: 'Jamf Policy Logs',
                            type: 'file',
                            path: '/var/log/jamf.log',
                            format: 'text',
                            priority: 'medium',
                            estimatedVolume: 200
                        }
                    ]
                };
            }
        } catch (error) {
            // Continue
        }
        return null;
    }

    private async checkKandji(): Promise<SecurityTool | null> {
        try {
            if (await this.isProcessRunning('io.kandji.KandjiAgent')) {
                return {
                    name: 'Kandji',
                    type: 'mdm',
                    vendor: 'Kandji',
                    status: 'active',
                    integrationMethod: 'api',
                    logSources: []
                };
            }
        } catch (error) {
            // Continue
        }
        return null;
    }

    private async checkMosyle(): Promise<SecurityTool | null> {
        try {
            if (await this.isProcessRunning('com.mosyle.management.agent')) {
                return {
                    name: 'Mosyle',
                    type: 'mdm',
                    vendor: 'Mosyle',
                    status: 'active',
                    integrationMethod: 'api',
                    logSources: []
                };
            }
        } catch (error) {
            // Continue
        }
        return null;
    }

    // Log source identification methods

    private async getSystemLogs(): Promise<LogSource[]> {
        const logs: LogSource[] = [];

        // Unified Logging (macOS 10.12+)
        logs.push({
            id: 'macos-unified-log',
            name: 'macOS Unified Log',
            type: 'syslog',
            path: 'unified-log',
            format: 'json',
            priority: 'high',
            estimatedVolume: 1000,
            parser: 'macos_log'
        });

        // System.log (legacy)
        if (existsSync('/var/log/system.log')) {
            logs.push({
                id: 'system-log',
                name: 'System Log',
                type: 'file',
                path: '/var/log/system.log',
                format: 'text',
                priority: 'high',
                estimatedVolume: 500
            });
        }

        // Security events
        logs.push({
            id: 'security-events',
            name: 'Security Events',
            type: 'syslog',
            path: 'security-events',
            format: 'json',
            priority: 'critical',
            estimatedVolume: 200,
            parser: 'macos_security'
        });

        // Network logs
        logs.push({
            id: 'network-events',
            name: 'Network Events',
            type: 'syslog',
            path: 'network-events',
            format: 'json',
            priority: 'medium',
            estimatedVolume: 300,
            parser: 'macos_network'
        });

        return logs;
    }

    private async getSecurityToolLogs(tool: SecurityTool): Promise<LogSource[]> {
        return tool.logSources || [];
    }

    private async getApplicationLogs(): Promise<LogSource[]> {
        const logs: LogSource[] = [];

        // Application crash logs
        if (existsSync('/Users/*/Library/Logs/DiagnosticReports')) {
            logs.push({
                id: 'crash-reports',
                name: 'Application Crash Reports',
                type: 'file',
                path: '/Users/*/Library/Logs/DiagnosticReports/*.crash',
                format: 'text',
                priority: 'medium',
                estimatedVolume: 50
            });
        }

        // Console logs
        logs.push({
            id: 'console-logs',
            name: 'Console Application Logs',
            type: 'syslog',
            path: 'console-logs',
            format: 'json',
            priority: 'low',
            estimatedVolume: 100,
            parser: 'macos_console'
        });

        return logs;
    }

    private async getWebServerLogs(): Promise<LogSource[]> {
        const logs: LogSource[] = [];

        // Apache logs (if installed via Homebrew)
        const apachePaths = [
            '/opt/homebrew/var/log/httpd',
            '/usr/local/var/log/httpd'
        ];

        for (const path of apachePaths) {
            if (existsSync(`${path}/access_log`)) {
                logs.push({
                    id: 'apache-access-mac',
                    name: 'Apache Access Log',
                    type: 'file',
                    path: `${path}/access_log`,
                    format: 'text',
                    priority: 'medium',
                    estimatedVolume: 1000
                });
            }
            if (existsSync(`${path}/error_log`)) {
                logs.push({
                    id: 'apache-error-mac',
                    name: 'Apache Error Log',
                    type: 'file',
                    path: `${path}/error_log`,
                    format: 'text',
                    priority: 'high',
                    estimatedVolume: 100
                });
            }
        }

        // Nginx logs (if installed via Homebrew)
        const nginxPaths = [
            '/opt/homebrew/var/log/nginx',
            '/usr/local/var/log/nginx'
        ];

        for (const path of nginxPaths) {
            if (existsSync(`${path}/access.log`)) {
                logs.push({
                    id: 'nginx-access-mac',
                    name: 'Nginx Access Log',
                    type: 'file',
                    path: `${path}/access.log`,
                    format: 'text',
                    priority: 'medium',
                    estimatedVolume: 1000
                });
            }
            if (existsSync(`${path}/error.log`)) {
                logs.push({
                    id: 'nginx-error-mac',
                    name: 'Nginx Error Log',
                    type: 'file',
                    path: `${path}/error.log`,
                    format: 'text',
                    priority: 'high',
                    estimatedVolume: 100
                });
            }
        }

        return logs;
    }

    // Compliance detection methods

    private async detectPaymentSoftware(): Promise<string[]> {
        const paymentSoftware: string[] = [];
        
        // Check for payment processing applications
        const paymentApps = [
            'Square Point of Sale',
            'PayPal Here',
            'Stripe Terminal',
            'QuickBooks Payments'
        ];

        for (const app of paymentApps) {
            if (existsSync(`/Applications/${app}.app`)) {
                paymentSoftware.push(app);
            }
        }

        return paymentSoftware;
    }

    private async detectHealthcareSoftware(): Promise<string[]> {
        const healthcareSoftware: string[] = [];
        
        // Check for healthcare applications
        const healthcareApps = [
            'Epic',
            'Cerner PowerChart',
            'Allscripts',
            'athenaCollector'
        ];

        for (const app of healthcareApps) {
            if (existsSync(`/Applications/${app}.app`)) {
                healthcareSoftware.push(app);
            }
        }

        return healthcareSoftware;
    }

    private async detectFinancialSoftware(): Promise<string[]> {
        const financialSoftware: string[] = [];
        
        // Check for financial applications
        const financialApps = [
            'QuickBooks',
            'Sage 50cloud',
            'NetSuite',
            'Xero'
        ];

        for (const app of financialApps) {
            if (existsSync(`/Applications/${app}.app`)) {
                financialSoftware.push(app);
            }
        }

        return financialSoftware;
    }

    private async isProcessRunning(processName: string): Promise<boolean> {
        try {
            const result = execSync(`pgrep -f "${processName}"`, { encoding: 'utf8' });
            return result.trim().length > 0;
        } catch {
            return false;
        }
    }
}