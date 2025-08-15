/**
 * ThreatGuard Agent - Health Monitor
 * Comprehensive system and agent health monitoring
 */

import { EventEmitter } from 'events';
import { Logger } from './logger';
import { 
    AgentOptions,
    HealthStatus,
    HealthMetric,
    HealthAlert,
    SystemHealth,
    AgentHealth,
    ComponentHealth,
    PerformanceMetrics,
    ResourceUsage
} from './types';
import { cpus, freemem, totalmem, loadavg } from 'os';
import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';

export class HealthMonitor extends EventEmitter {
    private logger: Logger;
    private options: AgentOptions;
    private isRunning: boolean = false;
    private monitorInterval: NodeJS.Timeout | null = null;
    private metrics: Map<string, HealthMetric[]> = new Map();
    private alerts: HealthAlert[] = [];
    private lastResourceUsage: ResourceUsage | null = null;

    // Health thresholds
    private readonly thresholds = {
        cpu: {
            warning: 70,
            critical: 85
        },
        memory: {
            warning: 80,
            critical: 90
        },
        disk: {
            warning: 85,
            critical: 95
        },
        network: {
            warning: 80,
            critical: 95
        },
        errorRate: {
            warning: 5,
            critical: 10
        }
    };

    constructor(options: AgentOptions) {
        super();
        this.options = options;
        this.logger = new Logger('HealthMonitor');
    }

    /**
     * Start health monitoring
     */
    public async start(): Promise<void> {
        try {
            if (this.isRunning) {
                this.logger.warn('⚠️ Health monitor is already running');
                return;
            }

            this.logger.info('🔍 Starting health monitor...');

            // Perform initial health check
            await this.performHealthCheck();

            // Start periodic monitoring
            this.monitorInterval = setInterval(async () => {
                try {
                    await this.performHealthCheck();
                } catch (error) {
                    this.logger.error('Health check failed:', error);
                }
            }, 30000); // Every 30 seconds

            this.isRunning = true;
            this.emit('monitor-started');

            this.logger.info('✅ Health monitor started successfully');

        } catch (error) {
            this.logger.error('❌ Failed to start health monitor:', error);
            throw error;
        }
    }

    /**
     * Stop health monitoring
     */
    public async stop(): Promise<void> {
        try {
            if (!this.isRunning) {
                this.logger.warn('⚠️ Health monitor is not running');
                return;
            }

            this.logger.info('🛑 Stopping health monitor...');

            if (this.monitorInterval) {
                clearInterval(this.monitorInterval);
                this.monitorInterval = null;
            }

            this.isRunning = false;
            this.emit('monitor-stopped');

            this.logger.info('✅ Health monitor stopped successfully');

        } catch (error) {
            this.logger.error('❌ Failed to stop health monitor:', error);
            throw error;
        }
    }

    /**
     * Get current health status
     */
    public async getHealthStatus(): Promise<HealthStatus> {
        try {
            const [systemHealth, agentHealth] = await Promise.all([
                this.getSystemHealth(),
                this.getAgentHealth()
            ]);

            // Determine overall health
            const overallStatus = this.determineOverallHealth(systemHealth, agentHealth);

            const healthStatus: HealthStatus = {
                overall: overallStatus,
                timestamp: new Date().toISOString(),
                system: systemHealth,
                agent: agentHealth,
                alerts: this.getActiveAlerts(),
                uptime: this.getUptime()
            };

            return healthStatus;

        } catch (error) {
            this.logger.error('Failed to get health status:', error);
            throw error;
        }
    }

    /**
     * Get performance metrics
     */
    public getPerformanceMetrics(): PerformanceMetrics {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        return {
            cpu: this.getMetricHistory('cpu_usage', oneHourAgo, now),
            memory: this.getMetricHistory('memory_usage', oneHourAgo, now),
            disk: this.getMetricHistory('disk_usage', oneHourAgo, now),
            network: this.getMetricHistory('network_usage', oneHourAgo, now),
            events: this.getMetricHistory('events_processed', oneHourAgo, now),
            errors: this.getMetricHistory('error_count', oneHourAgo, now)
        };
    }

    /**
     * Add custom health metric
     */
    public addMetric(name: string, value: number, metadata?: any): void {
        const metric: HealthMetric = {
            name,
            value,
            timestamp: new Date().toISOString(),
            metadata
        };

        if (!this.metrics.has(name)) {
            this.metrics.set(name, []);
        }

        const metrics = this.metrics.get(name)!;
        metrics.push(metric);

        // Keep only last 1000 metrics per type
        if (metrics.length > 1000) {
            metrics.splice(0, metrics.length - 1000);
        }

        // Check thresholds and generate alerts
        this.checkThresholds(metric);
    }

