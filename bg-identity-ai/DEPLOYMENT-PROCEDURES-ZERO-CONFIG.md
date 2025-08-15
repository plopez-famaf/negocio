# Phase 2B Enhanced API Capabilities - Zero-Config Deployment Procedures

## Executive Summary

Phase 2B introduces zero-configuration deployment for the BG Threat AI platform, revolutionizing enterprise cybersecurity deployment by eliminating setup complexity. This document provides comprehensive procedures for local development, testing, and production deployment with complete automation.

## Table of Contents

1. [Zero-Config Philosophy](#zero-config-philosophy)
2. [Local Development Setup](#local-development-setup)
3. [Testing Procedures](#testing-procedures)
4. [Cloud Deployment](#cloud-deployment)
5. [ThreatGuard Agent Zero-Config Deployment](#threatguard-agent-zero-config-deployment)
6. [Monitoring and Validation](#monitoring-and-validation)
7. [Troubleshooting](#troubleshooting)

## Zero-Config Philosophy

### Design Principles

**Complete Automation**: Every component self-configures and self-optimizes without human intervention.

**Intelligent Discovery**: Systems automatically detect their environment and configure appropriately.

**Zero Administrative Overhead**: No configuration files, no manual setup, no specialized knowledge required.

**Instant Value**: Full functionality available within 60 seconds of installation.

### Deployment Hierarchy

```yaml
deployment_levels:
  level_1_installation:
    # Single command deployment
    - Download and install package
    - No parameters or configuration files
    - Automatic service registration
    
  level_2_discovery:
    # Automatic environment detection
    - System profiling and characterization
    - Security tool discovery and integration
    - Network and compliance detection
    
  level_3_optimization:
    # Intelligent configuration generation
    - Performance tuning based on capabilities
    - Security policy application
    - Integration with existing infrastructure
    
  level_4_operation:
    # Continuous self-optimization
    - Real-time performance monitoring
    - Predictive scaling and adjustment
    - Automatic issue resolution
```

## Local Development Setup

### Prerequisites

#### Required Software (Auto-Detected)
- Node.js 18+ (automatically downloaded if missing)
- Docker and Docker Compose (automatically configured)
- Git (for version control)

#### Auto-Configuration Script

```bash
#!/bin/bash
# setup-dev-environment.sh - Zero-config development setup

echo "🚀 Setting up BG Threat AI development environment..."
echo "⚡ Zero-config setup - no user input required"

# Auto-detect operating system
OS=$(uname -s)
echo "📟 Detected OS: $OS"

# Install dependencies automatically
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js already installed: $NODE_VERSION"
else
    echo "📦 Installing Node.js automatically..."
    if [[ "$OS" == "Darwin" ]]; then
        # macOS - install via Homebrew
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        brew install node
    elif [[ "$OS" == "Linux" ]]; then
        # Linux - install via NodeSource
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
fi

# Auto-configure Docker
if command -v docker >/dev/null 2>&1; then
    echo "✅ Docker already installed"
else
    echo "🐳 Installing Docker automatically..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

# Auto-detect project structure and configure
if [[ -f "package.json" ]]; then
    echo "📋 Auto-installing dependencies..."
    npm install
else
    echo "❌ Not in a Node.js project directory"
    exit 1
fi

# Auto-generate environment configuration
echo "⚙️ Generating development configuration..."
cat > .env.development.local << EOF
# Auto-generated development configuration
# No manual editing required

# Service URLs (auto-detected)
NEXT_PUBLIC_API_URL=http://localhost:3002
THREATGUARD_SERVICE_URL=http://localhost:3002
WEBSOCKET_URL=ws://localhost:3002

# Development API Keys (auto-generated)
TEST_API_KEY=dev_$(openssl rand -hex 16)
JWT_SECRET=dev_$(openssl rand -hex 32)

# Redis Configuration (auto-configured)
REDIS_URL=redis://localhost:6379

# Database Configuration (auto-configured)
DATABASE_URL=postgresql://postgres:password@localhost:5432/bg_threat_ai_dev

# Auto-detection timestamp
GENERATED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF

echo "✅ Environment configuration generated"

# Auto-start development services
echo "🔄 Starting development services..."
docker-compose -f docker-compose.development.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to initialize..."
sleep 10

# Auto-validate setup
echo "🔍 Validating setup..."
if curl -f http://localhost:3002/health > /dev/null 2>&1; then
    echo "✅ bg-threat-ai service is running"
else
    echo "⚠️ bg-threat-ai service not responding"
fi

if curl -f http://localhost:6379 > /dev/null 2>&1; then
    echo "✅ Redis is running"
else
    echo "⚠️ Redis not responding"
fi

echo ""
echo "🎉 Development environment setup complete!"
echo ""
echo "📋 Available services:"
echo "   • bg-threat-ai API: http://localhost:3002"
echo "   • Health check: http://localhost:3002/health"
echo "   • WebSocket endpoint: ws://localhost:3002"
echo "   • Redis: localhost:6379"
echo ""
echo "🚀 Ready to start development:"
echo "   npm run dev        # Start development server"
echo "   npm test          # Run test suite"
echo "   npm run build     # Create production build"
echo ""
```

### One-Command Development Setup

```bash
# Complete development environment in one command
curl -fsSL https://setup.bg-threat.ai/dev | bash

# Alternative: Clone and auto-setup
git clone https://github.com/bg-threat-ai/bg-identity-ai.git
cd bg-identity-ai
./setup-dev-environment.sh
```

### Auto-Generated Development Configuration

The setup script automatically creates optimized configuration files:

```yaml
# Auto-generated docker-compose.development.yml
version: '3.8'
services:
  bg-threat-ai:
    build: 
      context: .
      target: development
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=development
      - REDIS_URL=redis://redis:6379
      - LOG_LEVEL=debug
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      - redis
      - postgres
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=bg_threat_ai_dev
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  redis_data:
  postgres_data:
```

## Testing Procedures

### Zero-Config Test Execution

#### Automated Test Discovery and Execution

```bash
#!/bin/bash
# run-all-tests.sh - Zero-config comprehensive testing

echo "🧪 Starting comprehensive test suite..."
echo "⚡ Auto-detecting test types and configurations"

# Auto-detect available test types
AVAILABLE_TESTS=()

if [[ -d "src/__tests__/unit" ]]; then
    AVAILABLE_TESTS+=("unit")
    echo "✅ Unit tests detected"
fi

if [[ -d "src/__tests__/integration" ]]; then
    AVAILABLE_TESTS+=("integration")
    echo "✅ Integration tests detected"
fi

if [[ -d "src/__tests__/e2e" ]]; then
    AVAILABLE_TESTS+=("e2e")
    echo "✅ E2E tests detected"
fi

if [[ -f "scripts/performance-benchmark.js" ]]; then
    AVAILABLE_TESTS+=("performance")
    echo "✅ Performance benchmarks detected"
fi

# Auto-start test environment
echo "🔄 Starting test environment..."
docker-compose -f docker-compose.test.yml up -d
sleep 5

# Execute all detected test types
for test_type in "${AVAILABLE_TESTS[@]}"; do
    echo ""
    echo "🏃 Running $test_type tests..."
    
    case $test_type in
        "unit")
            npm run test:unit
            ;;
        "integration")
            npm run test:integration
            ;;
        "e2e")
            npm run test:e2e
            ;;
        "performance")
            node scripts/performance-benchmark.js
            ;;
    esac
    
    if [[ $? -eq 0 ]]; then
        echo "✅ $test_type tests passed"
    else
        echo "❌ $test_type tests failed"
        FAILED_TESTS+=("$test_type")
    fi
done

# Auto-generate test report
echo ""
echo "📊 Generating comprehensive test report..."
node scripts/test-integration.js

# Cleanup test environment
echo "🧹 Cleaning up test environment..."
docker-compose -f docker-compose.test.yml down

# Summary
echo ""
echo "📋 Test Execution Summary:"
echo "   Total test types: ${#AVAILABLE_TESTS[@]}"
echo "   Passed: $((${#AVAILABLE_TESTS[@]} - ${#FAILED_TESTS[@]}))"
echo "   Failed: ${#FAILED_TESTS[@]}"

if [[ ${#FAILED_TESTS[@]} -eq 0 ]]; then
    echo "🎉 All tests passed! Ready for deployment."
    exit 0
else
    echo "⚠️ Some tests failed. Review test results before deployment."
    exit 1
fi
```

#### Test Configuration Auto-Generation

```typescript
// auto-generated vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

// Auto-detect test environment
const isCI = process.env.CI === 'true';
const testTimeout = isCI ? 30000 : 10000;

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.d.ts',
        'scripts/',
        'docs/'
      ],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90
      }
    },
    testTimeout,
    hookTimeout: testTimeout,
    maxConcurrency: isCI ? 1 : 4,
    pool: 'threads'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

### Automated Test Validation

```bash
# One-command test execution with automatic validation
curl -fsSL https://test.bg-threat.ai/validate | bash

# Alternative: Local test execution
./run-all-tests.sh
```

## Cloud Deployment

### Zero-Config Production Deployment

#### AWS Deployment (Fully Automated)

```bash
#!/bin/bash
# deploy-aws.sh - Zero-config AWS deployment

echo "☁️ Deploying to AWS with zero configuration..."

# Auto-detect AWS environment
if command -v aws >/dev/null 2>&1; then
    echo "✅ AWS CLI detected"
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    REGION=$(aws configure get region || echo "us-east-1")
    echo "📍 Deploying to account $ACCOUNT_ID in region $REGION"
else
    echo "❌ AWS CLI not found. Installing automatically..."
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip awscliv2.zip
    sudo ./aws/install
    rm -rf aws awscliv2.zip
fi

# Auto-generate CloudFormation template
cat > cloudformation-template.yaml << 'EOF'
AWSTemplateFormatVersion: '2010-09-09'
Description: 'BG Threat AI - Zero-Config Production Deployment'

Parameters:
  Environment:
    Type: String
    Default: production
    AllowedValues: [production, staging]

Resources:
  # Auto-configured VPC
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: !Sub ${Environment}-bg-threat-ai-vpc

  # Auto-configured ECS Cluster
  ECSCluster:
    Type: AWS::ECS::Cluster
    Properties:
      ClusterName: !Sub ${Environment}-bg-threat-ai
      CapacityProviders:
        - FARGATE
        - FARGATE_SPOT
      DefaultCapacityProviderStrategy:
        - CapacityProvider: FARGATE
          Weight: 1

  # Auto-configured Application Load Balancer
  ALB:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Name: !Sub ${Environment}-bg-threat-ai-alb
      Scheme: internet-facing
      Type: application
      SecurityGroups:
        - !Ref ALBSecurityGroup
      Subnets:
        - !Ref PublicSubnet1
        - !Ref PublicSubnet2

  # Auto-configured Redis Cluster
  RedisCluster:
    Type: AWS::ElastiCache::ReplicationGroup
    Properties:
      ReplicationGroupId: !Sub ${Environment}-bg-threat-ai-redis
      Description: Redis cluster for BG Threat AI
      NodeType: cache.t3.micro
      NumCacheClusters: 2
      Engine: redis
      EngineVersion: 7.0

  # Auto-configured RDS Instance
  Database:
    Type: AWS::RDS::DBInstance
    Properties:
      DBInstanceIdentifier: !Sub ${Environment}-bg-threat-ai-db
      DBInstanceClass: db.t3.micro
      Engine: postgres
      EngineVersion: '15.4'
      AllocatedStorage: 20
      StorageType: gp2
      DatabaseName: bg_threat_ai
      MasterUsername: postgres
      MasterUserPassword: !Ref DatabasePassword
      VPCSecurityGroups:
        - !Ref DatabaseSecurityGroup

  # Auto-configured ECS Service
  ECSService:
    Type: AWS::ECS::Service
    Properties:
      ServiceName: !Sub ${Environment}-bg-threat-ai-service
      Cluster: !Ref ECSCluster
      TaskDefinition: !Ref TaskDefinition
      DesiredCount: 2
      LaunchType: FARGATE
      NetworkConfiguration:
        AwsvpcConfiguration:
          AssignPublicIp: ENABLED
          SecurityGroups:
            - !Ref ServiceSecurityGroup
          Subnets:
            - !Ref PrivateSubnet1
            - !Ref PrivateSubnet2

Outputs:
  ServiceURL:
    Description: URL of the deployed service
    Value: !Sub 'https://${ALB.DNSName}'
    Export:
      Name: !Sub ${Environment}-bg-threat-ai-url
EOF

# Auto-deploy with CloudFormation
echo "🚀 Deploying infrastructure..."
aws cloudformation deploy \
    --template-file cloudformation-template.yaml \
    --stack-name bg-threat-ai-production \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides Environment=production

if [[ $? -eq 0 ]]; then
    echo "✅ Infrastructure deployment successful"
    
    # Get service URL
    SERVICE_URL=$(aws cloudformation describe-stacks \
        --stack-name bg-threat-ai-production \
        --query 'Stacks[0].Outputs[?OutputKey==`ServiceURL`].OutputValue' \
        --output text)
    
    echo "🌐 Service deployed at: $SERVICE_URL"
    echo "🔍 Health check: $SERVICE_URL/health"
    
    # Auto-validate deployment
    echo "⏳ Waiting for service to be ready..."
    sleep 30
    
    if curl -f "$SERVICE_URL/health" > /dev/null 2>&1; then
        echo "✅ Service is healthy and ready"
    else
        echo "⚠️ Service not responding - check CloudWatch logs"
    fi
else
    echo "❌ Infrastructure deployment failed"
    exit 1
fi
```

#### Azure Deployment (Fully Automated)

```bash
#!/bin/bash
# deploy-azure.sh - Zero-config Azure deployment

echo "☁️ Deploying to Azure with zero configuration..."

# Auto-install Azure CLI if needed
if ! command -v az >/dev/null 2>&1; then
    echo "📦 Installing Azure CLI..."
    curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
fi

# Auto-login and setup
echo "🔐 Setting up Azure environment..."
az login --use-device-code
SUBSCRIPTION_ID=$(az account show --query id --output tsv)
echo "📋 Using subscription: $SUBSCRIPTION_ID"

# Auto-generate Bicep template
cat > main.bicep << 'EOF'
@description('Environment name (production, staging)')
param environment string = 'production'

@description('Location for all resources')
param location string = resourceGroup().location

// Auto-configured Container Registry
resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' = {
  name: '${environment}bgthreatai'
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
  }
}

// Auto-configured Container Apps Environment
resource containerAppEnvironment 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: '${environment}-bg-threat-ai-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsWorkspace.properties.customerId
        sharedKey: logAnalyticsWorkspace.listKeys().primarySharedKey
      }
    }
  }
}

// Auto-configured Log Analytics
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${environment}-bg-threat-ai-logs'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// Auto-configured Redis Cache
resource redisCache 'Microsoft.Cache/redis@2023-04-01' = {
  name: '${environment}-bg-threat-ai-redis'
  location: location
  properties: {
    sku: {
      name: 'Basic'
      family: 'C'
      capacity: 0
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
  }
}

// Auto-configured PostgreSQL Database
resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2022-12-01' = {
  name: '${environment}-bg-threat-ai-db'
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: 'postgres'
    administratorLoginPassword: 'SecurePassword123!'
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    version: '15'
  }
}

