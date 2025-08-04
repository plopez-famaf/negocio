#!/bin/bash

# BehaviorGuard Quantum-Enhanced AI Services Startup Script
# This script starts all AI services with quantum-secure enhancements

set -e

echo "🔐 Starting BehaviorGuard Quantum-Secure AI Services..."
echo "========================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to check if quantum prerequisites are met
check_quantum_prerequisites() {
    echo -e "${PURPLE}🔍 Checking Quantum Prerequisites...${NC}"
    
    # Check for liboqs installation
    if ! ldconfig -p | grep -q liboqs; then
        echo -e "${RED}❌ OpenQuantumSafe (liboqs) not found${NC}"
        echo -e "${YELLOW}Please install using: ./scripts/install-quantum-deps.sh${NC}"
        return 1
    else
        echo -e "${GREEN}✅ OpenQuantumSafe (liboqs) found${NC}"
    fi
    
    # Check for Node.js quantum bindings
    if [ -f "bg-quantum-gateway/node_modules/liboqs-node/package.json" ]; then
        echo -e "${GREEN}✅ Node.js quantum bindings found${NC}"
    else
        echo -e "${YELLOW}⚠️  Installing Node.js quantum bindings...${NC}"
        cd bg-quantum-gateway
        npm install liboqs-node
        cd ..
    fi
    
    # Check for NVIDIA GPU (optional for Morpheus)
    if command -v nvidia-smi > /dev/null 2>&1; then
        echo -e "${GREEN}✅ NVIDIA GPU support detected${NC}"
        nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits | head -1
    else
        echo -e "${YELLOW}⚠️  NVIDIA GPU not detected (Morpheus will use CPU fallback)${NC}"
    fi
    
    echo ""
}

# Function to check service health with quantum status
check_quantum_service() {
    local service_name=$1
    local port=$2
    
    if curl -s http://localhost:$port/health > /dev/null 2>&1; then
        # Check if service supports quantum operations
        if curl -s http://localhost:$port/api/quantum/status > /dev/null 2>&1; then
            echo -e "${GREEN}✅ $service_name is running with quantum support on port $port${NC}"
        else
            echo -e "${GREEN}✅ $service_name is running on port $port (quantum support pending)${NC}"
        fi
        return 0
    else
        echo -e "${RED}❌ $service_name is not responding on port $port${NC}"
        return 1
    fi
}

