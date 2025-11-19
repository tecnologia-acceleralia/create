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
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Error: .env file not found.${NC}"
    echo -e "${YELLOW}Please ensure the repository is cloned and the .env file exists and is configured correctly.${NC}"
    exit 1
fi

# Generate secure JWT secrets if not changed
if grep -q "CHANGE-THIS-TO-A-SECURE-RANDOM-STRING-IN-PRODUCTION" .env; then
    echo -e "${YELLOW}🔐 Generating secure JWT secrets...${NC}"
    JWT_SECRET=$(openssl rand -base64 32)
    JWT_REFRESH_SECRET=$(openssl rand -base64 32)
    
    sed -i "s|CHANGE-THIS-TO-A-SECURE-RANDOM-STRING-IN-PRODUCTION|$JWT_SECRET|g" .env
    sed -i "s|CHANGE-THIS-TO-A-SECURE-RANDOM-STRING-IN-PRODUCTION|$JWT_REFRESH_SECRET|g" .env
    
    echo -e "${GREEN}✅ JWT secrets generated${NC}"
fi

# Update domain in .env file
echo -e "${YELLOW}🌐 Updating domain configuration...${NC}"
sed -i "s/your-domain.com/${DOMAIN_NAME}/g" .env
sed -i "s/admin@your-domain.com/${EMAIL}/g" .env

# Check if SSL certificate already exists
CERT_PATH="/etc/letsencrypt/live/${DOMAIN_NAME}/fullchain.pem"
if [ ! -f "$CERT_PATH" ]; then
    echo -e "${YELLOW}⚙️  Configuring Nginx for Certbot (wildcard)...${NC}"
    sudo tee /etc/nginx/sites-available/${PROJECT_NAME} > /dev/null <<EOF
server {
    listen 80;
    server_name ${DOMAIN_NAME} *.${DOMAIN_NAME};
}
EOF

    # Enable the site
    sudo ln -sf /etc/nginx/sites-available/${PROJECT_NAME} /etc/nginx/sites-enabled/
    # NO eliminar default para no interferir con otras aplicaciones en el servidor
    # sudo rm -f /etc/nginx/sites-enabled/default

    # Test Nginx configuration
    sudo nginx -t
    sudo systemctl reload nginx

    # Get SSL certificate (wildcard para soportar subdominios)
    echo -e "${YELLOW}📜 Obtaining wildcard SSL certificate from Let's Encrypt...${NC}"
    echo -e "${BLUE}ℹ️  Se obtendrá un certificado wildcard para ${DOMAIN_NAME} y *.${DOMAIN_NAME}${NC}"
    echo -e "${BLUE}ℹ️  Esto requiere validación DNS (registro TXT).${NC}"
    
    # Intentar obtener certificado wildcard
    WILDCARD_CERT_PATH="/etc/letsencrypt/live/${DOMAIN_NAME}/fullchain.pem"
    if [ ! -f "$WILDCARD_CERT_PATH" ]; then
        echo -e "${YELLOW}🔐 Obteniendo certificado wildcard con validación DNS...${NC}"
        echo -e "${YELLOW}   Certbot te pedirá agregar un registro TXT en tu DNS.${NC}"
        echo -e "${YELLOW}   Cuando aparezca el prompt, agrega el registro y presiona Enter.${NC}"
        echo ""
        
        # Obtener certificado wildcard con validación DNS manual
        # Usamos certonly en lugar de --nginx para tener más control
        sudo certbot certonly \
            --manual \
            --preferred-challenges dns \
            -d ${DOMAIN_NAME} \
            -d *.${DOMAIN_NAME} \
            --email ${EMAIL} \
            --agree-tos \
            --no-eff-email \
            --manual-public-ip-logging-ok || {
            echo ""
            echo -e "${RED}❌ No se pudo obtener el certificado wildcard.${NC}"
            echo -e "${YELLOW}⚠️  Posibles causas:${NC}"
            echo -e "   1. No se agregó el registro TXT en DNS a tiempo"
            echo -e "   2. El registro TXT no se propagó correctamente"
            echo -e "   3. Error de conexión con Let's Encrypt"
            echo ""
            echo -e "${YELLOW}💡 Puedes reintentar ejecutando:${NC}"
            echo -e "${BLUE}   sudo certbot certonly --manual --preferred-challenges dns -d ${DOMAIN_NAME} -d *.${DOMAIN_NAME}${NC}"
            echo ""
            echo -e "${YELLOW}⚠️  Continuando sin certificado SSL. Deberás configurarlo manualmente.${NC}"
            exit 1
        }
        
        echo ""
        echo -e "${GREEN}✅ Certificado wildcard obtenido exitosamente${NC}"
        
        # Configurar Nginx para usar el certificado wildcard
        echo -e "${YELLOW}⚙️  Configurando Nginx para usar el certificado wildcard...${NC}"
        sudo tee /etc/nginx/sites-available/${DOMAIN_NAME} > /dev/null <<EOF
# Redirección HTTP a HTTPS
server {
    listen 80;
    server_name ${DOMAIN_NAME} *.${DOMAIN_NAME};
    return 301 https://\$host\$request_uri;
}

