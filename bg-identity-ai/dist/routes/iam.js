"use strict";
/**
 * IAM Integration Routes
 * Provides endpoints for integrating with existing IAM ecosystems
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.iamRoutes = void 0;
const express_1 = require("express");
const logger_1 = require("@/lib/logger");
const iam_connector_1 = require("@/lib/iam-integration/iam-connector");
const auth_1 = require("@/middleware/auth");
const router = (0, express_1.Router)();
exports.iamRoutes = router;
const iamConnector = new iam_connector_1.IAMConnector();
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
        return res.json({
            providers: publicProviders,
            quantumSafeCount: providers.filter(p => p.quantumSafe).length,
            totalCount: providers.length
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get IAM providers', { error });
        return res.status(500).json({ error: 'Failed to retrieve IAM providers' });
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
        return res.json({
            providers: publicProviders,
            count: publicProviders.length,
            message: 'Quantum-safe IAM providers ready for post-quantum era'
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get quantum-safe providers', { error });
        return res.status(500).json({ error: 'Failed to retrieve quantum-safe providers' });
    }
});
// Get compliance matrix for all providers
router.get('/compliance-matrix', async (req, res) => {
    try {
        const complianceMatrix = iamConnector.getComplianceMatrix();
        return res.json({
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
    }
    catch (error) {
        logger_1.logger.error('Failed to get compliance matrix', { error });
        return res.status(500).json({ error: 'Failed to retrieve compliance information' });
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
        logger_1.logger.info('IAM authentication initiated', {
            providerId,
            returnUrl,
            clientIP: req.ip
        });
        return res.json({
            authUrl,
            providerId,
            message: 'Redirect user to authUrl to complete authentication'
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to initiate IAM authentication', { error });
        return res.status(500).json({ error: 'Authentication initiation failed' });
    }
});
// Handle IAM authentication callback
router.post('/auth/callback/:providerId', async (req, res) => {
    try {
        const { providerId } = req.params;
        const credentials = req.body;
        logger_1.logger.info('IAM authentication callback received', {
            providerId,
            hasCredentials: !!credentials
        });
        const session = await iamConnector.authenticateUser(providerId, credentials);
        return res.json({
            sessionId: session.sessionId,
            userId: session.userId,
            provider: session.provider,
            expiresAt: session.expiresAt,
            quantumToken: !!session.quantumToken,
            biometricRequired: !session.biometricVerified,
            message: 'Authentication successful. Biometric verification recommended.'
        });
    }
    catch (error) {
        logger_1.logger.error('IAM authentication callback failed', {
            error,
            providerId: req.params.providerId
        });
        return res.status(500).json({ error: 'Authentication failed' });
    }
});
// Bind biometric identity to IAM user
router.post('/bind-biometric', auth_1.authMiddleware, async (req, res) => {
    try {
        const { sessionId, biometricId, verificationResult } = req.body;
        if (!sessionId || !biometricId) {
            return res.status(400).json({
                error: 'SessionId and biometricId are required'
            });
        }
        const binding = await iamConnector.bindBiometricIdentity(sessionId, biometricId, verificationResult);
        logger_1.logger.info('Biometric identity bound to IAM user', {
            sessionId,
            biometricId,
            userId: binding.userId,
            provider: binding.provider,
            quantumSigned: binding.quantumSigned
        });
        return res.json({
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
    }
    catch (error) {
        logger_1.logger.error('Biometric binding failed', { error });
        return res.status(500).json({ error: 'Failed to bind biometric identity' });
    }
});
// Validate IAM session
router.get('/session/:sessionId', auth_1.authMiddleware, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await iamConnector.validateSession(sessionId);
        if (!session) {
            return res.status(500).json({ error: 'Session not found or expired' });
        }
        return res.json({
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
    }
    catch (error) {
        logger_1.logger.error('Session validation failed', { error });
        return res.status(500).json({ error: 'Session validation failed' });
    }
});
// Register new IAM provider (admin only)
router.post('/providers', auth_1.authMiddleware, async (req, res) => {
    try {
        // Check if user has admin role
        if (req.user?.role !== 'admin') {
            return res.status(400).json({ error: 'Admin access required' });
        }
        const providerConfig = req.body;
        // Validate required fields
        if (!providerConfig.id || !providerConfig.name || !providerConfig.type) {
            return res.status(400).json({
                error: 'Provider id, name, and type are required'
            });
        }
        await iamConnector.registerProvider(providerConfig);
        logger_1.logger.info('New IAM provider registered', {
            providerId: providerConfig.id,
            type: providerConfig.type,
            quantumSafe: providerConfig.quantumSafe,
            adminUser: req.user?.id
        });
        return res.json({
            success: true,
            providerId: providerConfig.id,
            message: 'IAM provider registered successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to register IAM provider', { error });
        return res.status(500).json({ error: 'Provider registration failed' });
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
        return res.json(status);
    }
    catch (error) {
        logger_1.logger.error('Failed to get IAM status', { error });
        return res.status(500).json({ error: 'Failed to retrieve IAM status' });
    }
});
//# sourceMappingURL=iam.js.map