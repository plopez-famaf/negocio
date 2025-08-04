#!/bin/bash

# BehaviorGuard Identity Services Startup Script
# This script starts the identity-focused architecture

set -e

echo "🔐 Starting BehaviorGuard Identity Services..."
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to check if Docker is running
check_docker() {
    echo -e "${CYAN}🔍 Checking Docker status...${NC}"
    
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not running${NC}"
        echo -e "${YELLOW}Please start Docker and try again${NC}"
        exit 1
    else
        echo -e "${GREEN}✅ Docker is running${NC}"
    fi
}

# Function to create necessary directories
create_directories() {
    echo -e "${CYAN}📁 Creating required directories...${NC}"
    
    directories=(
        "logs/identity-ai"
        "logs/web" 
        "logs/ai-dashboard"
        "logs/mobile-ai"
        "logs/redis"
        "logs/postgres"
        "logs/nginx"
        "uploads"
        "ssl"
        "nginx/conf.d"
        "monitoring"
        "scripts"
    )
    
    for dir in "${directories[@]}"; do
        mkdir -p "$dir"
        echo -e "${GREEN}✅ Created: $dir${NC}"
    done
}

# Function to create basic NGINX configuration
create_nginx_config() {
    echo -e "${CYAN}⚙️  Creating NGINX configuration...${NC}"
    
    cat > nginx/nginx.conf << 'EOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 10240;
    gzip_proxied expired no-cache no-store private must-revalidate;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    include /etc/nginx/conf.d/*.conf;
}
EOF

    cat > nginx/conf.d/default.conf << 'EOF'
# Main web application
upstream bg_web {
    server bg-web:3000 max_fails=3 fail_timeout=30s;
}

# Identity AI service
upstream bg_identity_ai {
    server bg-identity-ai:3001 max_fails=3 fail_timeout=30s;
}

# AI Dashboard
upstream bg_ai_dashboard {
    server bg-ai-dashboard:3000 max_fails=3 fail_timeout=30s;
}

# Main web application
server {
    listen 80;
    server_name localhost;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=web:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=api:10m rate=5r/s;
    
    # Main application
    location / {
        limit_req zone=web burst=20 nodelay;
        proxy_pass http://bg_web;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    # Identity AI API
    location /api/identity/ {
        limit_req zone=api burst=10 nodelay;
        proxy_pass http://bg_identity_ai/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 30s;
        proxy_send_timeout 60s;  # Longer timeout for AI processing
        proxy_read_timeout 60s;
        client_max_body_size 10M;  # Allow larger file uploads
    }
    
    # AI Dashboard
    location /dashboard/ {
        proxy_pass http://bg_ai_dashboard/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

    echo -e "${GREEN}✅ NGINX configuration created${NC}"
}

# Function to create basic monitoring configuration
create_monitoring_config() {
    echo -e "${CYAN}📊 Creating monitoring configuration...${NC}"
    
    cat > monitoring/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  # - "first_rules.yml"
  # - "second_rules.yml"

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'bg-identity-ai'
    static_configs:
      - targets: ['bg-identity-ai:3001']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'bg-web'
    static_configs:
      - targets: ['bg-web:3000']
    metrics_path: '/api/metrics'
    scrape_interval: 30s

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
    scrape_interval: 30s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres:5432']
    scrape_interval: 30s
EOF

    echo -e "${GREEN}✅ Monitoring configuration created${NC}"
}

# Function to create database initialization script
create_db_init() {
    echo -e "${CYAN}🗄️  Creating database initialization script...${NC}"
    
    cat > scripts/init-db.sql << 'EOF'
-- BehaviorGuard Identity Database Initialization

-- Create database if not exists
SELECT 'CREATE DATABASE behaviorguard'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'behaviorguard');

-- Connect to behaviorguard database
\c behaviorguard;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create biometric_templates table
CREATE TABLE IF NOT EXISTS biometric_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_type VARCHAR(50) NOT NULL, -- 'face', 'fingerprint', 'voice'
    template_data BYTEA NOT NULL,
    quality_score DECIMAL(3,2) NOT NULL,
    metadata JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create verification_attempts table
CREATE TABLE IF NOT EXISTS verification_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    verification_type VARCHAR(50) NOT NULL,
    success BOOLEAN NOT NULL,
    confidence_score DECIMAL(3,2),
    processing_time INTEGER, -- in milliseconds
    risk_score DECIMAL(3,2),
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_biometric_templates_user_id ON biometric_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_biometric_templates_type ON biometric_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_verification_attempts_user_id ON verification_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_attempts_created_at ON verification_attempts(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_biometric_templates_updated_at BEFORE UPDATE ON biometric_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
EOF

    echo -e "${GREEN}✅ Database initialization script created${NC}"
}

# Function to create environment file template
create_env_template() {
    echo -e "${CYAN}📝 Creating environment template...${NC}"
    
    if [ ! -f ".env" ]; then
        cat > .env << 'EOF'
# BehaviorGuard Identity Services Environment Configuration

# Database Configuration
DATABASE_URL=postgresql://bguser:bgpassword@postgres:5432/behaviorguard
POSTGRES_DB=behaviorguard
POSTGRES_USER=bguser
POSTGRES_PASSWORD=bgpassword

# Supabase Configuration (if using Supabase instead of local DB)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Authentication
JWT_SECRET=your-secure-jwt-secret-key-min-32-chars
NEXTAUTH_SECRET=your-secure-nextauth-secret-key
NEXTAUTH_URL=http://localhost:3000

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Mobile API
MOBILE_API_KEY=your-mobile-api-key

# Grafana
GRAFANA_PASSWORD=admin
EOF
        echo -e "${GREEN}✅ Environment template created at .env${NC}"
        echo -e "${YELLOW}⚠️  Please update the .env file with your actual values${NC}"
    else
        echo -e "${YELLOW}⚠️  .env file already exists, skipping creation${NC}"
    fi
}

# Function to start services
start_services() {
    echo -e "${PURPLE}🚀 Starting BehaviorGuard Identity Services...${NC}"
    
    # Create Docker network if it doesn't exist
    if ! docker network ls | grep -q bg-network; then
        echo -e "${CYAN}Creating Docker network...${NC}"
        docker network create bg-network
        echo -e "${GREEN}✅ Docker network created${NC}"
    fi
    
    # Pull latest images
    echo -e "${CYAN}📥 Pulling latest Docker images...${NC}"
    docker-compose -f docker-compose.identity.yml pull
    
    # Start services
    echo -e "${CYAN}🔄 Starting services...${NC}"
    docker-compose -f docker-compose.identity.yml up -d
    
    echo -e "${GREEN}✅ Services started successfully${NC}"
}

# Function to verify services are running
verify_services() {
    echo -e "${CYAN}🔍 Verifying services...${NC}"
    
    services=(
        "bg-redis:6379"
        "bg-postgres:5432"
        "bg-identity-ai:3001"
        "bg-web:3000"
        "bg-ai-dashboard:3000"
        "bg-nginx:80"
    )
    
    sleep 10  # Give services time to start
    
    for service in "${services[@]}"; do
        container_name=$(echo $service | cut -d':' -f1)
        port=$(echo $service | cut -d':' -f2)
        
        if docker ps | grep -q $container_name; then
            echo -e "${GREEN}✅ $container_name is running${NC}"
        else
            echo -e "${RED}❌ $container_name failed to start${NC}"
        fi
    done
}

# Function to show service URLs
show_service_urls() {
    echo -e "${CYAN}🌐 Service URLs:${NC}"
    echo "=============================="
    echo -e "${PURPLE}• Main Application:     http://localhost${NC}"
    echo -e "${PURPLE}• Identity AI API:      http://localhost/api/identity${NC}"
    echo -e "${PURPLE}• AI Dashboard:         http://localhost/dashboard${NC}"
    echo -e "${PURPLE}• Direct Identity API:  http://localhost:3001${NC}"
    echo -e "${PURPLE}• Direct Web App:       http://localhost:3000${NC}"
    echo -e "${PURPLE}• Direct AI Dashboard:  http://localhost:3002${NC}"
    echo -e "${PURPLE}• Mobile AI Service:    http://localhost:3003${NC}"
    echo -e "${PURPLE}• Grafana Monitoring:   http://localhost:3010${NC}"
    echo -e "${PURPLE}• Prometheus Metrics:   http://localhost:9090${NC}"
    echo ""
    echo -e "${CYAN}📊 Management Commands:${NC}"
    echo "=============================="
    echo -e "${YELLOW}• View logs:            docker-compose -f docker-compose.identity.yml logs -f [service]${NC}"
    echo -e "${YELLOW}• Stop services:        ./stop-identity-services.sh${NC}"
    echo -e "${YELLOW}• Restart service:      docker-compose -f docker-compose.identity.yml restart [service]${NC}"
    echo -e "${YELLOW}• View status:          docker-compose -f docker-compose.identity.yml ps${NC}"
}

# Main execution
echo "🏁 Starting Identity Services Setup..."
echo ""

# Run setup steps
check_docker
create_directories
create_nginx_config
create_monitoring_config
create_db_init
create_env_template

echo ""

# Start services
start_services

echo ""

# Verify and show results
verify_services

echo ""

show_service_urls

echo ""
echo -e "${GREEN}🎉 BehaviorGuard Identity Services Started Successfully!${NC}"
echo ""
echo -e "${BLUE}📝 Next Steps:${NC}"
echo "=============="
echo -e "${YELLOW}1. Update the .env file with your actual configuration values${NC}"
echo -e "${YELLOW}2. Access the main application at http://localhost${NC}"
echo -e "${YELLOW}3. Check service health at http://localhost/health${NC}"
echo -e "${YELLOW}4. Monitor services with Grafana at http://localhost:3010${NC}"
echo ""
echo -e "${GREEN}🔐 Your identity-focused BehaviorGuard platform is ready!${NC}"