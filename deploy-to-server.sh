#!/bin/bash

# Este script se encarga del despliegue en producción.
# Debe ejecutarse como el usuario 'deploy' y dentro del directorio del proyecto.

set -e # Exit on any error

echo "🚀 Starting Production Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration with defaults
PROJECT_NAME="create"
DOMAIN_NAME="${1:-create.acceleralia.com}"
EMAIL="${2:-operaciones+create@acceleralia.com}"
DEPLOY_USER="deploy"

# Show configuration
echo -e "${BLUE}📋 Configuration:${NC}"
echo -e "  Project: ${PROJECT_NAME}"
echo -e "  Domain: ${DOMAIN_NAME}"
echo -e "  Email: ${EMAIL}"
echo -e "  Deploy User: ${DEPLOY_USER}"
echo ""

# Optional: Allow override with parameters
if [ ! -z "$1" ] && [ ! -z "$2" ]; then
    echo -e "${GREEN}✅ Using provided parameters${NC}"
else
    echo -e "${YELLOW}ℹ️  Using default values. To override: $0 <domain> <email>${NC}"
fi
echo ""

# --- Check if running as the correct user ---
if [ "$USER" != "$DEPLOY_USER" ]; then
    echo -e "${RED}❌ Error: This script must be run as the '${DEPLOY_USER}' user.${NC}"
    echo -e "${YELLOW}Please log in as '${DEPLOY_USER}' and run the script again.${NC}"
    exit 1
fi

# Update system packages
echo -e "${YELLOW}📦 Updating system packages...${NC}"
sudo apt update && sudo apt upgrade -y

# Install Docker if not installed
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}🐳 Installing Docker...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo -e "${GREEN}✅ Docker installed successfully${NC}"
else
    echo -e "${GREEN}✅ Docker already installed${NC}"
fi

# Install Docker Compose if not installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}🐳 Installing Docker Compose...${NC}"
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✅ Docker Compose installed successfully${NC}"
else
    echo -e "${GREEN}✅ Docker Compose already installed${NC}"
fi

# Check and install Nginx for reverse proxy
if ! command -v nginx &> /dev/null; then
    echo -e "${YELLOW}🌐 Installing Nginx...${NC}"
    sudo apt install nginx -y
    echo -e "${GREEN}✅ Nginx installed successfully${NC}"
else
    echo -e "${GREEN}✅ Nginx already installed${NC}"
fi

# Check and install Certbot for SSL
if ! command -v certbot &> /dev/null; then
    echo -e "${YELLOW}🔒 Installing Certbot for SSL...${NC}"
    sudo apt install certbot python3-certbot-nginx -y
    echo -e "${GREEN}✅ Certbot installed successfully${NC}"
else
    echo -e "${GREEN}✅ Certbot already installed${NC}"
fi

# Create production environment file
echo -e "${YELLOW}⚙️  Verifying environment configuration...${NC}"
if [ ! -f ".env.dev.prod" ]; then
    echo -e "${RED}❌ Error: .env.dev file not found.${NC}"
    echo -e "${YELLOW}Please ensure the repository is cloned and the .env.dev file exists and is configured correctly.${NC}"
    exit 1
fi

# Generate secure JWT secrets if not changed
if grep -q "CHANGE-THIS-TO-A-SECURE-RANDOM-STRING-IN-PRODUCTION" .env.dev; then
    echo -e "${YELLOW}🔐 Generating secure JWT secrets...${NC}"
    JWT_SECRET=$(openssl rand -base64 32)
    JWT_REFRESH_SECRET=$(openssl rand -base64 32)
    
    sed -i "s|CHANGE-THIS-TO-A-SECURE-RANDOM-STRING-IN-PRODUCTION|$JWT_SECRET|g" .env.dev
    sed -i "s|CHANGE-THIS-TO-A-SECURE-RANDOM-STRING-IN-PRODUCTION|$JWT_REFRESH_SECRET|g" .env.dev
    
    echo -e "${GREEN}✅ JWT secrets generated${NC}"
fi

