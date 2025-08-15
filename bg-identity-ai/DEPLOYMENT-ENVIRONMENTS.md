# 🌍 Deployment Environments Guide
**Console-First Threat Detection Platform**  
**Version**: bg-threat-ai v2.0.0  
**Environment Coverage**: Local, Cloud, Hybrid  
**Last Updated**: August 10, 2025  

---

## 📖 Environment Overview

### Current Deployment Guide Scope

**✅ DEPLOYMENT-PROCEDURES.md covers:**
- **Local Development**: Docker Desktop on developer machines
- **On-Premises Servers**: Linux/Windows servers with Docker
- **Private Cloud**: Self-managed cloud instances
- **Edge Deployment**: Local data centers and edge computing

**⚠️ DEPLOYMENT-PROCEDURES.md does NOT cover:**
- **Public Cloud Platforms** (AWS, Azure, GCP)
- **Kubernetes Orchestration** 
- **Serverless Deployments**
- **Container Registries**
- **Cloud-Native Services**

---

## 🏠 Local Environment Deployment

### When to Use Local Deployment
- **Development and Testing**
- **Proof of Concept (PoC)**
- **Small Team Deployments (< 10 users)**
- **Air-Gapped Environments**
- **Edge Computing Scenarios**

### Local Deployment Procedure
```bash
# Follow DEPLOYMENT-PROCEDURES.md exactly as written
./scripts/deploy-production.sh

# Access locally
curl http://localhost/health
```

### Local Environment Characteristics
- **Infrastructure**: Docker Desktop or Docker Engine
- **Networking**: localhost/127.0.0.1
- **Storage**: Local volumes and file system
- **SSL**: Self-signed certificates
- **Scaling**: Single machine vertical scaling
- **Monitoring**: Local Prometheus/Grafana

---

## ☁️ Cloud Environment Deployment

### Cloud Deployment Options

#### Option 1: Cloud VM with Docker (IaaS)
**Best for**: Traditional deployment on cloud instances

**Supported Platforms:**
- AWS EC2 instances
- Azure Virtual Machines
- Google Compute Engine
- DigitalOcean Droplets
- Linode instances

**Deployment Method:**
```bash
# 1. Launch cloud VM (Ubuntu 20.04+, 4GB RAM, 20GB disk)
# 2. Install Docker and Docker Compose
# 3. Follow DEPLOYMENT-PROCEDURES.md with cloud modifications
```

#### Option 2: Container Orchestration (Kubernetes)
**Best for**: Production scaling and enterprise deployment

**Platforms:**
- Amazon EKS
- Azure AKS
- Google GKE
- DigitalOcean Kubernetes

**Requires**: New Kubernetes manifests (not in current guide)

#### Option 3: Container as a Service (CaaS)
**Best for**: Simplified container management

**Platforms:**
- AWS Fargate
- Azure Container Instances
- Google Cloud Run

**Requires**: Platform-specific configurations

#### Option 4: Platform as a Service (PaaS)
**Best for**: Zero infrastructure management

**Platforms:**
- Heroku
- Railway
- Render
- AWS App Runner

**Requires**: Platform-specific buildpacks and configurations

---

## 🔧 Cloud Deployment Procedures

### AWS EC2 Deployment

**Step 1: Launch EC2 Instance**
```bash
# Launch instance via AWS CLI
aws ec2 run-instances \
  --image-id ami-0c02fb55956c7d316 \
  --instance-type t3.medium \
  --key-name your-key-pair \
  --security-group-ids sg-xxxxxxxxx \
  --user-data file://cloud-init.sh
```

**Step 2: Connect and Setup**
```bash
# SSH to instance
ssh -i your-key.pem ubuntu@your-instance-ip

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

**Step 3: Deploy Application**
```bash
# Clone repository
git clone <your-repo-url>
cd bg-identity-ai

# Modify environment for cloud
cp .env.example .env.production

