# BG Identity AI Service

**BehaviorGuard Identity AI Service** - Biometric verification and document processing microservice.

## Overview

This service provides AI-powered identity verification capabilities including:

- **Biometric Verification**: Face recognition and fingerprint matching
- **Document Processing**: ID card, passport, and driver's license verification
- **OCR Text Extraction**: Automated text extraction from documents
- **Document Authentication**: Security feature analysis and fraud detection

## Architecture

- **Framework**: Express.js with TypeScript
- **Authentication**: JWT-based with inter-service communication
- **File Processing**: Multer for multipart uploads
- **Logging**: Structured logging with Winston
- **Security**: Helmet, CORS, input validation

## API Endpoints

### Health Checks
- `GET /health` - Service health status
- `GET /health/ready` - Readiness probe

### Biometric Verification
- `POST /api/biometric/verify-face` - Face verification
- `POST /api/biometric/verify-fingerprint` - Fingerprint verification  
- `POST /api/biometric/enroll` - Enroll biometric data

### Document Processing
- `POST /api/document/verify` - Document verification
- `POST /api/document/extract-text` - OCR text extraction
- `POST /api/document/authenticate` - Document authenticity check

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
npm start
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
PORT=3001
JWT_SECRET=your-jwt-secret
ALLOWED_ORIGINS=http://localhost:3000
LOG_LEVEL=info
```

## AI Model Integration

This service is designed to integrate with:

- **Face Recognition**: Azure Face API, AWS Rekognition, or custom models
- **OCR Processing**: AWS Textract, Google Vision API, or Tesseract
- **Document Analysis**: Custom ML models for security feature detection

## Security

- JWT authentication for all API endpoints
- File type validation and size limits
- Input sanitization and validation
- Structured logging for audit trails
- Security headers and CORS configuration

## Production Deployment

- Configure external AI service APIs
- Set up secure file storage (S3, Azure Blob)
- Configure Redis for caching and sessions
- Set up monitoring and alerting
- Enable HTTPS and security headers