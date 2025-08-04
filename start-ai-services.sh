#!/bin/bash

# BehaviorGuard AI Services Startup Script
# This script starts all AI services in development mode

set -e

echo "🚀 Starting BehaviorGuard AI Services..."
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if a service is running
check_service() {
    local service_name=$1
    local port=$2
    
    if curl -s http://localhost:$port/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $service_name is running on port $port${NC}"
        return 0
    else
        echo -e "${RED}❌ $service_name is not responding on port $port${NC}"
        return 1
    fi
}

# Function to start a service
start_service() {
    local service_name=$1
    local service_dir=$2
    local port=$3
    
    echo -e "${BLUE}Starting $service_name...${NC}"
    
    if [ -d "$service_dir" ]; then
        cd "$service_dir"
        
        # Check if package.json exists
        if [ -f "package.json" ]; then
            # Install dependencies if node_modules doesn't exist
            if [ ! -d "node_modules" ]; then
                echo -e "${YELLOW}Installing dependencies for $service_name...${NC}"
                npm install
            fi
            
            # Start the service in background
            npm run dev > "../logs/${service_name}.log" 2>&1 &
            echo $! > "../logs/${service_name}.pid"
            
            echo -e "${GREEN}$service_name started with PID $(cat ../logs/${service_name}.pid)${NC}"
        else
            echo -e "${RED}❌ package.json not found in $service_dir${NC}"
            return 1
        fi
        
        cd ..
    else
        echo -e "${RED}❌ Directory $service_dir not found${NC}"
        return 1
    fi
}

# Create logs directory
mkdir -p logs

# Load environment variables
if [ -f ".env.ai-services" ]; then
    echo -e "${BLUE}Loading environment variables...${NC}"
    export $(cat .env.ai-services | grep -v '^#' | xargs)
else
    echo -e "${YELLOW}⚠️  .env.ai-services file not found. Using default values.${NC}"
fi

echo ""
echo "🔧 Starting Infrastructure Services..."
echo "======================================"

# Start Redis and PostgreSQL using Docker
if command -v docker-compose > /dev/null 2>&1; then
    echo -e "${BLUE}Starting Redis and PostgreSQL...${NC}"
    docker-compose -f docker-compose.ai-services.yml up -d redis postgres
    
    # Wait for services to be ready
    echo -e "${YELLOW}Waiting for database services to be ready...${NC}"
    sleep 5
else
    echo -e "${YELLOW}⚠️  Docker Compose not found. Please start Redis and PostgreSQL manually.${NC}"
fi

echo ""
echo "🤖 Starting AI Services..."
echo "=========================="

# Start each AI service
start_service "BG Identity AI" "bg-identity-ai" 3001
sleep 2

start_service "BG Threat AI" "bg-threat-ai" 3002
sleep 2

start_service "BG AI Dashboard" "bg-ai-dashboard" 3003
sleep 2

start_service "BG Mobile AI" "bg-mobile-ai" 3004
sleep 2

start_service "BG Quantum Gateway" "bg-quantum-gateway" 3005
sleep 2

echo ""
echo "⏳ Waiting for services to initialize..."
sleep 10

echo ""
echo "🔍 Checking Service Health..."
echo "============================="

# Check each service
all_healthy=true

check_service "BG Identity AI" 3001 || all_healthy=false
check_service "BG Threat AI" 3002 || all_healthy=false
check_service "BG AI Dashboard" 3003 || all_healthy=false
check_service "BG Mobile AI" 3004 || all_healthy=false
check_service "BG Quantum Gateway" 3005 || all_healthy=false

echo ""
if [ "$all_healthy" = true ]; then
    echo -e "${GREEN}🎉 All AI services are running successfully!${NC}"
    echo ""
    echo "📊 Service URLs:"
    echo "================"
    echo -e "${BLUE}• BG Identity AI:      http://localhost:3001${NC}"
    echo -e "${BLUE}• BG Threat AI:        http://localhost:3002${NC}"
    echo -e "${BLUE}• BG AI Dashboard:     http://localhost:3003${NC}"
    echo -e "${BLUE}• BG Mobile AI:        http://localhost:3004${NC}"
    echo -e "${BLUE}• BG Quantum Gateway:  http://localhost:3005${NC}"
    echo ""
    echo "📋 Management Commands:"
    echo "======================"
    echo -e "${YELLOW}• View logs:         tail -f logs/<service-name>.log${NC}"
    echo -e "${YELLOW}• Stop services:     ./stop-ai-services.sh${NC}"
    echo -e "${YELLOW}• Restart service:   kill \$(cat logs/<service-name>.pid) && ./start-ai-services.sh${NC}"
    echo ""
    echo "🚀 Ready for AI-powered development!"
else
    echo -e "${RED}❌ Some services failed to start. Check the logs for details.${NC}"
    echo ""
    echo "📋 Troubleshooting:"
    echo "==================="
    echo -e "${YELLOW}• Check logs:        ls -la logs/${NC}"
    echo -e "${YELLOW}• View service log:  tail -f logs/<service-name>.log${NC}"
    echo -e "${YELLOW}• Check ports:       netstat -tulpn | grep LISTEN${NC}"
    echo -e "${YELLOW}• Kill processes:    ./stop-ai-services.sh${NC}"
    exit 1
fi