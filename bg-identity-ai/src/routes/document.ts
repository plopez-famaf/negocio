import { Router } from 'express';
import multer from 'multer';
import { logger } from '@/lib/logger';
import { DocumentService } from '@/services/document-service';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB limit for documents
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF are allowed.'));
    }
  }
});

const documentService = new DocumentService();

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
      return res.status(400).json({ error: 'Invalid document type' });
    }

    logger.info('Document verification requested', {
      userId,
      documentType,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    });

    const result = await documentService.verifyDocument(
      userId,
      documentType,
      req.file.buffer,
      req.file.mimetype
    );
    
    logger.info('Document verification completed', {
      userId,
      documentType,
      success: result.verified,
      confidence: result.confidence
    });

    res.json(result);
  } catch (error) {
    logger.error('Document verification failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id
    });
    res.status(500).json({ error: 'Document verification failed' });
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

    logger.info('Text extraction requested', {
      userId,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    });

    const result = await documentService.extractText(
      req.file.buffer,
      req.file.mimetype
    );
    
    logger.info('Text extraction completed', {
      userId,
      textLength: result.text.length,
      confidence: result.confidence
    });

    res.json(result);
  } catch (error) {
    logger.error('Text extraction failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id
    });
    res.status(500).json({ error: 'Text extraction failed' });
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

    logger.info('Document authentication requested', {
      userId,
      documentType,
      issuer,
      fileSize: req.file.size
    });

    const result = await documentService.authenticateDocument(
      userId,
      documentType,
      issuer,
      req.file.buffer,
      req.file.mimetype
    );
    
    logger.info('Document authentication completed', {
      userId,
      documentType,
      authentic: result.authentic,
      confidence: result.confidence
    });

    res.json(result);
  } catch (error) {
    logger.error('Document authentication failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id
    });
    res.status(500).json({ error: 'Document authentication failed' });
  }
});

export { router as documentRoutes };