# 🚀 Production Deployment Guide
**Console-First Threat Detection Platform**  
**Version**: bg-threat-ai v2.0.0  
**Last Updated**: August 10, 2025  

---

## 🎯 Quick Start Deployment

### Prerequisites Checklist
- ✅ Docker & Docker Compose installed
- ✅ Node.js 18+ installed
- ✅ SSL certificates (production) or self-signed (development)
- ✅ Production environment variables configured
- ✅ Network ports 80, 443, 3002, 6379 available

### One-Command Deployment
```bash
# Clone and deploy
git clone <repository-url>
cd bg-identity-ai

# Run automated deployment
./scripts/deploy-production.sh
```

### Manual Deployment Steps
```bash
# 1. Environment setup
cp .env.example .env.production
# Edit .env.production with your values

# 2. SSL certificates (choose one)
./scripts/generate-ssl-cert.sh        # Self-signed
# OR place CA certificates in ./ssl/

# 3. Build and deploy
docker-compose -f docker-compose.production.yml build
docker-compose -f docker-compose.production.yml up -d

# 4. Health check
curl -f http://localhost/health
```

---

## 📋 Environment Configuration

### Required Environment Variables
```bash
# Security (REQUIRED)
JWT_SECRET=your-secure-256-bit-jwt-secret
BG_WEB_API_KEY=your-production-api-key

# Redis (REQUIRED)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-redis-password
REDIS_URL=redis://:your-secure-redis-password@redis:6379/0

# Application
NODE_ENV=production
PORT=3002
LOG_LEVEL=info
```

### Optional Environment Variables
```bash
# External Services
SENTRY_DSN=your-sentry-dsn-for-error-tracking
SLACK_WEBHOOK_URL=your-slack-webhook-for-alerts
EMAIL_SMTP_HOST=your-smtp-server

# SSL/TLS
HTTPS_ENABLED=true
SSL_CERT_PATH=/etc/ssl/private/cert.pem
SSL_KEY_PATH=/etc/ssl/private/key.pem

# Performance
API_RATE_LIMIT_MAX_REQUESTS=1000
API_TIMEOUT=30000
MAX_MEMORY_USAGE_MB=512
```

---

## 🏗️ Architecture Overview

### Production Components
```
┌─────────────────────────────────────────┐
│                 NGINX                   │
│            Load Balancer                │
│         (SSL Termination)               │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│            bg-threat-ai                 │
│         (Node.js Service)               │
│           Port 3002                     │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│                Redis                    │
│         (Caching & Pub/Sub)             │
│           Port 6379                     │
└─────────────────────────────────────────┘

Optional Monitoring Stack:
├── Prometheus (Metrics)    - Port 9090
├── Grafana (Dashboards)    - Port 3001
└── AlertManager (Alerts)   - Port 9093
```

### Network Configuration
- **External Ports**: 80 (HTTP), 443 (HTTPS)
- **Internal Network**: 172.20.0.0/16
- **Service Discovery**: Docker network with service names
- **SSL Termination**: NGINX proxy layer

---

## 🔒 Security Configuration

### SSL/TLS Setup

#### Option 1: Self-Signed Certificates (Development)
```bash
./scripts/generate-ssl-cert.sh
```

#### Option 2: Production CA Certificates
```bash
# Place your certificates in ssl/ directory
ssl/
├── cert.pem    # SSL certificate
└── key.pem     # Private key
```

#### Option 3: Let's Encrypt (Automated)
```bash
# Install Certbot
sudo apt install certbot

# Generate certificates
sudo certbot certonly --standalone -d yourdomain.com

# Copy to ssl directory
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ssl/cert.pem
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ssl/key.pem
```

### Security Headers (Automatically Applied)
- HSTS (Strict-Transport-Security)
- Content-Security-Policy
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block

### Rate Limiting Configuration
- **API Endpoints**: 100 requests/minute per IP
- **Health Checks**: 30 requests/second per IP
- **Connection Limit**: 10 concurrent connections per IP

---

## 📊 Monitoring & Observability

### Health Check Endpoints
```bash
# Basic health check
curl http://localhost/health

# Detailed health with Redis status
curl http://localhost/health/detailed

# Readiness check
curl http://localhost/health/ready

# Redis-specific health
curl http://localhost/health/redis
```

### Monitoring Stack (Optional)
```bash
# Enable monitoring
docker-compose -f docker-compose.production.yml --profile monitoring up -d

# Access dashboards
open http://localhost:9090    # Prometheus
open http://localhost:3001    # Grafana (admin/admin)
```

### Log Management
```bash
# Real-time logs
docker-compose -f docker-compose.production.yml logs -f

# Service-specific logs
docker-compose -f docker-compose.production.yml logs -f bg-threat-ai
docker-compose -f docker-compose.production.yml logs -f redis
docker-compose -f docker-compose.production.yml logs -f nginx
```

---

## 🔧 Operations & Maintenance

### Daily Operations
```bash
# Check service status
docker-compose -f docker-compose.production.yml ps

# View resource usage
docker stats

# Check disk usage
docker system df

# Health check
curl -f http://localhost/health
```

### Scaling Operations
```bash
# Scale bg-threat-ai service
docker-compose -f docker-compose.production.yml up --scale bg-threat-ai=3 -d

# Update load balancer configuration for multiple instances
# Edit nginx/conf.d/bg-threat-ai.conf to add upstream servers
```

### Backup Procedures
```bash
# Create configuration backup
tar -czf "backup_$(date +%Y%m%d_%H%M%S).tar.gz" \
    .env.production \
    ssl/ \
    nginx/ \
    docker-compose.production.yml

# Backup Redis data (if persistent)
docker exec bg-threat-ai-redis-prod redis-cli BGSAVE
```

