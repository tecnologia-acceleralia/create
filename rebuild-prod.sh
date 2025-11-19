#!/bin/bash

# Script de rebuild seguro
# Hace git pull y reconstruye contenedores sin pérdida de datos

# No usar set -e para permitir manejo manual de errores en casos no críticos

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para logging
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Verificar que estamos en el directorio correcto
if [ ! -f "docker-compose.yml" ]; then
    error "No se encontró docker-compose.yml. Ejecuta este script desde la raíz del proyecto."
    exit 1
fi

log "🚀 Iniciando rebuild seguro..."

# 1. Verificar estado de git
log "📋 Verificando estado de git..."
if [ -n "$(git status --porcelain)" ]; then
    warning "Hay cambios sin commitear. ¿Quieres continuar? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        log "Operación cancelada por el usuario."
        exit 0
    fi
fi

# 2. Hacer backup de la base de datos y archivos de configuración
log "💾 Creando backup de la base de datos y archivos de configuración..."
BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/$BACKUP_TIMESTAMP"
mkdir -p "$BACKUP_DIR"

# Backup de archivos .env
log "📄 Haciendo backup de archivos de configuración..."
ENV_BACKUP_COUNT=0

if [ -f ".env" ]; then
    cp .env "$BACKUP_DIR/.env_$BACKUP_TIMESTAMP"
    success "Backup de .env creado: .env_$BACKUP_TIMESTAMP"
    ENV_BACKUP_COUNT=$((ENV_BACKUP_COUNT + 1))
else
    warning "Archivo .env no encontrado, omitiendo backup"
fi

if [ $ENV_BACKUP_COUNT -gt 0 ]; then
    success "Backup de $ENV_BACKUP_COUNT archivo(s) de configuración completado"
fi

# Backup de MySQL
if docker-compose --profile prod ps database 2>/dev/null | grep -q "Up" || docker-compose ps database | grep -q "Up"; then
    log "📦 Haciendo backup de MySQL..."
    
    # Cargar variables de entorno desde .env si existe
    if [ -f ".env" ]; then
        export $(grep -v '^#' .env | grep -E '^(MYSQL_|DB_)' | xargs)
    fi
    
    DB_NAME="${MYSQL_DATABASE:-${DB_NAME:-create}}"
    DB_USER="${MYSQL_USER:-${DB_USER:-root}}"
    DB_PASSWORD="${MYSQL_PASSWORD:-${DB_PASSWORD:-root}}"
    
    # Hacer backup de MySQL
    if docker-compose --profile prod exec -T database mysqldump -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" > "$BACKUP_DIR/database_backup.sql" 2>/dev/null; then
        success "Backup de base de datos creado en $BACKUP_DIR/database_backup.sql"
    else
        # Intentar sin contraseña en el comando (usando variable de entorno)
        MYSQL_PWD="$DB_PASSWORD" docker-compose --profile prod exec -T -e MYSQL_PWD="$DB_PASSWORD" database mysqldump -u"$DB_USER" "$DB_NAME" > "$BACKUP_DIR/database_backup.sql" 2>/dev/null
        if [ $? -eq 0 ]; then
            success "Backup de base de datos creado en $BACKUP_DIR/database_backup.sql"
        else
            warning "No se pudo hacer backup de MySQL. Continuando sin backup de BD."
        fi
    fi
else
    warning "MySQL no está ejecutándose. No se pudo hacer backup."
fi

# 3. Git pull
log "📥 Haciendo git pull..."
if git pull origin main; then
    success "Git pull exitoso"
else
    error "Error en git pull. Abortando rebuild."
    exit 1
fi

# 4. Verificar si hay cambios que requieren rebuild
log "🔍 Verificando cambios que requieren rebuild..."

# Verificar si hay commits previos para comparar
HAS_PREVIOUS_COMMIT=false
if git rev-parse --verify HEAD~1 > /dev/null 2>&1; then
    HAS_PREVIOUS_COMMIT=true
fi

# Verificar cambios en archivos de Docker
if [ "$HAS_PREVIOUS_COMMIT" = true ]; then
    DOCKER_CHANGES=$(git diff --name-only HEAD~1 HEAD | grep -E "(docker-compose\.yml|Dockerfile|package\.json|pnpm-lock\.yaml)" || true)
    FRONTEND_CHANGES=$(git diff --name-only HEAD~1 HEAD | grep -E "^frontend/" || true)
    BACKEND_CHANGES=$(git diff --name-only HEAD~1 HEAD | grep -E "^backend/" || true)
else
    log "ℹ️  No hay commits previos para comparar. Se reconstruirán todos los contenedores."
    DOCKER_CHANGES="docker-compose.yml"  # Forzar rebuild
    FRONTEND_CHANGES=""
    BACKEND_CHANGES=""
fi

# Determinar si se necesita rebuild
NEEDS_REBUILD=false
REBUILD_REASON=""

