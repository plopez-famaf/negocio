/**
 * Compliance Manager
 * Ensures adherence to regulatory frameworks and standards
 *
 * Supported Regulations:
 * - GDPR (General Data Protection Regulation)
 * - HIPAA (Health Insurance Portability and Accountability Act)
 * - CCPA (California Consumer Privacy Act)
 * - NIST Cybersecurity Framework
 * - SOC 2 Type II
 * - ISO 27001
 * - PCI DSS (for payment data)
 * - FISMA (Federal Information Security Management Act)
 *
 * Industry-Specific Compliance:
 * - Finance: PCI DSS, SOX, Basel III
 * - Healthcare: HIPAA, HITECH, FDA 21 CFR Part 11
 * - Government: FISMA, FedRAMP, NIST SP 800-53
 * - Retail: PCI DSS, CCPA, GDPR
 */
import { EventEmitter } from 'events';
export interface ComplianceConfig {
    regulations: string[];
    industry: 'finance' | 'healthcare' | 'government' | 'retail' | 'general';
    dataRetentionPeriod: number;
    auditLogRetention: number;
    encryptionStandards: string[];
    dataProcessingBasis?: string;
    privacyNoticeVersion?: string;
}
export interface AuditEvent {
    id: string;
    timestamp: Date;
    userId?: string;
    action: string;
    resource: string;
    result: 'success' | 'failure' | 'denied' | 'initiated' | 'completed' | 'error';
    ipAddress?: string;
    userAgent?: string;
    compliance: string[];
    dataCategory?: string;
    personalData: boolean;
    quantumSafe: boolean;
    metadata: Record<string, any>;
}
export interface DataProcessingRecord {
    id: string;
    userId: string;
    dataType: 'biometric' | 'personal' | 'behavioral' | 'authentication';
    purpose: string;
    legalBasis: string;
    dataCategories: string[];
    processingLocation: string;
    retentionPeriod: number;
    thirdPartySharing: boolean;
    quantumEncrypted: boolean;
    consentId?: string;
    timestamp: Date;
}
export interface ConsentRecord {
    id: string;
    userId: string;
    purpose: string;
    dataCategories: string[];
    consentDate: Date;
    withdrawnDate?: Date;
    version: string;
    ipAddress: string;
    evidence: string;
    quantumSigned: boolean;
}
export interface DataSubjectRights {
    accessRequests: number;
    rectificationRequests: number;
    erasureRequests: number;
    portabilityRequests: number;
    restrictionRequests: number;
    objectionRequests: number;
}
export interface ComplianceReport {
    generatedAt: Date;
    period: {
        from: Date;
        to: Date;
    };
    regulations: string[];
    totalEvents: number;
    personalDataProcessing: number;
    consentRecords: number;
    dataSubjectRequests: DataSubjectRights;
    securityMetrics: {
        quantumSafePercentage: number;
        encryptionCompliance: number;
        auditCoverage: number;
    };
    violations: ComplianceViolation[];
    recommendations: string[];
}
export interface ComplianceViolation {
    id: string;
    regulation: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    detectedAt: Date;
    affectedData: string[];
    remediation: string;
    status: 'open' | 'in_progress' | 'resolved';
}
export declare class ComplianceManager extends EventEmitter {
    private config;
    private auditLog;
    private processingRecords;
    private consentRecords;
    private violations;
    constructor(config: ComplianceConfig);
    /**
     * Initialize compliance monitoring
     */
    private initializeCompliance;
    /**
     * Record audit event for compliance tracking
     */
    recordAuditEvent(event: Omit<AuditEvent, 'id' | 'timestamp' | 'compliance'>): Promise<void>;
    /**
     * Record data processing activity (GDPR Article 30)
     */
    recordDataProcessing(processing: Omit<DataProcessingRecord, 'id' | 'timestamp'>): Promise<void>;
    /**
     * Record user consent (GDPR Article 7)
     */
    recordConsent(consent: Omit<ConsentRecord, 'id' | 'consentDate' | 'evidence'>): Promise<ConsentRecord>;
    /**
     * Handle data subject rights requests (GDPR Chapter III)
     */
    handleDataSubjectRequest(type: 'access' | 'rectification' | 'erasure' | 'portability' | 'restriction' | 'objection', userId: string, requestDetails: any): Promise<{
        requestId: string;
        status: string;
        estimatedCompletion: Date;
    }>;
    /**
     * Generate compliance report
     */
    generateComplianceReport(from: Date, to: Date): Promise<ComplianceReport>;
    /**
     * Check if operation is compliant with regulations
     */
    validateOperation(operation: string, dataType: string, userId?: string): Promise<{
        compliant: boolean;
        violations: string[];
        requirements: string[];
    }>;
    /**
     * Get applicable regulations for specific action/data type
     */
    private getApplicableRegulations;
    /**
     * Initialize GDPR-specific compliance measures
     */
    private initializeGDPRCompliance;
    /**
     * Initialize HIPAA-specific compliance measures
     */
    private initializeHIPAACompliance;
    /**
     * Initialize industry-specific compliance
     */
    private initializeIndustryCompliance;
    private initializeFinanceCompliance;
    private initializeHealthcareCompliance;
    private initializeGovernmentCompliance;
    private initializeRetailCompliance;
    /**
     * Start automated compliance monitoring
     */
    private startComplianceMonitoring;
    private performComplianceCheck;
    private generateDailySummary;
    private isPersonalData;
    private isHealthData;
    private isSensitiveData;
    private hasQuantumSafeEncryption;
    private hasHIPAACompliantEncryption;
    private generateEventId;
    private generateProcessingId;
    private generateConsentId;
    private generateRequestId;
    private generateConsentEvidence;
    private checkComplianceViolations;
    private cleanupAuditLogs;
    private validateGDPRProcessing;
    private getValidConsent;
    private processAccessRequest;
    private processErasureRequest;
    private processPortabilityRequest;
    private calculateDataSubjectRights;
    private calculateEncryptionCompliance;
    private calculateAuditCoverage;
    private generateRecommendations;
    private checkConsentExpiry;
    private enforceDataRetention;
    private recordHIPAAAccess;
}
//# sourceMappingURL=compliance-manager.d.ts.map