// Auto-configured Container App
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: '${environment}-bg-threat-ai'
  location: location
  properties: {
    managedEnvironmentId: containerAppEnvironment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3002
        allowInsecure: false
      }
      registries: [
        {
          server: containerRegistry.properties.loginServer
          username: containerRegistry.properties.adminUserEnabled ? containerRegistry.name : null
          passwordSecretRef: 'registry-password'
        }
      ]
      secrets: [
        {
          name: 'registry-password'
          value: containerRegistry.listCredentials().passwords[0].value
        }
        {
          name: 'redis-connection'
          value: redisCache.properties.hostName
        }
        {
          name: 'database-url'
          value: 'postgresql://postgres:SecurePassword123!@${postgresServer.properties.fullyQualifiedDomainName}:5432/postgres'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'bg-threat-ai'
          image: '${containerRegistry.properties.loginServer}/bg-threat-ai:latest'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'REDIS_URL'
              secretRef: 'redis-connection'
            }
            {
              name: 'DATABASE_URL'
              secretRef: 'database-url'
            }
            {
              name: 'PORT'
              value: '3002'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
      }
    }
  }
}

output serviceUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output containerRegistryLoginServer string = containerRegistry.properties.loginServer
EOF

# Auto-deploy with Bicep
echo "🚀 Deploying infrastructure..."
az group create --name bg-threat-ai-production --location eastus
az deployment group create \
    --resource-group bg-threat-ai-production \
    --template-file main.bicep \
    --parameters environment=production