# Update domain in .env.dev file
echo -e "${YELLOW}🌐 Updating domain configuration...${NC}"
sed -i "s/your-domain.com/${DOMAIN_NAME}/g" .env.dev
sed -i "s/admin@your-domain.com/${EMAIL}/g" .env.dev

# Check if SSL certificate already exists
CERT_PATH="/etc/letsencrypt/live/${DOMAIN_NAME}/fullchain.pem"
if [ ! -f "$CERT_PATH" ]; then
    echo -e "${YELLOW}⚙️  Configuring Nginx for Certbot...${NC}"
    sudo tee /etc/nginx/sites-available/${PROJECT_NAME} > /dev/null <<EOF
server {
    listen 80;
    server_name ${DOMAIN_NAME};
}
EOF

    # Enable the site
    sudo ln -sf /etc/nginx/sites-available/${PROJECT_NAME} /etc/nginx/sites-enabled/
    # NO eliminar default para no interferir con otras aplicaciones en el servidor
    # sudo rm -f /etc/nginx/sites-enabled/default

    # Test Nginx configuration
    sudo nginx -t
    sudo systemctl reload nginx

    # Get SSL certificate
    echo -e "${YELLOW}📜 Obtaining SSL certificate from Let's Encrypt...${NC}"
    sudo certbot --nginx -d ${DOMAIN_NAME} --email ${EMAIL} --agree-tos --non-interactive

    # Certbot renombra automáticamente la configuración al nombre del dominio
    # Eliminar la configuración antigua si existe (tanto el symlink como el archivo)
    if [ -L "/etc/nginx/sites-enabled/${PROJECT_NAME}" ] || [ -f "/etc/nginx/sites-enabled/${PROJECT_NAME}" ]; then
        echo -e "${YELLOW}🧹 Eliminando symlink antiguo '${PROJECT_NAME}' de sites-enabled...${NC}"
        sudo rm -f /etc/nginx/sites-enabled/${PROJECT_NAME}
        echo -e "${GREEN}✅ Symlink antiguo eliminado${NC}"
    fi
    
    if [ -f "/etc/nginx/sites-available/${PROJECT_NAME}" ]; then
        echo -e "${YELLOW}🧹 Eliminando configuración antigua '${PROJECT_NAME}' de sites-available...${NC}"
        sudo rm -f /etc/nginx/sites-available/${PROJECT_NAME}
        echo -e "${GREEN}✅ Configuración antigua eliminada${NC}"
    fi

    # Certbot has now updated the Nginx config, reload Nginx to apply changes
    sudo systemctl reload nginx
else
    echo -e "${GREEN}✅ SSL certificate already exists. Skipping certificate request.${NC}"
    # If certificate exists, ensure Nginx config is up to date
    sudo systemctl reload nginx
fi

# Setup logs directory with correct permissions
echo -e "${YELLOW}📁 Setting up logs directory...${NC}"
sudo mkdir -p logs
# El usuario appuser en el contenedor tiene UID 999 (ver Dockerfile)
sudo chown -R 999:999 logs
sudo chmod -R 755 logs

# Create log rotation configuration
echo -e "${YELLOW}📋 Setting up log rotation...${NC}"
sudo tee /etc/logrotate.d/create > /dev/null <<EOF
$(pwd)/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 1000 1000
    postrotate
        docker-compose --profile prod restart backend > /dev/null 2>&1 || true
    endscript
}
EOF

# Start the application
echo -e "${YELLOW}🚀 Starting the application...${NC}"
docker-compose --profile prod up -d --build

# Wait for services to be ready
echo -e "${YELLOW}⏳ Waiting for services to start...${NC}"
sleep 30

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    echo -e "${GREEN}✅ Application started successfully${NC}"
else
    echo -e "${RED}❌ Application failed to start. Check logs:${NC}"
    docker-compose logs
    exit 1
fi

# Handle database migrations
echo -e "${YELLOW}🗄️  Setting up database migrations...${NC}"
# Wait for backend to be ready
echo -e "${YELLOW}⏳ Waiting for backend to be ready...${NC}"
sleep 30

