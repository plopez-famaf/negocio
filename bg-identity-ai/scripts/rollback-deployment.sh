#!/bin/bash

# =================================================================
# ROLLBACK DEPLOYMENT SCRIPT
# bg-threat-ai Console-First Threat Detection Platform
# =================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.production.yml"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo -e "${YELLOW}⚠️  bg-threat-ai Production Rollback${NC}"
echo "================================================================"

# Function to print step headers
print_step() {
    echo -e "\n${BLUE}📋 Step $1: $2${NC}"
    echo "----------------------------------------------------------------"
}

# Step 1: Confirmation
print_step "1" "Rollback Confirmation"

echo -e "${RED}🚨 WARNING: This will rollback the production deployment${NC}"
echo "This action will:"
echo "  - Stop current production services"
echo "  - Restore previous configuration"
echo "  - Restart services with backup configuration"
echo
read -p "Are you sure you want to proceed? (type 'ROLLBACK' to confirm): " confirm

if [[ "$confirm" != "ROLLBACK" ]]; then
    echo -e "${GREEN}✅ Rollback cancelled${NC}"
    exit 0
fi

# Step 2: Create Emergency Backup
print_step "2" "Creating Emergency Backup"

mkdir -p "$BACKUP_DIR"

echo "Backing up current configuration..."
tar -czf "$BACKUP_DIR/emergency_backup_$TIMESTAMP.tar.gz" \
    .env.production \
    docker-compose.production.yml \
    ssl/ \
    nginx/ \
    logs/ \
    2>/dev/null || true

echo -e "${GREEN}✅ Emergency backup created: $BACKUP_DIR/emergency_backup_$TIMESTAMP.tar.gz${NC}"

# Step 3: Stop Current Services
print_step "3" "Stopping Current Services"

echo "Stopping production services..."
docker-compose -f "$COMPOSE_FILE" down

echo -e "${GREEN}✅ Services stopped${NC}"

# Step 4: Restore Previous Version
print_step "4" "Restoring Previous Version"

# Check if backup exists
LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null | head -n 1)

if [[ -n "$LATEST_BACKUP" ]]; then
    echo "Restoring from backup: $LATEST_BACKUP"
    tar -xzf "$LATEST_BACKUP"
    echo -e "${GREEN}✅ Configuration restored from backup${NC}"
else
    echo -e "${YELLOW}⚠️  No backup found. Using current configuration${NC}"
    echo "Rolling back to development mode..."
    
    # Restore development configuration
    if [[ -f ".env.example" ]]; then
        cp .env.example .env.production
        echo -e "${GREEN}✅ Development configuration restored${NC}"
    fi
fi

# Step 5: Restart Services
print_step "5" "Restarting Services"

echo "Starting services with restored configuration..."

# Try to start services
if docker-compose -f "$COMPOSE_FILE" up -d; then
    echo -e "${GREEN}✅ Services restarted successfully${NC}"
else
    echo -e "${RED}❌ Failed to restart services${NC}"
    echo "Attempting fallback to development mode..."
    
    # Fallback to development compose file
    if [[ -f "docker-compose.yml" ]]; then
        docker-compose up -d
        echo -e "${YELLOW}⚠️  Started in development mode${NC}"
    else
        echo -e "${RED}❌ Unable to start any services${NC}"
        exit 1
    fi
fi

# Step 6: Health Check
print_step "6" "Health Check Validation"

echo "Waiting for services to start..."
sleep 20

# Check if services are responsive
if curl -f -s http://localhost/health >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Health check passed${NC}"
else
    echo -e "${RED}❌ Health check failed${NC}"
    echo "Services may need more time to start or there may be configuration issues"
fi

# Step 7: Rollback Summary
print_step "7" "Rollback Summary"

echo -e "${GREEN}🔄 Rollback completed${NC}"
echo
echo -e "${BLUE}📊 Service Status:${NC}"
docker-compose -f "$COMPOSE_FILE" ps

echo
echo -e "${BLUE}🔧 Next Steps:${NC}"
echo "1. Verify application functionality"
echo "2. Check logs for any issues:"
echo "   docker-compose -f $COMPOSE_FILE logs -f"
echo "3. Monitor service health"
echo "4. Investigate the issue that required rollback"
echo
echo -e "${YELLOW}📝 Important Notes:${NC}"
echo "- Emergency backup saved: $BACKUP_DIR/emergency_backup_$TIMESTAMP.tar.gz"
echo "- Review logs to understand what went wrong"
echo "- Fix issues before attempting deployment again"
echo "- Consider implementing blue-green deployment for zero-downtime rollbacks"

echo -e "${GREEN}✅ Rollback process completed!${NC}"