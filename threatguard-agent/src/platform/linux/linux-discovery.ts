/**
 * ThreatGuard Agent - Linux Discovery
 * Linux-specific system discovery implementation
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

export class LinuxDiscovery {
    private logger: Logger;
    private options: AgentOptions;

    constructor(options: AgentOptions) {
        this.options = options;
        this.logger = new Logger('LinuxDiscovery');
    }

    /**
     * Gather Linux-specific system information
     */
    public async gatherSystemInfo(): Promise<Partial<SystemInfo>> {
        this.logger.debug('📊 Gathering Linux system information...');

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
            this.logger.error('❌ Failed to gather Linux system info:', error);
            throw error;
        }
    }

    /**
     * Discover Linux security tools
     */
    public async discoverSecurityTools(): Promise<SecurityTool[]> {
        this.logger.debug('🛡️ Discovering Linux security tools...');

        const securityTools: SecurityTool[] = [];

        try {
            // Check for common Linux security tools
            const toolChecks = [
                this.checkCrowdStrike(),
                this.checkSentinelOne(),
                this.checkCarbonBlack(),
                this.checkTrendMicro(),
                this.checkSymantec(),
                this.checkMcAfee(),
                this.checkOSSEC(),
                this.checkWazuh(),
                this.checkFail2Ban(),
                this.checkAppArmor(),
                this.checkSELinux(),
                this.checkIptables(),
                this.checkFirewalld(),
                this.checkUFW()
            ];

            const results = await Promise.allSettled(toolChecks);
            
            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    securityTools.push(result.value);
                }
            });

            return securityTools;

        } catch (error) {
            this.logger.error('❌ Failed to discover Linux security tools:', error);
            return securityTools;
        }
    }

    /**
     * Identify Linux log sources
     */
    public async identifyLogSources(securityTools: SecurityTool[]): Promise<LogSource[]> {
        this.logger.debug('📋 Identifying Linux log sources...');

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

            // Container logs
            const containerLogs = await this.getContainerLogs();
            logSources.push(...containerLogs);

            return logSources;

        } catch (error) {
            this.logger.error('❌ Failed to identify Linux log sources:', error);
            return logSources;
        }
    }

    /**
     * Analyze compliance requirements for Linux
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
            const hasEnterpriseTools = securityTools.some(tool => 
                ['edr', 'siem', 'dlp'].includes(tool.type)
            );
            if (hasEnterpriseTools) {
                requirements.push('iso_27001');
            }

            return requirements;

        } catch (error) {
            this.logger.error('❌ Failed to analyze Linux compliance requirements:', error);
            return requirements;
        }
    }

    // Private helper methods

    private async getOSDistribution(): Promise<string> {
        try {
            // Try /etc/os-release first (standard)
            if (existsSync('/etc/os-release')) {
                const content = await fs.readFile('/etc/os-release', 'utf8');
                const prettyName = content.match(/PRETTY_NAME="([^"]+)"/);
                if (prettyName) {
                    return prettyName[1];
                }
            }

            // Fallback to lsb_release
            try {
                const result = execSync('lsb_release -d -s', { encoding: 'utf8' });
                return result.trim().replace(/"/g, '');
            } catch {
                // Continue to next fallback
            }

            // Fallback to uname
            const result = execSync('uname -sr', { encoding: 'utf8' });
            return result.trim();

        } catch (error) {
            return 'Linux (Unknown Distribution)';
        }
    }

    private async getDiskSpace(): Promise<number> {
        try {
            const result = execSync('df / --output=avail -B1M | tail -n1', { encoding: 'utf8' });
            return parseInt(result.trim()) || 0;
        } catch (error) {
            return 0;
        }
    }

    private async getNetworkInterfaces(): Promise<NetworkInterface[]> {
        try {
            const interfaces: NetworkInterface[] = [];
            
            // Parse ip addr output
            const result = execSync('ip addr show', { encoding: 'utf8' });
            const lines = result.split('\n');
            
            let currentInterface: Partial<NetworkInterface> = {};
            
            for (const line of lines) {
                if (line.match(/^\d+:/)) {
                    // New interface
                    if (currentInterface.name) {
                        interfaces.push(currentInterface as NetworkInterface);
                    }
                    
                    const match = line.match(/^\d+: ([^:]+):/);
                    currentInterface = {
                        name: match ? match[1] : 'unknown',
                        type: 'ethernet' // Default
                    };
                } else if (line.includes('inet ')) {
                    // IPv4 address
                    const match = line.match(/inet ([^\/]+)/);
                    if (match && currentInterface) {
                        currentInterface.address = match[1];
                    }
                }
            }
            
            // Add last interface
            if (currentInterface.name) {
                interfaces.push(currentInterface as NetworkInterface);
            }

            return interfaces.filter(iface => 
                iface.name !== 'lo' && iface.address && iface.address !== '127.0.0.1'
            );

        } catch (error) {
            return [];
        }
    }

    private async getInstalledSoftware(): Promise<InstalledSoftware[]> {
        try {
            const software: InstalledSoftware[] = [];

            // Try different package managers
            const packageManagers = [
                { cmd: 'dpkg -l', parser: this.parseDpkgOutput.bind(this) },
                { cmd: 'rpm -qa', parser: this.parseRpmOutput.bind(this) },
                { cmd: 'pacman -Q', parser: this.parsePacmanOutput.bind(this) }
            ];

            for (const pm of packageManagers) {
                try {
                    const result = execSync(pm.cmd, { encoding: 'utf8' });
                    const packages = pm.parser(result);
                    software.push(...packages);
                    break; // Use first successful package manager
                } catch {
                    continue;
                }
            }

            return software;

        } catch (error) {
            return [];
        }
    }

    private parseDpkgOutput(output: string): InstalledSoftware[] {
        const packages: InstalledSoftware[] = [];
        const lines = output.split('\n');

        for (const line of lines) {
            if (line.startsWith('ii ')) {
                const parts = line.split(/\s+/);
                if (parts.length >= 3) {
                    packages.push({
                        name: parts[1],
                        version: parts[2],
                        vendor: 'Unknown',
                        category: 'package'
                    });
                }
            }
        }

        return packages;
    }

    private parseRpmOutput(output: string): InstalledSoftware[] {
        const packages: InstalledSoftware[] = [];
        const lines = output.split('\n');

        for (const line of lines) {
            if (line.trim()) {
                const match = line.match(/^([^-]+)-([^-]+)-(.+)$/);
                if (match) {
                    packages.push({
                        name: match[1],
                        version: match[2],
                        vendor: 'Unknown',
                        category: 'package'
                    });
                }
            }
        }

        return packages;
    }

    private parsePacmanOutput(output: string): InstalledSoftware[] {
        const packages: InstalledSoftware[] = [];
        const lines = output.split('\n');

        for (const line of lines) {
            if (line.trim()) {
                const parts = line.split(' ');
                if (parts.length >= 2) {
                    packages.push({
                        name: parts[0],
                        version: parts[1],
                        vendor: 'Unknown',
                        category: 'package'
                    });
                }
            }
        }

        return packages;
    }

    private async getRunningServices(): Promise<RunningService[]> {
        try {
            const services: RunningService[] = [];

            // Try systemctl first
            try {
                const result = execSync('systemctl list-units --type=service --state=running --no-pager', 
                    { encoding: 'utf8' });
                const lines = result.split('\n');

                for (const line of lines) {
                    const match = line.match(/^\s*([^\s]+)\.service\s+[^\s]+\s+[^\s]+\s+[^\s]+\s+(.+)$/);
                    if (match) {
                        services.push({
                            name: match[1],
                            displayName: match[2],
                            status: 'running',
                            startType: 'auto',
                            logSources: []
                        });
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
            osquerySupport: existsSync('/usr/bin/osqueryi'),
            containerRuntime: existsSync('/usr/bin/docker') || existsSync('/usr/bin/podman'),
            virtualizationSupport: existsSync('/proc/xen') || existsSync('/sys/hypervisor'),
            networkMonitoring: true,
            performanceCounters: false,
            registryAccess: false,
            fileSystemMonitoring: true
        };
    }

    // Security tool detection methods

    private async checkCrowdStrike(): Promise<SecurityTool | null> {
        try {
            if (existsSync('/opt/CrowdStrike') || await this.isProcessRunning('falcon-sensor')) {
                return {
                    name: 'CrowdStrike Falcon',
                    type: 'edr',
                    vendor: 'CrowdStrike',
                    status: 'active',
                    integrationMethod: 'api',
                    logSources: [
                        {
                            id: 'crowdstrike-falcon',
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
            if (existsSync('/opt/sentinelone') || await this.isProcessRunning('sentinelctl')) {
                return {
                    name: 'SentinelOne',
                    type: 'edr',
                    vendor: 'SentinelOne',
                    status: 'active',
                    integrationMethod: 'api',
                    logSources: [
                        {
                            id: 'sentinelone-agent',
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
            if (existsSync('/opt/carbonblack') || await this.isProcessRunning('cb-psc-sensor')) {
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

    private async checkTrendMicro(): Promise<SecurityTool | null> {
        try {
            if (existsSync('/opt/TrendMicro') || await this.isProcessRunning('ds_agent')) {
                return {
                    name: 'Trend Micro Deep Security',
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

    private async checkSymantec(): Promise<SecurityTool | null> {
        try {
            if (existsSync('/opt/Symantec') || await this.isProcessRunning('sepagent')) {
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
            if (existsSync('/opt/McAfee') || await this.isProcessRunning('mfetpd')) {
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

    private async checkOSSEC(): Promise<SecurityTool | null> {
        try {
            if (existsSync('/var/ossec') || await this.isProcessRunning('ossec-monitord')) {
                return {
                    name: 'OSSEC HIDS',
                    type: 'hids',
                    vendor: 'OSSEC',
                    status: 'active',
                    integrationMethod: 'file',
                    logSources: [
                        {
                            id: 'ossec-alerts',
                            name: 'OSSEC Alerts',
                            type: 'file',
                            path: '/var/ossec/logs/alerts/alerts.log',
                            format: 'text',
                            priority: 'high',
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

    private async checkWazuh(): Promise<SecurityTool | null> {
        try {
            if (existsSync('/var/ossec/bin/wazuh-control') || await this.isProcessRunning('wazuh-monitord')) {
                return {
                    name: 'Wazuh',
                    type: 'hids',
                    vendor: 'Wazuh',
                    status: 'active',
                    integrationMethod: 'api',
                    logSources: [
                        {
                            id: 'wazuh-alerts',
                            name: 'Wazuh Alerts',
                            type: 'file',
                            path: '/var/ossec/logs/alerts/alerts.json',
                            format: 'json',
                            priority: 'high',
                            estimatedVolume: 300
                        }
                    ]
                };
            }
        } catch (error) {
            // Continue
        }
        return null;
    }

    private async checkFail2Ban(): Promise<SecurityTool | null> {
        try {
            if (await this.isProcessRunning('fail2ban-server')) {
                return {
                    name: 'Fail2Ban',
                    type: 'ips',
                    vendor: 'Fail2Ban',
                    status: 'active',
                    integrationMethod: 'file',
                    logSources: [
                        {
                            id: 'fail2ban-log',
                            name: 'Fail2Ban',
                            type: 'file',
                            path: '/var/log/fail2ban.log',
                            format: 'text',
                            priority: 'medium',
                            estimatedVolume: 100
                        }
                    ]
                };
            }
        } catch (error) {
            // Continue
        }
        return null;
    }

    private async checkAppArmor(): Promise<SecurityTool | null> {
        try {
            if (existsSync('/sys/kernel/security/apparmor')) {
                return {
                    name: 'AppArmor',
                    type: 'mac',
                    vendor: 'Canonical',
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

    private async checkSELinux(): Promise<SecurityTool | null> {
        try {
            if (existsSync('/sys/fs/selinux')) {
                const status = execSync('getenforce 2>/dev/null || echo Disabled', { encoding: 'utf8' }).trim();
                return {
                    name: 'SELinux',
                    type: 'mac',
                    vendor: 'NSA/Red Hat',
                    status: status === 'Enforcing' ? 'active' : 'inactive',
                    integrationMethod: 'syslog',
                    logSources: []
                };
            }
        } catch (error) {
            // Continue
        }
        return null;
    }

    private async checkIptables(): Promise<SecurityTool | null> {
        try {
            const rules = execSync('iptables -L -n 2>/dev/null | wc -l', { encoding: 'utf8' });
            if (parseInt(rules.trim()) > 10) {
                return {
                    name: 'iptables',
                    type: 'firewall',
                    vendor: 'Netfilter Project',
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

    private async checkFirewalld(): Promise<SecurityTool | null> {
        try {
            if (await this.isProcessRunning('firewalld')) {
                return {
                    name: 'firewalld',
                    type: 'firewall',
                    vendor: 'Red Hat',
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

    private async checkUFW(): Promise<SecurityTool | null> {
        try {
            const status = execSync('ufw status 2>/dev/null', { encoding: 'utf8' });
            if (status.includes('Status: active')) {
                return {
                    name: 'UFW',
                    type: 'firewall',
                    vendor: 'Canonical',
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

    // Log source identification methods

    private async getSystemLogs(): Promise<LogSource[]> {
        const logs: LogSource[] = [];

        // Common Linux system logs
        const systemLogPaths = [
            { path: '/var/log/syslog', name: 'System Log', priority: 'high' as const },
            { path: '/var/log/auth.log', name: 'Authentication Log', priority: 'critical' as const },
            { path: '/var/log/kern.log', name: 'Kernel Log', priority: 'high' as const },
            { path: '/var/log/daemon.log', name: 'Daemon Log', priority: 'medium' as const },
            { path: '/var/log/mail.log', name: 'Mail Log', priority: 'low' as const },
            { path: '/var/log/cron.log', name: 'Cron Log', priority: 'low' as const },
            { path: '/var/log/messages', name: 'System Messages', priority: 'high' as const },
            { path: '/var/log/secure', name: 'Security Log', priority: 'critical' as const }
        ];

        for (const logPath of systemLogPaths) {
            if (existsSync(logPath.path)) {
                logs.push({
                    id: logPath.path.replace(/[\/\.]/g, '_'),
                    name: logPath.name,
                    type: 'file',
                    path: logPath.path,
                    format: 'text',
                    priority: logPath.priority,
                    estimatedVolume: 100
                });
            }
        }

        // Journald logs
        if (existsSync('/bin/journalctl')) {
            logs.push({
                id: 'systemd-journal',
                name: 'Systemd Journal',
                type: 'syslog',
                path: 'journald',
                format: 'json',
                priority: 'high',
                estimatedVolume: 500
            });
        }

        return logs;
    }

    private async getSecurityToolLogs(tool: SecurityTool): Promise<LogSource[]> {
        return tool.logSources || [];
    }

    private async getApplicationLogs(): Promise<LogSource[]> {
        const logs: LogSource[] = [];

        // Common application log directories
        const appLogDirs = [
            '/var/log/apache2',
            '/var/log/httpd',
            '/var/log/nginx',
            '/var/log/mysql',
            '/var/log/postgresql'
        ];

        for (const dir of appLogDirs) {
            if (existsSync(dir)) {
                try {
                    const files = await fs.readdir(dir);
                    for (const file of files) {
                        if (file.endsWith('.log')) {
                            logs.push({
                                id: `${dir}_${file}`.replace(/[\/\.]/g, '_'),
                                name: `${dir.split('/').pop()} - ${file}`,
                                type: 'file',
                                path: `${dir}/${file}`,
                                format: 'text',
                                priority: 'medium',
                                estimatedVolume: 200
                            });
                        }
                    }
                } catch (error) {
                    // Skip directory if can't read
                }
            }
        }

        return logs;
    }

    private async getWebServerLogs(): Promise<LogSource[]> {
        const logs: LogSource[] = [];

        // Apache logs
        const apacheDirs = ['/var/log/apache2', '/var/log/httpd'];
        for (const dir of apacheDirs) {
            if (existsSync(`${dir}/access.log`)) {
                logs.push({
                    id: 'apache_access',
                    name: 'Apache Access Log',
                    type: 'file',
                    path: `${dir}/access.log`,
                    format: 'text',
                    priority: 'medium',
                    estimatedVolume: 1000
                });
            }
            if (existsSync(`${dir}/error.log`)) {
                logs.push({
                    id: 'apache_error',
                    name: 'Apache Error Log',
                    type: 'file',
                    path: `${dir}/error.log`,
                    format: 'text',
                    priority: 'high',
                    estimatedVolume: 100
                });
            }
        }

        // Nginx logs
        if (existsSync('/var/log/nginx/access.log')) {
            logs.push({
                id: 'nginx_access',
                name: 'Nginx Access Log',
                type: 'file',
                path: '/var/log/nginx/access.log',
                format: 'text',
                priority: 'medium',
                estimatedVolume: 1000
            });
        }
        if (existsSync('/var/log/nginx/error.log')) {
            logs.push({
                id: 'nginx_error',
                name: 'Nginx Error Log',
                type: 'file',
                path: '/var/log/nginx/error.log',
                format: 'text',
                priority: 'high',
                estimatedVolume: 100
            });
        }

        return logs;
    }

    private async getContainerLogs(): Promise<LogSource[]> {
        const logs: LogSource[] = [];

        // Docker logs
        if (existsSync('/var/lib/docker')) {
            logs.push({
                id: 'docker_daemon',
                name: 'Docker Daemon',
                type: 'api',
                path: 'docker-api',
                format: 'json',
                priority: 'medium',
                estimatedVolume: 300
            });
        }

        // Podman logs
        if (existsSync('/usr/bin/podman')) {
            logs.push({
                id: 'podman_logs',
                name: 'Podman Logs',
                type: 'api',
                path: 'podman-api',
                format: 'json',
                priority: 'medium',
                estimatedVolume: 200
            });
        }

        return logs;
    }

    // Compliance detection methods

    private async detectPaymentSoftware(): Promise<string[]> {
        const paymentSoftware: string[] = [];
        
        // Check for common payment processing software
        const paymentProcessors = ['stripe', 'paypal', 'square', 'authorize.net'];
        
        // This would implement actual detection logic
        // For now, return empty array
        return paymentSoftware;
    }

    private async detectHealthcareSoftware(): Promise<string[]> {
        const healthcareSoftware: string[] = [];
        
        // Check for common healthcare software
        const healthcareApps = ['epic', 'cerner', 'allscripts', 'meditech'];
        
        // This would implement actual detection logic
        return healthcareSoftware;
    }

    private async detectFinancialSoftware(): Promise<string[]> {
        const financialSoftware: string[] = [];
        
        // Check for common financial software
        const financialApps = ['sap', 'oracle-financials', 'quickbooks', 'sage'];
        
        // This would implement actual detection logic
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