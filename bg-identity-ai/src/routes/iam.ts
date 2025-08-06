/**
 * IAM Integration Routes
 * Provides endpoints for integrating with existing IAM ecosystems
 */

import { Router } from 'express';
import { logger } from '@/lib/logger';
import { IAMConnector } from '@/lib/iam-integration/iam-connector';
import { authMiddleware } from '@/middleware/auth';

const router = Router();
const iamConnector = new IAMConnector();

// Get available IAM providers
router.get('/providers', async (req, res) => {
  try {
    const providers = iamConnector.getAvailableProviders();
    
    // Filter out sensitive configuration details
    const publicProviders = providers.map(provider => ({
      id: provider.id,
      name: provider.name,
      type: provider.type,
      quantumSafe: provider.quantumSafe,
      compliance: provider.compliance
    }));

    res.json({
      providers: publicProviders,
      quantumSafeCount: providers.filter(p => p.quantumSafe).length,
      totalCount: providers.length
    });
  } catch (error) {
    logger.error('Failed to get IAM providers', { error });
    res.status(500).json({ error: 'Failed to retrieve IAM providers' });
  }
});

// Get quantum-safe providers only
router.get('/providers/quantum-safe', async (req, res) => {
  try {
    const quantumProviders = iamConnector.getQuantumSafeProviders();
    
    const publicProviders = quantumProviders.map(provider => ({
      id: provider.id,
      name: provider.name,
      type: provider.type,
      compliance: provider.compliance
    }));

    res.json({
      providers: publicProviders,
      count: publicProviders.length,
      message: 'Quantum-safe IAM providers ready for post-quantum era'
    });
  } catch (error) {
    logger.error('Failed to get quantum-safe providers', { error });
    res.status(500).json({ error: 'Failed to retrieve quantum-safe providers' });
  }
});

// Get compliance matrix for all providers
router.get('/compliance-matrix', async (req, res) => {
  try {
    const complianceMatrix = iamConnector.getComplianceMatrix();
    
    res.json({
      complianceMatrix,
      supportedStandards: [
        'GDPR', 'HIPAA', 'SOC2', 'FedRAMP', 'NIST-PQC'
      ],
      industrySupport: {
        finance: ['SOC2', 'PCI-DSS', 'SOX'],
        healthcare: ['HIPAA', 'HITECH', 'GDPR'],
        government: ['FedRAMP', 'FISMA', 'NIST-800-53'],
        retail: ['PCI-DSS', 'CCPA', 'GDPR']
      }
    });
  } catch (error) {
    logger.error('Failed to get compliance matrix', { error });
    res.status(500).json({ error: 'Failed to retrieve compliance information' });
  }
});

// Initiate IAM authentication
router.post('/auth/initiate', async (req, res) => {
  try {
    const { providerId, returnUrl } = req.body;
    
    if (!providerId) {
      return res.status(400).json({ error: 'Provider ID is required' });
    }

    // This would typically redirect to the IAM provider
    // For API purposes, we return the authentication URL
    const authUrl = `${req.protocol}://${req.get('host')}/api/iam/auth/callback/${providerId}`;
    
    logger.info('IAM authentication initiated', { 
      providerId, 
      returnUrl,
      clientIP: req.ip 
    });

    res.json({
      authUrl,
      providerId,
      message: 'Redirect user to authUrl to complete authentication'
    });
  } catch (error) {
    logger.error('Failed to initiate IAM authentication', { error });
    res.status(500).json({ error: 'Authentication initiation failed' });
  }
});

