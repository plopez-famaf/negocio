/**
 * ThreatGuard Agent - Type Definitions
 * Comprehensive types for zero-config agent functionality
 */

export interface AgentOptions {
    debugMode?: boolean;
    customConfigPath?: string;
    dryRun?: boolean;
    forceDiscovery?: boolean;
    managementPort?: number;
    discoveryTimeout?: number;
}

export type AgentStatus = 
    | 'initializing'
    | 'starting'
    | 'discovering'
    | 'configuring'
    | 'starting-collection'
    | 'active'
    | 'reloading'
    | 'stopping'
    | 'stopped'
    | 'error';

export interface AgentConfig {
    agentId: string;
    version: string;
    organization: OrganizationInfo;
    profile: SecurityProfile;
    system: SystemInfo;
    collection: CollectionConfig;
    transmission: TransmissionConfig;
    management: ManagementConfig;
    security: SecurityConfig;
    performance: PerformanceConfig;
    generatedAt: string;
}

export interface OrganizationInfo {
    id: string;
    name: string;
    domain?: string;
    detectionMethod: 'domain' | 'certificate' | 'dns' | 'cloud' | 'manual';
    detectionConfidence: number;
    complianceRequirements: ComplianceFramework[];
}

export interface SecurityProfile {
    name: string;
    description: string;
    securityLevel: 'basic' | 'standard' | 'enhanced' | 'maximum';
    complianceProfiles: ComplianceFramework[];
    requiredSources: string[];
    filteringLevel: 'minimal' | 'standard' | 'aggressive';
    encryptionRequired: boolean;
    retentionPeriod: string;
}

export interface SystemInfo {
    hostname: string;
    platform: 'windows' | 'linux' | 'darwin';
    architecture: string;
    osVersion: string;
    osDistribution?: string;
    cpuCores: number;
    totalMemory: number;
    availableMemory: number;
    diskSpace: number;
    networkInterfaces: NetworkInterface[];
    installedSoftware: InstalledSoftware[];
    runningServices: RunningService[];
    securityTools: SecurityTool[];
    capabilities: SystemCapabilities;
}

export interface NetworkInterface {
    name: string;
    type: 'ethernet' | 'wireless' | 'virtual' | 'loopback';
    address: string;
    netmask: string;
    gateway?: string;
    dns?: string[];
    speed?: number;
}

export interface InstalledSoftware {
    name: string;
    version: string;
    vendor: string;
    category: 'security' | 'database' | 'web_server' | 'application' | 'system' | 'development';
    relevantLogs?: string[];
}

export interface RunningService {
    name: string;
    displayName?: string;
    status: 'running' | 'stopped' | 'starting' | 'stopping';
    pid?: number;
    startType: 'auto' | 'manual' | 'disabled';
    logSources?: LogSource[];
}

export interface SecurityTool {
    name: string;
    type: 'antivirus' | 'edr' | 'firewall' | 'ids' | 'dlp' | 'siem' | 'vulnerability_scanner';
    vendor: string;
    version?: string;
    status: 'active' | 'inactive' | 'partial';
    integrationMethod: 'api' | 'logs' | 'wmi' | 'registry' | 'files';
    logSources: LogSource[];
    apiEndpoints?: string[];
    configFiles?: string[];
}

export interface SystemCapabilities {
    windowsEventLogs: boolean;
    syslogGeneration: boolean;
    wmiQueries: boolean;
    osquerySupport: boolean;
    containerRuntime: boolean;
    virtualizationSupport: boolean;
    networkMonitoring: boolean;
    performanceCounters: boolean;
    registryAccess: boolean;
    fileSystemMonitoring: boolean;
}

export interface LogSource {
    id: string;
    name: string;
    type: 'file' | 'eventlog' | 'syslog' | 'api' | 'wmi' | 'database' | 'network';
    path: string;
    format: 'text' | 'json' | 'xml' | 'csv' | 'binary' | 'custom';
    parser?: string;
    rotationPattern?: string;
    encoding?: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    estimatedVolume: number; // events per hour
    retention?: string;
    compression?: boolean;
    encryption?: boolean;
}

export interface CollectionConfig {
    sources: LogSource[];
    intervals: {
        polling: number;
        heartbeat: number;
        healthCheck: number;
    };
    buffers: {
        inputBuffer: string;
        outputBuffer: string;
        memoryLimit: string;
    };
    filters: FilterConfig[];
    parsers: ParserConfig[];
    tags: Record<string, string>;
}

