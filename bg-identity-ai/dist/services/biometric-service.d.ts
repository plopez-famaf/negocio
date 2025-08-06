import { BiometricVerificationResult, BiometricEnrollmentResult, LivenessDetectionResult } from '@/types/biometric';
export declare class BiometricService {
    private redis;
    private pqcManager;
    private iamConnector;
    private complianceManager;
    constructor();
    verifyFace(userId: string, imageBuffer: Buffer): Promise<BiometricVerificationResult>;
    verifyFingerprint(userId: string, imageBuffer: Buffer): Promise<BiometricVerificationResult>;
    enrollBiometric(userId: string, type: 'face' | 'fingerprint', imageBuffer: Buffer): Promise<BiometricEnrollmentResult>;
    detectLiveness(imageBuffer: Buffer): Promise<LivenessDetectionResult>;
    performMultiModalVerification(userId: string, faceImage: Buffer, fingerprintImage?: Buffer, voiceSample?: Buffer): Promise<{
        overallVerified: boolean;
        overallConfidence: number;
        faceResult: BiometricVerificationResult;
        fingerprintResult?: BiometricVerificationResult;
        voiceResult?: any;
        riskScore: number;
    }>;
    getBiometricTemplate(userId: string, type: 'face' | 'fingerprint'): Promise<string | null>;
    storeBiometricTemplate(userId: string, type: 'face' | 'fingerprint', template: string): Promise<void>;
    getVerificationHistory(userId: string, limit?: number): Promise<any[]>;
    recordVerificationAttempt(userId: string, result: BiometricVerificationResult, type: 'face' | 'fingerprint' | 'multimodal'): Promise<void>;
    private verifyVoice;
    private calculateLivenessScore;
    private assessImageQuality;
    private calculateRiskScore;
    private simulateProcessingDelay;
    cleanup(): Promise<void>;
}
//# sourceMappingURL=biometric-service.d.ts.map