import { DocumentVerificationResult, TextExtractionResult, DocumentAuthenticationResult } from '@/types/document';
export declare class DocumentService {
    verifyDocument(userId: string, documentType: string, documentBuffer: Buffer, mimeType: string): Promise<DocumentVerificationResult>;
    extractText(documentBuffer: Buffer, mimeType: string): Promise<TextExtractionResult>;
    authenticateDocument(userId: string, documentType: string, issuer: string, documentBuffer: Buffer, mimeType: string): Promise<DocumentAuthenticationResult>;
    private simulateProcessingDelay;
}
//# sourceMappingURL=document-service.d.ts.map