if [[ $? -eq 0 ]]; then
    echo "✅ Infrastructure deployment successful"
    
    # Get service URL
    SERVICE_URL=$(az deployment group show \
        --resource-group bg-threat-ai-production \
        --name main \
        --query properties.outputs.serviceUrl.value \
        --output tsv)
    
    echo "🌐 Service deployed at: $SERVICE_URL"
    echo "🔍 Health check: $SERVICE_URL/health"
else
    echo "❌ Infrastructure deployment failed"
    exit 1
fi
```

## ThreatGuard Agent Zero-Config Deployment

### Enterprise Mass Deployment

#### Windows Group Policy Deployment

```powershell
# Deploy-ThreatGuardAgent.ps1 - Zero-config enterprise deployment

Write-Host "🏢 Starting enterprise ThreatGuard Agent deployment..." -ForegroundColor Cyan
Write-Host "⚡ Zero-configuration deployment - no user input required" -ForegroundColor Green

# Auto-detect domain environment
$Domain = (Get-WmiObject -Class Win32_ComputerSystem).Domain
Write-Host "🌐 Detected domain: $Domain" -ForegroundColor Yellow

# Auto-download latest agent
$DownloadUrl = "https://releases.bg-threat.ai/latest/ThreatGuardAgent.msi"
$LocalPath = "$env:TEMP\ThreatGuardAgent.msi"

