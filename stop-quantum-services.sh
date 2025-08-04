#!/bin/bash

# BehaviorGuard Quantum-Enhanced AI Services Stop Script
# This script stops all quantum-enhanced AI services

set -e

echo "🛑 Stopping BehaviorGuard Quantum-Secure AI Services..."
echo "======================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Function to stop quantum services
stop_quantum_service() {
    local service_name=$1
    
    if [ -f "logs/${service_name}-quantum.pid" ]; then
        local pid=$(cat "logs/${service_name}-quantum.pid")
        
        if ps -p $pid > /dev/null 2>&1; then
            echo -e "${BLUE}Stopping quantum-enhanced $service_name (PID: $pid)...${NC}"
            kill $pid
            
            # Wait for process to stop
            local count=0
            while ps -p $pid > /dev/null 2>&1 && [ $count -lt 15 ]; do
                sleep 1
                count=$((count + 1))
            done
            
            if ps -p $pid > /dev/null 2>&1; then
                echo -e "${YELLOW}Force killing $service_name...${NC}"
                kill -9 $pid
            fi
            
            echo -e "${GREEN}✅ Quantum-enhanced $service_name stopped${NC}"
        else
            echo -e "${YELLOW}⚠️  $service_name process not found (PID: $pid)${NC}"
        fi
        
        rm -f "logs/${service_name}-quantum.pid"
    else
        echo -e "${YELLOW}⚠️  No quantum PID file found for $service_name${NC}"
    fi
}

# Stop quantum-enhanced AI services
echo "🔐 Stopping Quantum AI Services..."
echo "=================================="

stop_quantum_service "bg-identity-ai"
stop_quantum_service "bg-threat-ai"
stop_quantum_service "bg-ai-dashboard"
stop_quantum_service "bg-mobile-ai"
stop_quantum_service "bg-quantum-gateway"

# Stop any remaining Node.js processes on quantum ports
echo ""
echo "🔍 Checking for remaining quantum processes..."
echo "============================================="

for port in 3001 3002 3003 3004 3005 8000 8001 8888 8889 9092; do
    pid=$(lsof -ti:$port 2>/dev/null || true)
    if [ -n "$pid" ]; then
        echo -e "${YELLOW}Found process on port $port (PID: $pid), killing...${NC}"
        kill $pid 2>/dev/null || kill -9 $pid 2>/dev/null || true
    fi
done

# Stop Docker quantum services
echo ""
echo "🐳 Stopping Quantum Docker Services..."
echo "======================================"

if command -v docker-compose > /dev/null 2>&1; then
    # Stop quantum-specific services
    if [ -f "docker-compose.quantum.yml" ]; then
        echo -e "${PURPLE}Stopping Morpheus and quantum gateway containers...${NC}"
        docker-compose -f docker-compose.quantum.yml down
        echo -e "${GREEN}✅ Quantum Docker services stopped${NC}"
    fi
    
    # Stop basic infrastructure
    if [ -f "docker-compose.ai-services.yml" ]; then
        echo -e "${BLUE}Stopping basic infrastructure services...${NC}"
        docker-compose -f docker-compose.ai-services.yml stop
        echo -e "${GREEN}✅ Infrastructure services stopped${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Docker Compose not found${NC}"
fi

# Clean up quantum-specific resources
echo ""
echo "🧹 Cleaning up quantum resources..."
echo "==================================="

# Stop any NVIDIA processes
if command -v nvidia-smi > /dev/null 2>&1; then
    echo -e "${BLUE}Checking NVIDIA GPU processes...${NC}"
    gpu_processes=$(nvidia-smi --query-compute-apps=pid --format=csv,noheader,nounits 2>/dev/null || true)
    if [ -n "$gpu_processes" ]; then
        echo -e "${YELLOW}Found GPU processes: $gpu_processes${NC}"
        echo -e "${YELLOW}Note: GPU processes may be used by other applications${NC}"
    else
        echo -e "${GREEN}✅ No GPU processes found${NC}"
    fi
fi

# Clean up shared memory and semaphores (quantum operations may leave artifacts)
echo -e "${BLUE}Cleaning up quantum shared resources...${NC}"
# Clean up any orphaned shared memory segments
ipcs -m | grep $(whoami) | awk '{print $2}' | xargs -r ipcrm -m 2>/dev/null || true
# Clean up any orphaned semaphores
ipcs -s | grep $(whoami) | awk '{print $2}' | xargs -r ipcrm -s 2>/dev/null || true

echo -e "${GREEN}✅ Quantum shared resources cleaned${NC}"

# Clean up quantum log files (optional)
echo ""
read -p "$(echo -e ${YELLOW}Delete quantum log files? [y/N]:${NC} )" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Cleaning up quantum log files...${NC}"
    rm -f logs/*-quantum.log
    rm -f logs/morpheus-*.log
    rm -f logs/quantum-*.log
    echo -e "${GREEN}✅ Quantum log files cleaned${NC}"
fi

# Clean up temporary quantum files
echo -e "${BLUE}Cleaning up temporary quantum files...${NC}"
rm -f /tmp/quantum-*.tmp 2>/dev/null || true
rm -f /tmp/morpheus-*.tmp 2>/dev/null || true
rm -f /tmp/liboqs-*.tmp 2>/dev/null || true
echo -e "${GREEN}✅ Temporary files cleaned${NC}"

echo ""
echo -e "${GREEN}🎉 All quantum-enhanced AI services stopped successfully!${NC}"
echo ""
echo "📊 Quantum Status Summary:"
echo "=========================="
echo -e "${PURPLE}• Post-quantum cryptography: Disabled${NC}"
echo -e "${PURPLE}• Hybrid authentication: Stopped${NC}"
echo -e "${PURPLE}• GPU acceleration: Released${NC}"
echo -e "${PURPLE}• Quantum gateway: Shutdown${NC}"
echo ""
echo "📋 Next Steps:"
echo "=============="
echo -e "${BLUE}• Start quantum services:  ./start-quantum-services.sh${NC}"
echo -e "${BLUE}• Start basic services:     ./start-ai-services.sh${NC}"
echo -e "${BLUE}• Check quantum status:     ./scripts/test-quantum-install.sh${NC}"
echo -e "${BLUE}• Reset quantum config:     rm .env.quantum${NC}"
echo -e "${BLUE}• Check system processes:   ps aux | grep -E '(node|python|morpheus)'${NC}"