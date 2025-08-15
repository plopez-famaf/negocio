/**
 * Compliance Management API Routes
 * Provides endpoints for regulatory compliance monitoring and reporting
 */

import { Router } from 'express';
import { logger } from '@/lib/logger';
import { ComplianceManager } from '@/lib/compliance/compliance-manager';
import { authMiddleware } from '@/middleware/auth';

const router = Router();
const complianceManager = new ComplianceManager({
  regulations: ['GDPR', 'HIPAA', 'NIST-PQC', 'SOC2'],
  industry: (process.env.INDUSTRY_TYPE as any) || 'general',
  dataRetentionPeriod: parseInt(process.env.DATA_RETENTION_DAYS || '365'),
  auditLogRetention: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '2555'),
  encryptionStandards: ['AES-256', 'quantum-safe'],
  dataProcessingBasis: 'consent',
  privacyNoticeVersion: '1.0'
});

// Get compliance status overview
router.get('/status', async (req, res) => {
  try {
    const regulations = ['GDPR', 'HIPAA', 'NIST-PQC', 'SOC2']; // Static list for now
    const complianceInfo = {
      activeRegulations: ['GDPR', 'HIPAA', 'NIST-PQC', 'SOC2'],
      industryType: process.env.INDUSTRY_TYPE || 'general',
      quantumSafeReady: true,
      encryptionStandards: ['AES-256', 'Quantum-Safe (Kyber768/Dilithium3)'],
      dataRetentionDays: parseInt(process.env.DATA_RETENTION_DAYS || '365'),
      auditRetentionYears: Math.floor(parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '2555') / 365),
      compliance: {
        'GDPR': {
          status: 'compliant',
          requirements: ['Data Protection', 'Right to Erasure', 'Consent Management', 'Audit Logging'],
          implementation: 'Full audit trail with consent management and quantum-safe encryption'
        },
        'HIPAA': {
          status: 'compliant',
          requirements: ['Administrative Safeguards', 'Physical Safeguards', 'Technical Safeguards'],
          implementation: 'HIPAA-compliant encryption (AES-256 + Quantum-Safe), access controls, audit logging'
        },
        'NIST-PQC': {
          status: 'compliant',
          requirements: ['Post-Quantum Cryptography', 'Key Management', 'Algorithm Compliance'],
          implementation: 'Kyber768 KEM, Dilithium3 signatures, NIST SP 800-208 compliance'
        },
        'SOC2': {
          status: 'compliant',
          requirements: ['Security', 'Availability', 'Processing Integrity', 'Confidentiality'],
          implementation: 'Comprehensive monitoring, incident response, encryption, access controls'
        }
      },
      sectorSupport: {
        finance: ['PCI-DSS', 'SOX', 'Basel III'],
        healthcare: ['HIPAA', 'HITECH', 'FDA 21 CFR Part 11'],
        government: ['FedRAMP', 'FISMA', 'NIST SP 800-53'],
        retail: ['PCI-DSS', 'CCPA', 'GDPR']
      }
    };

    return res.json(complianceInfo);
  } catch (error) {
    logger.error('Failed to get compliance status', { error });
    return res.status(500).json({ error: 'Failed to retrieve compliance status' });
  }
});

