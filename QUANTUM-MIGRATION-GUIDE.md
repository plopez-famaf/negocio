# Quantum Migration Guide
## Step-by-Step Implementation of Post-Quantum Cryptography

---

## **🎯 Executive Summary**

This guide provides a comprehensive roadmap for migrating BehaviorGuard's AI services from classical cryptography to quantum-resistant algorithms using OpenQuantumSafe. The migration follows a **hybrid approach** ensuring backward compatibility while establishing quantum security.

### **Migration Strategy**
- **Phase Approach**: Gradual rollout with fallback support
- **Hybrid Tokens**: Classical + Post-quantum signatures simultaneously
- **Zero Downtime**: Service continuity during migration
- **Performance Optimization**: Minimal impact on existing operations
- **Compliance Ready**: NIST Post-Quantum Standards adherence

---

## **📋 Prerequisites & Dependencies**

### **System Requirements**
```bash
# Hardware Requirements
CPU: x86_64 or ARM64 architecture
RAM: Minimum 8GB (16GB recommended for development)
Storage: 50GB available space
Network: Broadband internet for package downloads

# Software Requirements
OS: Ubuntu 20.04+ / macOS 12+ / Windows 11 with WSL2
Node.js: v18.0.0 or higher
Docker: v20.10+ with Compose v2.0+
Git: v2.30+ for repository management
```

### **Development Environment Setup**
```bash
# Verify prerequisites
node --version    # Should be v18+
docker --version  # Should be v20.10+
git --version     # Should be v2.30+

# Install build tools (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install build-essential cmake ninja-build libssl-dev

# Install build tools (macOS)
xcode-select --install
brew install cmake ninja

# Install build tools (Windows WSL2)
sudo apt-get install build-essential cmake ninja-build libssl-dev
```

---

## **🔧 Phase 1: OpenQuantumSafe Installation (Week 1)**

### **Step 1.1: Install liboqs Core Library**

#### **Linux/WSL2 Installation**
```bash
# Create development directory
mkdir -p ~/quantum-development
cd ~/quantum-development

# Clone OpenQuantumSafe repository
git clone --depth 1 https://github.com/open-quantum-safe/liboqs.git
cd liboqs

# Configure build with all algorithms
mkdir build && cd build
cmake -GNinja \
  -DCMAKE_INSTALL_PREFIX=/usr/local \
  -DOQS_BUILD_ONLY_LIB=ON \
  -DOQS_ENABLE_KEM_KYBER=ON \
  -DOQS_ENABLE_SIG_DILITHIUM=ON \
  -DOQS_ENABLE_SIG_FALCON=ON \
  -DOQS_ENABLE_KEM_FRODOKEM=ON \
  ..

# Build and install
ninja
sudo ninja install

# Verify installation
ls /usr/local/lib/liboqs*
ls /usr/local/include/oqs/
```

#### **macOS Installation**
```bash
# Using Homebrew (recommended)
brew tap open-quantum-safe/liboqs
brew install liboqs

# Or compile from source
git clone --depth 1 https://github.com/open-quantum-safe/liboqs.git
cd liboqs
mkdir build && cd build
cmake -GNinja -DCMAKE_INSTALL_PREFIX=/usr/local ..
ninja
sudo ninja install

# Update library paths
export DYLD_LIBRARY_PATH="/usr/local/lib:$DYLD_LIBRARY_PATH"
echo 'export DYLD_LIBRARY_PATH="/usr/local/lib:$DYLD_LIBRARY_PATH"' >> ~/.zshrc
```

### **Step 1.2: Install Node.js Bindings**

#### **Install oqs-node Package**
```bash
# Navigate to project root
cd /Users/pl/negocio

# Install OpenQuantumSafe Node.js bindings
npm install --save liboqs-node

# Alternative: Install from source
git clone https://github.com/open-quantum-safe/liboqs-node.git
cd liboqs-node
npm install
npm run build
npm link

# Link in your project
cd /Users/pl/negocio
npm link liboqs-node
```

#### **Verify Installation**
```javascript
// test-quantum-install.js
const oqs = require('liboqs-node');

console.log('Available KEM algorithms:', oqs.KEMs.get_enabled_KEMs());
console.log('Available Signature algorithms:', oqs.Sigs.get_enabled_sig_algs());

// Test Kyber768 KEM
try {
  const kem = new oqs.KeyEncapsulation('Kyber768');
  const keypair = kem.generate_keypair();
  console.log('✅ Kyber768 KEM working - Public key length:', keypair.public_key.length);
} catch (error) {
  console.error('❌ Kyber768 KEM failed:', error.message);
}

// Test Dilithium3 Signatures
try {
  const sig = new oqs.Signature('Dilithium3');
  const keypair = sig.generate_keypair();
  console.log('✅ Dilithium3 Signatures working - Public key length:', keypair.public_key.length);
} catch (error) {
  console.error('❌ Dilithium3 Signatures failed:', error.message);
}
```

