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
export interface IAMProvider {
    id: string;
    name: string;
    type: 'oidc' | 'saml' | 'ldap' | 'oauth2';
    config: any;
    quantumSafe: boolean;
    compliance: string[];
}
export interface IAMUser {
    id: string;
    username: string;
    email: string;
    displayName: string;
    groups: string[];
    roles: string[];
    attributes: Record<string, any>;
    provider: string;
    quantumVerified?: boolean;
}
export interface BiometricBinding {
    userId: string;
    provider: string;
    biometricId: string;
    bindingDate: Date;
    quantumSigned: boolean;
    complianceFlags: string[];
}
export interface IAMSession {
    sessionId: string;
    userId: string;
    provider: string;
    accessToken?: string;
    refreshToken?: string;
    idToken?: string;
    quantumToken?: any;
    expiresAt: Date;
    mfaVerified: boolean;
    biometricVerified: boolean;
}
export declare class IAMConnector {
    private providers;
    private clients;
    private pqcManager;
    private sessions;
    constructor();
    /**
     * Initialize supported IAM providers with modular configuration
     */
    private initializeProviders;
    /**
     * Register a new IAM provider (modular expansion)
     */
    registerProvider(provider: IAMProvider): Promise<void>;
    /**
     * Initialize OpenID Connect client
     */
    private initializeOIDCClient;
    /**
     * Initialize SAML client
     */
    private initializeSAMLClient;
    /**
     * Initialize LDAP client
     */
    private initializeLDAPClient;
    /**
     * Authenticate user with IAM provider
     */
    authenticateUser(providerId: string, credentials: any): Promise<IAMSession>;
    /**
     * Bind biometric identity to IAM user
     */
    bindBiometricIdentity(sessionId: string, biometricId: string, verificationResult: any): Promise<BiometricBinding>;
    /**
     * Get available IAM providers
     */
    getAvailableProviders(): IAMProvider[];
    /**
     * Get quantum-safe providers only
     */
    getQuantumSafeProviders(): IAMProvider[];
    /**
     * Get compliance information for all providers
     */
    getComplianceMatrix(): Record<string, string[]>;
    /**
     * Validate session and return user info
     */
    validateSession(sessionId: string): Promise<IAMSession | null>;
    private authenticateOIDC;
    private authenticateLDAP;
    private storeBiometricBinding;
    private generateSessionId;
}
//# sourceMappingURL=iam-connector.d.ts.map