    /**
     * Perform comprehensive health check
     */
    private async performHealthCheck(): Promise<void> {
        try {
            // Collect system metrics
            await this.collectSystemMetrics();

            // Collect agent metrics
            await this.collectAgentMetrics();

            // Clean old metrics and alerts
            this.cleanOldData();

            this.emit('health-check-completed');

        } catch (error) {
            this.logger.error('Health check error:', error);
            this.emit('health-check-failed', error);
        }
    }

    /**
     * Collect system metrics
     */
    private async collectSystemMetrics(): Promise<void> {
        try {
            // CPU metrics
            const cpuUsage = await this.getCPUUsage();
            this.addMetric('cpu_usage', cpuUsage);

            // Memory metrics
            const memoryUsage = this.getMemoryUsage();
            this.addMetric('memory_usage', memoryUsage.percent);
            this.addMetric('memory_used_mb', memoryUsage.used);
            this.addMetric('memory_available_mb', memoryUsage.available);

            // Disk metrics
            const diskUsage = await this.getDiskUsage();
            this.addMetric('disk_usage', diskUsage.percent);
            this.addMetric('disk_used_gb', diskUsage.used);
            this.addMetric('disk_available_gb', diskUsage.available);

            // Network metrics
            const networkUsage = await this.getNetworkUsage();
            this.addMetric('network_usage', networkUsage.percent);
            this.addMetric('network_bytes_in', networkUsage.bytesIn);
            this.addMetric('network_bytes_out', networkUsage.bytesOut);

            // Load average (Unix-like systems)
            if (process.platform !== 'win32') {
                const load = loadavg();
                this.addMetric('load_1min', load[0]);
                this.addMetric('load_5min', load[1]);
                this.addMetric('load_15min', load[2]);
            }

        } catch (error) {
            this.logger.error('Failed to collect system metrics:', error);
        }
    }

    /**
     * Collect agent-specific metrics
     */
    private async collectAgentMetrics(): Promise<void> {
        try {
            // Process metrics
            const processMetrics = process.memoryUsage();
            this.addMetric('agent_memory_rss', processMetrics.rss / 1024 / 1024); // MB
            this.addMetric('agent_memory_heap_used', processMetrics.heapUsed / 1024 / 1024); // MB
            this.addMetric('agent_memory_heap_total', processMetrics.heapTotal / 1024 / 1024); // MB

            // CPU time
            const cpuUsage = process.cpuUsage();
            this.addMetric('agent_cpu_user', cpuUsage.user / 1000); // ms
            this.addMetric('agent_cpu_system', cpuUsage.system / 1000); // ms

            // Event loop lag
            const eventLoopLag = await this.measureEventLoopLag();
            this.addMetric('agent_event_loop_lag', eventLoopLag);

            // File descriptor usage (Unix-like systems)
            if (process.platform !== 'win32') {
                const fdCount = await this.getFileDescriptorCount();
                this.addMetric('agent_file_descriptors', fdCount);
            }

        } catch (error) {
            this.logger.error('Failed to collect agent metrics:', error);
        }
    }

    /**
     * Get CPU usage percentage
     */
    private async getCPUUsage(): Promise<number> {
        try {
            if (process.platform === 'win32') {
                // Windows: Use wmic
                const result = execSync('wmic cpu get loadpercentage /value', { encoding: 'utf8' });
                const match = result.match(/LoadPercentage=(\d+)/);
                return match ? parseInt(match[1]) : 0;
            } else {
                // Unix-like: Calculate from /proc/stat or use top
                if (existsSync('/proc/stat')) {
                    return await this.getCPUUsageFromProc();
                } else {
                    // macOS fallback
                    const result = execSync('top -l 1 -n 0 | grep "CPU usage"', { encoding: 'utf8' });
                    const match = result.match(/(\d+\.\d+)% user/);
                    return match ? parseFloat(match[1]) : 0;
                }
            }
        } catch (error) {
            return 0;
        }
    }

