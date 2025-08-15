# 📋 Deployment & Health Check Procedures
**Console-First Threat Detection Platform**  
**Version**: bg-threat-ai v2.0.0  
**Documentation Type**: Step-by-Step Operational Procedures  
**Last Updated**: August 10, 2025  

---

## 📖 Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Setup Procedure](#environment-setup-procedure)
3. [SSL Certificate Setup](#ssl-certificate-setup)
4. [Production Deployment Procedure](#production-deployment-procedure)
5. [Health Check Procedures](#health-check-procedures)
6. [Post-Deployment Validation](#post-deployment-validation)
7. [Troubleshooting Procedures](#troubleshooting-procedures)
8. [Rollback Procedures](#rollback-procedures)
9. [Monitoring Setup](#monitoring-setup)
10. [Maintenance Procedures](#maintenance-procedures)

---

## 🔍 Pre-Deployment Checklist

### System Requirements Verification

**Step 1: Check Operating System**
```bash
# Verify OS compatibility
uname -a
# Should show: Linux, macOS, or Windows with WSL2

# Check available disk space (minimum 10GB)
df -h
```

**Step 2: Verify Docker Installation**
```bash
# Check Docker version (minimum 20.10.0)
docker --version
# Expected output: Docker version 20.10.0 or higher

# Check Docker Compose version (minimum 2.0.0)
docker-compose --version
# Expected output: Docker Compose version v2.x.x or higher

# Verify Docker is running
docker info
# Should show system information without errors
```

**Step 3: Verify Node.js Installation**
```bash
# Check Node.js version (minimum 18.0.0)
node --version
# Expected output: v18.x.x or higher

# Check npm version
npm --version
# Expected output: 8.x.x or higher
```

**Step 4: Network Port Availability**
```bash
# Check if required ports are free
sudo netstat -tulpn | grep -E ':(80|443|3002|6379)'
# Should show no active processes on these ports

# Alternative check using lsof
lsof -i :80 -i :443 -i :3002 -i :6379
# Should return empty or show only docker processes
```

**Step 5: Repository Setup**
```bash
# Clone the repository
git clone <repository-url>
cd bg-identity-ai

# Verify all required files exist
ls -la
# Should show: Dockerfile, docker-compose.production.yml, scripts/, etc.

# Check script permissions
ls -la scripts/
# deploy-production.sh should be executable (rwxr-xr-x)
```

---

## ⚙️ Environment Setup Procedure

### Step 1: Create Production Environment File

**1.1 Copy Example Environment**
```bash
# Navigate to project directory
cd bg-identity-ai

# Copy template to production file
cp .env.example .env.production

# Verify file was created
ls -la .env.production
```

**1.2 Generate Secure Secrets**
```bash
# Generate secure JWT secret (256-bit)
openssl rand -hex 32
# Copy this value for JWT_SECRET

# Generate secure Redis password
openssl rand -base64 32
# Copy this value for REDIS_PASSWORD

# Generate secure API key
openssl rand -base64 24 | tr -d "=+/" | cut -c1-24
# Copy this value for BG_WEB_API_KEY
```

**1.3 Edit Production Environment**
```bash
# Open environment file for editing
nano .env.production
# or use your preferred editor: vim, code, etc.
```

**1.4 Configure Required Variables**
```bash
# REQUIRED: Security Configuration
NODE_ENV=production
JWT_SECRET=<your-256-bit-hex-secret-from-step-1.2>
BG_WEB_API_KEY=<your-api-key-from-step-1.2>

# REQUIRED: Redis Configuration  
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<your-redis-password-from-step-1.2>
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0

# REQUIRED: Application Configuration
PORT=3002
LOG_LEVEL=info
```

**1.5 Configure Optional Variables**
```bash
# Optional: External Services
SENTRY_DSN=your-sentry-dsn-if-available
SLACK_WEBHOOK_URL=your-slack-webhook-if-available
BG_WEB_API_URL=https://yourdomain.com

# Optional: HTTPS Configuration
HTTPS_ENABLED=true
SSL_CERT_PATH=/etc/ssl/private/cert.pem
SSL_KEY_PATH=/etc/ssl/private/key.pem
CORS_ORIGIN=https://yourdomain.com
```

**1.6 Validate Environment Configuration**
```bash
# Run environment validation script
node scripts/validate-environment.js

# Expected output:
# ✅ READY FOR DEPLOYMENT
# Environment configuration is valid and secure.
```

---

## 🔒 SSL Certificate Setup

### Option A: Self-Signed Certificates (Development/Testing)

**Step A1: Generate Self-Signed Certificates**
```bash
# Run SSL certificate generation script
./scripts/generate-ssl-cert.sh

# Follow prompts or use defaults:
# Domain: localhost (default)
# Country: US (default)
# State: CA (default)
# Organization: bg-threat-ai (default)
```

**Step A2: Verify Certificate Generation**
```bash
# Check if certificates were created
ls -la ssl/
# Should show: cert.pem, key.pem

# Verify certificate validity
openssl x509 -in ssl/cert.pem -noout -text | head -20
# Should show certificate information
```

### Option B: Production CA Certificates

**Step B1: Obtain CA Certificates**
```bash
# Create ssl directory if not exists
mkdir -p ssl/

# Copy your CA-issued certificates
cp /path/to/your/certificate.crt ssl/cert.pem
cp /path/to/your/private.key ssl/key.pem

# Set proper permissions
chmod 644 ssl/cert.pem
chmod 600 ssl/key.pem
```

**Step B2: Verify Production Certificates**
```bash
# Check certificate validity
openssl x509 -in ssl/cert.pem -noout -dates
# Should show valid date range

# Verify certificate matches private key
openssl x509 -noout -modulus -in ssl/cert.pem | openssl md5
openssl rsa -noout -modulus -in ssl/key.pem | openssl md5
# Both MD5 hashes should match
```

---

## 🚀 Production Deployment Procedure

### Method 1: Automated Deployment (Recommended)

**Step 1: Run Automated Deployment Script**
```bash
# Execute automated deployment
./scripts/deploy-production.sh

# The script will:
# - Validate environment
# - Check SSL certificates
# - Build production images
# - Start all services
# - Perform health checks
# - Display deployment summary
```

**Step 2: Monitor Deployment Progress**
```bash
# Watch deployment logs in real-time
# (Script will offer this option at the end)

# Or manually check logs:
docker-compose -f docker-compose.production.yml logs -f
```

### Method 2: Manual Deployment

**Step 1: Build Production Images**
```bash
# Build all services without cache
docker-compose -f docker-compose.production.yml build --no-cache

# Expected output:
# Successfully built <image-ids>
# Successfully tagged bg-threat-ai_bg-threat-ai:latest
```

**Step 2: Start Services in Background**
```bash
# IMPORTANT: Source environment variables from .env.production
set -a && source .env.production && set +a

# Start all services
docker-compose -f docker-compose.production.yml up -d

# Expected output:
# Creating network "bg-threat-ai_threat-detection-network"
# Creating volume "bg-threat-ai_redis_data"
# Creating bg-threat-ai-redis-prod ... done
# Creating bg-threat-ai-service-prod ... done
# Creating bg-threat-ai-nginx-prod ... done
```

**Step 3: Wait for Services to Start**
```bash
# Wait 30-60 seconds for services to initialize
sleep 30

# Check service status
docker-compose -f docker-compose.production.yml ps

# Expected output shows all services as "Up (healthy)"
```

---

## 🩺 Health Check Procedures

### Level 1: Basic Health Checks

**Check 1.1: Container Status**
```bash
# Check all containers are running
docker-compose -f docker-compose.production.yml ps

# Expected output:
# bg-threat-ai-redis-prod    Up (healthy)
# bg-threat-ai-service-prod  Up (healthy)  
# bg-threat-ai-nginx-prod    Up (healthy)
```

**Check 1.2: Basic HTTP Health Check**
```bash
# Test basic health endpoint
curl -f http://localhost/health

# Expected response (status 200):
{
  "status": "healthy",
  "service": "bg-threat-ai",
  "version": "2.0.0",
  "uptime": "<uptime-in-seconds>",
  "timestamp": "2025-08-10T...",
  "memory": { ... },
  "redis": {
    "status": "connected",
    "hitRate": 0,
    "responseTime": "<1-5>",
    "uptime": "<uptime-in-seconds>"
  }
}
```

**Check 1.3: HTTPS Health Check**
```bash
# Test HTTPS health endpoint
curl -f -k https://localhost/health

# Expected response: Same as above with HTTPS
# Note: -k flag ignores self-signed certificate warnings
```

### Level 2: Detailed Health Checks

**Check 2.1: Redis Health Verification**
```bash
# Test Redis-specific health endpoint
curl -s http://localhost/health/redis | jq '.'

# Expected response:
{
  "status": "healthy",
  "connection": {
    "status": "connected",
    "responseTime": 1,
    "uptime": 1234
  },
  "performance": {
    "hitRate": 0,
    "memoryUsage": "< 100MB",
    "operationsPerSecond": "< 1000"
  },
  "cache": {
    "keyCount": 0,
    "isConnected": true
  }
}
```

**Check 2.2: Detailed System Health**
```bash
# Test comprehensive health endpoint
curl -s http://localhost/health/detailed | jq '.'

# Expected response:
{
  "overallStatus": "healthy",
  "redisStatus": "connected",
  "cacheHitRate": 0,
  "timestamp": "2025-08-10T...",
  "components": {
    "redis": { ... },
    "memory": { ... },
    "uptime": { ... }
  }
}
```

**Check 2.3: Readiness Check**
```bash
# Test readiness endpoint
curl -f http://localhost/health/ready

# Expected response (status 200):
{
  "status": "ready",
  "service": "bg-threat-ai",
  "checks": {
    "redis": "connected",
    "application": "ready",
    "dependencies": "available"
  }
}
```

### Level 3: API Endpoint Validation

**Check 3.1: Authentication Test**
```bash
# Test API authentication (should fail without token)
curl -w "%{http_code}" -s -o /dev/null http://localhost/api/threat/health

# Expected response: 401 (Unauthorized)
```

**Check 3.2: Health with Authentication**
```bash
# Get JWT_SECRET from running container (since container may use different secret than .env.production)
CONTAINER_JWT_SECRET=$(docker exec bg-threat-ai-service-prod printenv JWT_SECRET)
echo "Using JWT_SECRET from container: ${CONTAINER_JWT_SECRET:0:20}..."

# Generate test JWT token (for testing only)
TOKEN=$(JWT_SECRET="$CONTAINER_JWT_SECRET" node -e "
const jwt = require('jsonwebtoken');
console.log(jwt.sign({id: 'test', email: 'test@test.com'}, process.env.JWT_SECRET));
")

# Test authenticated endpoint
curl -H "Authorization: Bearer $TOKEN" \
     -w "%{http_code}" \
     -s -o /dev/null http://localhost/api/threat/health

# Expected response: 200
```

### Level 4: Performance Validation

**Check 4.1: Response Time Measurement**
```bash
# Create curl format file
cat > curl-format.txt << 'EOF' 
     time_namelookup:  %{time_namelookup}\n
        time_connect:  %{time_connect}\n
     time_appconnect:  %{time_appconnect}\n
    time_pretransfer:  %{time_pretransfer}\n
       time_redirect:  %{time_redirect}\n
  time_starttransfer:  %{time_starttransfer}\n
                     ----------\n
          time_total:  %{time_total}\n
EOF

# Test response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost/health

# Expected output:
# time_total should be < 0.050 (50ms) for health endpoint
```

**Check 4.2: Concurrent Connection Test**
```bash
# Test multiple concurrent requests
for i in {1..10}; do
  curl -w "%{time_total}\n" -o /dev/null -s http://localhost/health &
done
wait

# Expected: All requests should complete in < 50ms
```

---

## ✅ Post-Deployment Validation

### Validation Checklist

**Step 1: Service Verification**
```bash
# 1.1 All containers running and healthy
docker-compose -f docker-compose.production.yml ps | grep -v "Up (healthy)" | wc -l
# Expected output: 1 (header line only)

# 1.2 No critical errors in logs (last 50 lines)
docker-compose -f docker-compose.production.yml logs --tail=50 | grep -i error
# Expected output: No critical errors (warnings are acceptable)

# 1.3 Memory usage within limits
docker stats --no-stream | grep bg-threat-ai
# Memory usage should be < 1GB total
```

**Step 2: Network Connectivity**
```bash
# 2.1 External HTTP access
curl -f -w "Status: %{http_code}, Time: %{time_total}s\n" \
     -o /dev/null -s http://localhost/health

# Expected: Status: 200, Time: < 0.05s

# 2.2 External HTTPS access
curl -f -k -w "Status: %{http_code}, Time: %{time_total}s\n" \
     -o /dev/null -s https://localhost/health

# Expected: Status: 200, Time: < 0.05s

# 2.3 WebSocket connectivity (optional)
curl -i -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     http://localhost/socket.io/
# Expected: HTTP/1.1 101 Switching Protocols
```

**Step 3: Security Validation**
```bash
# 3.1 Security headers check
curl -I http://localhost/health | grep -E "(X-Content-Type-Options|X-Frame-Options|X-XSS-Protection)"

# Expected output:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block

# 3.2 HTTPS redirect check
curl -I http://localhost/ | grep -i location
# Expected: Location: https://localhost/

# 3.3 Rate limiting check (optional)
for i in {1..50}; do curl -w "%{http_code}\n" -o /dev/null -s http://localhost/health; done | sort | uniq -c
# Most should be 200, some might be 429 (rate limited)
```

**Step 4: Data Persistence Validation**
```bash
# 4.1 Redis data persistence
docker exec bg-threat-ai-redis-prod redis-cli ping
# Expected output: PONG

# 4.2 Configuration persistence
docker-compose -f docker-compose.production.yml restart bg-threat-ai
sleep 10
curl -f http://localhost/health
# Expected: Service should recover and respond healthy
```

### Validation Success Criteria

**✅ Deployment is successful if:**
- All containers show "Up (healthy)" status
- Health endpoints respond < 50ms
- HTTPS endpoints accessible (even with self-signed certificates)
- No critical errors in logs
- Memory usage < 1GB total
- Security headers present
- Redis connectivity working
- Service survives restart

**⚠️ Deployment needs attention if:**
- Any container shows "Up (unhealthy)" status
- Health endpoints respond > 100ms
- Critical errors in logs
- Memory usage > 1GB
- Security headers missing
- Redis connectivity issues

**❌ Deployment failed if:**
- Any container not running
- Health endpoints not responding
- Critical services not accessible
- Authentication completely broken

---

## 🔧 Troubleshooting Procedures

### Issue 1: Container Won't Start

**Symptom**: Container status shows "Exited" or "Restarting"

**Diagnosis Steps:**
```bash
# Check container logs
docker-compose -f docker-compose.production.yml logs <service-name>

# Check system resources
docker system df
free -h

# Check port conflicts
netstat -tulpn | grep -E ':(80|443|3002|6379)'
```

**Resolution Steps:**
```bash
# Step 1: Stop all services
docker-compose -f docker-compose.production.yml down

# Step 2: Clean up resources
docker system prune -f

# Step 3: Check environment file
node scripts/validate-environment.js

# Step 4: Restart services
docker-compose -f docker-compose.production.yml up -d

# Step 5: Monitor startup
docker-compose -f docker-compose.production.yml logs -f
```

### Issue 2: Health Check Failing

**Symptom**: curl to /health returns error or timeout

**Diagnosis Steps:**
```bash
# Check if service is running
docker-compose -f docker-compose.production.yml ps

# Check application logs
docker-compose -f docker-compose.production.yml logs bg-threat-ai

# Test direct service connection (bypass NGINX)
curl -f http://localhost:3002/health
```

**Resolution Steps:**
```bash
# Step 1: Restart unhealthy service
docker-compose -f docker-compose.production.yml restart bg-threat-ai

# Step 2: Wait for health check
sleep 30

# Step 3: Test again
curl -f http://localhost/health

# Step 4: If still failing, check Redis
docker exec bg-threat-ai-redis-prod redis-cli ping
```

### Issue 3: SSL/HTTPS Not Working

**Symptom**: HTTPS connections fail or show certificate errors

**Diagnosis Steps:**
```bash
# Check SSL certificate files
ls -la ssl/
openssl x509 -in ssl/cert.pem -noout -dates

# Check NGINX configuration
docker exec bg-threat-ai-nginx-prod nginx -t

# Test SSL connection
openssl s_client -connect localhost:443
```

**Resolution Steps:**
```bash
# Step 1: Regenerate SSL certificates
rm -rf ssl/
./scripts/generate-ssl-cert.sh

# Step 2: Restart NGINX
docker-compose -f docker-compose.production.yml restart nginx

# Step 3: Test HTTPS
curl -k https://localhost/health
```

### Issue 4: Performance Problems

**Symptom**: Health checks take > 100ms, API responses slow

**Diagnosis Steps:**
```bash
# Check resource usage
docker stats --no-stream

# Check memory usage
curl -s http://localhost/health | jq '.memory'

# Test API response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost/health
```

**Resolution Steps:**
```bash
# Step 1: Increase resource limits in docker-compose.production.yml
# memory: 2G, cpus: '2.0'

# Step 2: Enable monitoring
docker-compose -f docker-compose.production.yml --profile monitoring up -d

# Step 3: Check Prometheus metrics
open http://localhost:9090

# Step 4: Optimize based on metrics
```

---

## 🔄 Rollback Procedures

### Automatic Rollback (Recommended)

**Step 1: Execute Rollback Script**
```bash
# Run automated rollback
./scripts/rollback-deployment.sh

# Follow prompts:
# Type 'ROLLBACK' to confirm
```

**Step 2: Verify Rollback Success**
```bash
# Check service status
docker-compose -f docker-compose.production.yml ps

# Test health endpoint
curl -f http://localhost/health

# Check logs for errors
docker-compose -f docker-compose.production.yml logs --tail=20
```

### Manual Rollback

**Step 1: Stop Current Services**
```bash
# Stop all services
docker-compose -f docker-compose.production.yml down

# Remove containers and networks
docker-compose -f docker-compose.production.yml down --volumes --remove-orphans
```

**Step 2: Restore Configuration**
```bash
# If you have a backup
tar -xzf backup_YYYYMMDD_HHMMSS.tar.gz

# Or reset to defaults
cp .env.example .env.production
```

**Step 3: Restart Services**
```bash
# Build and start
docker-compose -f docker-compose.production.yml build --no-cache
docker-compose -f docker-compose.production.yml up -d

# Verify health
sleep 30
curl -f http://localhost/health
```

---

## 📊 Monitoring Setup

### Enable Monitoring Stack

**Step 1: Start Monitoring Services**
```bash
# Enable Prometheus and Grafana
docker-compose -f docker-compose.production.yml --profile monitoring up -d

# Verify monitoring services
docker-compose -f docker-compose.production.yml ps | grep -E "(prometheus|grafana)"
```

**Step 2: Access Monitoring Dashboards**
```bash
# Prometheus metrics
open http://localhost:9090

# Grafana dashboards  
open http://localhost:3001
# Default login: admin/admin
```

**Step 3: Configure Alerts (Optional)**
```bash
# Edit Prometheus alert rules
nano monitoring/alert_rules.yml

# Restart Prometheus to load new rules
docker-compose -f docker-compose.production.yml restart prometheus
```

### Custom Health Monitoring

**Setup Custom Health Checks**
```bash
# Create monitoring script
cat > scripts/health-monitor.sh << 'EOF'
#!/bin/bash
while true; do
  if ! curl -f -s http://localhost/health > /dev/null; then
    echo "$(date): Health check failed"
    # Add alert logic here
  fi
  sleep 30
done
EOF

chmod +x scripts/health-monitor.sh

# Run in background
nohup ./scripts/health-monitor.sh > health-monitor.log 2>&1 &
```

---

## 🔧 Maintenance Procedures

### Daily Maintenance

**Daily Health Check**
```bash
# Run daily health validation
curl -f http://localhost/health
curl -f http://localhost/health/detailed
curl -f http://localhost/health/ready

# Check resource usage
docker stats --no-stream | grep bg-threat-ai

# Check logs for errors
docker-compose -f docker-compose.production.yml logs --since=24h | grep -i error
```

**Daily Backup**
```bash
# Create daily configuration backup
mkdir -p backups/daily
tar -czf "backups/daily/backup_$(date +%Y%m%d).tar.gz" \
    .env.production \
    ssl/ \
    nginx/ \
    docker-compose.production.yml

# Keep only 7 days of backups
find backups/daily/ -name "backup_*.tar.gz" -mtime +7 -delete
```

### Weekly Maintenance

**Security Updates**
```bash
# Update base images
docker-compose -f docker-compose.production.yml pull

# Rebuild with latest updates
docker-compose -f docker-compose.production.yml build --pull --no-cache

# Rolling restart
docker-compose -f docker-compose.production.yml up -d
```

**Performance Review**
```bash
# Check performance metrics (if monitoring enabled)
curl -s "http://localhost:9090/api/v1/query?query=up" | jq '.'

# Review response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost/health

# Clean up unused resources
docker system prune -f
```

### Monthly Maintenance

**SSL Certificate Renewal**
```bash
# Check certificate expiration
openssl x509 -in ssl/cert.pem -noout -dates

# If using Let's Encrypt (automated)
certbot renew --dry-run

# Update certificates and restart
docker-compose -f docker-compose.production.yml restart nginx
```

**Comprehensive Health Audit**
```bash
# Run full system validation
node scripts/validate-environment.js

# Performance baseline check
# Compare current metrics with PERFORMANCE-BASELINE.md

# Security audit
docker scan bg-threat-ai:latest
```

---

## 📞 Emergency Procedures

### Critical Service Failure

**Immediate Response (< 5 minutes)**
```bash
# 1. Assess situation
docker-compose -f docker-compose.production.yml ps

# 2. Check health status
curl -f http://localhost/health || echo "HEALTH CHECK FAILED"

# 3. If completely down, emergency restart
docker-compose -f docker-compose.production.yml restart

# 4. Monitor recovery
docker-compose -f docker-compose.production.yml logs -f --tail=100
```

**If Restart Fails (5-15 minutes)**
```bash
# 1. Full system restart
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d

# 2. If still failing, rollback
./scripts/rollback-deployment.sh

# 3. Emergency fallback to development mode
docker-compose up -d
```

### Data Recovery

**Redis Data Loss**
```bash
# 1. Stop services
docker-compose -f docker-compose.production.yml down

# 2. Restore Redis volume from backup (if available)
docker volume create bg-threat-ai_redis_data
# Restore backup to volume

# 3. Restart services
docker-compose -f docker-compose.production.yml up -d
```

---

## ✅ Deployment Success Confirmation

### Final Validation Checklist

**✅ Complete this checklist after deployment:**

- [ ] All containers show "Up (healthy)" status
- [ ] HTTP health check responds in < 50ms
- [ ] HTTPS health check accessible (even with self-signed cert)
- [ ] Redis health check returns "connected"
- [ ] Detailed health check shows all components healthy
- [ ] Memory usage < 1GB total across all containers
- [ ] No critical errors in logs (last 100 lines)
- [ ] Security headers present in HTTP responses
- [ ] Rate limiting functional (test with 50+ requests)
- [ ] Service survives container restart
- [ ] Backup procedures documented and tested
- [ ] Monitoring enabled (optional but recommended)
- [ ] Rollback procedure tested and working

**🎉 If all items checked: DEPLOYMENT SUCCESSFUL**

**⚠️ If 1-2 items unchecked: DEPLOYMENT SUCCESSFUL WITH WARNINGS**

**❌ If 3+ items unchecked: DEPLOYMENT REQUIRES ATTENTION**

---

## 📋 Quick Reference Commands

### Essential Commands
```bash
# Deploy
./scripts/deploy-production.sh

# Health check
curl -f http://localhost/health

# Check status
docker-compose -f docker-compose.production.yml ps

# View logs
docker-compose -f docker-compose.production.yml logs -f

# Rollback
./scripts/rollback-deployment.sh

# Stop all
docker-compose -f docker-compose.production.yml down
```

### Troubleshooting Commands
```bash
# Restart service
docker-compose -f docker-compose.production.yml restart bg-threat-ai

# Check Redis
docker exec bg-threat-ai-redis-prod redis-cli ping

# Test SSL
openssl s_client -connect localhost:443

# Check resources
docker stats --no-stream
```

---

**End of Procedures Document**  
*Console-First Threat Detection Platform - Production Deployment Procedures v2.0.0*  
*For support: Review logs and DEPLOYMENT-GUIDE.md*