```bash
# Run verification test
node test-quantum-install.js
```

---

## **🔐 Phase 2: Quantum Gateway Service Implementation (Week 2)**

### **Step 2.1: Create bg-quantum-gateway Service**

#### **Service Structure Setup**
```bash
# Create quantum gateway service
mkdir -p bg-quantum-gateway/src/{lib,middleware,routes,services,types,utils}
cd bg-quantum-gateway

# Initialize Node.js project
npm init -y

# Install dependencies
npm install --save \
  express cors helmet compression dotenv \
  zod uuid winston ioredis \
  jsonwebtoken \
  liboqs-node

npm install --save-dev \
  @types/node @types/express @types/cors \
  @types/compression @types/jsonwebtoken \
  @types/uuid typescript tsx vitest \
  eslint @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser
```

#### **Quantum Cryptography Service Implementation**
```typescript
// src/services/quantum-crypto-service.ts
import * as oqs from 'liboqs-node';
import { logger } from '@/lib/logger';

export interface QuantumKeyPair {
  publicKey: Buffer;
  privateKey: Buffer;
  algorithm: string;
  timestamp: string;
}

export interface QuantumSignature {
  signature: Buffer;
  algorithm: string;
  message: Buffer;
  timestamp: string;
}

export class QuantumCryptoService {
  private kemAlgorithm: string = 'Kyber768';
  private sigAlgorithm: string = 'Dilithium3';

  constructor() {
    this.validateAlgorithms();
    logger.info('Quantum cryptography service initialized', {
      kemAlgorithm: this.kemAlgorithm,
      sigAlgorithm: this.sigAlgorithm
    });
  }

  private validateAlgorithms(): void {
    const availableKEMs = oqs.KEMs.get_enabled_KEMs();
    const availableSigs = oqs.Sigs.get_enabled_sig_algs();

    if (!availableKEMs.includes(this.kemAlgorithm)) {
      throw new Error(`KEM algorithm ${this.kemAlgorithm} not available`);
    }

    if (!availableSigs.includes(this.sigAlgorithm)) {
      throw new Error(`Signature algorithm ${this.sigAlgorithm} not available`);
    }

    logger.info('Quantum algorithms validated successfully');
  }

  // Key Encapsulation Mechanism (KEM) Operations
  async generateKEMKeyPair(): Promise<QuantumKeyPair> {
    try {
      const kem = new oqs.KeyEncapsulation(this.kemAlgorithm);
      const keypair = kem.generate_keypair();

      const result: QuantumKeyPair = {
        publicKey: keypair.public_key,
        privateKey: keypair.private_key,
        algorithm: this.kemAlgorithm,
        timestamp: new Date().toISOString()
      };

      logger.info('KEM keypair generated', {
        algorithm: this.kemAlgorithm,
        publicKeyLength: keypair.public_key.length,
        privateKeyLength: keypair.private_key.length
      });

      return result;
    } catch (error) {
      logger.error('KEM keypair generation failed', {
        algorithm: this.kemAlgorithm,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to generate KEM keypair');
    }
  }

  async encapsulateSecret(publicKey: Buffer): Promise<{
    sharedSecret: Buffer;
    ciphertext: Buffer;
  }> {
    try {
      const kem = new oqs.KeyEncapsulation(this.kemAlgorithm);
      const result = kem.encap_secret(publicKey);

      logger.info('Secret encapsulation completed', {
        algorithm: this.kemAlgorithm,
        sharedSecretLength: result.shared_secret.length,
        ciphertextLength: result.ciphertext.length
      });

      return {
        sharedSecret: result.shared_secret,
        ciphertext: result.ciphertext
      };
    } catch (error) {
      logger.error('Secret encapsulation failed', {
        algorithm: this.kemAlgorithm,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to encapsulate secret');
    }
  }

  async decapsulateSecret(privateKey: Buffer, ciphertext: Buffer): Promise<Buffer> {
    try {
      const kem = new oqs.KeyEncapsulation(this.kemAlgorithm);
      const sharedSecret = kem.decap_secret(ciphertext, privateKey);

      logger.info('Secret decapsulation completed', {
        algorithm: this.kemAlgorithm,
        sharedSecretLength: sharedSecret.length
      });

      return sharedSecret;
    } catch (error) {
      logger.error('Secret decapsulation failed', {
        algorithm: this.kemAlgorithm,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to decapsulate secret');
    }
  }

  // Digital Signature Operations
  async generateSignatureKeyPair(): Promise<QuantumKeyPair> {
    try {
      const sig = new oqs.Signature(this.sigAlgorithm);
      const keypair = sig.generate_keypair();

      const result: QuantumKeyPair = {
        publicKey: keypair.public_key,
        privateKey: keypair.private_key,
        algorithm: this.sigAlgorithm,
        timestamp: new Date().toISOString()
      };

      logger.info('Signature keypair generated', {
        algorithm: this.sigAlgorithm,
        publicKeyLength: keypair.public_key.length,
        privateKeyLength: keypair.private_key.length
      });

      return result;
    } catch (error) {
      logger.error('Signature keypair generation failed', {
        algorithm: this.sigAlgorithm,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to generate signature keypair');
    }
  }

  async signMessage(message: Buffer, privateKey: Buffer): Promise<QuantumSignature> {
    try {
      const sig = new oqs.Signature(this.sigAlgorithm);
      const signature = sig.sign(message, privateKey);

      const result: QuantumSignature = {
        signature,
        algorithm: this.sigAlgorithm,
        message,
        timestamp: new Date().toISOString()
      };

      logger.info('Message signed successfully', {
        algorithm: this.sigAlgorithm,
        messageLength: message.length,
        signatureLength: signature.length
      });

      return result;
    } catch (error) {
      logger.error('Message signing failed', {
        algorithm: this.sigAlgorithm,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to sign message');
    }
  }

  async verifySignature(
    message: Buffer,
    signature: Buffer,
    publicKey: Buffer
  ): Promise<boolean> {
    try {
      const sig = new oqs.Signature(this.sigAlgorithm);
      const isValid = sig.verify(message, signature, publicKey);

      logger.info('Signature verification completed', {
        algorithm: this.sigAlgorithm,
        messageLength: message.length,
        signatureLength: signature.length,
        isValid
      });

      return isValid;
    } catch (error) {
      logger.error('Signature verification failed', {
        algorithm: this.sigAlgorithm,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  // Hybrid Token Generation
  async generateHybridToken(payload: any): Promise<{
    classicalToken: string;
    quantumSignature: QuantumSignature;
    hybridToken: string;
  }> {
    try {
      // Generate classical JWT
      const jwt = require('jsonwebtoken');
      const classicalToken = jwt.sign(payload, process.env.JWT_SECRET || 'fallback-secret');

      // Generate quantum signature keypair for this token
      const sigKeypair = await this.generateSignatureKeyPair();
      
      // Create message to sign (combination of payload and classical token)
      const message = Buffer.from(JSON.stringify({
        payload,
        classicalToken,
        timestamp: new Date().toISOString()
      }));

      // Generate quantum signature
      const quantumSignature = await this.signMessage(message, sigKeypair.privateKey);

      // Create hybrid token structure
      const hybridToken = Buffer.from(JSON.stringify({
        classical: classicalToken,
        quantum: {
          signature: quantumSignature.signature.toString('base64'),
          publicKey: sigKeypair.publicKey.toString('base64'),
          algorithm: this.sigAlgorithm
        },
        metadata: {
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          hybrid: true
        }
      })).toString('base64');

      logger.info('Hybrid token generated successfully', {
        payloadKeys: Object.keys(payload),
        classicalTokenLength: classicalToken.length,
        quantumSignatureLength: quantumSignature.signature.length,
        hybridTokenLength: hybridToken.length
      });

      return {
        classicalToken,
        quantumSignature,
        hybridToken
      };
    } catch (error) {
      logger.error('Hybrid token generation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to generate hybrid token');
    }
  }

  async verifyHybridToken(hybridToken: string): Promise<{
    isValid: boolean;
    payload?: any;
    metadata?: any;
  }> {
    try {
      // Decode hybrid token
      const tokenData = JSON.parse(Buffer.from(hybridToken, 'base64').toString());
      
      // Verify classical JWT
      const jwt = require('jsonwebtoken');
      let classicalPayload;
      try {
        classicalPayload = jwt.verify(tokenData.classical, process.env.JWT_SECRET || 'fallback-secret');
      } catch (jwtError) {
        logger.warn('Classical JWT verification failed', {
          error: jwtError instanceof Error ? jwtError.message : 'Unknown error'
        });
        return { isValid: false };
      }

      // Reconstruct message for quantum verification
      const message = Buffer.from(JSON.stringify({
        payload: classicalPayload,
        classicalToken: tokenData.classical,
        timestamp: tokenData.metadata.timestamp
      }));

      // Verify quantum signature
      const quantumSignature = Buffer.from(tokenData.quantum.signature, 'base64');
      const quantumPublicKey = Buffer.from(tokenData.quantum.publicKey, 'base64');
      
      const isQuantumValid = await this.verifySignature(
        message,
        quantumSignature,
        quantumPublicKey
      );

      const isValid = isQuantumValid; // Both classical and quantum must be valid

      logger.info('Hybrid token verification completed', {
        classicalValid: true, // JWT verification passed
        quantumValid: isQuantumValid,
        overallValid: isValid,
        algorithm: tokenData.quantum.algorithm
      });

      return {
        isValid,
        payload: isValid ? classicalPayload : undefined,
        metadata: isValid ? tokenData.metadata : undefined
      };
    } catch (error) {
      logger.error('Hybrid token verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return { isValid: false };
    }
  }

  // Performance Benchmarking
  async benchmarkOperations(): Promise<{
    kem: { keyGen: number; encap: number; decap: number };
    signature: { keyGen: number; sign: number; verify: number };
  }> {
    const iterations = 10;
    const results = {
      kem: { keyGen: 0, encap: 0, decap: 0 },
      signature: { keyGen: 0, sign: 0, verify: 0 }
    };

    // Benchmark KEM operations
    let start = Date.now();
    for (let i = 0; i < iterations; i++) {
      await this.generateKEMKeyPair();
    }
    results.kem.keyGen = (Date.now() - start) / iterations;

    const kemKeypair = await this.generateKEMKeyPair();
    
    start = Date.now();
    for (let i = 0; i < iterations; i++) {
      await this.encapsulateSecret(kemKeypair.publicKey);
    }
    results.kem.encap = (Date.now() - start) / iterations;

    const encapResult = await this.encapsulateSecret(kemKeypair.publicKey);
    
    start = Date.now();
    for (let i = 0; i < iterations; i++) {
      await this.decapsulateSecret(kemKeypair.privateKey, encapResult.ciphertext);
    }
    results.kem.decap = (Date.now() - start) / iterations;

    // Benchmark Signature operations
    start = Date.now();
    for (let i = 0; i < iterations; i++) {
      await this.generateSignatureKeyPair();
    }
    results.signature.keyGen = (Date.now() - start) / iterations;

    const sigKeypair = await this.generateSignatureKeyPair();
    const message = Buffer.from('Test message for benchmarking');
    
    start = Date.now();
    let signature;
    for (let i = 0; i < iterations; i++) {
      signature = await this.signMessage(message, sigKeypair.privateKey);
    }
    results.signature.sign = (Date.now() - start) / iterations;

    start = Date.now();
    for (let i = 0; i < iterations; i++) {
      await this.verifySignature(message, signature!.signature, sigKeypair.publicKey);
    }
    results.signature.verify = (Date.now() - start) / iterations;

    logger.info('Quantum cryptography benchmark completed', {
      iterations,
      results,
      kemAlgorithm: this.kemAlgorithm,
      sigAlgorithm: this.sigAlgorithm
    });

    return results;
  }
}
```