Write-Host "📦 Downloading ThreatGuard Agent..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $DownloadUrl -OutFile $LocalPath

# Verify digital signature
$Signature = Get-AuthenticodeSignature -FilePath $LocalPath
if ($Signature.Status -eq "Valid") {
    Write-Host "✅ Digital signature verified" -ForegroundColor Green
} else {
    Write-Host "❌ Invalid digital signature" -ForegroundColor Red
    exit 1
}

# Zero-config silent installation
Write-Host "🔄 Installing ThreatGuard Agent..." -ForegroundColor Yellow
$InstallArgs = @(
    "/i"
    "$LocalPath"
    "/quiet"
    "/norestart"
    "/l*v"
    "$env:TEMP\ThreatGuardAgent-Install.log"
)

$Process = Start-Process -FilePath "msiexec.exe" -ArgumentList $InstallArgs -Wait -PassThru

if ($Process.ExitCode -eq 0) {
    Write-Host "✅ Installation completed successfully" -ForegroundColor Green
    
    # Wait for auto-configuration
    Write-Host "⏳ Waiting for auto-configuration..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
    
    # Verify agent status
    $Service = Get-Service -Name "ThreatGuardAgent" -ErrorAction SilentlyContinue
    if ($Service.Status -eq "Running") {
        Write-Host "✅ ThreatGuard Agent is running" -ForegroundColor Green
        
        # Check agent registration
        $AgentStatus = Invoke-RestMethod -Uri "http://localhost:8888/status" -ErrorAction SilentlyContinue
        if ($AgentStatus.registered) {
            Write-Host "✅ Agent registered and configured automatically" -ForegroundColor Green
            Write-Host "📊 Organization: $($AgentStatus.organization)" -ForegroundColor Cyan
            Write-Host "🔧 Profile: $($AgentStatus.profile)" -ForegroundColor Cyan
            Write-Host "📈 Collection rate: $($AgentStatus.eventsPerSecond) events/second" -ForegroundColor Cyan
        } else {
            Write-Host "⚠️ Agent installed but not yet registered" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ ThreatGuard Agent service not running" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Installation failed with exit code: $($Process.ExitCode)" -ForegroundColor Red
    exit 1
}

# Cleanup
Remove-Item -Path $LocalPath -Force

Write-Host "🎉 ThreatGuard Agent deployment completed!" -ForegroundColor Green
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "   • Agent will appear in dashboard within 5 minutes" -ForegroundColor White
Write-Host "   • No further configuration required" -ForegroundColor White
Write-Host "   • Monitoring starts automatically" -ForegroundColor White
```

#### Linux Ansible Deployment

```yaml
# threatguard-agent-deployment.yml - Zero-config Ansible playbook

---
- name: Deploy ThreatGuard Agent (Zero-Config)
  hosts: all
  become: yes
  vars:
    agent_version: "latest"
    download_url: "https://releases.bg-threat.ai/{{ agent_version }}"
    
  tasks:
    - name: Detect operating system
      debug:
        msg: "Detected OS: {{ ansible_distribution }} {{ ansible_distribution_version }}"
    
    - name: Download ThreatGuard Agent (Debian/Ubuntu)
      get_url:
        url: "{{ download_url }}/threatguard-agent_{{ agent_version }}_amd64.deb"
        dest: "/tmp/threatguard-agent.deb"
        mode: '0644'
      when: ansible_os_family == "Debian"
    
    - name: Download ThreatGuard Agent (RHEL/CentOS)
      get_url:
        url: "{{ download_url }}/threatguard-agent-{{ agent_version }}-1.x86_64.rpm"
        dest: "/tmp/threatguard-agent.rpm"
        mode: '0644'
      when: ansible_os_family == "RedHat"
    
    - name: Install ThreatGuard Agent (Debian/Ubuntu)
      apt:
        deb: "/tmp/threatguard-agent.deb"
        state: present
      when: ansible_os_family == "Debian"
      notify: restart threatguard
    
    - name: Install ThreatGuard Agent (RHEL/CentOS)
      yum:
        name: "/tmp/threatguard-agent.rpm"
        state: present
      when: ansible_os_family == "RedHat"
      notify: restart threatguard
    
    - name: Wait for auto-configuration
      pause:
        seconds: 30
        prompt: "Waiting for ThreatGuard Agent auto-configuration..."
    
    - name: Verify agent status
      uri:
        url: "http://localhost:8888/status"
        method: GET
      register: agent_status
      failed_when: false
    
    - name: Display agent information
      debug:
        msg: |
          ThreatGuard Agent Status:
          - Service: {{ 'Running' if agent_status.status == 200 else 'Not responding' }}
          - Organization: {{ agent_status.json.organization | default('Auto-detecting...') }}
          - Profile: {{ agent_status.json.profile | default('Auto-configuring...') }}
          - Collection Rate: {{ agent_status.json.eventsPerSecond | default(0) }} events/second
      when: agent_status.status == 200
    
    - name: Cleanup installation files
      file:
        path: "{{ item }}"
        state: absent
      with_items:
        - "/tmp/threatguard-agent.deb"
        - "/tmp/threatguard-agent.rpm"
  
  handlers:
    - name: restart threatguard
      service:
        name: threatguard-agent
        state: restarted
        enabled: yes
```

#### macOS Jamf Pro Deployment

```bash
#!/bin/bash
# deploy-threatguard-macos.sh - Zero-config macOS deployment

echo "🍎 Deploying ThreatGuard Agent on macOS..."
echo "⚡ Zero-configuration deployment"

# Auto-detect macOS version
OS_VERSION=$(sw_vers -productVersion)
echo "📱 Detected macOS: $OS_VERSION"

# Auto-download appropriate package
DOWNLOAD_URL="https://releases.bg-threat.ai/latest/ThreatGuardAgent-macOS.pkg"
LOCAL_PATH="/tmp/ThreatGuardAgent.pkg"

echo "📦 Downloading ThreatGuard Agent..."
curl -L "$DOWNLOAD_URL" -o "$LOCAL_PATH"

# Verify package signature
echo "🔍 Verifying package signature..."
if pkgutil --check-signature "$LOCAL_PATH"; then
    echo "✅ Package signature verified"
else
    echo "❌ Invalid package signature"
    exit 1
fi

# Zero-config installation
echo "🔄 Installing ThreatGuard Agent..."
installer -pkg "$LOCAL_PATH" -target /

if [[ $? -eq 0 ]]; then
    echo "✅ Installation completed successfully"
    
    # Wait for auto-configuration
    echo "⏳ Waiting for auto-configuration..."
    sleep 30
    
    # Verify service status
    if launchctl list | grep -q "com.bg-threat.threatguard-agent"; then
        echo "✅ ThreatGuard Agent service is running"
        
        # Check agent registration
        if curl -f http://localhost:8888/status > /dev/null 2>&1; then
            AGENT_INFO=$(curl -s http://localhost:8888/status)
            echo "✅ Agent registered and configured automatically"
            echo "📊 Agent information:"
            echo "$AGENT_INFO" | python3 -m json.tool
        else
            echo "⚠️ Agent installed but not yet responding"
        fi
    else
        echo "❌ ThreatGuard Agent service not running"
    fi
else
    echo "❌ Installation failed"
    exit 1
fi

# Cleanup
rm -f "$LOCAL_PATH"

echo "🎉 ThreatGuard Agent deployment completed!"
echo "📋 The agent will appear in your dashboard within 5 minutes"
echo "🔧 No further configuration required"
```

## Monitoring and Validation

### Auto-Validation Scripts

#### Health Check Automation

```bash
#!/bin/bash
# validate-deployment.sh - Comprehensive deployment validation

echo "🔍 Validating BG Threat AI deployment..."
echo "⚡ Automatic validation - no configuration required"

# Service endpoints to validate
SERVICES=(
    "bg-threat-ai:http://localhost:3002/health"
    "redis:redis://localhost:6379"
    "postgres:postgresql://postgres:password@localhost:5432/bg_threat_ai_dev"
)

# API endpoints to test
API_ENDPOINTS=(
    "GET:/health"
    "GET:/api/analytics/dashboard-metrics"
    "GET:/api/ml/model-status"
    "GET:/api/integrations/webhooks"
)

# Performance benchmarks
PERFORMANCE_THRESHOLDS=(
    "api_response_time:1000"
    "websocket_latency:100"
    "memory_usage:512"
    "cpu_usage:50"
)

echo ""
echo "🔧 Service Health Validation"
echo "================================"

ALL_SERVICES_HEALTHY=true

for service in "${SERVICES[@]}"; do
    service_name="${service%%:*}"
    service_url="${service#*:}"
    
    echo "Checking $service_name..."
    
    case $service_name in
        "bg-threat-ai")
            if curl -f "$service_url" > /dev/null 2>&1; then
                echo "✅ $service_name is healthy"
            else
                echo "❌ $service_name is not responding"
                ALL_SERVICES_HEALTHY=false
            fi
            ;;
        "redis")
            if command -v redis-cli >/dev/null 2>&1; then
                if redis-cli ping | grep -q "PONG"; then
                    echo "✅ $service_name is healthy"
                else
                    echo "❌ $service_name is not responding"
                    ALL_SERVICES_HEALTHY=false
                fi
            else
                echo "⚠️ Cannot test $service_name - redis-cli not installed"
            fi
            ;;
        "postgres")
            if command -v psql >/dev/null 2>&1; then
                if psql "$service_url" -c '\l' > /dev/null 2>&1; then
                    echo "✅ $service_name is healthy"
                else
                    echo "❌ $service_name is not responding"
                    ALL_SERVICES_HEALTHY=false
                fi
            else
                echo "⚠️ Cannot test $service_name - psql not installed"
            fi
            ;;
    esac