    /**
     * Get CPU usage from /proc/stat (Linux)
     */
    private async getCPUUsageFromProc(): Promise<number> {
        try {
            const stat1 = await fs.readFile('/proc/stat', 'utf8');
            await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
            const stat2 = await fs.readFile('/proc/stat', 'utf8');

            const line1 = stat1.split('\n')[0];
            const line2 = stat2.split('\n')[0];

            const values1 = line1.split(/\s+/).slice(1).map(Number);
            const values2 = line2.split(/\s+/).slice(1).map(Number);

            const idle1 = values1[3];
            const idle2 = values2[3];

            const total1 = values1.reduce((a, b) => a + b, 0);
            const total2 = values2.reduce((a, b) => a + b, 0);

            const totalDiff = total2 - total1;
            const idleDiff = idle2 - idle1;

            return totalDiff > 0 ? ((totalDiff - idleDiff) / totalDiff) * 100 : 0;

        } catch (error) {
            return 0;
        }
    }

    /**
     * Get memory usage
     */
    private getMemoryUsage(): { percent: number; used: number; available: number } {
        const total = totalmem();
        const free = freemem();
        const used = total - free;

        return {
            percent: (used / total) * 100,
            used: Math.round(used / 1024 / 1024), // MB
            available: Math.round(free / 1024 / 1024) // MB
        };
    }

    /**
     * Get disk usage
     */
    private async getDiskUsage(): Promise<{ percent: number; used: number; available: number }> {
        try {
            let result: string;
            
            if (process.platform === 'win32') {
                result = execSync('wmic logicaldisk where size!=0 get size,freespace,caption', 
                    { encoding: 'utf8' });
                // Parse Windows disk info (simplified)
                return { percent: 50, used: 100, available: 100 }; // Placeholder
            } else {
                result = execSync('df / | tail -n1', { encoding: 'utf8' });
                const parts = result.trim().split(/\s+/);
                const total = parseInt(parts[1]) * 1024; // Convert from KB to bytes
                const used = parseInt(parts[2]) * 1024;
                const available = parseInt(parts[3]) * 1024;

                return {
                    percent: (used / total) * 100,
                    used: Math.round(used / 1024 / 1024 / 1024), // GB
                    available: Math.round(available / 1024 / 1024 / 1024) // GB
                };
            }
        } catch (error) {
            return { percent: 0, used: 0, available: 0 };
        }
    }

    /**
     * Get network usage (simplified implementation)
     */
    private async getNetworkUsage(): Promise<{ percent: number; bytesIn: number; bytesOut: number }> {
        try {
            // This would implement actual network usage monitoring
            // For now, return mock data
            return {
                percent: Math.random() * 20, // Random low usage
                bytesIn: Math.floor(Math.random() * 1000000),
                bytesOut: Math.floor(Math.random() * 500000)
            };
        } catch (error) {
            return { percent: 0, bytesIn: 0, bytesOut: 0 };
        }
    }

    /**
     * Measure event loop lag
     */
    private async measureEventLoopLag(): Promise<number> {
        const start = process.hrtime.bigint();
        
        return new Promise(resolve => {
            setImmediate(() => {
                const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
                resolve(lag);
            });
        });
    }