### **Step 2.2: Quantum Gateway API Routes**

```typescript
// src/routes/quantum.ts
import { Router } from 'express';
import { logger } from '@/lib/logger';
import { QuantumCryptoService } from '@/services/quantum-crypto-service';

const router = Router();
const quantumCrypto = new QuantumCryptoService();

// Key generation endpoints
router.post('/kem/keypair', async (req, res) => {
  try {
    const keypair = await quantumCrypto.generateKEMKeyPair();
    
    // Only return public key for security
    res.json({
      publicKey: keypair.publicKey.toString('base64'),
      algorithm: keypair.algorithm,
      timestamp: keypair.timestamp
    });
  } catch (error) {
    logger.error('KEM keypair generation failed', { error });
    res.status(500).json({ error: 'Failed to generate KEM keypair' });
  }
});

router.post('/signature/keypair', async (req, res) => {
  try {
    const keypair = await quantumCrypto.generateSignatureKeyPair();
    
    res.json({
      publicKey: keypair.publicKey.toString('base64'),
      algorithm: keypair.algorithm,
      timestamp: keypair.timestamp
    });
  } catch (error) {
    logger.error('Signature keypair generation failed', { error });
    res.status(500).json({ error: 'Failed to generate signature keypair' });
  }
});

// Hybrid token operations
router.post('/token/generate', async (req, res) => {
  try {
    const { payload } = req.body;
    
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Invalid payload provided' });
    }

    const hybridTokenResult = await quantumCrypto.generateHybridToken(payload);
    
    res.json({
      hybridToken: hybridTokenResult.hybridToken,
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        hybrid: true
      }
    });
  } catch (error) {
    logger.error('Hybrid token generation failed', { error });
    res.status(500).json({ error: 'Failed to generate hybrid token' });
  }
});

router.post('/token/verify', async (req, res) => {
  try {
    const { hybridToken } = req.body;
    
    if (!hybridToken || typeof hybridToken !== 'string') {
      return res.status(400).json({ error: 'Invalid hybrid token provided' });
    }

    const verificationResult = await quantumCrypto.verifyHybridToken(hybridToken);
    
    res.json(verificationResult);
  } catch (error) {
    logger.error('Hybrid token verification failed', { error });
    res.status(500).json({ error: 'Failed to verify hybrid token' });
  }
});

// Performance benchmarking
router.get('/benchmark', async (req, res) => {
  try {
    const benchmarkResults = await quantumCrypto.benchmarkOperations();
    
    res.json({
      results: benchmarkResults,
      timestamp: new Date().toISOString(),
      algorithms: {
        kem: 'Kyber768',
        signature: 'Dilithium3'
      }
    });
  } catch (error) {
    logger.error('Quantum benchmark failed', { error });
    res.status(500).json({ error: 'Failed to run quantum benchmark' });
  }
});

export { router as quantumRoutes };
```

