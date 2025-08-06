"use strict";
/**
 * IAM Ecosystem Connector
 * Modular integration with existing Identity and Access Management systems
 *
 * Supported Standards:
 * - OpenID Connect 1.0
 * - SAML 2.0
 * - OAuth 2.0 / OAuth 2.1
 * - LDAP v3
 * - SCIM 2.0 (System for Cross-domain Identity Management)
 *
 * Enterprise Integrations:
 * - Microsoft Azure AD / Entra ID
 * - AWS IAM / Cognito
 * - Google Cloud Identity
 * - Okta
 * - Auth0
 * - Keycloak
 * - Active Directory
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.IAMConnector = void 0;
const openid_client_1 = require("openid-client");
const saml2 = __importStar(require("saml2-js"));
const ldap = __importStar(require("ldapjs"));
const logger_1 = require("@/lib/logger");
const pqc_manager_1 = require("@/lib/quantum-crypto/pqc-manager");
class IAMConnector {
    providers = new Map();
    clients = new Map();
    pqcManager;
    sessions = new Map();
    constructor() {
        this.pqcManager = new pqc_manager_1.PQCManager();
        this.initializeProviders();
    }
    /**
     * Initialize supported IAM providers with modular configuration
     */
    async initializeProviders() {
        logger_1.logger.info('Initializing IAM ecosystem connectors');
        // Default provider configurations
        const defaultProviders = [
            {
                id: 'azure-ad',
                name: 'Microsoft Azure AD',
                type: 'oidc',
                config: {
                    issuer: process.env.AZURE_AD_ISSUER,
                    clientId: process.env.AZURE_AD_CLIENT_ID,
                    clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
                    redirectUri: process.env.AZURE_AD_REDIRECT_URI
                },
                quantumSafe: true,
                compliance: ['SOC2', 'GDPR', 'HIPAA']
            },
            {
                id: 'aws-cognito',
                name: 'AWS Cognito',
                type: 'oidc',
                config: {
                    issuer: process.env.AWS_COGNITO_ISSUER,
                    clientId: process.env.AWS_COGNITO_CLIENT_ID,
                    clientSecret: process.env.AWS_COGNITO_CLIENT_SECRET
                },
                quantumSafe: true,
                compliance: ['SOC2', 'GDPR', 'HIPAA', 'FedRAMP']
            },
            {
                id: 'google-identity',
                name: 'Google Cloud Identity',
                type: 'oidc',
                config: {
                    issuer: 'https://accounts.google.com',
                    clientId: process.env.GOOGLE_CLIENT_ID,
                    clientSecret: process.env.GOOGLE_CLIENT_SECRET
                },
                quantumSafe: false, // To be upgraded
                compliance: ['SOC2', 'GDPR']
            },
            {
                id: 'okta',
                name: 'Okta',
                type: 'oidc',
                config: {
                    issuer: process.env.OKTA_ISSUER,
                    clientId: process.env.OKTA_CLIENT_ID,
                    clientSecret: process.env.OKTA_CLIENT_SECRET
                },
                quantumSafe: true,
                compliance: ['SOC2', 'GDPR', 'HIPAA', 'FedRAMP']
            },
            {
                id: 'keycloak',
                name: 'Keycloak',
                type: 'oidc',
                config: {
                    issuer: process.env.KEYCLOAK_ISSUER,
                    clientId: process.env.KEYCLOAK_CLIENT_ID,
                    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET
                },
                quantumSafe: true,
                compliance: ['GDPR', 'Custom']
            },
            {
                id: 'enterprise-ad',
                name: 'Active Directory',
                type: 'ldap',
                config: {
                    url: process.env.AD_LDAP_URL,
                    bindDN: process.env.AD_BIND_DN,
                    bindPassword: process.env.AD_BIND_PASSWORD,
                    baseDN: process.env.AD_BASE_DN
                },
                quantumSafe: false, // Legacy system
                compliance: ['Enterprise']
            }
        ];
        for (const provider of defaultProviders) {
            await this.registerProvider(provider);
        }
        logger_1.logger.info('IAM ecosystem connectors initialized', {
            providersCount: this.providers.size,
            quantumSafeProviders: Array.from(this.providers.values()).filter(p => p.quantumSafe).length
        });
    }
    /**
     * Register a new IAM provider (modular expansion)
     */
    async registerProvider(provider) {
        try {
            this.providers.set(provider.id, provider);
            if (provider.type === 'oidc') {
                await this.initializeOIDCClient(provider);
            }
            else if (provider.type === 'saml') {
                await this.initializeSAMLClient(provider);
            }
            else if (provider.type === 'ldap') {
                await this.initializeLDAPClient(provider);
            }
            logger_1.logger.info('IAM provider registered successfully', {
                providerId: provider.id,
                type: provider.type,
                quantumSafe: provider.quantumSafe,
                compliance: provider.compliance
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to register IAM provider', {
                providerId: provider.id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    /**
     * Initialize OpenID Connect client
     */
    async initializeOIDCClient(provider) {
        if (!provider.config.issuer) {
            logger_1.logger.warn('OIDC issuer not configured', { providerId: provider.id });
            return;
        }
        try {
            const issuer = await openid_client_1.Issuer.discover(provider.config.issuer);
            const client = new issuer.Client({
                client_id: provider.config.clientId,
                client_secret: provider.config.clientSecret,
                redirect_uris: [provider.config.redirectUri || 'http://localhost:3001/auth/callback'],
                response_types: ['code']
            });
            this.clients.set(provider.id, { type: 'oidc', client, issuer });
            logger_1.logger.info('OIDC client initialized', {
                providerId: provider.id,
                issuer: issuer.issuer,
                algorithms: issuer.id_token_signing_alg_values_supported
            });
        }
        catch (error) {
            logger_1.logger.error('OIDC client initialization failed', {
                providerId: provider.id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    /**
     * Initialize SAML client
     */
    async initializeSAMLClient(provider) {
        try {
            const samlClient = new saml2.ServiceProvider({
                entity_id: provider.config.entityId,
                private_key: provider.config.privateKey,
                certificate: provider.config.certificate,
                assert_endpoint: provider.config.assertEndpoint
            });
            const identityProvider = new saml2.IdentityProvider({
                sso_login_url: provider.config.ssoLoginUrl,
                sso_logout_url: provider.config.ssoLogoutUrl,
                certificates: [provider.config.idpCertificate]
            });
            this.clients.set(provider.id, { type: 'saml', sp: samlClient, idp: identityProvider });
            logger_1.logger.info('SAML client initialized', {
                providerId: provider.id,
                entityId: provider.config.entityId
            });
        }
        catch (error) {
            logger_1.logger.error('SAML client initialization failed', {
                providerId: provider.id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    /**
     * Initialize LDAP client
     */
    async initializeLDAPClient(provider) {
        try {
            const client = ldap.createClient({
                url: provider.config.url,
                timeout: 5000,
                connectTimeout: 10000
            });
            // Test connection
            await new Promise((resolve, reject) => {
                client.bind(provider.config.bindDN, provider.config.bindPassword, (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            this.clients.set(provider.id, { type: 'ldap', client });
            logger_1.logger.info('LDAP client initialized', {
                providerId: provider.id,
                url: provider.config.url
            });
        }
        catch (error) {
            logger_1.logger.error('LDAP client initialization failed', {
                providerId: provider.id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    /**
     * Authenticate user with IAM provider
     */
    async authenticateUser(providerId, credentials) {
        const provider = this.providers.get(providerId);
        if (!provider) {
            throw new Error(`IAM provider ${providerId} not found`);
        }
        const client = this.clients.get(providerId);
        if (!client) {
            throw new Error(`IAM client ${providerId} not initialized`);
        }
        try {
            let user;
            let tokens = {};
            if (provider.type === 'oidc') {
                const result = await this.authenticateOIDC(client, credentials);
                user = result.user;
                tokens = result.tokens;
            }
            else if (provider.type === 'ldap') {
                user = await this.authenticateLDAP(client, credentials);
            }
            else {
                throw new Error(`Authentication method not implemented for ${provider.type}`);
            }
            // Create session
            const sessionId = this.generateSessionId();
            const session = {
                sessionId,
                userId: user.id,
                provider: providerId,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                idToken: tokens.id_token,
                expiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
                mfaVerified: false,
                biometricVerified: false
            };
            // Add quantum-safe token if provider supports it
            if (provider.quantumSafe) {
                session.quantumToken = await this.pqcManager.createHybridToken({ userId: user.id, provider: providerId }, process.env.JWT_SECRET || 'fallback-secret');
            }
            this.sessions.set(sessionId, session);
            logger_1.logger.info('User authenticated successfully', {
                providerId,
                userId: user.id,
                quantumSafe: provider.quantumSafe,
                sessionId
            });
            return session;
        }
        catch (error) {
            logger_1.logger.error('User authentication failed', {
                providerId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    /**
     * Bind biometric identity to IAM user
     */
    async bindBiometricIdentity(sessionId, biometricId, verificationResult) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error('Session not found');
        }
        const provider = this.providers.get(session.provider);
        if (!provider) {
            throw new Error('Provider not found');
        }
        try {
            const binding = {
                userId: session.userId,
                provider: session.provider,
                biometricId,
                bindingDate: new Date(),
                quantumSigned: provider.quantumSafe,
                complianceFlags: provider.compliance
            };
            // Store binding securely (implement persistence layer)
            await this.storeBiometricBinding(binding);
            // Update session to mark biometric verification
            session.biometricVerified = true;
            this.sessions.set(sessionId, session);
            logger_1.logger.info('Biometric identity bound successfully', {
                userId: session.userId,
                provider: session.provider,
                biometricId,
                quantumSigned: binding.quantumSigned
            });
            return binding;
        }
        catch (error) {
            logger_1.logger.error('Biometric binding failed', {
                sessionId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    /**
     * Get available IAM providers
     */
    getAvailableProviders() {
        return Array.from(this.providers.values());
    }
    /**
     * Get quantum-safe providers only
     */
    getQuantumSafeProviders() {
        return Array.from(this.providers.values()).filter(p => p.quantumSafe);
    }
    /**
     * Get compliance information for all providers
     */
    getComplianceMatrix() {
        const matrix = {};
        for (const [id, provider] of this.providers) {
            matrix[id] = provider.compliance;
        }
        return matrix;
    }
    /**
     * Validate session and return user info
     */
    async validateSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return null;
        }
        if (session.expiresAt < new Date()) {
            this.sessions.delete(sessionId);
            return null;
        }
        return session;
    }
    // Private helper methods
    async authenticateOIDC(client, credentials) {
        // Implementation depends on specific OIDC flow
        // This is a simplified version
        const tokenSet = new openid_client_1.TokenSet(credentials.tokens);
        const userinfo = await client.client.userinfo(tokenSet);
        const user = {
            id: userinfo.sub,
            username: userinfo.preferred_username || userinfo.email,
            email: userinfo.email,
            displayName: userinfo.name,
            groups: userinfo.groups || [],
            roles: userinfo.roles || [],
            attributes: userinfo,
            provider: 'oidc'
        };
        return { user, tokens: credentials.tokens };
    }
    async authenticateLDAP(client, credentials) {
        return new Promise((resolve, reject) => {
            const searchFilter = `(sAMAccountName=${credentials.username})`;
            const searchOptions = {
                scope: 'sub',
                filter: searchFilter,
                attributes: ['sAMAccountName', 'mail', 'displayName', 'memberOf']
            };
            client.client.search(credentials.baseDN, searchOptions, (err, res) => {
                if (err) {
                    reject(err);
                    return;
                }
                res.on('searchEntry', (entry) => {
                    const user = {
                        id: entry.object.sAMAccountName,
                        username: entry.object.sAMAccountName,
                        email: entry.object.mail,
                        displayName: entry.object.displayName,
                        groups: entry.object.memberOf || [],
                        roles: [],
                        attributes: entry.object,
                        provider: 'ldap'
                    };
                    resolve(user);
                });
                res.on('error', (err) => {
                    reject(err);
                });
            });
        });
    }
    async storeBiometricBinding(binding) {
        // Implement secure storage (database, encrypted file, etc.)
        logger_1.logger.debug('Storing biometric binding', { binding });
    }
    generateSessionId() {
        return 'sess_' + require('crypto').randomBytes(16).toString('hex');
    }
}
exports.IAMConnector = IAMConnector;
//# sourceMappingURL=iam-connector.js.map