# Check if backend is healthy before running migrations
echo -e "${YELLOW}🔍 Checking backend health...${NC}"
for i in {1..10}; do
    if curl -f http://localhost:3001/api/health >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend is healthy${NC}"
        break
    else
        echo -e "${YELLOW}⏳ Waiting for backend... (attempt $i/10)${NC}"
        sleep 10
    fi
done

# Run migrations with proper error handling
echo -e "${YELLOW}🔄 Running database migrations...${NC}"

# First, check if there are any pending migrations
echo -e "${YELLOW}🔍 Checking migration status...${NC}"
CURRENT_REVISION=$(docker-compose exec -T backend flask db current 2>/dev/null | grep -o 'Rev: [a-f0-9_]*' | cut -d' ' -f2 || echo "none")
HEAD_REVISION=$(docker-compose exec -T backend flask db heads 2>/dev/null | grep -o 'Rev: [a-f0-9_]*' | cut -d' ' -f2 || echo "none")

echo "Current revision: $CURRENT_REVISION"
echo "Head revision: $HEAD_REVISION"

if [ "$CURRENT_REVISION" = "$HEAD_REVISION" ]; then
    echo -e "${GREEN}✅ Database is already up to date${NC}"
else
    echo -e "${YELLOW}🔄 Running migrations from $CURRENT_REVISION to $HEAD_REVISION...${NC}"
    
    if docker-compose exec -T backend flask db upgrade; then
        echo -e "${GREEN}✅ Migrations completed successfully${NC}"
    else
        echo -e "${RED}❌ Migration failed. Attempting to fix...${NC}"
        
        # Try to fix common migration issues
        echo -e "${YELLOW}🔧 Attempting to fix migration issues...${NC}"
        
        # Check if the issue is with duplicate columns
        echo -e "${YELLOW}🔍 Checking for common migration issues...${NC}"
        
        # Check if año_documento column exists but migration is failing
        if docker-compose exec -T postgres psql -U postgres -d buscador_proyectos -c "
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'proyectos_generales' 
        AND column_name = 'año_documento';
        " 2>/dev/null | grep -q "año_documento"; then
            echo -e "${YELLOW}⚠️  Columna año_documento ya existe. Marcando migración como aplicada...${NC}"
            
            # Mark the specific migration as applied without running it
            docker-compose exec -T backend flask db stamp 20250909_134046
            
            # Try upgrade again
            echo -e "${YELLOW}🔄 Retrying migration after fixing duplicate column issue...${NC}"
            if docker-compose exec -T backend flask db upgrade; then
                echo -e "${GREEN}✅ Migrations fixed and completed${NC}"
            else
                echo -e "${RED}❌ Migration still failed after fix attempt${NC}"
                echo -e "${YELLOW}Please check the logs and fix manually:${NC}"
                echo "  docker-compose logs backend"
                echo "  docker-compose exec backend flask db current"
                echo "  docker-compose exec backend flask db history"
                exit 1
            fi
        else
            # Try to stamp the database to current revision
            echo "Stamping database to current revision..."
            docker-compose exec -T backend flask db stamp head
            
            # Try upgrade again
            echo "Retrying migration..."
            if docker-compose exec -T backend flask db upgrade; then
                echo -e "${GREEN}✅ Migrations fixed and completed${NC}"
            else
                echo -e "${RED}❌ Migration still failed. Manual intervention required.${NC}"
                echo -e "${YELLOW}Please check the logs and fix manually:${NC}"
                echo "  docker-compose logs backend"
                echo "  docker-compose exec backend flask db current"
                echo "  docker-compose exec backend flask db history"
                exit 1
            fi
        fi
    fi
fi

# Verify migrations were applied correctly
echo -e "${YELLOW}🔍 Verifying migrations...${NC}"
CURRENT_REVISION=$(docker-compose exec -T backend flask db current 2>/dev/null | grep -o 'Rev: [a-f0-9_]*' | cut -d' ' -f2)
echo "Current database revision: $CURRENT_REVISION"