done

echo ""
echo "🔌 API Endpoint Validation"
echo "=========================="

ALL_APIS_HEALTHY=true

for endpoint in "${API_ENDPOINTS[@]}"; do
    method="${endpoint%%:*}"
    path="${endpoint#*:}"
    url="http://localhost:3002$path"
    
    echo "Testing $method $path..."
    
    case $method in
        "GET")
            response_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
            if [[ $response_code == "200" ]]; then
                echo "✅ $path responded with 200"
            else
                echo "❌ $path responded with $response_code"
                ALL_APIS_HEALTHY=false
            fi
            ;;
        "POST")
            response_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{}' "$url")
            if [[ $response_code == "200" || $response_code == "201" ]]; then
                echo "✅ $path responded with $response_code"
            else
                echo "❌ $path responded with $response_code"
                ALL_APIS_HEALTHY=false
            fi
            ;;
    esac
done

echo ""
echo "⚡ Performance Validation"
echo "========================"

ALL_PERFORMANCE_OK=true

# Test API response time
echo "Testing API response time..."
start_time=$(date +%s%3N)
curl -s "http://localhost:3002/health" > /dev/null
end_time=$(date +%s%3N)
response_time=$((end_time - start_time))

if [[ $response_time -lt 1000 ]]; then
    echo "✅ API response time: ${response_time}ms (< 1000ms)"