export interface FilterConfig {
    name: string;
    type: 'grep' | 'modify' | 'throttle' | 'parser' | 'lua' | 'custom';
    rules: FilterRule[];
    enabled: boolean;
    priority: number;
}

export interface FilterRule {
    condition: string;
    action: 'include' | 'exclude' | 'modify' | 'tag' | 'route';
    parameters: Record<string, any>;
}

export interface ParserConfig {
    name: string;
    format: string;
    regex?: string;
    timeKey?: string;
    timeFormat?: string;
    timeKeepOriginal?: boolean;
    keyName?: string;
}

export interface TransmissionConfig {
    endpoints: TransmissionEndpoint[];
    protocol: 'https' | 'tcp' | 'udp';
    format: 'json' | 'msgpack' | 'csv';
    compression: 'gzip' | 'lz4' | 'snappy' | 'none';
    batchSize: number;
    flushInterval: number;
    retryAttempts: number;
    retryBackoff: 'linear' | 'exponential';
    healthCheckInterval: number;
    tls: TLSConfig;
}

export interface TransmissionEndpoint {
    url: string;
    weight: number;
    active: boolean;
    headers?: Record<string, string>;
    authMethod?: 'bearer' | 'basic' | 'cert' | 'api_key';
    authCredentials?: Record<string, string>;
}

export interface TLSConfig {
    enabled: boolean;
    version: '1.2' | '1.3';
    cipherSuites?: string[];
    certificateFile?: string;
    keyFile?: string;
    caFile?: string;
    verifyHostname: boolean;
    verifyPeer: boolean;
}

export interface ManagementConfig {
    enabled: boolean;
    port: number;
    interface: string;
    authentication: 'none' | 'api_key' | 'cert';
    apiKey?: string;
    allowedIPs?: string[];
    endpoints: string[];
    remoteManagement: RemoteManagementConfig;
}

export interface RemoteManagementConfig {
    enabled: boolean;
    serverUrl: string;
    registrationEndpoint: string;
    configEndpoint: string;
    heartbeatInterval: number;
    configSyncInterval: number;
    commandPollInterval: number;
    authentication: RemoteAuthConfig;
}

export interface RemoteAuthConfig {
    method: 'jwt' | 'cert' | 'api_key';
    credentials: Record<string, string>;
    refreshInterval?: number;
}

export interface SecurityConfig {
    encryption: EncryptionConfig;
    authentication: AuthenticationConfig;
    authorization: AuthorizationConfig;
    auditLogging: boolean;
    integrityChecking: boolean;
    antiTampering: boolean;
}

export interface EncryptionConfig {
    algorithm: 'AES-256-GCM' | 'ChaCha20-Poly1305';
    keyDerivation: 'PBKDF2' | 'Argon2';
    keyRotationInterval: string;
    encryptAtRest: boolean;
    encryptInTransit: boolean;
}

export interface AuthenticationConfig {
    required: boolean;
    methods: ('api_key' | 'jwt' | 'cert' | 'oauth2')[];
    tokenExpiration: string;
    refreshTokens: boolean;
}

export interface AuthorizationConfig {
    enabled: boolean;
    roles: string[];
    permissions: Record<string, string[]>;
    defaultRole: string;
}

export interface PerformanceConfig {
    resourceLimits: ResourceLimits;
    optimization: OptimizationConfig;
    monitoring: PerformanceMonitoringConfig;
    throttling: ThrottlingConfig;
}

export interface ResourceLimits {
    maxCpuPercent: number;
    maxMemoryMB: number;
    maxDiskMB: number;
    maxNetworkKbps: number;
    maxFileDescriptors: number;
    maxConnections: number;
}

export interface OptimizationConfig {
    enableCompression: boolean;
    enableCaching: boolean;
    enableBatching: boolean;
    enableMultithreading: boolean;
    workerThreads: number;
    ioThreads: number;
    networkThreads: number;
}

export interface PerformanceMonitoringConfig {
    enabled: boolean;
    interval: number;
    metrics: string[];
    alertThresholds: Record<string, number>;
    historicalData: boolean;
    retentionPeriod: string;
}

export interface ThrottlingConfig {
    enabled: boolean;
    cpuThreshold: number;
    memoryThreshold: number;
    networkThreshold: number;
    throttlePercentage: number;
    recoveryThreshold: number;
}

