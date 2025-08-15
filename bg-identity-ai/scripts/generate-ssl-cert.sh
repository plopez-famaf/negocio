#!/bin/bash

# =================================================================
# SSL Certificate Generation Script
# bg-threat-ai Console-First Threat Detection Platform
# =================================================================

set -e

# Configuration
SSL_DIR="./ssl"
DOMAIN="${DOMAIN:-localhost}"
COUNTRY="${COUNTRY:-US}"
STATE="${STATE:-CA}"
CITY="${CITY:-San Francisco}"
ORG="${ORG:-bg-threat-ai}"
EMAIL="${EMAIL:-admin@${DOMAIN}}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔒 SSL Certificate Generation for bg-threat-ai${NC}"
echo "================================================================"

# Create SSL directory if it doesn't exist
mkdir -p "$SSL_DIR"

# Check if certificates already exist
if [[ -f "$SSL_DIR/cert.pem" && -f "$SSL_DIR/key.pem" ]]; then
    echo -e "${YELLOW}⚠️  Certificates already exist in $SSL_DIR${NC}"
    read -p "Do you want to regenerate them? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Keeping existing certificates."
        exit 0
    fi
fi

echo -e "${GREEN}📋 Generating SSL certificate for domain: $DOMAIN${NC}"

# Generate private key
echo -e "${GREEN}🔑 Generating private key...${NC}"
openssl genrsa -out "$SSL_DIR/key.pem" 4096

# Generate certificate signing request
echo -e "${GREEN}📝 Generating certificate signing request...${NC}"
openssl req -new -key "$SSL_DIR/key.pem" -out "$SSL_DIR/cert.csr" \
    -subj "/C=$COUNTRY/ST=$STATE/L=$CITY/O=$ORG/CN=$DOMAIN/emailAddress=$EMAIL"

# Generate self-signed certificate
echo -e "${GREEN}📜 Generating self-signed certificate...${NC}"
openssl x509 -req -in "$SSL_DIR/cert.csr" -signkey "$SSL_DIR/key.pem" \
    -out "$SSL_DIR/cert.pem" -days 365 \
    -extensions v3_req -extfile <(
cat <<EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C=$COUNTRY
ST=$STATE
L=$CITY
O=$ORG
CN=$DOMAIN
emailAddress=$EMAIL

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = $DOMAIN
DNS.2 = www.$DOMAIN
DNS.3 = localhost
DNS.4 = 127.0.0.1
IP.1 = 127.0.0.1
EOF
)

# Set proper permissions
chmod 600 "$SSL_DIR/key.pem"
chmod 644 "$SSL_DIR/cert.pem"
chmod 644 "$SSL_DIR/cert.csr"

# Clean up CSR (optional)
rm -f "$SSL_DIR/cert.csr"

echo -e "${GREEN}✅ SSL certificates generated successfully!${NC}"
echo
echo "Files created:"
echo "  - Private Key: $SSL_DIR/key.pem"
echo "  - Certificate: $SSL_DIR/cert.pem"
echo
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo "1. For production, replace with certificates from a trusted CA"
echo "2. Update nginx configuration with correct certificate paths"
echo "3. Test HTTPS connectivity: curl -k https://$DOMAIN/health"
echo
echo -e "${RED}🚨 Security Note:${NC}"
echo "This is a self-signed certificate suitable for development/testing only."
echo "For production deployment, obtain certificates from a trusted Certificate Authority."
echo
echo -e "${GREEN}🎯 Certificate Information:${NC}"
openssl x509 -in "$SSL_DIR/cert.pem" -noout -text | grep -A 5 "Subject:"
echo
openssl x509 -in "$SSL_DIR/cert.pem" -noout -dates

# Create .gitignore entry for SSL files
if [[ ! -f .gitignore ]] || ! grep -q "ssl/" .gitignore; then
    echo "ssl/" >> .gitignore
    echo -e "${GREEN}📝 Added ssl/ to .gitignore${NC}"
fi

echo -e "${GREEN}🔒 SSL certificate generation completed!${NC}"