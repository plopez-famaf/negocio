#!/bin/bash

# BehaviorGuard AI Services Stop Script
# This script stops all running AI services

set -e

echo "🛑 Stopping BehaviorGuard AI Services..."
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to stop a service
stop_service() {
    local service_name=$1
    
    if [ -f "logs/${service_name}.pid" ]; then
        local pid=$(cat "logs/${service_name}.pid")
        
        if ps -p $pid > /dev/null 2>&1; then
            echo -e "${BLUE}Stopping $service_name (PID: $pid)...${NC}"
            kill $pid
            
            # Wait for process to stop
            local count=0
            while ps -p $pid > /dev/null 2>&1 && [ $count -lt 10 ]; do
                sleep 1
                count=$((count + 1))
            done
            
            if ps -p $pid > /dev/null 2>&1; then
                echo -e "${YELLOW}Force killing $service_name...${NC}"
                kill -9 $pid
            fi
            
            echo -e "${GREEN}✅ $service_name stopped${NC}"
        else
            echo -e "${YELLOW}⚠️  $service_name process not found (PID: $pid)${NC}"
        fi
        
        rm -f "logs/${service_name}.pid"
    else
        echo -e "${YELLOW}⚠️  No PID file found for $service_name${NC}"
    fi
}

# Stop all AI services
echo "🤖 Stopping AI Services..."
echo "========================="

stop_service "bg-identity-ai"
stop_service "bg-threat-ai"
stop_service "bg-ai-dashboard"
stop_service "bg-mobile-ai"
stop_service "bg-quantum-gateway"

# Stop any remaining Node.js processes on our ports
echo ""
echo "🔍 Checking for remaining processes..."
echo "===================================="

for port in 3001 3002 3003 3004 3005; do
    pid=$(lsof -ti:$port 2>/dev/null || true)
    if [ -n "$pid" ]; then
        echo -e "${YELLOW}Found process on port $port (PID: $pid), killing...${NC}"
        kill $pid 2>/dev/null || kill -9 $pid 2>/dev/null || true
    fi
done

# Stop Docker services
echo ""
echo "🐳 Stopping Docker Services..."
echo "==============================="

if command -v docker-compose > /dev/null 2>&1; then
    if [ -f "docker-compose.ai-services.yml" ]; then
        echo -e "${BLUE}Stopping Redis and PostgreSQL...${NC}"
        docker-compose -f docker-compose.ai-services.yml stop
        echo -e "${GREEN}✅ Docker services stopped${NC}"
    else
        echo -e "${YELLOW}⚠️  docker-compose.ai-services.yml not found${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Docker Compose not found${NC}"
fi

# Clean up log files (optional)
read -p "$(echo -e ${YELLOW}Delete log files? [y/N]:${NC} )" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Cleaning up log files...${NC}"
    rm -f logs/*.log
    echo -e "${GREEN}✅ Log files cleaned${NC}"
fi

echo ""
echo -e "${GREEN}🎉 All AI services stopped successfully!${NC}"
echo ""
echo "📋 Next Steps:"
echo "=============="
echo -e "${BLUE}• Start services:    ./start-ai-services.sh${NC}"
echo -e "${BLUE}• Check processes:   ps aux | grep node${NC}"
echo -e "${BLUE}• Check ports:       netstat -tulpn | grep LISTEN${NC}"