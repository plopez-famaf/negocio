#!/bin/bash

# =================================================================
# PRODUCTION DEPLOYMENT SCRIPT
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
ENV_FILE=".env.production"
SSL_CERT_PATH="./ssl/cert.pem"
SSL_KEY_PATH="./ssl/key.pem"

echo -e "${GREEN}🚀 bg-threat-ai Production Deployment${NC}"
echo "================================================================"

# Function to print step headers
print_step() {
    echo -e "\n${BLUE}📋 Step $1: $2${NC}"
    echo "----------------------------------------------------------------"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Step 1: Pre-deployment Checks
print_step "1" "Pre-deployment Validation"

# Check required commands
echo "Checking required commands..."
for cmd in docker docker-compose node npm curl; do
    if ! command_exists "$cmd"; then
        echo -e "${RED}❌ Error: $cmd is not installed${NC}"
        exit 1
    else
        echo -e "${GREEN}✅ $cmd is available${NC}"
    fi
done

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}❌ Error: Docker is not running${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker is running${NC}"

# Check if production environment file exists
if [[ ! -f "$ENV_FILE" ]]; then
    echo -e "${YELLOW}⚠️  Production environment file not found${NC}"
    echo "Creating from template..."
    cp .env.example "$ENV_FILE"
    echo -e "${YELLOW}📝 Please edit $ENV_FILE with production values before continuing${NC}"
    read -p "Press Enter when ready..."
fi

# Step 2: Environment Validation
print_step "2" "Environment Configuration Validation"

echo "Validating environment configuration..."
if node scripts/validate-environment.js; then
    echo -e "${GREEN}✅ Environment validation passed${NC}"
else
    echo -e "${RED}❌ Environment validation failed${NC}"
    echo "Please fix configuration issues before deploying"
    exit 1
fi

# Step 3: SSL Certificate Setup
print_step "3" "SSL Certificate Setup"

if [[ ! -f "$SSL_CERT_PATH" || ! -f "$SSL_KEY_PATH" ]]; then
    echo -e "${YELLOW}⚠️  SSL certificates not found${NC}"
    read -p "Generate self-signed certificates for development? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ./scripts/generate-ssl-cert.sh
    else
        echo -e "${RED}❌ SSL certificates required for production deployment${NC}"
        echo "Please place your SSL certificates in:"
        echo "  - Certificate: $SSL_CERT_PATH"
        echo "  - Private Key: $SSL_KEY_PATH"
        exit 1
    fi
else
    echo -e "${GREEN}✅ SSL certificates found${NC}"
fi

# Step 4: Build Application
print_step "4" "Building Production Images"

echo "Building bg-threat-ai production image..."
docker-compose -f "$COMPOSE_FILE" build --no-cache

echo -e "${GREEN}✅ Production images built successfully${NC}"

# Step 5: Stop Existing Services
print_step "5" "Stopping Existing Services"

echo "Stopping any existing containers..."
docker-compose -f "$COMPOSE_FILE" down --remove-orphans

echo -e "${GREEN}✅ Existing services stopped${NC}"

# Step 6: Start Production Services
print_step "6" "Starting Production Services"

echo "Starting production services..."
docker-compose -f "$COMPOSE_FILE" up -d

echo "Waiting for services to become healthy..."
sleep 30

# Check service health
services=("bg-threat-ai-redis-prod" "bg-threat-ai-service-prod" "bg-threat-ai-nginx-prod")
all_healthy=true

for service in "${services[@]}"; do
    if docker ps --filter "name=$service" --filter "health=healthy" | grep -q "$service"; then
        echo -e "${GREEN}✅ $service is healthy${NC}"
    else
        echo -e "${RED}❌ $service is not healthy${NC}"
        all_healthy=false
    fi
done

if [ "$all_healthy" = false ]; then
    echo -e "${RED}❌ Some services are not healthy. Check logs:${NC}"
    echo "docker-compose -f $COMPOSE_FILE logs"
    exit 1
fi

# Step 7: Health Check Validation
print_step "7" "Deployment Health Validation"

echo "Testing health endpoints..."

# Test HTTP health check
if curl -f -s http://localhost/health >/dev/null; then
    echo -e "${GREEN}✅ HTTP health check passed${NC}"
else
    echo -e "${RED}❌ HTTP health check failed${NC}"
fi

# Test HTTPS health check (if SSL is configured)
if curl -f -s -k https://localhost/health >/dev/null; then
    echo -e "${GREEN}✅ HTTPS health check passed${NC}"
else
    echo -e "${YELLOW}⚠️  HTTPS health check failed (SSL may not be configured)${NC}"
fi

# Test API endpoints
if curl -f -s http://localhost/health/ready >/dev/null; then
    echo -e "${GREEN}✅ Readiness check passed${NC}"
else
    echo -e "${RED}❌ Readiness check failed${NC}"
fi

# Step 8: Display Deployment Information
print_step "8" "Deployment Summary"

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo
echo -e "${BLUE}📊 Service Information:${NC}"
echo "  - Application: http://localhost (HTTP)"
echo "  - Application: https://localhost (HTTPS)"
echo "  - Health Check: http://localhost/health"
echo "  - Redis: localhost:6379"
echo "  - Monitoring: http://localhost:3001 (if enabled)"
echo
echo -e "${BLUE}🔧 Management Commands:${NC}"
echo "  - View logs: docker-compose -f $COMPOSE_FILE logs -f"
echo "  - Check status: docker-compose -f $COMPOSE_FILE ps"
echo "  - Stop services: docker-compose -f $COMPOSE_FILE down"
echo "  - Restart: docker-compose -f $COMPOSE_FILE restart"
echo
echo -e "${BLUE}📊 Monitoring:${NC}"
echo "  - Enable monitoring: docker-compose -f $COMPOSE_FILE --profile monitoring up -d"
echo "  - Prometheus: http://localhost:9090"
echo "  - Grafana: http://localhost:3001"
echo
echo -e "${YELLOW}🔒 Security Reminders:${NC}"
echo "  - Change default passwords in $ENV_FILE"
echo "  - Replace self-signed SSL certificates with CA certificates"
echo "  - Review firewall rules and network security"
echo "  - Monitor application logs regularly"
echo
echo -e "${GREEN}✅ bg-threat-ai is now running in production mode!${NC}"

# Optional: Show real-time logs
read -p "Show real-time logs? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}📋 Real-time logs (Ctrl+C to exit):${NC}"
    docker-compose -f "$COMPOSE_FILE" logs -f
fi