# Edit cloud-specific settings
nano .env.production
# Set: CORS_ORIGIN=https://your-domain.com
# Set: BG_WEB_API_URL=https://your-domain.com

# Deploy using existing procedures
./scripts/deploy-production.sh
```

**Step 4: Configure Cloud Security**
```bash
# Configure security group to allow:
# - Port 80 (HTTP)
# - Port 443 (HTTPS)
# - Port 22 (SSH) from your IP only
# - Block direct access to 3002, 6379

# Configure Route 53 for domain
# Point your domain to the EC2 instance IP
```

### Azure VM Deployment

**Step 1: Create Azure VM**
```bash
# Create resource group
az group create --name bg-threat-ai-rg --location eastus

# Create VM
az vm create \
  --resource-group bg-threat-ai-rg \
  --name bg-threat-ai-vm \
  --image UbuntuLTS \
  --size Standard_B2s \
  --admin-username azureuser \
  --generate-ssh-keys \
  --custom-data cloud-init.sh
```

**Step 2: Configure Networking**
```bash
# Open required ports
az vm open-port --resource-group bg-threat-ai-rg --name bg-threat-ai-vm --port 80
az vm open-port --resource-group bg-threat-ai-rg --name bg-threat-ai-vm --port 443

# Get public IP
az vm show -d --resource-group bg-threat-ai-rg --name bg-threat-ai-vm --query publicIps -o tsv
```

**Step 3: Deploy Application**
```bash
# SSH to VM
ssh azureuser@your-vm-ip

# Follow same deployment steps as AWS
# Use DEPLOYMENT-PROCEDURES.md with cloud environment variables
```

### Google Cloud Platform Deployment

**Step 1: Create Compute Engine Instance**
```bash
# Create instance
gcloud compute instances create bg-threat-ai-instance \
  --zone=us-central1-a \
  --machine-type=e2-medium \
  --image-family=ubuntu-2004-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=20GB \
  --metadata-from-file startup-script=startup-script.sh
```

**Step 2: Configure Firewall**
```bash
# Allow HTTP and HTTPS traffic
gcloud compute firewall-rules create allow-bg-threat-ai \
  --allow tcp:80,tcp:443 \
  --source-ranges 0.0.0.0/0 \
  --description "Allow HTTP and HTTPS to bg-threat-ai"
```

**Step 3: Deploy Application**
```bash
# SSH to instance
gcloud compute ssh bg-threat-ai-instance --zone=us-central1-a

# Follow deployment procedures
# Use DEPLOYMENT-PROCEDURES.md
```

---

## 🔄 Environment-Specific Modifications

### Local Environment (.env.production)
```bash
# Local-specific settings
NODE_ENV=production
BG_WEB_API_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
REDIS_HOST=redis
```

### Cloud Environment (.env.production)
```bash
# Cloud-specific settings
NODE_ENV=production
BG_WEB_API_URL=https://yourdomain.com
CORS_ORIGIN=https://yourdomain.com
REDIS_HOST=redis

# Cloud monitoring
SENTRY_DSN=your-sentry-dsn
SLACK_WEBHOOK_URL=your-slack-webhook

# Cloud security
JWT_SECRET=<256-bit-cloud-secret>
REDIS_PASSWORD=<strong-cloud-password>
```

### SSL Certificate Differences

#### Local Environment
```bash
# Use self-signed certificates
./scripts/generate-ssl-cert.sh
```

#### Cloud Environment
```bash
# Option 1: Let's Encrypt (Recommended)
sudo apt install certbot
sudo certbot certonly --standalone -d yourdomain.com
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ssl/cert.pem
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ssl/key.pem

# Option 2: Cloud Provider Certificates
# AWS Certificate Manager
# Azure Key Vault Certificates
# Google Managed SSL Certificates