# Servidor HTTPS con certificado wildcard
server {
    server_name ${DOMAIN_NAME} *.${DOMAIN_NAME};
    listen 443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/${DOMAIN_NAME}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN_NAME}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    
    # Placeholder - será reemplazado por nginx-create.conf más adelante
    location / {
        return 200 "SSL configured";
        add_header Content-Type text/plain;
    }
}
EOF
        
        # Habilitar el sitio
        sudo ln -sf /etc/nginx/sites-available/${DOMAIN_NAME} /etc/nginx/sites-enabled/${DOMAIN_NAME}
        
        # Verificar y recargar Nginx
        if sudo nginx -t; then
            sudo systemctl reload nginx
            echo -e "${GREEN}✅ Nginx configurado con certificado wildcard${NC}"
        else
            echo -e "${RED}❌ Error en la configuración de Nginx${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}✅ Certificado wildcard ya existe${NC}"
    fi

    # Limpiar configuraciones antiguas si existen (solo si usan el nombre del proyecto, no el dominio)
    if [ "${PROJECT_NAME}" != "${DOMAIN_NAME}" ]; then
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
    fi
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
    if curl -f http://localhost:5100/health >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend is healthy${NC}"
        break
    else
        echo -e "${YELLOW}⏳ Waiting for backend... (attempt $i/10)${NC}"
        sleep 10
    fi
done

# Run migrations with proper error handling
echo -e "${YELLOW}🔄 Running database migrations...${NC}"

# Check migration status
echo -e "${YELLOW}🔍 Checking migration status...${NC}"
MIGRATION_STATUS=$(docker-compose exec -T backend pnpm run migrate:status 2>&1 || echo "error")

if echo "$MIGRATION_STATUS" | grep -q "Migraciones pendientes:.*✖"; then
    echo -e "${YELLOW}🔄 Running pending migrations...${NC}"
    if docker-compose exec -T backend pnpm run migrate:up; then
        echo -e "${GREEN}✅ Migrations completed successfully${NC}"
    else
        echo -e "${RED}❌ Migration failed${NC}"
        echo -e "${YELLOW}Please check the logs and fix manually:${NC}"
        echo "  docker-compose logs backend"
        echo "  docker-compose exec backend pnpm run migrate:status"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Database is already up to date${NC}"
fi

# Verify migrations were applied correctly
echo -e "${YELLOW}🔍 Verifying migrations...${NC}"
docker-compose exec -T backend pnpm run migrate:status

# Test database connectivity
echo -e "${YELLOW}🧪 Testing database connectivity...${NC}"
# Load database credentials from .env file
DB_NAME=$(grep "^DB_NAME=" .env | cut -d'=' -f2 | tr -d '"' || echo "create")
DB_USER=$(grep "^DB_USER=" .env | cut -d'=' -f2 | tr -d '"' || echo "root")
DB_PASSWORD=$(grep "^DB_PASSWORD=" .env | cut -d'=' -f2 | tr -d '"' || echo "root")

# Use MYSQL_PWD environment variable to avoid password in command line
if docker-compose exec -T -e MYSQL_PWD="${DB_PASSWORD}" database mysql -u"${DB_USER}" -e "USE ${DB_NAME}; SELECT 1;" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Database is accessible${NC}"
else
    echo -e "${RED}❌ Database is not accessible${NC}"
    echo -e "${YELLOW}Checking database container status...${NC}"
    docker-compose ps database
    echo -e "${YELLOW}Checking database logs...${NC}"
    docker-compose logs --tail=20 database
    exit 1
fi

# Test critical endpoints to ensure migrations worked
echo -e "${YELLOW}🧪 Testing critical endpoints...${NC}"
if curl -f http://localhost:5100/health >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend health endpoint works${NC}"
else
    echo -e "${YELLOW}⚠️  Backend health endpoint check failed. Checking logs...${NC}"
    docker-compose logs --tail=20 backend
    echo -e "${YELLOW}⚠️  This may require manual intervention${NC}"
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
DB_NAME=\$(grep "^DB_NAME=" .env | cut -d'=' -f2 | tr -d '"' || echo "create")
DB_USER=\$(grep "^DB_USER=" .env | cut -d'=' -f2 | tr -d '"' || echo "root")
DB_PASSWORD=\$(grep "^DB_PASSWORD=" .env | cut -d'=' -f2 | tr -d '"' || echo "root")
docker-compose exec -T -e MYSQL_PWD="\${DB_PASSWORD}" database mysqldump -u"\${DB_USER}" "\${DB_NAME}" > \$BACKUP_DIR/db_backup_\$DATE.sql

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
    # Reemplazar variables en nginx-create.conf antes de copiarlo
    sed "s|\${NGINX_DOMAIN}|${DOMAIN_NAME}|g; s|\${NGINX_CERT_PATH}|/etc/letsencrypt/live/${DOMAIN_NAME}/fullchain.pem|g; s|\${NGINX_CERT_KEY_PATH}|/etc/letsencrypt/live/${DOMAIN_NAME}/privkey.pem|g" nginx-create.conf | sudo tee /etc/nginx/sites-available/${DOMAIN_NAME} > /dev/null
      
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
    else
        echo -e "${RED}❌ Nginx configuration error${NC}"
        echo -e "${YELLOW}⚠️  Please check nginx configuration manually${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  nginx-create.conf not found, skipping nginx update${NC}"
fi

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
echo -e "  Config:  ~/${PROJECT_NAME}/.env"
echo -e "  Logs:    ~/${PROJECT_NAME}/logs/"
echo -e "  Backups: ~/backups/"
echo ""
echo -e "${GREEN}✅ Your Create platform is now live!${NC}"
