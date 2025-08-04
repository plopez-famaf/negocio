#!/bin/bash

# BehaviorGuard Identity Services Stop Script
# This script stops all identity services gracefully

set -e

echo "🛑 Stopping BehaviorGuard Identity Services..."
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Function to stop services gracefully
stop_services() {
    echo -e "${PURPLE}🛑 Stopping Identity Services...${NC}"
    
    if [ -f "docker-compose.identity.yml" ]; then
        echo -e "${BLUE}Using docker-compose to stop services...${NC}"
        docker-compose -f docker-compose.identity.yml down
        echo -e "${GREEN}✅ Services stopped via docker-compose${NC}"
    else
        echo -e "${YELLOW}⚠️  docker-compose.identity.yml not found, stopping containers manually...${NC}"
        
        # Stop containers manually
        containers=("bg-nginx" "bg-web" "bg-identity-ai" "bg-ai-dashboard" "bg-mobile-ai" "bg-redis" "bg-postgres" "bg-prometheus" "bg-grafana")
        
        for container in "${containers[@]}"; do
            if docker ps | grep -q "$container"; then
                echo -e "${BLUE}Stopping $container...${NC}"
                docker stop "$container" > /dev/null 2>&1
                echo -e "${GREEN}✅ $container stopped${NC}"
            else
                echo -e "${YELLOW}⚠️  $container not running${NC}"
            fi
        done
    fi
}

# Function to clean up containers
cleanup_containers() {
    echo -e "${BLUE}🧹 Cleaning up stopped containers...${NC}"
    
    stopped_containers=$(docker ps -a -q --filter "name=bg-" --filter "status=exited" 2>/dev/null || true)
    
    if [ -n "$stopped_containers" ]; then
        read -p "$(echo -e ${YELLOW}Remove stopped BehaviorGuard containers? [y/N]:${NC} )" -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "$stopped_containers" | xargs docker rm > /dev/null 2>&1
            echo -e "${GREEN}✅ Stopped containers removed${NC}"
        fi
    else
        echo -e "${GREEN}✅ No stopped containers to clean up${NC}"
    fi
}

# Function to clean up volumes
cleanup_volumes() {
    echo -e "${BLUE}🗄️  Checking Docker volumes...${NC}"
    
    unused_volumes=$(docker volume ls -q --filter "name=negocio_" 2>/dev/null || true)
    if [ -n "$unused_volumes" ]; then
        read -p "$(echo -e ${YELLOW}Remove BehaviorGuard Docker volumes? This will delete all data! [y/N]:${NC} )" -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "$unused_volumes" | xargs docker volume rm > /dev/null 2>&1
            echo -e "${GREEN}✅ Docker volumes removed${NC}"
        fi
    else
        echo -e "${GREEN}✅ No volumes to clean up${NC}"
    fi
}

# Function to clean up networks
cleanup_networks() {
    echo -e "${BLUE}🌐 Checking Docker networks...${NC}"
    
    if docker network ls | grep -q "bg-network"; then
        read -p "$(echo -e ${YELLOW}Remove bg-network? [y/N]:${NC} )" -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker network rm bg-network > /dev/null 2>&1
            echo -e "${GREEN}✅ bg-network removed${NC}"
        fi
    else
        echo -e "${GREEN}✅ No bg-network to clean up${NC}"
    fi
}

# Function to check ports
check_ports() {
    echo -e "${BLUE}🔌 Checking ports...${NC}"
    
    ports=(80 443 3000 3001 3002 3003 3010 5432 6379 9090)
    for port in "${ports[@]}"; do
        if lsof -i :$port > /dev/null 2>&1; then
            process=$(lsof -i :$port | tail -1 | awk '{print $1, $2}')
            echo -e "${YELLOW}   ⚠️  Port $port: $process${NC}"
        else
            echo -e "${GREEN}   ✅ Port $port: Available${NC}"
        fi
    done
}

# Function to show final status
show_final_status() {
    echo -e "${CYAN}📊 Final System Status:${NC}"
    
    # Check Docker containers
    echo -e "${CYAN}🐳 Docker Status:${NC}"
    bg_containers=$(docker ps -a --filter "name=bg-" --format "table {{.Names}}\t{{.Status}}" | tail -n +2)
    if [ -n "$bg_containers" ]; then
        echo "$bg_containers" | while read line; do
            if echo "$line" | grep -q "Up"; then
                echo -e "${YELLOW}   ⚠️  $line${NC}"
            else
                echo -e "${GREEN}   ✅ $line${NC}"
            fi
        done
    else
        echo -e "${GREEN}   ✅ No BehaviorGuard containers found${NC}"
    fi
    
    echo ""
    check_ports
}

# Function to clean up log files
cleanup_logs() {
    echo -e "${BLUE}📝 Cleaning up log files...${NC}"
    
    read -p "$(echo -e ${YELLOW}Delete log files? [y/N]:${NC} )" -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Clean up log directories but keep the structure
        find logs -name "*.log" -type f -delete 2>/dev/null || true
        find logs -name "*.log.*" -type f -delete 2>/dev/null || true
        
        echo -e "${GREEN}✅ Log files cleaned${NC}"
    fi
}

# Function to show shutdown summary
show_shutdown_summary() {
    echo -e "${GREEN}🎉 BehaviorGuard Identity Services Shutdown Complete!${NC}"
    echo ""
    echo "📊 Shutdown Summary:"
    echo "==================="
    echo -e "${GREEN}• Identity AI Service: Stopped${NC}"
    echo -e "${GREEN}• Web Application: Stopped${NC}" 
    echo -e "${GREEN}• AI Dashboard: Stopped${NC}"
    echo -e "${GREEN}• Mobile AI Service: Stopped${NC}"
    echo -e "${GREEN}• Database: Stopped${NC}"
    echo -e "${GREEN}• Redis Cache: Stopped${NC}"
    echo -e "${GREEN}• NGINX Proxy: Stopped${NC}"
    echo -e "${GREEN}• Monitoring: Stopped${NC}"
    echo ""
    echo "📋 Next Steps:"
    echo "=============="
    echo -e "${BLUE}• Start services:       ./start-identity-services.sh${NC}"
    echo -e "${BLUE}• Check Docker:         docker ps -a${NC}"
    echo -e "${BLUE}• View logs:            ls -la logs/*/>${NC}"
    echo -e "${BLUE}• Check ports:          lsof -i :3000-3003,80,443,5432,6379${NC}"
}

# Main execution
echo "🏁 Starting Identity Services Shutdown..."
echo ""

# Stop services in proper order
stop_services
echo ""

# Cleanup operations (optional)
cleanup_containers
echo ""

cleanup_volumes
echo ""

cleanup_networks
echo ""

cleanup_logs
echo ""

# Final status
show_final_status

echo ""

# Show summary
show_shutdown_summary