# Option 3: Commercial CA
# Purchase SSL certificate from CA
# Install according to CA instructions
```

---

## 🏗️ Cloud Infrastructure Configurations

### AWS Infrastructure Setup

**Create cloud-init.sh:**
```bash
#!/bin/bash
# AWS EC2 User Data Script

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker ubuntu

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Create application directory
mkdir -p /opt/bg-threat-ai
cd /opt/bg-threat-ai

# Clone repository (replace with your repo)
git clone https://github.com/your-org/bg-threat-ai.git .

# Set permissions
chown -R ubuntu:ubuntu /opt/bg-threat-ai

# Configure firewall
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Create systemd service for auto-start
cat > /etc/systemd/system/bg-threat-ai.service << 'EOF'
[Unit]
Description=BG Threat AI Service
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/bg-threat-ai
ExecStart=/usr/local/bin/docker-compose -f docker-compose.production.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.production.yml down
User=ubuntu
Group=ubuntu

[Install]
WantedBy=multi-user.target
EOF

systemctl enable bg-threat-ai
```

### Azure Resource Manager Template

**Create azuredeploy.json:**
```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "vmName": {
      "type": "string",
      "defaultValue": "bg-threat-ai-vm"
    },
    "adminUsername": {
      "type": "string",
      "defaultValue": "azureuser"
    }
  },
  "resources": [
    {
      "type": "Microsoft.Compute/virtualMachines",
      "apiVersion": "2021-04-01",
      "name": "[parameters('vmName')]",
      "location": "[resourceGroup().location]",
      "properties": {
        "hardwareProfile": {
          "vmSize": "Standard_B2s"
        },
        "osProfile": {
          "computerName": "[parameters('vmName')]",
          "adminUsername": "[parameters('adminUsername')]",
          "customData": "[base64(variables('cloudInitScript'))]"
        }
      }
    }
  ]
}
```

### Google Cloud Deployment Manager

**Create deployment.yaml:**
```yaml
resources:
- name: bg-threat-ai-instance
  type: compute.v1.instance
  properties:
    zone: us-central1-a
    machineType: zones/us-central1-a/machineTypes/e2-medium
    disks:
    - deviceName: boot
      type: PERSISTENT
      boot: true
      autoDelete: true
      initializeParams:
        sourceImage: projects/ubuntu-os-cloud/global/images/family/ubuntu-2004-lts
    networkInterfaces:
    - network: global/networks/default
      accessConfigs:
      - name: External NAT
        type: ONE_TO_ONE_NAT
    metadata:
      items:
      - key: startup-script
        value: |
          #!/bin/bash
          # GCP startup script content here
```

---

## 📊 Environment Comparison Matrix

| Feature | Local | AWS EC2 | Azure VM | GCP Compute |
|---------|-------|---------|----------|-------------|
| **Setup Complexity** | Simple | Medium | Medium | Medium |
| **Cost** | Free | $50-200/month | $60-250/month | $45-180/month |
| **Scaling** | Limited | Auto Scaling Groups | Scale Sets | Instance Groups |
| **Monitoring** | Local only | CloudWatch | Azure Monitor | Operations Suite |
| **Security** | Basic | IAM + Security Groups | RBAC + NSG | IAM + Firewall |
| **SSL** | Self-signed | ACM/Let's Encrypt | Key Vault/Let's Encrypt | Managed SSL |
| **Backup** | Manual | EBS Snapshots | VM Backups | Disk Snapshots |
| **Load Balancing** | NGINX only | ELB/ALB | Load Balancer | Load Balancer |
| **Auto-restart** | Docker restart | EC2 auto-recovery | VM auto-restart | Instance repair |

---

## 🎯 Deployment Decision Matrix

### Choose Local Deployment When:
- ✅ Development and testing
- ✅ PoC or demo environments
- ✅ Small team (< 5 users)
- ✅ Air-gapped requirements
- ✅ Edge computing needs
- ✅ Learning and experimentation

### Choose Cloud Deployment When:
- ✅ Production environment
- ✅ Multiple users (> 10)
- ✅ Need high availability
- ✅ Require auto-scaling
- ✅ Global user base
- ✅ Enterprise security requirements
- ✅ Need managed services integration

---

## 🚀 Migration Procedures

### Local to Cloud Migration

**Step 1: Backup Local Environment**
```bash
# Create complete backup
tar -czf bg-threat-ai-backup.tar.gz \
    .env.production \
    ssl/ \
    nginx/ \
    logs/ \
    docker-compose.production.yml
