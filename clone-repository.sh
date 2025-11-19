#!/bin/bash

# Este script de configuración inicial prepara el entorno para el despliegue.
# Debe ejecutarse con sudo.

set -e # Exit on any error

echo "🚀 Starting Initial Server Setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="create"
DEPLOY_USER="deploy"
REPO_URL="git@github.com:tecnologia-acceleralia/create.git"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Error: This script must be run with sudo or as root.${NC}"
    echo -e "${YELLOW}Usage: sudo $0${NC}"
    exit 1
fi

# Install Docker if not installed
echo -e "${YELLOW}🐳 Checking Docker installation...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}🐳 Installing Docker...${NC}"
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sh /tmp/get-docker.sh
    rm /tmp/get-docker.sh
    echo -e "${GREEN}✅ Docker installed successfully${NC}"
else
    echo -e "${GREEN}✅ Docker already installed${NC}"
fi

# Ensure Docker daemon is running
if ! systemctl is-active --quiet docker; then
    echo -e "${YELLOW}🚀 Starting Docker daemon...${NC}"
    systemctl start docker
    systemctl enable docker
    echo -e "${GREEN}✅ Docker daemon started${NC}"
fi

# Create deploy user if not exists
if ! id "$DEPLOY_USER" &>/dev/null; then
    echo -e "${YELLOW}👥 User '${DEPLOY_USER}' not found. Creating user...${NC}"
    useradd -m -s /bin/bash ${DEPLOY_USER}
    
    # Set password for deploy user
    echo -e "${YELLOW}🔐 Setting password for user '${DEPLOY_USER}'...${NC}"
    passwd ${DEPLOY_USER}
    echo -e "${GREEN}✅ User '${DEPLOY_USER}' created and configured.${NC}"
else
    echo -e "${GREEN}✅ User '${DEPLOY_USER}' already exists.${NC}"
fi

# Ensure user is in sudo and docker groups
echo -e "${YELLOW}⚙️  Configuring permissions for '${DEPLOY_USER}'...${NC}"

# Add to sudo group
if ! groups ${DEPLOY_USER} | grep -q "\bsudo\b"; then
    usermod -aG sudo ${DEPLOY_USER}
    echo -e "${GREEN}✅ User '${DEPLOY_USER}' added to sudo group.${NC}"
else
    echo -e "${GREEN}✅ User '${DEPLOY_USER}' already in sudo group.${NC}"
fi

# Add to docker group
if ! groups ${DEPLOY_USER} | grep -q "\bdocker\b"; then
    usermod -aG docker ${DEPLOY_USER}
    echo -e "${GREEN}✅ User '${DEPLOY_USER}' added to docker group.${NC}"
else
    echo -e "${GREEN}✅ User '${DEPLOY_USER}' already in docker group.${NC}"
fi

# Configure Docker socket permissions as fallback
if [ -S /var/run/docker.sock ]; then
    chmod 666 /var/run/docker.sock 2>/dev/null || true
    echo -e "${GREEN}✅ Docker socket permissions configured${NC}"
fi

# Generate SSH key for deploy user if it doesn't exist
if [ ! -f "/home/${DEPLOY_USER}/.ssh/id_ed25519" ]; then
    echo -e "${YELLOW}🔑 Generating SSH key for user '${DEPLOY_USER}'...${NC}"
    sudo -u ${DEPLOY_USER} ssh-keygen -t ed25519 -f /home/${DEPLOY_USER}/.ssh/id_ed25519 -N ""
    echo -e "${GREEN}✅ SSH key generated successfully.${NC}"
else
    echo -e "${GREEN}✅ SSH key already exists for user '${DEPLOY_USER}'.${NC}"
fi

# Clone repository
echo -e "${YELLOW}📥 Cloning repository into /home/${DEPLOY_USER}/${PROJECT_NAME}...${NC}"
if [ -d "/home/${DEPLOY_USER}/${PROJECT_NAME}/.git" ]; then
    echo -e "${GREEN}✅ Repository already cloned. Skipping...${NC}"
else
    if sudo -u ${DEPLOY_USER} git clone ${REPO_URL} /home/${DEPLOY_USER}/${PROJECT_NAME}; then
        echo -e "${GREEN}✅ Repository cloned successfully.${NC}"
    else
        echo -e "${RED}❌ Error cloning the repository.${NC}"
        echo -e "${YELLOW}This is likely because the public SSH key has not been added to your GitHub account.${NC}"
        echo -e "${BLUE}
        Please follow these steps:
        1. Copy the public key from the server:
           sudo cat /home/${DEPLOY_USER}/.ssh/id_ed25519.pub

        2. Go to your GitHub account settings -> SSH and GPG keys -> New SSH key.
        3. Paste the key you just copied.

        4. Once the key is added, run this script again.
        ${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}🎉 Initial setup completed!${NC}"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo -e "${YELLOW}⚠️  IMPORTANT: For Docker permissions to take effect, you need to:${NC}"
echo -e "  • Log out and log back in as '${DEPLOY_USER}', OR"
echo -e "  • Run: newgrp docker (when logged in as ${DEPLOY_USER})"
echo ""
echo -e "  1. Access your server via SSH as the '${DEPLOY_USER}' user:"
echo -e "     ssh ${DEPLOY_USER}@your-server-ip"
echo ""
echo -e "  2. If already logged in, refresh group membership:"
echo -e "     newgrp docker"
echo ""
echo -e "  3. Go to the project directory:"
echo -e "     cd /home/${DEPLOY_USER}/${PROJECT_NAME}"
echo ""
echo -e "  4. Configure your .env file (copy from config.prod.env if needed)"
echo ""
echo -e "  5. Verify Docker access:"
echo -e "     docker ps"
echo ""
echo -e "  6. Run the deployment script:"
echo -e "     ./deploy-to-server.sh <your-domain.com> <your-email@example.com>"
echo ""
echo -e "${GREEN}✅ User '${DEPLOY_USER}' is now configured with Docker permissions!${NC}"
echo ""
