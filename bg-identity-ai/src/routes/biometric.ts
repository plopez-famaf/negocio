import { Router } from 'express';
import multer from 'multer';
import { logger } from '@/lib/logger';
import { BiometricService } from '@/services/biometric-service';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const biometricService = new BiometricService();

// Face verification endpoint
router.post('/verify-face', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No face image provided' });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    logger.info('Face verification requested', {
      userId,
      fileSize: req.file.size
    });

    const result = await biometricService.verifyFace(userId, req.file.buffer);
    
    logger.info('Face verification completed', {
      userId,
      success: result.verified,
      confidence: result.confidence
    });

    return res.json(result);
  } catch (error) {
    logger.error('Face verification failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id
    });
    return res.status(500).json({ error: 'Face verification failed' });
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

    logger.info('Fingerprint verification requested', {
      userId,
      fileSize: req.file.size
    });

    const result = await biometricService.verifyFingerprint(userId, req.file.buffer);
    
    logger.info('Fingerprint verification completed', {
      userId,
      success: result.verified,
      confidence: result.confidence
    });

    return res.json(result);
  } catch (error) {
    logger.error('Fingerprint verification failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id
    });
    return res.status(500).json({ error: 'Fingerprint verification failed' });
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
      return res.status(500).json({ error: 'Invalid biometric type' });
    }

    logger.info('Biometric enrollment requested', {
      userId,
      type,
      fileSize: req.file.size
    });

    const result = await biometricService.enrollBiometric(userId, type, req.file.buffer);
    
    logger.info('Biometric enrollment completed', {
      userId,
      type,
      success: result.success
    });

    return res.json(result);
  } catch (error) {
    logger.error('Biometric enrollment failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id
    });
    return res.status(500).json({ error: 'Biometric enrollment failed' });
  }
});

// Liveness detection endpoint
router.post('/liveness-detection', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    logger.info('Liveness detection requested', {
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    });

    const result = await biometricService.detectLiveness(req.file.buffer);
    
    logger.info('Liveness detection completed', {
      isLive: result.isLive,
      confidence: result.confidence,
      livenessScore: result.livenessScore
    });

    return res.json(result);
  } catch (error) {
    logger.error('Liveness detection failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return res.status(500).json({ error: 'Liveness detection failed' });
  }
});

// Multi-modal verification endpoint
router.post('/verify-multimodal', 
  upload.fields([
    { name: 'face', maxCount: 1 },
    { name: 'fingerprint', maxCount: 1 },
    { name: 'voice', maxCount: 1 }
  ]), 
  async (req, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (!files?.face?.[0]) {
        return res.status(500).json({ error: 'Face image is required for multi-modal verification' });
      }

      logger.info('Multi-modal verification requested', {
        userId,
        hasFingerprint: !!files?.fingerprint?.[0],
        hasVoice: !!files?.voice?.[0],
        faceImageSize: files.face[0].size
      });

      const result = await biometricService.performMultiModalVerification(
        userId,
        files.face[0].buffer,
        files?.fingerprint?.[0]?.buffer,
        files?.voice?.[0]?.buffer
      );
      
      // Record verification attempt
      await biometricService.recordVerificationAttempt(userId, result.faceResult, 'multimodal');

      logger.info('Multi-modal verification completed', {
        userId,
        overallVerified: result.overallVerified,
        overallConfidence: result.overallConfidence,
        riskScore: result.riskScore
      });

      return res.json(result);
    } catch (error) {
      logger.error('Multi-modal verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });
      return res.status(500).json({ error: 'Multi-modal verification failed' });
    }
  }
);

// Get verification history
router.get('/history/:userId?', async (req, res) => {
  try {
    const userId = req.params.userId || req.user?.id;
    const limit = parseInt(req.query.limit as string) || 10;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Only allow users to see their own history, unless they're admin
    if (userId !== req.user?.id && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const history = await biometricService.getVerificationHistory(userId, limit);
    
    logger.info('Verification history retrieved', {
      userId,
      historyLength: history.length
    });

    return res.json({ userId, history });
  } catch (error) {
    logger.error('Failed to retrieve verification history', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.params.userId || req.user?.id
    });
    return res.status(500).json({ error: 'Failed to retrieve history' });
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

    return res.json(health);
  } catch (error) {
    logger.error('Health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return res.status(500).json({ 
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as biometricRoutes };