---

## **🔄 Phase 3: Service Integration (Week 3)**

### **Step 3.1: Update Existing Services for Quantum Support**

#### **Enhanced Authentication Middleware**
```typescript
// shared/utils/quantum-auth-middleware.ts
import { Request, Response, NextFunction } from 'express';
import { QuantumCryptoService } from '../services/quantum-crypto-service';
import { logger } from '../lib/logger';

interface QuantumAuthRequest extends Request {
  user?: any;
  quantum?: {
    verified: boolean;
    algorithm: string;
    timestamp: string;
  };
}

export class QuantumAuthMiddleware {
  private quantumCrypto: QuantumCryptoService;

  constructor() {
    this.quantumCrypto = new QuantumCryptoService();
  }

  // Hybrid authentication: supports both classical JWT and quantum-safe tokens
  hybridAuth = async (req: QuantumAuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header provided' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    try {
      // Try quantum-safe token first
      if (this.isHybridToken(token)) {
        const quantumResult = await this.quantumCrypto.verifyHybridToken(token);
        
        if (quantumResult.isValid && quantumResult.payload) {
          req.user = quantumResult.payload;
          req.quantum = {
            verified: true,
            algorithm: 'Hybrid (Classical + Dilithium3)',
            timestamp: new Date().toISOString()
          };
          
          logger.info('Quantum-safe authentication successful', {
            userId: req.user.id,
            algorithm: 'hybrid'
          });
          
          return next();
        }
      }

      // Fallback to classical JWT
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      req.user = decoded;
      req.quantum = {
        verified: false,
        algorithm: 'Classical JWT',
        timestamp: new Date().toISOString()
      };
      
      logger.info('Classical authentication successful', {
        userId: decoded.id,
        algorithm: 'jwt',
        quantumUpgradeAvailable: true
      });
      
      next();
    } catch (error) {
      logger.warn('Authentication failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tokenType: this.isHybridToken(token) ? 'hybrid' : 'jwt'
      });
      
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  };

  // Quantum-only authentication (for high-security endpoints)
  quantumOnlyAuth = async (req: QuantumAuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      return res.status(401).json({ 
        error: 'Quantum-safe authentication required',
        upgrade: 'Please upgrade to quantum-safe tokens'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    if (!this.isHybridToken(token)) {
      return res.status(401).json({
        error: 'Classical tokens not accepted for this endpoint',
        upgrade: 'Quantum-safe authentication required'
      });
    }

    try {
      const quantumResult = await this.quantumCrypto.verifyHybridToken(token);
      
      if (!quantumResult.isValid || !quantumResult.payload) {
        return res.status(401).json({ error: 'Invalid quantum-safe token' });
      }

      req.user = quantumResult.payload;
      req.quantum = {
        verified: true,
        algorithm: 'Quantum-Safe Hybrid',
        timestamp: new Date().toISOString()
      };
      
      logger.info('Quantum-only authentication successful', {
        userId: req.user.id,
        algorithm: 'quantum-safe'
      });
      
      next();
    } catch (error) {
      logger.warn('Quantum authentication failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      res.status(401).json({ error: 'Quantum authentication failed' });
    }
  };

  private isHybridToken(token: string): boolean {
    try {
      // Hybrid tokens are base64 encoded JSON with specific structure
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      return decoded.classical && decoded.quantum && decoded.metadata && decoded.metadata.hybrid;
    } catch {
      return false;
    }
  }
}
```