    /**
     * Get file descriptor count (Unix-like systems)
     */
    private async getFileDescriptorCount(): Promise<number> {
        try {
            if (existsSync('/proc/self/fd')) {
                const fds = await fs.readdir('/proc/self/fd');
                return fds.length;
            }
            return 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Get system health summary
     */
    private async getSystemHealth(): Promise<SystemHealth> {
        const currentMetrics = {
            cpu: this.getLatestMetric('cpu_usage')?.value || 0,
            memory: this.getLatestMetric('memory_usage')?.value || 0,
            disk: this.getLatestMetric('disk_usage')?.value || 0,
            network: this.getLatestMetric('network_usage')?.value || 0
        };

        return {
            status: this.getComponentStatus('system'),
            cpu: {
                usage: currentMetrics.cpu,
                status: this.getHealthStatus(currentMetrics.cpu, this.thresholds.cpu)
            },
            memory: {
                usage: currentMetrics.memory,
                status: this.getHealthStatus(currentMetrics.memory, this.thresholds.memory)
            },
            disk: {
                usage: currentMetrics.disk,
                status: this.getHealthStatus(currentMetrics.disk, this.thresholds.disk)
            },
            network: {
                usage: currentMetrics.network,
                status: this.getHealthStatus(currentMetrics.network, this.thresholds.network)
            }
        };
    }

    /**
     * Get agent health summary
     */
    private async getAgentHealth(): Promise<AgentHealth> {
        const components: ComponentHealth[] = [
            {
                name: 'Discovery Engine',
                status: 'healthy', // Would be determined by actual component state
                lastCheck: new Date().toISOString()
            },
            {
                name: 'Fluent Bit Manager',
                status: 'healthy',
                lastCheck: new Date().toISOString()
            },
            {
                name: 'Management Service',
                status: 'healthy',
                lastCheck: new Date().toISOString()
            },
            {
                name: 'Configuration Manager',
                status: 'healthy',
                lastCheck: new Date().toISOString()
            }
        ];

        const overallStatus = components.every(c => c.status === 'healthy') ? 'healthy' : 'degraded';

        return {
            status: overallStatus,
            components,
            performance: {
                memoryUsage: this.getLatestMetric('agent_memory_rss')?.value || 0,
                cpuUsage: 0, // Would calculate from CPU metrics
                eventLoopLag: this.getLatestMetric('agent_event_loop_lag')?.value || 0
            }
        };
    }

    /**
     * Determine overall health status
     */
    private determineOverallHealth(system: SystemHealth, agent: AgentHealth): 'healthy' | 'warning' | 'critical' | 'unknown' {
        if (system.status === 'critical' || agent.status === 'critical') {
            return 'critical';
        }
        if (system.status === 'warning' || agent.status === 'warning' || agent.status === 'degraded') {
            return 'warning';
        }
        if (system.status === 'healthy' && agent.status === 'healthy') {
            return 'healthy';
        }
        return 'unknown';
    }

    /**
     * Get health status based on value and thresholds
     */
    private getHealthStatus(value: number, thresholds: { warning: number; critical: number }): 'healthy' | 'warning' | 'critical' {
        if (value >= thresholds.critical) return 'critical';
        if (value >= thresholds.warning) return 'warning';
        return 'healthy';
    }

    /**
     * Get component status
     */
    private getComponentStatus(component: string): 'healthy' | 'warning' | 'critical' | 'unknown' {
        // This would check actual component health
        // For now, return based on recent metrics
        return 'healthy';
    }

    /**
     * Check thresholds and generate alerts
     */
    private checkThresholds(metric: HealthMetric): void {
        let threshold: { warning: number; critical: number } | undefined;

        // Map metrics to thresholds
        switch (metric.name) {
            case 'cpu_usage':
                threshold = this.thresholds.cpu;
                break;
            case 'memory_usage':
                threshold = this.thresholds.memory;
                break;
            case 'disk_usage':
                threshold = this.thresholds.disk;
                break;
            case 'network_usage':
                threshold = this.thresholds.network;
                break;
        }

        if (!threshold) return;

        let severity: 'warning' | 'critical' | null = null;
        if (metric.value >= threshold.critical) {
            severity = 'critical';
        } else if (metric.value >= threshold.warning) {
            severity = 'warning';
        }

        if (severity) {
            const alert: HealthAlert = {
                id: `${metric.name}-${Date.now()}`,
                severity,
                component: metric.name,
                message: `${metric.name} is ${severity}: ${metric.value}%`,
                timestamp: metric.timestamp,
                resolved: false,
                metadata: metric.metadata
            };

            this.alerts.push(alert);
            this.emit('health-alert', alert);

            this.logger.warn(`🚨 Health Alert [${severity.toUpperCase()}]: ${alert.message}`);
        }
    }

    /**
     * Get latest metric value
     */
    private getLatestMetric(name: string): HealthMetric | undefined {
        const metrics = this.metrics.get(name);
        return metrics && metrics.length > 0 ? metrics[metrics.length - 1] : undefined;
    }

    /**
     * Get metric history
     */
    private getMetricHistory(name: string, from: Date, to: Date): HealthMetric[] {
        const metrics = this.metrics.get(name) || [];
        return metrics.filter(m => {
            const timestamp = new Date(m.timestamp);
            return timestamp >= from && timestamp <= to;
        });
    }

    /**
     * Get active alerts
     */
    private getActiveAlerts(): HealthAlert[] {
        return this.alerts.filter(alert => !alert.resolved);
    }

    /**
     * Get uptime in seconds
     */
    private getUptime(): number {
        return process.uptime();
    }

    /**
     * Clean old metrics and alerts
     */
    private cleanOldData(): void {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        // Clean old metrics (keep last hour)
        for (const [name, metrics] of this.metrics) {
            const filtered = metrics.filter(m => new Date(m.timestamp) > oneHourAgo);
            this.metrics.set(name, filtered);
        }

        // Clean old resolved alerts (keep for 24 hours)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        this.alerts = this.alerts.filter(alert => 
            !alert.resolved || new Date(alert.timestamp) > oneDayAgo
        );
    }
}