# Function to start services with quantum configuration
start_quantum_service() {
    local service_name=$1
    local service_dir=$2
    local port=$3
    local quantum_enabled=${4:-false}
    
    echo -e "${BLUE}Starting $service_name...${NC}"
    
    if [ -d "$service_dir" ]; then
        cd "$service_dir"
        
        if [ -f "package.json" ]; then
            # Install dependencies if needed
            if [ ! -d "node_modules" ]; then
                echo -e "${YELLOW}Installing dependencies for $service_name...${NC}"
                npm install
            fi
            
            # Set quantum-specific environment variables
            export QUANTUM_ENABLED=$quantum_enabled
            export QUANTUM_ALGORITHMS="Kyber768,Dilithium3"
            export MORPHEUS_ENABLED=true
            export GPU_ACCELERATION=auto
            
            # Start service with quantum configuration
            if [ "$quantum_enabled" = "true" ]; then
                echo -e "${PURPLE}🔐 Starting with quantum-secure configuration${NC}"
            fi
            
            npm run dev > "../logs/${service_name}-quantum.log" 2>&1 &
            echo $! > "../logs/${service_name}-quantum.pid"
            
            echo -e "${GREEN}$service_name started with PID $(cat ../logs/${service_name}-quantum.pid)${NC}"
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

# Check quantum prerequisites
check_quantum_prerequisites

# Load quantum-specific environment variables
if [ -f ".env.quantum" ]; then
    echo -e "${PURPLE}Loading quantum environment variables...${NC}"
    export $(cat .env.quantum | grep -v '^#' | xargs)
else
    echo -e "${YELLOW}⚠️  .env.quantum file not found. Creating with defaults...${NC}"
    cat > .env.quantum << 'EOF'
# Quantum-Secure AI Services Configuration
QUANTUM_ENABLED=true
QUANTUM_KEM_ALGORITHM=Kyber768
QUANTUM_SIG_ALGORITHM=Dilithium3
MORPHEUS_ENABLED=true
GPU_ACCELERATION=auto
TRITON_SERVER_URL=http://localhost:8001
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
REDIS_QUANTUM_DB=1
POSTGRES_QUANTUM_SCHEMA=quantum_security
EOF
    export $(cat .env.quantum | grep -v '^#' | xargs)
fi

echo ""
echo "🔧 Starting Quantum Infrastructure..."
echo "===================================="

# Start enhanced infrastructure with quantum support
if command -v docker-compose > /dev/null 2>&1; then
    echo -e "${BLUE}Starting quantum-enhanced infrastructure...${NC}"
    
    # Start basic infrastructure
    docker-compose -f docker-compose.ai-services.yml up -d redis postgres
    
    # Start Morpheus and quantum services if available
    if [ -f "docker-compose.quantum.yml" ]; then
        echo -e "${PURPLE}Starting quantum gateway and Morpheus services...${NC}"
        docker-compose -f docker-compose.quantum.yml up -d
    else
        echo -e "${YELLOW}⚠️  docker-compose.quantum.yml not found. Starting without Morpheus.${NC}"
    fi
    
    echo -e "${YELLOW}Waiting for infrastructure services...${NC}"
    sleep 10
else
    echo -e "${YELLOW}⚠️  Docker Compose not found. Please start services manually.${NC}"
fi

echo ""
echo "🚀 Starting Quantum-Enhanced AI Services..."
echo "==========================================="

# Start services with quantum enhancements
start_quantum_service "BG Identity AI" "bg-identity-ai" 3001 true
sleep 3

start_quantum_service "BG Threat AI" "bg-threat-ai" 3002 true
sleep 3

start_quantum_service "BG AI Dashboard" "bg-ai-dashboard" 3003 true
sleep 3

start_quantum_service "BG Mobile AI" "bg-mobile-ai" 3004 true
sleep 3

start_quantum_service "BG Quantum Gateway" "bg-quantum-gateway" 3005 true
sleep 3

echo ""
echo "⏳ Waiting for quantum services to initialize..."
sleep 15

echo ""
echo "🔍 Checking Quantum Service Health..."
echo "====================================="

# Check quantum-enhanced services
all_healthy=true

check_quantum_service "BG Identity AI" 3001 || all_healthy=false
check_quantum_service "BG Threat AI" 3002 || all_healthy=false
check_quantum_service "BG AI Dashboard" 3003 || all_healthy=false
check_quantum_service "BG Mobile AI" 3004 || all_healthy=false
check_quantum_service "BG Quantum Gateway" 3005 || all_healthy=false

# Test quantum operations
echo ""
echo "🧪 Testing Quantum Operations..."
echo "==============================="

if curl -s http://localhost:3005/api/quantum/benchmark > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Quantum cryptography operations functional${NC}"
    
    # Show quantum performance metrics
    quantum_metrics=$(curl -s http://localhost:3005/api/quantum/benchmark | jq -r '.results // empty')
    if [ -n "$quantum_metrics" ]; then
        echo -e "${CYAN}📊 Quantum Performance Metrics:${NC}"
        echo "$quantum_metrics" | jq '.'
    fi
else
    echo -e "${YELLOW}⚠️  Quantum operations test failed${NC}"
    all_healthy=false
fi

echo ""
if [ "$all_healthy" = true ]; then
    echo -e "${GREEN}🎉 All quantum-enhanced AI services are running successfully!${NC}"
    echo ""
    echo "📊 Quantum-Secure Service URLs:"
    echo "==============================="
    echo -e "${CYAN}• BG Identity AI:      http://localhost:3001 🔐${NC}"
    echo -e "${CYAN}• BG Threat AI:        http://localhost:3002 🛡️${NC}"
    echo -e "${CYAN}• BG AI Dashboard:     http://localhost:3003 📊${NC}"
    echo -e "${CYAN}• BG Mobile AI:        http://localhost:3004 📱${NC}"
    echo -e "${PURPLE}• BG Quantum Gateway:  http://localhost:3005 🔐${NC}"
    echo ""
    echo "🔐 Quantum Security Features:"
    echo "============================="
    echo -e "${PURPLE}• Post-Quantum Cryptography: Kyber768 + Dilithium3${NC}"
    echo -e "${PURPLE}• Hybrid Authentication: Classical + Quantum-safe tokens${NC}"
    echo -e "${PURPLE}• Biometric Encryption: Quantum-resistant templates${NC}"
    echo -e "${PURPLE}• Threat Detection: GPU-accelerated with Morpheus${NC}"
    echo ""
    echo "📋 Quantum Management Commands:"
    echo "==============================="
    echo -e "${YELLOW}• View quantum logs:     tail -f logs/*-quantum.log${NC}"
    echo -e "${YELLOW}• Stop quantum services: ./stop-quantum-services.sh${NC}"
    echo -e "${YELLOW}• Test quantum ops:      curl http://localhost:3005/api/quantum/benchmark${NC}"
    echo -e "${YELLOW}• Generate hybrid token: curl -X POST http://localhost:3005/api/quantum/token/generate${NC}"
    echo ""
    echo "🚀 Ready for quantum-secure AI development!"
else
    echo -e "${RED}❌ Some quantum services failed to start. Check the logs for details.${NC}"
    echo ""
    echo "📋 Quantum Troubleshooting:"
    echo "==========================="
    echo -e "${YELLOW}• Check quantum logs:    ls -la logs/*-quantum.log${NC}"
    echo -e "${YELLOW}• Test quantum deps:     ./scripts/test-quantum-install.sh${NC}"
    echo -e "${YELLOW}• Verify GPU support:    nvidia-smi${NC}"
    echo -e "${YELLOW}• Reset services:        ./stop-quantum-services.sh && ./start-quantum-services.sh${NC}"
    exit 1
fi