else
    echo "❌ API response time: ${response_time}ms (>= 1000ms)"
    ALL_PERFORMANCE_OK=false
fi

# Test WebSocket connection
echo "Testing WebSocket connection..."
if command -v wscat >/dev/null 2>&1; then
    ws_start=$(date +%s%3N)
    timeout 5 wscat -c ws://localhost:3002 -x 'ping' > /dev/null 2>&1
    ws_end=$(date +%s%3N)
    ws_latency=$((ws_end - ws_start))
    
    if [[ $ws_latency -lt 100 ]]; then
        echo "✅ WebSocket latency: ${ws_latency}ms (< 100ms)"
    else
        echo "❌ WebSocket latency: ${ws_latency}ms (>= 100ms)"
        ALL_PERFORMANCE_OK=false
    fi
else
    echo "⚠️ Cannot test WebSocket - wscat not installed"
fi

# Test memory usage
echo "Testing memory usage..."
if command -v docker >/dev/null 2>&1; then
    memory_usage=$(docker stats --no-stream --format "table {{.MemUsage}}" 2>/dev/null | grep -o '[0-9.]*MiB' | head -1 | grep -o '[0-9.]*')
    if [[ ! -z "$memory_usage" ]]; then
        if (( $(echo "$memory_usage < 512" | bc -l) )); then
            echo "✅ Memory usage: ${memory_usage}MB (< 512MB)"
        else
            echo "❌ Memory usage: ${memory_usage}MB (>= 512MB)"
            ALL_PERFORMANCE_OK=false
        fi
    else
        echo "⚠️ Cannot determine memory usage"
    fi
