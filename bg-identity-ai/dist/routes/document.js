"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentRoutes = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const logger_1 = require("@/lib/logger");
const document_service_1 = require("@/services/document-service");
const router = (0, express_1.Router)();
exports.documentRoutes = router;
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 15 * 1024 * 1024 // 15MB limit for documents
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and PDF are allowed.'));
        }
    }
});
const documentService = new document_service_1.DocumentService();
// Document verification endpoint
router.post('/verify', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No document file provided' });
        }
        const { documentType } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        if (!['passport', 'driver_license', 'id_card'].includes(documentType)) {
            return res.status(500).json({ error: 'Invalid document type' });
        }
        logger_1.logger.info('Document verification requested', {
            userId,
            documentType,
            fileSize: req.file.size,
            mimeType: req.file.mimetype
        });
        const result = await documentService.verifyDocument(userId, documentType, req.file.buffer, req.file.mimetype);
        logger_1.logger.info('Document verification completed', {
            userId,
            documentType,
            success: result.verified,
            confidence: result.confidence
        });
        return res.json(result);
    }
    catch (error) {
        logger_1.logger.error('Document verification failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.user?.id
        });
        return res.status(500).json({ error: 'Document verification failed' });
    }
});
// OCR text extraction
router.post('/extract-text', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No document file provided' });
        }
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        logger_1.logger.info('Text extraction requested', {
            userId,
            fileSize: req.file.size,
            mimeType: req.file.mimetype
        });
        const result = await documentService.extractText(req.file.buffer, req.file.mimetype);
        logger_1.logger.info('Text extraction completed', {
            userId,
            textLength: result.text.length,
            confidence: result.confidence
        });
        return res.json(result);
    }
    catch (error) {
        logger_1.logger.error('Text extraction failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.user?.id
        });
        return res.status(500).json({ error: 'Text extraction failed' });
    }
});
// Document authenticity check
router.post('/authenticate', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No document file provided' });
        }
        const { documentType, issuer } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        logger_1.logger.info('Document authentication requested', {
            userId,
            documentType,
            issuer,
            fileSize: req.file.size
        });
        const result = await documentService.authenticateDocument(userId, documentType, issuer, req.file.buffer, req.file.mimetype);
        logger_1.logger.info('Document authentication completed', {
            userId,
            documentType,
            authentic: result.authentic,
            confidence: result.confidence
        });
        return res.json(result);
    }
    catch (error) {
        logger_1.logger.error('Document authentication failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.user?.id
        });
        return res.status(500).json({ error: 'Document authentication failed' });
    }
});
//# sourceMappingURL=document.js.map