export interface DocumentVerificationResult {
  verified: boolean;
  confidence: number;
  documentType: string;
  extractedData: {
    name?: string;
    documentNumber?: string;
    issueDate?: string;
    expiryDate?: string;
    issuer?: string;
    [key: string]: any;
  };
  securityFeatures: {
    watermark: boolean;
    hologram: boolean;
    rfidChip: boolean;
    microprint: boolean;
    [key: string]: boolean;
  };
  timestamp: string;
  processingTime: number;
  metadata: {
    modelVersion: string;
    imageQuality: string;
    pageCount: number;
    [key: string]: any;
  };
}

export interface TextExtractionResult {
  text: string;
  confidence: number;
  language: string;
  timestamp: string;
  processingTime: number;
  metadata: {
    ocrVersion: string;
    wordsDetected: number;
    imageQuality: string;
    [key: string]: any;
  };
}

export interface DocumentAuthenticationResult {
  authentic: boolean;
  confidence: number;
  documentType: string;
  issuer: string;
  riskScore: number;
  anomalies: string[];
  securityChecks: {
    fontConsistency: boolean;
    layoutStructure: boolean;
    securityFeatures: boolean;
    digitalSignature: boolean | null;
    [key: string]: boolean | null;
  };
  timestamp: string;
  processingTime: number;
  metadata: {
    modelVersion: string;
    checksPerformed: number;
    databaseVersion: string;
    [key: string]: any;
  };
}