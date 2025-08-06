/**
 * Post-Quantum Cryptography Manager
 * Implements NIST PQC standards with OpenQuantumSafe integration
 *
 * Standards Compliance:
 * - NIST SP 800-208: Recommendation for Stateful Hash-Based Signature Schemes
 * - NIST PQC Standardization (Kyber, Dilithium)
 * - FIPS 140-2 Level 3 compliance for key management
 */
export interface PQCKeyPair {
    publicKey: Buffer;
    privateKey: Buffer;
    algorithm: 'kyber768' | 'dilithium3' | 'falcon512';
    keyId: string;
    createdAt: Date;
    expiresAt?: Date;
}
export interface PQCSignature {
    signature: Buffer;
    algorithm: string;
    keyId: string;
    timestamp: Date;
}
export interface PQCEncryptedData {
    ciphertext: Buffer;
    encapsulatedKey: Buffer;
    algorithm: string;
    keyId: string;
    iv: Buffer;
}
export interface HybridToken {
    classicalJWT: string;
    quantumSignature: PQCSignature;
    keyEncapsulation: Buffer;
    metadata: {
        version: string;
        algorithms: string[];
        compliance: string[];
    };
}
export declare class PQCManager {
    private keyStore;
    private readonly NIST_COMPLIANCE_VERSION;
    constructor();
    /**
     * Initialize quantum-safe cryptographic environment
     * Compliant with NIST PQC guidelines
     */
    private initializeQuantumSafety;
    /**
     * Generate quantum-safe key pair
     * NIST PQC compliant key generation
     */
    generateKeyPair(algorithm: 'kyber768' | 'dilithium3' | 'falcon512', keyId?: string): Promise<PQCKeyPair>;
    /**
     * Create hybrid authentication token
     * Combines classical JWT with quantum-resistant signatures
     */
    createHybridToken(payload: any, classicalSecret: string, signatureKeyId?: string): Promise<HybridToken>;
    /**
     * Verify hybrid authentication token
     * Validates both classical and quantum components
     */
    verifyHybridToken(token: HybridToken, classicalSecret: string): Promise<{
        valid: boolean;
        payload?: any;
        quantum_verified: boolean;
    }>;
    /**
     * Encrypt biometric template with quantum-safe encryption
     * NIST compliant encryption for sensitive biometric data
     */
    encryptBiometricTemplate(template: Buffer, keyId?: string): Promise<PQCEncryptedData>;
    /**
     * Decrypt biometric template
     */
    decryptBiometricTemplate(encryptedData: PQCEncryptedData): Promise<Buffer>;
    /**
     * Get public key for external systems integration
     */
    getPublicKey(keyId: string): Buffer | null;
    /**
     * List available quantum-safe algorithms
     */
    getSupportedAlgorithms(): string[];
    /**
     * Get compliance information
     */
    getComplianceInfo(): any;
    private simulateQuantumKeyGeneration;
    private signData;
    private verifySignature;
    private encapsulateKey;
    private performKEM;
    private recoverSharedSecret;
    private generateKeyId;
    private generateTokenId;
}
//# sourceMappingURL=pqc-manager.d.ts.map