else
    echo "⚠️ Cannot test memory usage - Docker not available"
fi

echo ""
echo "📊 Validation Summary"
echo "===================="

OVERALL_STATUS=true

if [[ $ALL_SERVICES_HEALTHY == true ]]; then
    echo "✅ All services are healthy"
else
    echo "❌ Some services are unhealthy"
    OVERALL_STATUS=false
fi

if [[ $ALL_APIS_HEALTHY == true ]]; then
    echo "✅ All API endpoints are responding"
else
    echo "❌ Some API endpoints are not responding"
    OVERALL_STATUS=false
fi

if [[ $ALL_PERFORMANCE_OK == true ]]; then
    echo "✅ Performance metrics within acceptable ranges"
else
    echo "❌ Performance metrics exceed thresholds"
    OVERALL_STATUS=false
fi

echo ""
if [[ $OVERALL_STATUS == true ]]; then
    echo "🎉 Deployment validation successful!"
    echo "🚀 BG Threat AI is ready for use"
    exit 0
else
    echo "⚠️ Deployment validation failed"
    echo "🔧 Review the issues above before proceeding"
    exit 1
fi
```

## Troubleshooting

### Zero-Config Troubleshooting Guide

#### Automatic Issue Detection and Resolution

```bash
#!/bin/bash
# auto-troubleshoot.sh - Zero-config troubleshooting

echo "🔧 BG Threat AI Auto-Troubleshooting..."
echo "⚡ Automatic issue detection and resolution"

# Common issues and their auto-resolutions
declare -A ISSUES_AND_FIXES=(
    ["service_not_responding"]="restart_services"
    ["high_memory_usage"]="optimize_memory"
    ["slow_api_response"]="clear_cache_and_restart"
    ["websocket_connection_failed"]="restart_networking"
    ["database_connection_failed"]="restart_database"
    ["redis_connection_failed"]="restart_redis"
)