# Test database connectivity
echo -e "${YELLOW}🧪 Testing database connectivity...${NC}"
if docker-compose exec -T postgres psql -U postgres -d buscador_proyectos -c "SELECT 1;" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Database is accessible${NC}"
else
    echo -e "${RED}❌ Database is not accessible${NC}"
    exit 1
fi

# Verify specific critical columns exist
echo -e "${YELLOW}🔍 Verifying critical database columns...${NC}"

# Check for año_documento column (the one that caused the issue)
if docker-compose exec -T postgres psql -U postgres -d buscador_proyectos -c "
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'proyectos_generales' 
AND column_name = 'año_documento';
" 2>/dev/null | grep -q "año_documento"; then
    echo -e "${GREEN}✅ Columna año_documento existe${NC}"
else
    echo -e "${YELLOW}⚠️  Columna año_documento no existe. Creándola...${NC}"
    if docker-compose exec -T postgres psql -U postgres -d buscador_proyectos -c "
    ALTER TABLE proyectos_generales 
    ADD COLUMN IF NOT EXISTS año_documento INTEGER;
    " 2>/dev/null; then
        echo -e "${GREEN}✅ Columna año_documento creada${NC}"
    else
        echo -e "${RED}❌ Error creando columna año_documento${NC}"
        exit 1
    fi
fi

# Test critical endpoints to ensure migrations worked
echo -e "${YELLOW}🧪 Testing critical endpoints...${NC}"
if curl -f http://localhost:3001/api/proyectos/estadisticas >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Endpoint de estadísticas funciona${NC}"
else
    echo -e "${RED}❌ Endpoint de estadísticas falla. Revisando logs...${NC}"
    docker-compose logs --tail=20 backend
    echo -e "${YELLOW}⚠️  Puede requerir intervención manual${NC}"
fi

# Setup firewall
echo -e "${YELLOW}🔥 Configuring firewall...${NC}"
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# Create systemd service for auto-start
echo -e "${YELLOW}⚙️  Setting up auto-start service...${NC}"
sudo tee /etc/systemd/system/${PROJECT_NAME}.service > /dev/null <<EOF
[Unit]
Description=Create platform
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/\$USER/${PROJECT_NAME}
ExecStart=/usr/local/bin/docker-compose --profile prod up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable ${PROJECT_NAME}

# Create backup script
echo -e "${YELLOW}💾 Creating backup script...${NC}"
tee backup.sh > /dev/null <<EOF
#!/bin/bash
# Backup script

BACKUP_DIR="/home/\$USER/backups"
DATE=\$(date +%Y%m%d_%H%M%S)

mkdir -p \$BACKUP_DIR

# Backup database
docker-compose exec -T postgres pg_dump -U postgres buscador_proyectos > \$BACKUP_DIR/db_backup_\$DATE.sql

# Backup uploads
tar -czf \$BACKUP_DIR/uploads_backup_\$DATE.tar.gz uploads/

# Keep only last 7 days of backups
find \$BACKUP_DIR -name "*.sql" -mtime +7 -delete
find \$BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: \$DATE"

# Renew SSL certificate (if needed)
sudo certbot renew --quiet
EOF

chmod +x backup.sh

# Setup cron job for backups
echo -e "${YELLOW}🕰️ Configuring cron job for backups and renewal...${NC}"
(crontab -l 2>/dev/null | grep -v "${PROJECT_NAME}"; echo "0 2 * * * /home/$USER/${PROJECT_NAME}/backup.sh") | crontab -

echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo -e "  1. Update your DNS to point ${DOMAIN_NAME} to this server's IP"
echo -e "  2. Wait for DNS propagation (5-30 minutes)"
echo -e "  3. Visit https://${DOMAIN_NAME} to access your application"
echo ""
echo -e "${BLUE}🔧 Management commands:${NC}"
echo -e "  Start:   docker-compose --profile prod up -d"
echo -e "  Stop:    docker-compose down"
echo -e "  Logs:    docker-compose logs -f"
echo -e "  Status:  docker-compose ps"
echo -e "  Backup:  ./backup.sh"
echo ""
echo -e "${BLUE}📁 Important files:${NC}"
echo -e "  Config:  ~/${PROJECT_NAME}/.env.dev"
echo -e "  Logs:    ~/${PROJECT_NAME}/logs/"
echo -e "  Backups: ~/backups/"
echo ""
echo -e "${GREEN}✅ Your Create platform is now live!${NC}"

