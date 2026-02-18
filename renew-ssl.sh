#!/bin/bash

# =============================================================================
# Script de renovación de certificado SSL (Let's Encrypt) - Opción manual DNS
# =============================================================================
#
# Este script renueva el certificado wildcard usando validación DNS manual,
# igual que en el despliegue inicial (deploy-to-server.sh).
#
# CUÁNDO USARLO:
#   - Cuando el certificado ha caducado o está próximo a caducar.
#   - Cuando certbot renew automático no pudo renovar (p. ej. no se añadió el TXT).
#
# CÓMO EJECUTARLO (en el servidor):
#   1. Conéctate al servidor por SSH (como usuario deploy o con sudo).
#   2. Ve al directorio del proyecto: cd ~/create  (o la ruta donde esté el repo).
#   3. Si es la primera vez: chmod +x renew-ssl.sh
#   4. Ejecuta: ./renew-ssl.sh
#   5. Opcional: otro dominio/email: ./renew-ssl.sh "midominio.com" "email@ejemplo.com"
#
# QUÉ HARÁ CERTBOT:
#   - Te pedirá que crees un registro TXT en tu DNS para _acme-challenge.<dominio>.
#   - Cuando aparezca el mensaje, añade ese registro en tu proveedor DNS.
#   - Espera 1-5 minutos a que propague (puedes comprobar con: dig TXT _acme-challenge.<dominio>).
#   - Pulsa Enter en la terminal cuando Certbot te lo indique.
#   - Si todo va bien, Certbot renovará el certificado y el script recargará Nginx.
#
# REQUISITOS:
#   - Certbot instalado (sudo apt install certbot python3-certbot-nginx).
#   - Permisos sudo para certbot y reload de nginx.
#
# =============================================================================

set -e

# Colores para mensajes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuración (mismos valores por defecto que deploy-to-server.sh)
DOMAIN_NAME="${1:-create.acceleralia.com}"
EMAIL="${2:-operaciones+create@acceleralia.com}"

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Renovación de certificado SSL (wildcard) - Validación DNS    ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Dominio:${NC} ${DOMAIN_NAME} (y *.${DOMAIN_NAME})"
echo -e "${YELLOW}Email:${NC}  ${EMAIL}"
echo ""
echo -e "${YELLOW}Cuando Certbot te pida un registro TXT:${NC}"
echo -e "  1. Crea el registro en tu proveedor DNS (_acme-challenge.${DOMAIN_NAME})."
echo -e "  2. Espera a que propague (1-5 min)."
echo -e "  3. Pulsa Enter cuando Certbot lo indique."
echo ""
echo -e "${BLUE}Iniciando Certbot...${NC}"
echo ""

# Renovar certificado wildcard con validación DNS manual (igual que en deploy)
sudo certbot certonly \
  --manual \
  --preferred-challenges dns \
  -d "${DOMAIN_NAME}" \
  -d "*.${DOMAIN_NAME}" \
  --email "${EMAIL}" \
  --agree-tos \
  --no-eff-email \
  --manual-public-ip-logging-ok

if [ $? -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✅ Certificado renovado correctamente.${NC}"
  echo -e "${YELLOW}Recargando Nginx para usar el nuevo certificado...${NC}"
  if sudo nginx -t 2>/dev/null; then
    sudo systemctl reload nginx
    echo -e "${GREEN}✅ Nginx recargado. El sitio ya usa el certificado nuevo.${NC}"
  else
    echo -e "${RED}⚠️  Nginx -t falló. Comprueba la configuración antes de recargar.${NC}"
    echo -e "   Certificado guardado en: /etc/letsencrypt/live/${DOMAIN_NAME}/"
  fi
  echo ""
else
  echo ""
  echo -e "${RED}❌ No se pudo renovar el certificado.${NC}"
  echo -e "${YELLOW}Comprueba:${NC}"
  echo -e "  - Que el registro TXT se creó y propagó antes de pulsar Enter."
  echo -e "  - Que el dominio apunta correctamente a este servidor (DNS)."
  echo -e "  - Los logs de Certbot si hay más detalles."
  echo ""
  exit 1
fi