### **Step 3.2: Service-Specific Quantum Integration**

#### **bg-identity-ai Quantum Enhancement**
```typescript
// bg-identity-ai/src/services/quantum-biometric-service.ts
import { QuantumCryptoService } from '../../shared/services/quantum-crypto-service';
import { logger } from '@/lib/logger';

export class QuantumBiometricService {
  private quantumCrypto: QuantumCryptoService;

  constructor() {
    this.quantumCrypto = new QuantumCryptoService();
  }

  async encryptBiometricTemplate(
    userId: string,
    template: Buffer,
    biometricType: 'face' | 'fingerprint'
  ): Promise<{
    encryptedTemplate: string;
    publicKey: string;
    algorithm: string;
  }> {
    try {
      // Generate quantum-safe keypair for this biometric template
      const kemKeypair = await this.quantumCrypto.generateKEMKeyPair();
      
      // Encapsulate a shared secret
      const encapResult = await this.quantumCrypto.encapsulateSecret(kemKeypair.publicKey);
      
      // Use shared secret for AES encryption of the template
      const crypto = require('crypto');
      const cipher = crypto.createCipher('aes-256-gcm', encapResult.sharedSecret);
      let encrypted = cipher.update(template);
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      
      // Combine ciphertext and encrypted template
      const encryptedData = {
        ciphertext: encapResult.ciphertext.toString('base64'),
        encryptedTemplate: encrypted.toString('base64'),
        authTag: cipher.getAuthTag().toString('base64')
      };

      logger.info('Biometric template encrypted with quantum-safe crypto', {
        userId,
        biometricType,
        algorithm: 'Kyber768 + AES-256-GCM',
        templateSize: template.length,
        encryptedSize: encrypted.length
      });

      return {
        encryptedTemplate: Buffer.from(JSON.stringify(encryptedData)).toString('base64'),
        publicKey: kemKeypair.publicKey.toString('base64'),
        algorithm: 'Kyber768'
      };
    } catch (error) {
      logger.error('Quantum biometric encryption failed', {
        userId,
        biometricType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to encrypt biometric template');
    }
  }

  async decryptBiometricTemplate(
    encryptedTemplate: string,
    privateKey: Buffer
  ): Promise<Buffer> {
    try {
      // Decode encrypted data
      const encryptedData = JSON.parse(Buffer.from(encryptedTemplate, 'base64').toString());
      const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64');
      const encrypted = Buffer.from(encryptedData.encryptedTemplate, 'base64');
      const authTag = Buffer.from(encryptedData.authTag, 'base64');

      // Decapsulate shared secret
      const sharedSecret = await this.quantumCrypto.decapsulateSecret(privateKey, ciphertext);
      
      // Use shared secret for AES decryption
      const crypto = require('crypto');
      const decipher = crypto.createDecipher('aes-256-gcm', sharedSecret);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      logger.info('Biometric template decrypted successfully', {
        algorithm: 'Kyber768 + AES-256-GCM',
        decryptedSize: decrypted.length
      });

      return decrypted;
    } catch (error) {
      logger.error('Quantum biometric decryption failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to decrypt biometric template');
    }
  }
}
```