### Update Procedures
```bash
# 1. Create backup
./scripts/rollback-deployment.sh  # Creates emergency backup

# 2. Pull latest changes
git pull origin main

# 3. Rebuild and deploy
docker-compose -f docker-compose.production.yml build --no-cache
docker-compose -f docker-compose.production.yml up -d

# 4. Verify deployment
curl -f http://localhost/health
```

---

## 🚨 Troubleshooting

### Common Issues

#### Service Won't Start
```bash
# Check logs for specific service
docker-compose -f docker-compose.production.yml logs service-name

# Check resource usage
docker stats

# Verify environment variables
docker-compose -f docker-compose.production.yml config
```

#### SSL Certificate Issues
```bash
# Check certificate validity
openssl x509 -in ssl/cert.pem -noout -dates

# Test SSL configuration
openssl s_client -connect localhost:443

# Regenerate self-signed certificates
rm -rf ssl/
./scripts/generate-ssl-cert.sh
```

#### Redis Connection Issues
```bash
# Test Redis connectivity
docker exec bg-threat-ai-redis-prod redis-cli ping

# Check Redis logs
docker-compose -f docker-compose.production.yml logs redis

# Reset Redis password
# Edit .env.production and rebuild
```

#### Performance Issues
```bash
# Check API response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost/health

# Monitor real-time metrics
docker-compose -f docker-compose.production.yml --profile monitoring up -d
# Visit http://localhost:9090 for Prometheus metrics
```

### Emergency Procedures

#### Complete Rollback
```bash
./scripts/rollback-deployment.sh
```

#### Service Recovery
```bash
# Stop and restart specific service
docker-compose -f docker-compose.production.yml restart bg-threat-ai

# Full system restart
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d
```

#### Data Recovery
```bash
# Restore from backup
tar -xzf backup_YYYYMMDD_HHMMSS.tar.gz

# Restart with restored configuration
docker-compose -f docker-compose.production.yml up -d
```

---

## 📈 Performance Tuning

### Current Performance Baseline
Based on comprehensive testing:

| Metric | Current Performance | Target | Status |
|--------|-------------------|---------|--------|
| Health endpoints | 1-3ms | <50ms | ✅ Excellent |
| API endpoints | 1200-1800ms | <100ms | ⚠️ Needs optimization |
| Memory usage | 74MB | <500MB | ✅ Excellent |
| Redis operations | 1-2ms | <10ms | ✅ Excellent |

### Optimization Recommendations

#### Immediate (Post-Deployment)
```bash
# Enable Redis persistence
# Edit redis.conf - already configured for production

# Configure connection pooling
# Already implemented in application

# Monitor and tune based on load
docker-compose -f docker-compose.production.yml --profile monitoring up -d
```

#### Advanced (After Load Testing)
- Implement horizontal scaling
- Add Redis Sentinel for HA
- Consider CDN for static assets
- Implement database connection pooling

---

## 🔐 Security Hardening

### Production Security Checklist
- ✅ Strong JWT secrets (256-bit minimum)
- ✅ Redis password authentication
- ✅ SSL/TLS encryption
- ✅ Security headers configured
- ✅ Rate limiting enabled
- ✅ Input validation with Zod
- ✅ Non-root container user
- ✅ Network isolation
- ✅ Secrets not in images
- ✅ Regular security updates

### Advanced Security (Optional)
```bash
# Enable fail2ban for brute force protection
sudo apt install fail2ban

# Configure firewall rules
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 3002/tcp  # Block direct access
sudo ufw deny 6379/tcp  # Block direct Redis access

# Enable Docker security scanning
docker scan bg-threat-ai:latest
```

---

## 🎯 Success Metrics

### Deployment Success Criteria
- ✅ All services healthy (docker ps shows "healthy" status)
- ✅ Health check responds < 50ms
- ✅ HTTPS SSL certificate valid
- ✅ Redis connection operational
- ✅ No critical errors in logs
- ✅ API endpoints responding (even if slow)

### Production Readiness Checklist
- ✅ Environment variables configured
- ✅ SSL certificates installed
- ✅ Monitoring enabled
- ✅ Backup procedures documented
- ✅ Rollback script tested
- ✅ Load balancer configured
- ✅ Security headers active
- ✅ Rate limiting functional

---

## 📞 Support & Resources

### Documentation
- **Architecture**: See `COMPREHENSIVE-TESTING-REPORT.md`
- **Performance**: See `PERFORMANCE-BASELINE.md`
- **Environment**: See `.env.example`

### Scripts
- **Deploy**: `./scripts/deploy-production.sh`
- **Rollback**: `./scripts/rollback-deployment.sh`
- **SSL Setup**: `./scripts/generate-ssl-cert.sh`
- **Validation**: `node scripts/validate-environment.js`

### Monitoring URLs (When Enabled)
- **Application**: https://localhost
- **Health Check**: https://localhost/health
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001

---

## 🏆 Conclusion

The Console-First Threat Detection Platform is now ready for production deployment with:

- ✅ **Enterprise-grade security** with SSL/TLS, authentication, and hardening
- ✅ **High availability** with Docker containers, health checks, and auto-restart
- ✅ **Comprehensive monitoring** with health endpoints and optional Prometheus stack
- ✅ **Production operations** with deployment, rollback, and maintenance scripts
- ✅ **Performance baseline** documented with optimization roadmap
- ✅ **Scalability foundation** ready for horizontal scaling and load balancing

**Next Steps After Deployment:**
1. Monitor performance metrics and optimize API response times
2. Implement horizontal scaling based on load requirements
3. Set up external monitoring and alerting
4. Regular security updates and certificate renewals
5. Performance optimization based on production usage patterns

---

*Deployment Guide - Version 2.0.0*  
*Console-First Threat Detection Platform*  
*Production Ready: August 10, 2025*