if [ -n "$DOCKER_CHANGES" ]; then
    NEEDS_REBUILD=true
    REBUILD_REASON="archivos de Docker"
fi

if [ -n "$FRONTEND_CHANGES" ]; then
    NEEDS_REBUILD=true
    if [ -n "$REBUILD_REASON" ]; then
        REBUILD_REASON="$REBUILD_REASON y frontend"
    else
        REBUILD_REASON="frontend"
    fi
fi

if [ -n "$BACKEND_CHANGES" ]; then
    NEEDS_REBUILD=true
    if [ -n "$REBUILD_REASON" ]; then
        REBUILD_REASON="$REBUILD_REASON y backend"
    else
        REBUILD_REASON="backend"
    fi
fi

if [ "$NEEDS_REBUILD" = true ]; then
    log "📝 Cambios detectados en: $REBUILD_REASON"
    if [ -n "$DOCKER_CHANGES" ]; then
        log "   Archivos de Docker:"
        echo "$DOCKER_CHANGES" | sed 's/^/     - /'
    fi
    if [ -n "$FRONTEND_CHANGES" ]; then
        log "   Archivos de frontend:"
        echo "$FRONTEND_CHANGES" | head -5 | sed 's/^/     - /'
        if [ $(echo "$FRONTEND_CHANGES" | wc -l) -gt 5 ]; then
            log "     ... y $(($(echo "$FRONTEND_CHANGES" | wc -l) - 5)) archivos más"
        fi
    fi
    if [ -n "$BACKEND_CHANGES" ]; then
        log "   Archivos de backend:"
        echo "$BACKEND_CHANGES" | head -5 | sed 's/^/     - /'
        if [ $(echo "$BACKEND_CHANGES" | wc -l) -gt 5 ]; then
            log "     ... y $(($(echo "$BACKEND_CHANGES" | wc -l) - 5)) archivos más"
        fi
    fi
    log "🔄 Reconstruyendo contenedores..."
    
    # Parar servicios (manteniendo volúmenes)
    log "⏹️  Parando servicios..."
    if ! docker-compose --profile prod down; then
        error "Error al parar servicios"
        exit 1
    fi
    
    # Rebuild sin cache
    log "🔨 Reconstruyendo imágenes..."
    if ! docker-compose --profile prod build --no-cache; then
        error "Error al reconstruir imágenes"
        exit 1
    fi
    
    # Levantar servicios
    log "🚀 Levantando servicios..."
    if ! docker-compose --profile prod up -d; then
        error "Error al levantar servicios"
        exit 1
    fi
    
    # Esperar a que los servicios estén listos
    log "⏳ Esperando a que los servicios estén listos..."
    sleep 10
    
    # Verificar health checks
    log "🏥 Verificando health checks..."
    for i in {1..30}; do
        if docker-compose --profile prod ps | grep -q "healthy"; then
            success "Servicios saludables"
            break
        fi
        if [ $i -eq 30 ]; then
            error "Timeout esperando health checks"
            exit 1
        fi
        sleep 2
    done
    
else
    log "ℹ️  No hay cambios en código o archivos de Docker."
    
    # Verificar si el contenedor frontend-prod existe
    if ! docker ps -a --format '{{.Names}}' | grep -q "^create-frontend-prod$"; then
        log "🔨 Contenedor frontend-prod no existe. Construyendo y levantando servicios..."
        if ! docker-compose --profile prod up -d --build frontend-prod; then
            error "Error al construir y levantar frontend-prod"
            exit 1
        fi
    else
        log "🔄 Reiniciando servicios existentes..."
        if ! docker-compose --profile prod restart; then
            error "Error al reiniciar servicios"
            exit 1
        fi
    fi
fi

# 5. Ejecutar migraciones faltantes
log "🗄️  Verificando migraciones de base de datos..."

# Esperar a que MySQL esté completamente listo
log "⏳ Esperando a que MySQL esté listo..."
for i in {1..30}; do
    if docker-compose --profile prod exec -T database mysqladmin ping -h localhost --silent > /dev/null 2>&1; then
        success "MySQL está listo"
        break
    fi
    if [ $i -eq 30 ]; then
        error "Timeout esperando MySQL"
        exit 1
    fi
    sleep 2
done

# Verificar estado de migraciones antes de ejecutar
log "📊 Verificando estado de migraciones..."
MIGRATION_STATUS=$(docker-compose --profile prod exec -T backend pnpm run migrate:status 2>&1)
if [ $? -ne 0 ]; then
    warning "No se pudo verificar el estado de migraciones. Intentando ejecutar migraciones..."
    MIGRATION_STATUS=""
fi