# Actualizar configuración de nginx
echo ""
echo -e "${YELLOW}🔧 Updating nginx configuration to fix file upload limits...${NC}"

# Verificar si el archivo de configuración de nginx existe
if [ -f "nginx-create.conf" ]; then
    echo -e "${BLUE}📝 Updating nginx configuration...${NC}"
    
    # Hacer backup de la configuración actual
    if [ -f "/etc/nginx/sites-available/${DOMAIN_NAME}" ]; then
        sudo cp /etc/nginx/sites-available/${DOMAIN_NAME} /etc/nginx/sites-available/${DOMAIN_NAME}.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
    fi
    
    # Eliminar configuración antigua si existe (tanto el symlink como el archivo)
    if [ -L "/etc/nginx/sites-enabled/${PROJECT_NAME}" ] || [ -f "/etc/nginx/sites-enabled/${PROJECT_NAME}" ]; then
        echo -e "${YELLOW}🧹 Eliminando symlink antiguo '${PROJECT_NAME}' de sites-enabled...${NC}"
        sudo rm -f /etc/nginx/sites-enabled/${PROJECT_NAME}
        echo -e "${GREEN}✅ Symlink antiguo eliminado${NC}"
    fi
    
    if [ -f "/etc/nginx/sites-available/${PROJECT_NAME}" ]; then
        echo -e "${YELLOW}🧹 Eliminando configuración antigua '${PROJECT_NAME}' de sites-available...${NC}"
        sudo rm -f /etc/nginx/sites-available/${PROJECT_NAME}
        echo -e "${GREEN}✅ Configuración antigua eliminada${NC}"
    fi
    
    # Copiar la nueva configuración y reemplazar variables
    # Reemplazar variables en nginx-prod.conf antes de copiarlo
    sed "s|\${NGINX_DOMAIN}|${DOMAIN_NAME}|g; s|\${NGINX_CERT_PATH}|/etc/letsencrypt/live/${DOMAIN_NAME}/fullchain.pem|g; s|\${NGINX_CERT_KEY_PATH}|/etc/letsencrypt/live/${DOMAIN_NAME}/privkey.pem|g" nginx-prod.conf | sudo tee /etc/nginx/sites-available/${DOMAIN_NAME} > /dev/null
      
    # Asegurar que esté habilitada
    sudo ln -sf /etc/nginx/sites-available/${DOMAIN_NAME} /etc/nginx/sites-enabled/${DOMAIN_NAME}

    # NO eliminar configuración default para no interferir con otras aplicaciones
    # Nginx puede manejar múltiples sitios usando server_name
    # if [ -f "/etc/nginx/sites-enabled/default" ] || [ -L "/etc/nginx/sites-enabled/default" ]; then
    #     echo -e "${YELLOW}🧹 Deshabilitando configuración 'default' de nginx...${NC}"
    #     sudo rm -f /etc/nginx/sites-enabled/default
    #     echo -e "${GREEN}✅ Configuración 'default' deshabilitada${NC}"
    # fi

    # Verificar y recargar nginx
    if sudo nginx -t; then
        echo -e "${GREEN}✅ Nginx configuration is valid${NC}"
        sudo systemctl reload nginx
        echo -e "${GREEN}✅ Nginx reloaded successfully${NC}"
        echo -e "${BLUE}📋 File upload limits updated:${NC}"
        echo -e "   • Maximum file size: 50MB"
        echo -e "   • Timeout for file uploads: 300s"
        echo -e "   • Error 413 should now be resolved"
    else
        echo -e "${RED}❌ Nginx configuration error${NC}"
        echo -e "${YELLOW}⚠️  Please check nginx configuration manually${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  nginx-create.conf not found, skipping nginx update${NC}"
fi