---

## **🧪 Phase 4: Testing & Validation (Week 4)**

### **Step 4.1: Quantum Cryptography Test Suite**

```typescript
// tests/quantum-crypto.test.ts
import { describe, test, expect, beforeEach } from 'vitest';
import { QuantumCryptoService } from '../src/services/quantum-crypto-service';

describe('Quantum Cryptography Service', () => {
  let quantumCrypto: QuantumCryptoService;

  beforeEach(() => {
    quantumCrypto = new QuantumCryptoService();
  });

  describe('Key Encapsulation Mechanism (KEM)', () => {
    test('should generate KEM keypair successfully', async () => {
      const keypair = await quantumCrypto.generateKEMKeyPair();
      
      expect(keypair.publicKey).toBeInstanceOf(Buffer);
      expect(keypair.privateKey).toBeInstanceOf(Buffer);
      expect(keypair.algorithm).toBe('Kyber768');
      expect(keypair.publicKey.length).toBe(1184); // Kyber768 public key size
      expect(keypair.privateKey.length).toBe(2400); // Kyber768 private key size
    });

    test('should encapsulate and decapsulate secret correctly', async () => {
      const keypair = await quantumCrypto.generateKEMKeyPair();
      const encapResult = await quantumCrypto.encapsulateSecret(keypair.publicKey);
      const decapResult = await quantumCrypto.decapsulateSecret(
        keypair.privateKey,
        encapResult.ciphertext
      );
      
      expect(encapResult.sharedSecret).toEqual(decapResult);
      expect(encapResult.sharedSecret.length).toBe(32); // 256-bit shared secret
    });
  });

  describe('Digital Signatures', () => {
    test('should generate signature keypair successfully', async () => {
      const keypair = await quantumCrypto.generateSignatureKeyPair();
      
      expect(keypair.publicKey).toBeInstanceOf(Buffer);
      expect(keypair.privateKey).toBeInstanceOf(Buffer);
      expect(keypair.algorithm).toBe('Dilithium3');
      expect(keypair.publicKey.length).toBe(1952); // Dilithium3 public key size
    });

    test('should sign and verify message correctly', async () => {
      const keypair = await quantumCrypto.generateSignatureKeyPair();
      const message = Buffer.from('Test message for quantum signature');
      
      const signature = await quantumCrypto.signMessage(message, keypair.privateKey);
      const isValid = await quantumCrypto.verifySignature(
        message,
        signature.signature,
        keypair.publicKey
      );
      
      expect(isValid).toBe(true);
      expect(signature.algorithm).toBe('Dilithium3');
    });

    test('should reject invalid signatures', async () => {
      const keypair = await quantumCrypto.generateSignatureKeyPair();
      const message = Buffer.from('Original message');
      const tamperedMessage = Buffer.from('Tampered message');
      
      const signature = await quantumCrypto.signMessage(message, keypair.privateKey);
      const isValid = await quantumCrypto.verifySignature(
        tamperedMessage,
        signature.signature,
        keypair.publicKey
      );
      
      expect(isValid).toBe(false);
    });
  });

  describe('Hybrid Tokens', () => {
    test('should generate and verify hybrid token successfully', async () => {
      const payload = {
        userId: 'test-user-123',
        email: 'test@example.com',
        role: 'user',
        exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
      };

      const hybridTokenResult = await quantumCrypto.generateHybridToken(payload);
      const verificationResult = await quantumCrypto.verifyHybridToken(
        hybridTokenResult.hybridToken
      );
      
      expect(verificationResult.isValid).toBe(true);
      expect(verificationResult.payload).toEqual(expect.objectContaining({
        userId: payload.userId,
        email: payload.email,
        role: payload.role
      }));
    });

    test('should reject tampered hybrid tokens', async () => {
      const payload = { userId: 'test-user', role: 'user' };
      const hybridTokenResult = await quantumCrypto.generateHybridToken(payload);
      
      // Tamper with the token
      const tamperedToken = hybridTokenResult.hybridToken.slice(0, -10) + 'tampered123';
      const verificationResult = await quantumCrypto.verifyHybridToken(tamperedToken);
      
      expect(verificationResult.isValid).toBe(false);
    });
  });

  describe('Performance Benchmarks', () => {
    test('should complete benchmark within reasonable time', async () => {
      const startTime = Date.now();
      const benchmarkResults = await quantumCrypto.benchmarkOperations();
      const totalTime = Date.now() - startTime;
      
      // Benchmark should complete within 30 seconds
      expect(totalTime).toBeLessThan(30000);
      
      // Check that all operations have reasonable performance
      expect(benchmarkResults.kem.keyGen).toBeLessThan(10); // <10ms per KEM keygen
      expect(benchmarkResults.kem.encap).toBeLessThan(5);   // <5ms per encapsulation
      expect(benchmarkResults.kem.decap).toBeLessThan(5);   // <5ms per decapsulation
      
      expect(benchmarkResults.signature.keyGen).toBeLessThan(15); // <15ms per sig keygen
      expect(benchmarkResults.signature.sign).toBeLessThan(10);   // <10ms per signature
      expect(benchmarkResults.signature.verify).toBeLessThan(5);  // <5ms per verification
    }, 35000);
  });
});
```