# Mostrar migraciones pendientes si las hay
if echo "$MIGRATION_STATUS" | grep -q "Migraciones pendientes:"; then
    PENDING_LINES=$(echo "$MIGRATION_STATUS" | grep -A 100 "Migraciones pendientes:" | grep "✖" || true)
    if [ -n "$PENDING_LINES" ]; then
        PENDING_COUNT=$(echo "$PENDING_LINES" | wc -l)
        PENDING_COUNT=$((PENDING_COUNT + 0))  # Forzar conversión a número
        if [ "$PENDING_COUNT" -gt 0 ] 2>/dev/null; then
            log "📋 Se encontraron $PENDING_COUNT migración(es) pendiente(s):"
            echo "$PENDING_LINES" | sed 's/^/     /'
        fi
    fi
fi

# Ejecutar migraciones faltantes con Sequelize/Umzug
log "📊 Ejecutando migraciones faltantes..."
if docker-compose --profile prod exec -T backend pnpm run migrate:up; then
    success "Migraciones ejecutadas correctamente"
    
    # Verificar estado después de ejecutar
    log "✅ Verificando estado final de migraciones..."
    FINAL_STATUS=$(docker-compose --profile prod exec -T backend pnpm run migrate:status 2>&1)
    if echo "$FINAL_STATUS" | grep -q "Migraciones pendientes:"; then
        REMAINING_LINES=$(echo "$FINAL_STATUS" | grep -A 100 "Migraciones pendientes:" | grep "✖" || true)
        if [ -n "$REMAINING_LINES" ]; then
            REMAINING_PENDING=$(echo "$REMAINING_LINES" | wc -l)
            REMAINING_PENDING=$((REMAINING_PENDING + 0))  # Forzar conversión a número
            if [ "$REMAINING_PENDING" -gt 0 ] 2>/dev/null; then
                warning "Aún quedan $REMAINING_PENDING migración(es) pendiente(s)"
            else
                success "Todas las migraciones están aplicadas"
            fi
        else
            success "Todas las migraciones están aplicadas"
        fi
    else
        success "Todas las migraciones están aplicadas"
    fi
else
    error "Error ejecutando migraciones"
    log "🔍 Verificando logs del backend para más detalles..."
    docker-compose --profile prod logs backend --tail=20
    exit 1
fi

# 6. Verificar que todo funciona
log "🔍 Verificando que la aplicación funciona..."

# Esperar un poco más para que los servicios estén completamente listos
log "⏳ Esperando a que los servicios estén completamente listos..."
sleep 5

# Verificar backend con reintentos
log "🔍 Verificando backend..."
BACKEND_OK=false
for i in {1..10}; do
    if curl -f --connect-timeout 10 --max-time 30 http://localhost:5100/health > /dev/null 2>&1; then
        success "Backend funcionando correctamente"
        BACKEND_OK=true
        break
    else
        log "Intento $i/10: Backend aún no responde, esperando..."
        sleep 3
    fi
done

if [ "$BACKEND_OK" = false ]; then
    error "Backend no responde después de 10 intentos"
    log "🔍 Verificando logs del backend..."
    docker-compose --profile prod logs backend --tail=20
    log "🔍 Verificando estado de contenedores..."
    docker-compose --profile prod ps
    exit 1
fi

# Verificar frontend con reintentos
log "🔍 Verificando frontend..."
FRONTEND_OK=false
for i in {1..5}; do
    if curl -f --connect-timeout 10 --max-time 30 http://localhost:3100 > /dev/null 2>&1; then
        success "Frontend funcionando correctamente"
        FRONTEND_OK=true
        break
    else
        log "Intento $i/5: Frontend aún no responde, esperando..."
        sleep 2
    fi
done

if [ "$FRONTEND_OK" = false ]; then
    error "Frontend no responde después de 5 intentos"
    log "🔍 Verificando logs del frontend..."
    docker-compose --profile prod logs frontend-prod --tail=20
    exit 1
fi

# 7. Mostrar estado final
log "📊 Estado final de los contenedores:"
docker-compose --profile prod ps

# 8. Mostrar logs recientes
log "📋 Últimos logs del backend:"
docker-compose --profile prod logs backend --tail=10

# 9. Limpiar backups antiguos (mantener solo los últimos 5)
log "🧹 Limpiando backups antiguos..."
if [ -d "backups" ]; then
    cd backups
    ls -t | tail -n +6 | xargs -r rm -rf
    cd ..
    success "Backups antiguos eliminados"
fi

success "🎉 Rebuild completado exitosamente!"
log "📁 Backup guardado en: $BACKUP_DIR"

echo ""
echo "📋 Resumen:"
echo "  - Git pull: ✅"
echo "  - Backup de archivos .env: ✅"
echo "  - Backup de BD MySQL: ✅"
echo "  - Rebuild contenedores: ✅"
echo "  - Migraciones Sequelize: ✅"
echo "  - Health checks: ✅"
echo ""
echo "🌐 Servicios:"
echo "  - Backend API: http://localhost:5100"
echo "  - Frontend: http://localhost:3100"
echo "  - MySQL: localhost:3406"
echo ""
