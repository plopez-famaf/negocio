export interface BiometricVerificationResult {
  verified: boolean;
  confidence: number;
  timestamp: string;
  processingTime: number;
  metadata: {
    modelVersion: string;
    imageQuality: string;
    [key: string]: any;
  };
}

export interface BiometricEnrollmentResult {
  success: boolean;
  templateId: string;
  quality: number;
  timestamp: string;
  metadata: {
    modelVersion: string;
    extractedFeatures: number;
    imageQuality: string;
    [key: string]: any;
  };
}

export interface BiometricTemplate {
  id: string;
  userId: string;
  type: 'face' | 'fingerprint';
  template: Buffer;
  quality: number;
  createdAt: string;
  updatedAt: string;
}

export interface LivenessDetectionResult {
  isLive: boolean;
  confidence: number;
  livenessScore: number;
  timestamp: string;
  processingTime: number;
  metadata?: {
    imageHash?: string;
    detectionMethod?: string;
    imageQuality?: 'poor' | 'fair' | 'good' | 'excellent';
    motionDetected?: boolean;
    eyeBlinkDetected?: boolean;
    lightReflection?: boolean;
  };
}