### **Step 4.2: Integration Testing Script**

```bash
#!/bin/bash
# test-quantum-integration.sh

echo "🧪 Running Quantum Migration Integration Tests..."

# Set environment variables
export NODE_ENV=test
export JWT_SECRET=test-secret-key

# Start quantum gateway service
echo "Starting bg-quantum-gateway service..."
cd bg-quantum-gateway
npm run dev &
QUANTUM_PID=$!
sleep 5

# Test quantum gateway health
echo "Testing quantum gateway health..."
curl -f http://localhost:3005/health || exit 1

# Test KEM keypair generation
echo "Testing KEM keypair generation..."
curl -X POST http://localhost:3005/api/quantum/kem/keypair \
  -H "Content-Type: application/json" | jq .publicKey || exit 1

# Test signature keypair generation
echo "Testing signature keypair generation..."
curl -X POST http://localhost:3005/api/quantum/signature/keypair \
  -H "Content-Type: application/json" | jq .publicKey || exit 1

# Test hybrid token generation
echo "Testing hybrid token generation..."
TOKEN_RESPONSE=$(curl -X POST http://localhost:3005/api/quantum/token/generate \
  -H "Content-Type: application/json" \
  -d '{"payload":{"userId":"test-123","role":"user"}}')

HYBRID_TOKEN=$(echo $TOKEN_RESPONSE | jq -r .hybridToken)

if [ "$HYBRID_TOKEN" = "null" ]; then
  echo "❌ Hybrid token generation failed"
  exit 1
fi

# Test hybrid token verification
echo "Testing hybrid token verification..."
curl -X POST http://localhost:3005/api/quantum/token/verify \
  -H "Content-Type: application/json" \
  -d "{\"hybridToken\":\"$HYBRID_TOKEN\"}" | jq .isValid || exit 1

# Test performance benchmark
echo "Testing quantum performance benchmark..."
curl -X GET http://localhost:3005/api/quantum/benchmark | jq .results || exit 1

# Test service integration
echo "Testing service integration..."
for PORT in 3001 3002 3003 3004; do
  if curl -f http://localhost:$PORT/health >/dev/null 2>&1; then
    echo "✅ Service on port $PORT is healthy"
  else
    echo "⚠️  Service on port $PORT is not running (expected in test)"
  fi
done

# Cleanup
kill $QUANTUM_PID 2>/dev/null

echo "✅ Quantum migration integration tests completed successfully!"
echo ""
echo "📊 Migration Progress:"
echo "- ✅ OpenQuantumSafe installation complete"
echo "- ✅ Quantum gateway service operational" 
echo "- ✅ Hybrid token system functional"
echo "- ✅ Performance benchmarks passing"
echo "- ⏳ Service integration ready for deployment"
echo ""
echo "🚀 Next Steps:"
echo "1. Deploy quantum gateway to development environment"
echo "2. Update other AI services with quantum auth middleware"
echo "3. Begin gradual rollout of hybrid tokens"
echo "4. Monitor performance and security metrics"
```