# Auto-detect issues
detect_issues() {
    local issues=()
    
    # Check service responsiveness
    if ! curl -f http://localhost:3002/health > /dev/null 2>&1; then
        issues+=("service_not_responding")
    fi
    
    # Check memory usage
    if command -v docker >/dev/null 2>&1; then
        local memory=$(docker stats --no-stream --format "{{.MemUsage}}" 2>/dev/null | head -1 | grep -o '[0-9.]*MiB' | head -1 | grep -o '[0-9.]*')
        if [[ ! -z "$memory" ]] && (( $(echo "$memory > 800" | bc -l) )); then
            issues+=("high_memory_usage")
        fi
    fi
    
    # Check API response time
    local start_time=$(date +%s%3N)
    curl -s http://localhost:3002/health > /dev/null 2>&1
    local end_time=$(date +%s%3N)
    local response_time=$((end_time - start_time))
    if [[ $response_time -gt 2000 ]]; then
        issues+=("slow_api_response")
    fi
    
    # Check WebSocket connection
    if command -v wscat >/dev/null 2>&1; then
        if ! timeout 5 wscat -c ws://localhost:3002 -x 'ping' > /dev/null 2>&1; then
            issues+=("websocket_connection_failed")
        fi
    fi
    
    # Check database connection
    if command -v psql >/dev/null 2>&1; then
        if ! psql "postgresql://postgres:password@localhost:5432/bg_threat_ai_dev" -c '\l' > /dev/null 2>&1; then
            issues+=("database_connection_failed")
        fi
    fi
    
    # Check Redis connection
    if command -v redis-cli >/dev/null 2>&1; then
        if ! redis-cli ping | grep -q "PONG"; then
            issues+=("redis_connection_failed")
        fi
    fi
    
    echo "${issues[@]}"
}

# Auto-fix functions
restart_services() {
    echo "🔄 Restarting services..."
    docker-compose down
    docker-compose up -d
    sleep 10
    echo "✅ Services restarted"
}

optimize_memory() {
    echo "💾 Optimizing memory usage..."
    docker-compose exec bg-threat-ai sh -c "kill -USR2 \$(pgrep node)"
    docker system prune -f
    echo "✅ Memory optimized"
}

clear_cache_and_restart() {
    echo "🧹 Clearing cache and restarting..."
    redis-cli flushall
    restart_services
    echo "✅ Cache cleared and services restarted"
}

restart_networking() {
    echo "🌐 Restarting networking..."
    docker network prune -f
    restart_services
    echo "✅ Networking restarted"
}

restart_database() {
    echo "🗄️ Restarting database..."
    docker-compose restart postgres
    sleep 5
    echo "✅ Database restarted"
}

restart_redis() {
    echo "📦 Restarting Redis..."
    docker-compose restart redis
    sleep 5
    echo "✅ Redis restarted"
}

# Main troubleshooting logic
echo "🔍 Detecting issues..."
detected_issues=($(detect_issues))

if [[ ${#detected_issues[@]} -eq 0 ]]; then
    echo "✅ No issues detected - system is healthy"
    exit 0
fi

echo "⚠️ Detected issues: ${detected_issues[*]}"

for issue in "${detected_issues[@]}"; do
    echo ""
    echo "🔧 Resolving: $issue"
    
    if [[ -n "${ISSUES_AND_FIXES[$issue]}" ]]; then
        ${ISSUES_AND_FIXES[$issue]}
    else
        echo "❌ No automatic fix available for: $issue"
    fi
done

echo ""
echo "⏳ Waiting for system to stabilize..."
sleep 30

# Re-validate after fixes
echo "🔍 Re-validating system..."
remaining_issues=($(detect_issues))

if [[ ${#remaining_issues[@]} -eq 0 ]]; then
    echo "✅ All issues resolved automatically!"
    echo "🎉 System is now healthy"
else
    echo "⚠️ Some issues persist: ${remaining_issues[*]}"
    echo "📞 Please contact support with the following information:"
    echo "   - Detected issues: ${detected_issues[*]}"
    echo "   - Remaining issues: ${remaining_issues[*]}"
    echo "   - System information: $(uname -a)"
    echo "   - Docker version: $(docker --version)"
fi
```

---

## Summary

This zero-config deployment approach revolutionizes enterprise cybersecurity deployment by:

1. **Eliminating Setup Complexity**: Single-command installation with no configuration files
2. **Automatic Environment Detection**: Intelligent discovery of systems, services, and compliance requirements
3. **Instant Value Realization**: Full functionality within 60 seconds of installation
4. **Zero Administrative Overhead**: Self-managing, self-optimizing, and self-healing systems
5. **Enterprise Scale**: Supports deployment from single endpoints to 100,000+ enterprise environments

The zero-config philosophy ensures that organizations can achieve comprehensive security visibility immediately, without the traditional barriers of complex configuration, specialized expertise, or lengthy deployment cycles.