```

**Step 2: Prepare Cloud Environment**
```bash
# Launch cloud instance
# Install Docker and dependencies
# Configure security groups/firewall
```

**Step 3: Transfer and Deploy**
```bash
# Upload backup to cloud instance
scp bg-threat-ai-backup.tar.gz user@cloud-ip:~/

# SSH to cloud instance and extract
ssh user@cloud-ip
tar -xzf bg-threat-ai-backup.tar.gz

# Modify for cloud environment
nano .env.production
# Update CORS_ORIGIN, BG_WEB_API_URL, etc.

# Deploy using existing procedures
./scripts/deploy-production.sh
```

### Cloud to Local Migration

**Step 1: Download Cloud Backup**
```bash
# SSH to cloud instance and create backup
ssh user@cloud-ip
tar -czf cloud-backup.tar.gz /opt/bg-threat-ai/

# Download to local
scp user@cloud-ip:~/cloud-backup.tar.gz ./
```

**Step 2: Deploy Locally**
```bash
# Extract and modify for local
tar -xzf cloud-backup.tar.gz
cd bg-threat-ai

# Update environment for local
nano .env.production
# Set CORS_ORIGIN=http://localhost:3000

# Deploy locally
./scripts/deploy-production.sh
```

---

## 🔧 Environment-Specific Troubleshooting

### Local Environment Issues
- **Docker Desktop not running**: Start Docker Desktop
- **Port conflicts**: Check for other local services
- **Permission issues**: Check Docker user permissions
- **Resource constraints**: Increase Docker memory/CPU limits

### Cloud Environment Issues
- **Security group**: Verify ports 80/443 are open
- **Domain not resolving**: Check DNS configuration
- **SSL certificate**: Use Let's Encrypt for valid certificates
- **Instance size**: Upgrade if resource constraints occur
- **SSH access**: Verify security group allows SSH from your IP

---

## 📋 Quick Reference

### Local Deployment
```bash
# One command local deployment
./scripts/deploy-production.sh

# Access
curl http://localhost/health
```

### AWS EC2 Deployment
```bash
# Launch EC2 with user data script
# SSH and clone repository
# Run: ./scripts/deploy-production.sh
# Configure domain/SSL

# Access
curl https://yourdomain.com/health
```

### Environment Check Commands
```bash
# Check if running locally
curl -f http://localhost/health

# Check if running in cloud
curl -f https://yourdomain.com/health

# Check environment
grep NODE_ENV .env.production
```

---

## 🏆 Summary

**Current Status:**
- ✅ **DEPLOYMENT-PROCEDURES.md**: Complete for local/on-premises deployment
- ✅ **DEPLOYMENT-ENVIRONMENTS.md**: Covers local vs cloud deployment options

**Environment Coverage:**
- ✅ **Local Development**: Fully supported with existing procedures
- ✅ **On-Premises Servers**: Supported with Docker deployment
- ✅ **Cloud VMs (IaaS)**: Supported with environment modifications
- ⚠️ **Kubernetes**: Requires additional manifests (future enhancement)
- ⚠️ **Serverless**: Requires platform-specific configurations (future)

**Recommendation:**
- **For immediate use**: Use **DEPLOYMENT-PROCEDURES.md** for local/on-premises
- **For cloud deployment**: Use this guide with cloud-specific modifications
- **For production scaling**: Consider Kubernetes deployment (requires additional setup)

---

*Environment Guide - Version 2.0.0*  
*Console-First Threat Detection Platform*  
*Multi-Environment Deployment Ready*