// Handle IAM authentication callback
router.post('/auth/callback/:providerId', async (req, res) => {
  try {
    const { providerId } = req.params;
    const credentials = req.body;

    logger.info('IAM authentication callback received', { 
      providerId,
      hasCredentials: !!credentials 
    });

    const session = await iamConnector.authenticateUser(providerId, credentials);
    
    res.json({
      sessionId: session.sessionId,
      userId: session.userId,
      provider: session.provider,
      expiresAt: session.expiresAt,
      quantumToken: !!session.quantumToken,
      biometricRequired: !session.biometricVerified,
      message: 'Authentication successful. Biometric verification recommended.'
    });
  } catch (error) {
    logger.error('IAM authentication callback failed', { 
      error,
      providerId: req.params.providerId 
    });
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// Bind biometric identity to IAM user
router.post('/bind-biometric', authMiddleware, async (req, res) => {
  try {
    const { sessionId, biometricId, verificationResult } = req.body;
    
    if (!sessionId || !biometricId) {
      return res.status(400).json({ 
        error: 'SessionId and biometricId are required' 
      });
    }

    const binding = await iamConnector.bindBiometricIdentity(
      sessionId, 
      biometricId, 
      verificationResult
    );

    logger.info('Biometric identity bound to IAM user', {
      sessionId,
      biometricId,
      userId: binding.userId,
      provider: binding.provider,
      quantumSigned: binding.quantumSigned
    });

    res.json({
      success: true,
      binding: {
        userId: binding.userId,
        provider: binding.provider,
        bindingDate: binding.bindingDate,
        quantumSigned: binding.quantumSigned,
        complianceFlags: binding.complianceFlags
      },
      message: 'Biometric identity successfully bound to IAM account'
    });
  } catch (error) {
    logger.error('Biometric binding failed', { error });
    res.status(500).json({ error: 'Failed to bind biometric identity' });
  }
});

// Validate IAM session
router.get('/session/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await iamConnector.validateSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    res.json({
      valid: true,
      session: {
        sessionId: session.sessionId,
        userId: session.userId,
        provider: session.provider,
        expiresAt: session.expiresAt,
        mfaVerified: session.mfaVerified,
        biometricVerified: session.biometricVerified,
        quantumProtected: !!session.quantumToken
      }
    });
  } catch (error) {
    logger.error('Session validation failed', { error });
    res.status(500).json({ error: 'Session validation failed' });
  }
});

// Register new IAM provider (admin only)
router.post('/providers', authMiddleware, async (req, res) => {
  try {
    // Check if user has admin role
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const providerConfig = req.body;
    
    // Validate required fields
    if (!providerConfig.id || !providerConfig.name || !providerConfig.type) {
      return res.status(400).json({ 
        error: 'Provider id, name, and type are required' 
      });
    }

    await iamConnector.registerProvider(providerConfig);

    logger.info('New IAM provider registered', {
      providerId: providerConfig.id,
      type: providerConfig.type,
      quantumSafe: providerConfig.quantumSafe,
      adminUser: req.user?.id
    });

    res.json({
      success: true,
      providerId: providerConfig.id,
      message: 'IAM provider registered successfully'
    });
  } catch (error) {
    logger.error('Failed to register IAM provider', { error });
    res.status(500).json({ error: 'Provider registration failed' });
  }
});

// Get IAM integration status
router.get('/status', async (req, res) => {
  try {
    const providers = iamConnector.getAvailableProviders();
    const quantumSafeProviders = providers.filter(p => p.quantumSafe);
    
    const status = {
      totalProviders: providers.length,
      quantumSafeProviders: quantumSafeProviders.length,
      quantumReadinessPercentage: providers.length > 0 ? 
        (quantumSafeProviders.length / providers.length) * 100 : 0,
      supportedProtocols: ['OpenID Connect', 'SAML 2.0', 'OAuth 2.0', 'LDAP v3'],
      complianceStandards: ['GDPR', 'HIPAA', 'SOC2', 'FedRAMP', 'NIST-PQC'],
      enterpriseIntegrations: [
        'Microsoft Azure AD',
        'AWS Cognito',
        'Google Cloud Identity',
        'Okta',
        'Auth0',
        'Keycloak',
        'Active Directory'
      ]
    };

    res.json(status);
  } catch (error) {
    logger.error('Failed to get IAM status', { error });
    res.status(500).json({ error: 'Failed to retrieve IAM status' });
  }
});

export { router as iamRoutes };