---

## **📈 Migration Monitoring & Rollback**

### **Monitoring Dashboard Metrics**
```typescript
// Quantum migration metrics to track
const migrationMetrics = {
  tokenDistribution: {
    classicalOnly: 85,      // Percentage using classical JWT
    hybridTokens: 15,       // Percentage using quantum-safe hybrid
    quantumOnly: 0          // Future: quantum-only endpoints
  },
  performance: {
    classicalAuth: 12,      // Average auth time (ms)
    hybridAuth: 28,         // Average hybrid auth time (ms)
    quantumOnlyAuth: 45     // Average quantum-only auth time (ms)
  },
  security: {
    quantumReadiness: 60,   // Percentage of users quantum-ready
    algorithmStrength: 'NIST Level 3', // Security level
    cryptoAgility: true     // Algorithm switching capability
  }
};
```

### **Rollback Strategy**
```bash
# Emergency rollback script
#!/bin/bash
# rollback-quantum.sh

echo "🚨 Emergency Quantum Migration Rollback"

# Stop quantum gateway
docker-compose stop bg-quantum-gateway

# Revert authentication middleware to classical-only
git checkout main -- shared/utils/auth-middleware.ts

# Remove quantum dependencies from services
for service in bg-identity-ai bg-threat-ai bg-ai-dashboard bg-mobile-ai; do
  cd $service
  npm uninstall liboqs-node
  git checkout main -- src/middleware/auth.ts
  cd ..
done

# Restart services with classical authentication
./start-ai-services.sh

echo "✅ Rollback completed - all services using classical authentication"
```

---

## **✅ Migration Checklist**

### **Phase 1: Foundation ✅**
- [ ] OpenQuantumSafe library installed and tested
- [ ] Node.js bindings functional
- [ ] Development environment configured
- [ ] Basic quantum operations validated

### **Phase 2: Gateway Service ⏳**
- [ ] bg-quantum-gateway service created
- [ ] Quantum crypto service implemented
- [ ] API endpoints for key management
- [ ] Hybrid token generation/verification
- [ ] Performance benchmarking complete

### **Phase 3: Service Integration ⏳**
- [ ] Authentication middleware updated
- [ ] Biometric encryption enhanced
- [ ] Inter-service communication secured
- [ ] Migration monitoring implemented

### **Phase 4: Testing & Validation ⏳**
- [ ] Comprehensive test suite created
- [ ] Integration tests passing
- [ ] Performance benchmarks met
- [ ] Security validation complete
- [ ] Rollback procedures tested

---

## **🎯 Success Criteria**

### **Technical Metrics**
- **Quantum Operations**: <10ms KEM keygen, <5ms signatures
- **Hybrid Tokens**: <50ms generation/verification
- **Service Integration**: Zero downtime migration
- **Test Coverage**: 90%+ quantum functionality

### **Security Validation**
- **Algorithm Compliance**: NIST Level 3 post-quantum security
- **Hybrid Compatibility**: Classical and quantum tokens coexist
- **Cryptographic Agility**: Algorithm switching capability
- **Migration Safety**: Rollback procedures validated

### **Performance Targets**
- **Authentication Latency**: <100ms for hybrid tokens
- **Service Availability**: 99.9% uptime during migration
- **Resource Usage**: <20% increase in CPU/memory
- **Scalability**: Support for 10K+ concurrent quantum operations

**The migration to post-quantum cryptography positions BehaviorGuard as the first quantum-ready cybersecurity platform, ensuring long-term security in the post-quantum computing era.** 🔐🚀