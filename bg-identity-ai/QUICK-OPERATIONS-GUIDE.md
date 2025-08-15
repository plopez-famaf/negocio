# 🚀 Quick Operations Guide
**bg-threat-ai Console-First Threat Detection Platform**

## 🟢 System Startup

### Full System Start
```bash
# Source environment variables from production config
set -a && source .env.production && set +a

# Start all services
docker-compose -f docker-compose.production.yml up -d

# Wait for services to be ready
sleep 15

# Verify all services are healthy
docker-compose -f docker-compose.production.yml ps
```

### Quick Health Check
```bash
# Test main health endpoint
curl -f http://localhost/health

# Test service health directly
curl -f http://localhost:3002/health

# Check all service status
docker-compose -f docker-compose.production.yml ps
```

## 🔴 System Shutdown

### Graceful Shutdown (Recommended)
```bash
# Stop all services gracefully - preserves data
docker-compose -f docker-compose.production.yml down

# Verify shutdown
docker-compose -f docker-compose.production.yml ps
```

### Complete Clean Shutdown (⚠️ Removes Data)
```bash
# Stop services and remove all data volumes
docker-compose -f docker-compose.production.yml down --volumes --remove-orphans

# WARNING: This deletes Redis data and logs
```

### Individual Service Control
```bash
# Stop specific service
docker-compose -f docker-compose.production.yml stop bg-threat-ai

# Start specific service
docker-compose -f docker-compose.production.yml start bg-threat-ai

# Restart specific service
docker-compose -f docker-compose.production.yml restart bg-threat-ai
```

## 🔄 System Restart

### Full System Restart
```bash
# Quick restart (maintains environment)
docker-compose -f docker-compose.production.yml restart

# Or full restart with fresh environment
docker-compose -f docker-compose.production.yml down
set -a && source .env.production && set +a
docker-compose -f docker-compose.production.yml up -d
```

### Service-Specific Restart
```bash
# Restart just the API service
docker-compose -f docker-compose.production.yml restart bg-threat-ai

# Restart nginx proxy
docker-compose -f docker-compose.production.yml restart nginx

# Restart Redis
docker-compose -f docker-compose.production.yml restart redis
```

## 📊 Monitoring & Logs

### View Logs
```bash
# View all service logs
docker-compose -f docker-compose.production.yml logs -f

# View specific service logs
docker-compose -f docker-compose.production.yml logs -f bg-threat-ai

# View last 50 log entries
docker-compose -f docker-compose.production.yml logs --tail=50
```

### Service Status
```bash
# Check container status and health
docker-compose -f docker-compose.production.yml ps

# Check resource usage
docker stats

# Check service uptime
curl -s http://localhost/health | jq '.uptime'
```

## 🧪 API Testing

### Authentication Test
```bash
# Test unauthorized access (should return 401)
curl -w "%{http_code}" -s -o /dev/null http://localhost/api/threat/health

# Test with valid token (should return 200)
CONTAINER_JWT_SECRET=$(docker exec bg-threat-ai-service-prod printenv JWT_SECRET)
TOKEN=$(JWT_SECRET="$CONTAINER_JWT_SECRET" node -e "
const jwt = require('jsonwebtoken');
console.log(jwt.sign({id: 'test', email: 'test@test.com'}, process.env.JWT_SECRET));
")
curl -H "Authorization: Bearer $TOKEN" -w "%{http_code}" -s -o /dev/null http://localhost/api/threat/health
```

### Performance Testing
```bash
# Run comprehensive performance tests
CONTAINER_JWT_SECRET=$(docker exec bg-threat-ai-service-prod printenv JWT_SECRET)
JWT_SECRET="$CONTAINER_JWT_SECRET" node scripts/test-performance-improvements.js

# Quick API response time test
CONTAINER_JWT_SECRET=$(docker exec bg-threat-ai-service-prod printenv JWT_SECRET)
TOKEN=$(JWT_SECRET="$CONTAINER_JWT_SECRET" node -e "console.log(require('jsonwebtoken').sign({id:'test',email:'test@example.com',role:'admin',exp:Math.floor(Date.now()/1000)+3600},process.env.JWT_SECRET));")

time curl -X POST http://localhost:3002/api/threat/detect-realtime \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"events":[{"id":"test-1","type":"malware","signature":"trojan"}],"source":"test"}'
```

## 🚨 Emergency Procedures

### Quick Recovery
```bash
# If service becomes unresponsive
docker-compose -f docker-compose.production.yml restart bg-threat-ai
sleep 10
curl -f http://localhost/health

# If still failing, full restart
docker-compose -f docker-compose.production.yml down
set -a && source .env.production && set +a
docker-compose -f docker-compose.production.yml up -d
```

### Emergency Rollback
```bash
# Use automated rollback script
./scripts/rollback-deployment.sh

# Follow prompts and type 'ROLLBACK' to confirm
```

### Troubleshooting
```bash
# Check container resource usage
docker stats --no-stream

# Check available disk space
df -h

# Check system memory
free -h

# View detailed service logs
docker-compose -f docker-compose.production.yml logs --tail=100 bg-threat-ai
```

## 📋 Quick Status Commands

```bash
# Essential status check (copy-paste ready)
echo "=== System Status ===" && \
docker-compose -f docker-compose.production.yml ps && \
echo && echo "=== Health Check ===" && \
curl -s http://localhost/health | jq '.status, .redis.status' && \
echo && echo "=== API Response Time ===" && \
curl -w "Total time: %{time_total}s\n" -s -o /dev/null http://localhost/health
```

## 🔧 Environment Management

### Check Environment Variables
```bash
# View container environment
docker exec bg-threat-ai-service-prod printenv | grep -E "(JWT_SECRET|REDIS|NODE_ENV)" | sort

# Verify .env.production is loaded
grep -E "(JWT_SECRET|REDIS_PASSWORD)" .env.production
```

### Update Configuration
```bash
# After modifying .env.production, restart with new config
docker-compose -f docker-compose.production.yml down
set -a && source .env.production && set +a
docker-compose -f docker-compose.production.yml up -d
```

---

## 📊 Expected Performance Metrics

- **API Response Time**: < 100ms (typical: 4-44ms)
- **Health Check**: < 10ms
- **Threat Detection Rate**: ≥ 99%
- **System Startup**: ~15-30 seconds
- **Memory Usage**: ~512MB per service
- **CPU Usage**: < 50% under normal load

---

## 🆘 Support

For detailed troubleshooting procedures, see:
- `DEPLOYMENT-PROCEDURES.md` - Complete deployment and validation procedures
- `scripts/rollback-deployment.sh` - Emergency rollback procedures
- `docker-compose -f docker-compose.production.yml logs` - Service logs