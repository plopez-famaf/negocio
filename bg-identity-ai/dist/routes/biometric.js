"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.biometricRoutes = void 0;
const express_1 = require("express");
const logger_1 = require("@/lib/logger");
const threat_detection_service_1 = require("@/services/threat-detection-service");
const router = (0, express_1.Router)();
exports.biometricRoutes = router;
const threatService = new threat_detection_service_1.ThreatDetectionService();
// Real-time threat detection endpoint
router.post('/detect-realtime', async (req, res) => {
    try {
        const { events, source, timestamp } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        if (!events || !Array.isArray(events)) {
            return res.status(400).json({ error: 'Events array is required' });
        }
        logger_1.logger.info('Real-time threat detection requested', {
            userId,
            eventCount: events.length,
            source
        });
        const result = await threatService.detectThreatsRealtime(events, source, userId);
        logger_1.logger.info('Real-time threat detection completed', {
            userId,
            threatsFound: result.threatsDetected,
            riskScore: result.overallRiskScore
        });
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error('Real-time threat detection failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.user?.id
        });
        res.status(500).json({ error: 'Real-time threat detection failed' });
    }
});
// Fingerprint verification endpoint
router.post('/verify-fingerprint', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No fingerprint image provided' });
        }
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        logger_1.logger.info('Fingerprint verification requested', {
            userId,
            fileSize: req.file.size
        });
        const result = await biometricService.verifyFingerprint(userId, req.file.buffer);
        logger_1.logger.info('Fingerprint verification completed', {
            userId,
            success: result.verified,
            confidence: result.confidence
        });
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error('Fingerprint verification failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.user?.id
        });
        res.status(500).json({ error: 'Fingerprint verification failed' });
    }
});
// Enroll biometric data
router.post('/enroll', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No biometric data provided' });
        }
        const { type } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        if (!['face', 'fingerprint'].includes(type)) {
            return res.status(400).json({ error: 'Invalid biometric type' });
        }
        logger_1.logger.info('Biometric enrollment requested', {
            userId,
            type,
            fileSize: req.file.size
        });
        const result = await biometricService.enrollBiometric(userId, type, req.file.buffer);
        logger_1.logger.info('Biometric enrollment completed', {
            userId,
            type,
            success: result.success
        });
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error('Biometric enrollment failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.user?.id
        });
        res.status(500).json({ error: 'Biometric enrollment failed' });
    }
});
// Liveness detection endpoint
router.post('/liveness-detection', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }
        logger_1.logger.info('Liveness detection requested', {
            fileSize: req.file.size,
            mimeType: req.file.mimetype
        });
        const result = await biometricService.detectLiveness(req.file.buffer);
        logger_1.logger.info('Liveness detection completed', {
            isLive: result.isLive,
            confidence: result.confidence,
            livenessScore: result.livenessScore
        });
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error('Liveness detection failed', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        res.status(500).json({ error: 'Liveness detection failed' });
    }
});
// Multi-modal verification endpoint
router.post('/verify-multimodal', upload.fields([
    { name: 'face', maxCount: 1 },
    { name: 'fingerprint', maxCount: 1 },
    { name: 'voice', maxCount: 1 }
]), async (req, res) => {
    try {
        const files = req.files;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        if (!files?.face?.[0]) {
            return res.status(400).json({ error: 'Face image is required for multi-modal verification' });
        }
        logger_1.logger.info('Multi-modal verification requested', {
            userId,
            hasFingerprint: !!files?.fingerprint?.[0],
            hasVoice: !!files?.voice?.[0],
            faceImageSize: files.face[0].size
        });
        const result = await biometricService.performMultiModalVerification(userId, files.face[0].buffer, files?.fingerprint?.[0]?.buffer, files?.voice?.[0]?.buffer);
        // Record verification attempt
        await biometricService.recordVerificationAttempt(userId, result.faceResult, 'multimodal');
        logger_1.logger.info('Multi-modal verification completed', {
            userId,
            overallVerified: result.overallVerified,
            overallConfidence: result.overallConfidence,
            riskScore: result.riskScore
        });
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error('Multi-modal verification failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.user?.id
        });
        res.status(500).json({ error: 'Multi-modal verification failed' });
    }
});
// Get verification history
router.get('/history/:userId?', async (req, res) => {
    try {
        const userId = req.params.userId || req.user?.id;
        const limit = parseInt(req.query.limit) || 10;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        // Only allow users to see their own history, unless they're admin
        if (userId !== req.user?.id && req.user?.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        const history = await biometricService.getVerificationHistory(userId, limit);
        logger_1.logger.info('Verification history retrieved', {
            userId,
            historyLength: history.length
        });
        res.json({ userId, history });
    }
    catch (error) {
        logger_1.logger.error('Failed to retrieve verification history', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.params.userId || req.user?.id
        });
        res.status(500).json({ error: 'Failed to retrieve history' });
    }
});
// Health check for biometric service
router.get('/health', async (req, res) => {
    try {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            service: 'bg-identity-ai',
            version: '1.0.0',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            // Test Redis connection
            redis: 'connected' // Simplified for now
        };
        res.json(health);
    }
    catch (error) {
        logger_1.logger.error('Health check failed', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        res.status(500).json({
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
//# sourceMappingURL=biometric.js.map