export interface DiscoveryResult {
    system: SystemInfo;
    organization: OrganizationInfo;
    securityTools: SecurityTool[];
    logSources: LogSource[];
    complianceRequirements: ComplianceFramework[];
    recommendations: Recommendation[];
    confidence: number;
    discoveryTime: number;
    errors: DiscoveryError[];
}

export interface Recommendation {
    type: 'performance' | 'security' | 'compliance' | 'integration';
    priority: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    action: string;
    automated: boolean;
    estimatedImpact: string;
}

export interface DiscoveryError {
    source: string;
    error: string;
    severity: 'warning' | 'error' | 'critical';
    recoverable: boolean;
    suggestion?: string;
}

export type ComplianceFramework = 
    | 'pci_dss'
    | 'hipaa'
    | 'sox'
    | 'gdpr'
    | 'iso_27001'
    | 'nist_800_53'
    | 'cis_controls'
    | 'fisma'
    | 'fedramp'
    | 'ccpa';

export interface HealthInfo {
    overall: 'healthy' | 'warning' | 'critical';
    components: ComponentHealth[];
    metrics: HealthMetrics;
    alerts: HealthAlert[];
    lastCheck: string;
}

export interface ComponentHealth {
    name: string;
    status: 'healthy' | 'warning' | 'critical' | 'unknown';
    message?: string;
    lastCheck: string;
    uptime: number;
    metrics: Record<string, number>;
}

export interface HealthMetrics {
    cpu: {
        usage: number;
        loadAverage: number[];
        temperature?: number;
    };
    memory: {
        used: number;
        total: number;
        percentage: number;
        swapUsed?: number;
    };
    disk: {
        used: number;
        total: number;
        percentage: number;
        iops?: number;
    };
    network: {
        bytesIn: number;
        bytesOut: number;
        packetsIn: number;
        packetsOut: number;
        errors: number;
    };
    application: {
        eventsProcessed: number;
        eventsFiltered: number;
        eventsTransmitted: number;
        errorRate: number;
        responseTime: number;
    };
}

export interface HealthAlert {
    id: string;
    type: 'performance' | 'resource' | 'connectivity' | 'security';
    severity: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    timestamp: string;
    acknowledged: boolean;
    source: string;
    metadata: Record<string, any>;
}

export interface RemoteCommand {
    id: string;
    type: 'reload_config' | 'update_agent' | 'change_log_level' | 'restart' | 'custom';
    parameters: Record<string, any>;
    timestamp: string;
    timeout: number;
    requiredPermissions: string[];
}

export interface CommandResult {
    commandId: string;
    success: boolean;
    result?: any;
    error?: string;
    timestamp: string;
    executionTime: number;
}

export interface DiscoveryProgress {
    phase: string;
    progress: number;
    message: string;
    timestamp: string;
    details?: Record<string, any>;
}

export interface AgentMetrics {
    uptime: number;
    eventsProcessed: number;
    eventsTransmitted: number;
    bytesTransmitted: number;
    errorCount: number;
    lastError?: string;
    performanceMetrics: HealthMetrics;
    fluentBitMetrics?: Record<string, any>;
}

// Fluent Bit specific types
export interface FluentBitConfig {
    service: FluentBitServiceConfig;
    inputs: FluentBitInputConfig[];
    filters: FluentBitFilterConfig[];
    outputs: FluentBitOutputConfig[];
    parsers: FluentBitParserConfig[];
}

export interface FluentBitServiceConfig {
    flush: number;
    daemon: boolean;
    logLevel: 'error' | 'warning' | 'info' | 'debug' | 'trace';
    logFile?: string;
    httpServer: boolean;
    httpListen: string;
    httpPort: number;
    storageMetrics: boolean;
    storageChecksum?: 'off' | 'on';
    storageBacklogMemLimit?: string;
}

export interface FluentBitInputConfig {
    name: string;
    alias?: string;
    tag?: string;
    properties: Record<string, any>;
}

export interface FluentBitFilterConfig {
    name: string;
    match: string;
    alias?: string;
    properties: Record<string, any>;
}

export interface FluentBitOutputConfig {
    name: string;
    match: string;
    alias?: string;
    properties: Record<string, any>;
}

export interface FluentBitParserConfig {
    name: string;
    format: string;
    regex?: string;
    timeKey?: string;
    timeFormat?: string;
    timeKeepOriginal?: boolean;
    properties: Record<string, any>;
}