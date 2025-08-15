#!/usr/bin/env node

/**
 * Environment Configuration Validation Script
 * Validates production environment setup before deployment
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class EnvironmentValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.validationResults = {};
  }

  log(level, category, message, details = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      ...details
    };

    if (level === 'error') {
      this.errors.push(entry);
      console.log(`❌ [${category.toUpperCase()}] ${message}`);
    } else if (level === 'warning') {
      this.warnings.push(entry);
      console.log(`⚠️  [${category.toUpperCase()}] ${message}`);
    } else {
      console.log(`✅ [${category.toUpperCase()}] ${message}`);
    }
  }

  validateRequired(envVar, category, description) {
    if (!process.env[envVar] || process.env[envVar].trim() === '') {
      this.log('error', category, `Missing required environment variable: ${envVar}`, {
        variable: envVar,
        description,
        suggestion: `Set ${envVar} in your .env.production file`
      });
      return false;
    }
    
    this.log('success', category, `${envVar} configured correctly`);
    return true;
  }

  validateOptional(envVar, category, description, defaultValue) {
    if (!process.env[envVar] || process.env[envVar].trim() === '') {
      this.log('warning', category, `Optional variable ${envVar} not set, using default: ${defaultValue}`, {
        variable: envVar,
        description,
        defaultValue
      });
      return false;
    }
    
    this.log('success', category, `${envVar} configured: ${process.env[envVar]}`);
    return true;
  }

  validateSecurityConfiguration() {
    console.log('\n🔒 VALIDATING SECURITY CONFIGURATION');
    console.log('=====================================');

    // JWT Secret validation
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      this.log('error', 'security', 'JWT_SECRET is required for authentication');
    } else if (jwtSecret === 'test-secret-key-for-development-only' || 
               jwtSecret === 'your-256-bit-secret-key-here-change-for-production') {
      this.log('error', 'security', 'JWT_SECRET is using a placeholder value - must be changed for production');
    } else if (jwtSecret.length < 32) {
      this.log('error', 'security', 'JWT_SECRET should be at least 32 characters for security');
    } else {
      this.log('success', 'security', 'JWT_SECRET is properly configured');
    }

    // API Key validation
    const apiKey = process.env.BG_WEB_API_KEY;
    if (!apiKey) {
      this.log('warning', 'security', 'BG_WEB_API_KEY not set - inter-service communication may fail');
    } else if (apiKey === 'your-api-key-here' || apiKey.includes('placeholder')) {
      this.log('error', 'security', 'BG_WEB_API_KEY is using a placeholder value');
    } else {
      this.log('success', 'security', 'BG_WEB_API_KEY configured');
    }

    // CORS configuration
    this.validateOptional('CORS_ORIGIN', 'security', 'CORS origin for cross-origin requests', 'http://localhost:3000');
    
    return this.errors.filter(e => e.category === 'security').length === 0;
  }

  validateRedisConfiguration() {
    console.log('\n📊 VALIDATING REDIS CONFIGURATION');
    console.log('==================================');

    const redisHost = this.validateRequired('REDIS_HOST', 'redis', 'Redis server hostname');
    const redisPort = this.validateRequired('REDIS_PORT', 'redis', 'Redis server port');
    const redisUrl = this.validateRequired('REDIS_URL', 'redis', 'Complete Redis connection URL');

    // Redis performance settings
    this.validateOptional('REDIS_MAX_RETRIES', 'redis', 'Maximum Redis connection retries', '3');
    this.validateOptional('REDIS_COMMAND_TIMEOUT', 'redis', 'Redis command timeout in ms', '5000');
    this.validateOptional('REDIS_CONNECT_TIMEOUT', 'redis', 'Redis connection timeout in ms', '10000');

    // Redis authentication
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.REDIS_PASSWORD) {
        this.log('warning', 'redis', 'REDIS_PASSWORD not set - recommended for production');
      } else {
        this.log('success', 'redis', 'Redis authentication configured');
      }
    }

    return redisHost && redisPort && redisUrl;
  }

  validatePerformanceConfiguration() {
    console.log('\n⚡ VALIDATING PERFORMANCE CONFIGURATION');
    console.log('========================================');

    // API performance settings
    this.validateOptional('API_RATE_LIMIT_MAX_REQUESTS', 'performance', 'API rate limit per window', '1000');
    this.validateOptional('API_TIMEOUT', 'performance', 'API request timeout in ms', '30000');
    this.validateOptional('MAX_MEMORY_USAGE_MB', 'performance', 'Maximum memory usage in MB', '512');

    // Cache TTL settings
    this.validateOptional('CACHE_TTL_DEFAULT', 'performance', 'Default cache TTL in seconds', '300');
    this.validateOptional('CACHE_TTL_THREATS', 'performance', 'Threat event cache TTL', '300');
    this.validateOptional('CACHE_TTL_BEHAVIOR', 'performance', 'Behavior analysis cache TTL', '3600');
    this.validateOptional('CACHE_TTL_INTELLIGENCE', 'performance', 'Threat intelligence cache TTL', '14400');

    return true;
  }

  validateMonitoringConfiguration() {
    console.log('\n📊 VALIDATING MONITORING CONFIGURATION');
    console.log('=======================================');

    // Basic monitoring settings
    this.validateOptional('HEALTH_CHECK_INTERVAL', 'monitoring', 'Health check interval in ms', '30000');
    this.validateOptional('METRICS_COLLECTION_ENABLED', 'monitoring', 'Enable metrics collection', 'true');
    this.validateOptional('PERFORMANCE_TRACKING_ENABLED', 'monitoring', 'Enable performance tracking', 'true');

    // External monitoring services
    if (process.env.SENTRY_DSN) {
      this.log('success', 'monitoring', 'Sentry error tracking configured');
    } else {
      this.log('warning', 'monitoring', 'Sentry DSN not configured - error tracking disabled');
    }

    // Logging configuration
    this.validateOptional('LOG_FORMAT', 'monitoring', 'Log output format', 'json');
    this.validateOptional('LOG_CORRELATION_ID_HEADER', 'monitoring', 'Correlation ID header name', 'x-correlation-id');

    return true;
  }

  validateWebSocketConfiguration() {
    console.log('\n🔌 VALIDATING WEBSOCKET CONFIGURATION');
    console.log('=====================================');

    this.validateOptional('WEBSOCKET_ENABLED', 'websocket', 'Enable WebSocket support', 'true');
    this.validateOptional('WEBSOCKET_MAX_CONNECTIONS', 'websocket', 'Maximum WebSocket connections', '1000');
    this.validateOptional('WEBSOCKET_HEARTBEAT_INTERVAL', 'websocket', 'WebSocket heartbeat interval', '25000');
    this.validateOptional('WEBSOCKET_HEARTBEAT_TIMEOUT', 'websocket', 'WebSocket heartbeat timeout', '60000');

    return true;
  }

  validateProductionReadiness() {
    console.log('\n🚀 VALIDATING PRODUCTION READINESS');
    console.log('===================================');

    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv !== 'production') {
      this.log('warning', 'production', `NODE_ENV is '${nodeEnv}', should be 'production' for production deployment`);
    } else {
      this.log('success', 'production', 'NODE_ENV set to production');
    }

    // HTTPS configuration for production
    if (process.env.NODE_ENV === 'production') {
      const httpsEnabled = process.env.HTTPS_ENABLED === 'true';
      if (!httpsEnabled) {
        this.log('warning', 'production', 'HTTPS not enabled - recommended for production');
      } else {
        const certPath = process.env.SSL_CERT_PATH;
        const keyPath = process.env.SSL_KEY_PATH;
        
        if (!certPath || !keyPath) {
          this.log('error', 'production', 'HTTPS enabled but SSL certificate paths not configured');
        } else if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
          this.log('error', 'production', 'SSL certificate files not found at specified paths');
        } else {
          this.log('success', 'production', 'HTTPS configuration valid');
        }
      }
    }

    return true;
  }

  generateSecureJWTSecret() {
    return crypto.randomBytes(32).toString('hex');
  }

  generateSecureAPIKey() {
    return crypto.randomBytes(24).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
  }

  generateSecurityRecommendations() {
    console.log('\n🔧 SECURITY RECOMMENDATIONS');
    console.log('============================');

    if (!process.env.JWT_SECRET || 
        process.env.JWT_SECRET === 'test-secret-key-for-development-only' ||
        process.env.JWT_SECRET === 'your-256-bit-secret-key-here-change-for-production') {
      const newSecret = this.generateSecureJWTSecret();
      console.log(`💡 Generate a secure JWT secret:`);
      console.log(`   JWT_SECRET=${newSecret}`);
    }

    if (!process.env.BG_WEB_API_KEY || 
        process.env.BG_WEB_API_KEY === 'your-api-key-here' ||
        process.env.BG_WEB_API_KEY.includes('placeholder')) {
      const newApiKey = this.generateSecureAPIKey();
      console.log(`💡 Generate a secure API key:`);
      console.log(`   BG_WEB_API_KEY=${newApiKey}`);
    }

    if (process.env.NODE_ENV === 'production' && !process.env.REDIS_PASSWORD) {
      console.log(`💡 Enable Redis authentication for production:`);
      console.log(`   REDIS_PASSWORD=your-secure-redis-password`);
      console.log(`   REDIS_URL=redis://:your-secure-redis-password@redis-server:6379/0`);
    }
  }

  async runValidation() {
    console.log('🔍 ENVIRONMENT CONFIGURATION VALIDATION');
    console.log('========================================');
    console.log(`Environment: ${process.env.NODE_ENV || 'undefined'}`);
    console.log(`Timestamp: ${new Date().toISOString()}\n`);

    // Run all validation checks
    const results = {
      security: this.validateSecurityConfiguration(),
      redis: this.validateRedisConfiguration(), 
      performance: this.validatePerformanceConfiguration(),
      monitoring: this.validateMonitoringConfiguration(),
      websocket: this.validateWebSocketConfiguration(),
      production: this.validateProductionReadiness()
    };

    // Generate summary
    console.log('\n📋 VALIDATION SUMMARY');
    console.log('=====================');
    
    const totalChecks = Object.keys(results).length;
    const passedChecks = Object.values(results).filter(Boolean).length;
    const passRate = ((passedChecks / totalChecks) * 100).toFixed(1);

    console.log(`✅ Passed: ${passedChecks}/${totalChecks} categories (${passRate}%)`);
    console.log(`❌ Errors: ${this.errors.length}`);
    console.log(`⚠️  Warnings: ${this.warnings.length}`);

    if (this.errors.length > 0) {
      console.log('\n❌ CRITICAL ERRORS (Must Fix):');
      this.errors.forEach((error, index) => {
        console.log(`${index + 1}. [${error.category.toUpperCase()}] ${error.message}`);
        if (error.suggestion) {
          console.log(`   💡 ${error.suggestion}`);
        }
      });
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS (Recommended):');
      this.warnings.slice(0, 5).forEach((warning, index) => {
        console.log(`${index + 1}. [${warning.category.toUpperCase()}] ${warning.message}`);
      });
      
      if (this.warnings.length > 5) {
        console.log(`... and ${this.warnings.length - 5} more warnings`);
      }
    }

    // Security recommendations
    if (this.errors.some(e => e.category === 'security') || 
        this.warnings.some(w => w.category === 'security')) {
      this.generateSecurityRecommendations();
    }

    // Final recommendation
    console.log('\n🎯 DEPLOYMENT RECOMMENDATION');
    console.log('=============================');
    
    if (this.errors.length === 0) {
      console.log('✅ READY FOR DEPLOYMENT');
      console.log('Environment configuration is valid and secure.');
      if (this.warnings.length > 0) {
        console.log('⚠️  Address warnings for optimal production configuration.');
      }
      return true;
    } else {
      console.log('❌ NOT READY FOR DEPLOYMENT');
      console.log(`Fix ${this.errors.length} critical error(s) before deploying.`);
      return false;
    }
  }
}

// Load environment from .env.production if available
const envProductionPath = path.join(__dirname, '..', '.env.production');
if (fs.existsSync(envProductionPath)) {
  console.log(`Loading environment from: ${envProductionPath}`);
  require('dotenv').config({ path: envProductionPath });
} else {
  console.log('Loading default environment configuration');
  require('dotenv').config();
}

// Run validation if called directly
if (require.main === module) {
  const validator = new EnvironmentValidator();
  
  validator.runValidation()
    .then(isReady => {
      console.log('\n' + '='.repeat(50));
      process.exit(isReady ? 0 : 1);
    })
    .catch(error => {
      console.error('Environment validation failed:', error);
      process.exit(1);
    });
}

module.exports = EnvironmentValidator;