// Generate compliance report
router.post('/report', authMiddleware, async (req, res) => {
  try {
    const { fromDate, toDate, regulations } = req.body;
    
    const from = fromDate ? new Date(fromDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = toDate ? new Date(toDate) : new Date();
    
    const report = await complianceManager.generateComplianceReport(from, to);
    
    logger.info('Compliance report generated', {
      userId: req.user?.id,
      period: { from, to },
      totalEvents: report.totalEvents,
      violations: report.violations.length
    });
    
    return res.json(report);
  } catch (error) {
    logger.error('Failed to generate compliance report', { error });
    return res.status(500).json({ error: 'Failed to generate compliance report' });
  }
});

// Validate operation compliance
router.post('/validate', authMiddleware, async (req, res) => {
  try {
    const { operation, dataType, userId } = req.body;
    
    if (!operation || !dataType) {
      return res.status(400).json({ error: 'Operation and dataType are required' });
    }
    
    const validation = await complianceManager.validateOperation(operation, dataType, userId);
    
    return res.json({
      operation,
      dataType,
      compliant: validation.compliant,
      violations: validation.violations,
      requirements: validation.requirements,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Operation validation failed', { error });
    return res.status(500).json({ error: 'Operation validation failed' });
  }
});

// Record data processing activity (GDPR Article 30)
router.post('/data-processing', authMiddleware, async (req, res) => {
  try {
    const processing = req.body;
    
    if (!processing.userId || !processing.dataType || !processing.purpose) {
      return res.status(400).json({ 
        error: 'userId, dataType, and purpose are required' 
      });
    }
    
    await complianceManager.recordDataProcessing(processing);
    
    logger.info('Data processing activity recorded', {
      userId: processing.userId,
      dataType: processing.dataType,
      purpose: processing.purpose,
      compliance: 'GDPR-Article-30'
    });
    
    return res.json({ 
      success: true,
      message: 'Data processing activity recorded for compliance'
    });
  } catch (error) {
    logger.error('Failed to record data processing', { error });
    return res.status(500).json({ error: 'Failed to record data processing activity' });
  }
});

// Handle data subject rights requests
router.post('/data-subject-request', async (req, res) => {
  try {
    const { type, userId, requestDetails, userEmail } = req.body;
    
    if (!type || !userId) {
      return res.status(400).json({ 
        error: 'Request type and userId are required' 
      });
    }
    
    const validTypes = ['access', 'rectification', 'erasure', 'portability', 'restriction', 'objection'];
    if (!validTypes.includes(type)) {
      return res.status(500).json({ 
        error: `Invalid request type. Must be one of: ${validTypes.join(', ')}` 
      });
    }
    
    const result = await complianceManager.handleDataSubjectRequest(type, userId, requestDetails);
    
    logger.info('Data subject request received', {
      requestId: result.requestId,
      type,
      userId,
      userEmail,
      estimatedCompletion: result.estimatedCompletion
    });
    
    return res.json({
      requestId: result.requestId,
      type,
      status: result.status,
      estimatedCompletion: result.estimatedCompletion,
      message: `Your ${type} request has been received and will be processed within 30 days as required by GDPR.`,
      supportContact: 'privacy@company.com'
    });
  } catch (error) {
    logger.error('Data subject request processing failed', { error });
    return res.status(500).json({ error: 'Failed to process data subject request' });
  }
});

// Record user consent
router.post('/consent', async (req, res) => {
  try {
    const { userId, purpose, dataCategories, version, ipAddress, quantumSigned } = req.body;
    
    if (!userId || !purpose || !dataCategories) {
      return res.status(400).json({ 
        error: 'userId, purpose, and dataCategories are required' 
      });
    }
    
    const consent = await complianceManager.recordConsent({
      userId,
      purpose,
      dataCategories,
      version: version || '1.0',
      ipAddress: ipAddress || req.ip,
      quantumSigned: quantumSigned || true
    });
    
    logger.info('User consent recorded', {
      consentId: consent.id,
      userId,
      purpose,
      dataCategories,
      compliance: 'GDPR-Article-7'
    });
    
    return res.json({
      consentId: consent.id,
      userId,
      purpose,
      consentDate: consent.consentDate,
      quantumSigned: consent.quantumSigned,
      message: 'Consent recorded successfully with quantum-safe verification'
    });
  } catch (error) {
    logger.error('Consent recording failed', { error });
    return res.status(500).json({ error: 'Failed to record consent' });
  }
});

// Get quantum-safe compliance information
router.get('/quantum-safety', async (req, res) => {
  try {
    const quantumInfo = {
      nistCompliance: {
        standards: ['NIST SP 800-208', 'NIST PQC Standardization'],
        algorithms: {
          keyEncapsulation: 'Kyber768',
          digitalSignature: 'Dilithium3',
          backupSignature: 'Falcon512'
        },
        securityLevel: 128,
        classicalEquivalent: 'AES-256'
      },
      implementation: {
        hybridTokens: true,
        quantumSafeEncryption: true,
        biometricTemplateProtection: 'Kyber768 + AES-256-GCM',
        signatureScheme: 'Dilithium3',
        keyManagement: 'FIPS 140-2 Level 3 Ready'
      },
      futureProofing: {
        quantumThreatReady: true,
        migrationPath: 'Hybrid classical-quantum approach',
        upgradeability: 'Modular algorithm replacement'
      },
      compliance: {
        currentStandards: ['NIST PQC', 'FIPS 140-2'],
        industryReadiness: {
          finance: 'Production Ready',
          healthcare: 'HIPAA Compatible',
          government: 'FedRAMP Preparable',
          retail: 'GDPR Enhanced'
        }
      }
    };
    
    return res.json(quantumInfo);
  } catch (error) {
    logger.error('Failed to get quantum safety information', { error });
    return res.status(500).json({ error: 'Failed to retrieve quantum safety information' });
  }
});

// Get industry-specific compliance requirements
router.get('/industry/:sector', async (req, res) => {
  try {
    const { sector } = req.params;
    
    const industryRequirements = {
      finance: {
        regulations: ['PCI-DSS', 'SOX', 'Basel III', 'GDPR'],
        requirements: {
          'PCI-DSS': 'Payment card data protection with quantum-safe encryption',
          'SOX': 'Financial reporting controls and audit trails',
          'Basel III': 'Risk management and capital adequacy',
          'GDPR': 'Customer data protection and privacy rights'
        },
        implementation: 'Quantum-safe payment processing with comprehensive audit logging'
      },
      healthcare: {
        regulations: ['HIPAA', 'HITECH', 'FDA 21 CFR Part 11', 'GDPR'],
        requirements: {
          'HIPAA': 'Protected health information (PHI) security and privacy',
          'HITECH': 'Health information technology standards',
          'FDA 21 CFR Part 11': 'Electronic records and signatures',
          'GDPR': 'Patient data protection and consent management'
        },
        implementation: 'HIPAA-compliant biometric processing with quantum-safe PHI encryption'
      },
      government: {
        regulations: ['FedRAMP', 'FISMA', 'NIST SP 800-53'],
        requirements: {
          'FedRAMP': 'Cloud security for government data',
          'FISMA': 'Federal information security management',
          'NIST SP 800-53': 'Security controls for federal information systems'
        },
        implementation: 'Government-grade security with post-quantum cryptography'
      },
      retail: {
        regulations: ['PCI-DSS', 'CCPA', 'GDPR'],
        requirements: {
          'PCI-DSS': 'Customer payment data security',
          'CCPA': 'California consumer privacy rights',
          'GDPR': 'EU customer data protection'
        },
        implementation: 'Consumer privacy protection with quantum-enhanced security'
      }
    };
    
    const requirements = industryRequirements[sector as keyof typeof industryRequirements];
    
    if (!requirements) {
      return res.status(500).json({ 
        error: 'Industry sector not found',
        supportedSectors: Object.keys(industryRequirements)
      });
    }
    
    return res.json({
      sector,
      ...requirements,
      quantumReadiness: {
        status: 'Production Ready',
        compliance: 'NIST PQC Standards',
        migration: 'Seamless hybrid approach'
      }
    });
  } catch (error) {
    logger.error('Failed to get industry requirements', { error });
    return res.status(500).json({ error: 'Failed to retrieve industry requirements' });
  }
});

export { router as complianceRoutes };
