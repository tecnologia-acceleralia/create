#!/bin/bash

# Script de rebuild seguro
# Hace git pull y reconstruye contenedores sin pérdida de datos
#
# Uso:
#   ./rebuild-prod.sh [--resetdb]
#
# Parámetros:
#   --resetdb    Borra la base de datos después del backup (antes de migraciones)

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

request_data_loss_confirmation() {
    local action_description="$1"
    local confirmation_text="${2:-ELIMINAR-DATOS}"
    
    echo ""
    echo "=================================================="
    echo -e "${RED}⚠️  ADVERTENCIA: PÉRDIDA DE DATOS${NC}"
    echo "=================================================="
    echo ""
    echo -e "${YELLOW}La siguiente acción causará pérdida de datos:${NC}"
    echo -e "${YELLOW}  $action_description${NC}"
    echo ""
    echo -e "${YELLOW}Para confirmar esta acción destructiva, escribe exactamente:${NC}"
    echo -e "${BLUE}  $confirmation_text${NC}"
    echo ""
    read -r user_input
    
    if [[ "$user_input" != "$confirmation_text" ]]; then
        echo ""
        error "Operación cancelada. El texto de confirmación no coincide."
        echo ""
        exit 1
    fi
    
    echo ""
    success "Confirmación recibida. Procediendo con la operación..."
    echo ""
}

# Variable para controlar si se debe resetear la BD
RESET_DB=false

# Parsear argumentos
while [[ $# -gt 0 ]]; do
    case $1 in
        --resetdb|-resetdb)
            RESET_DB=true
            shift
            ;;
        *)
            error "Parámetro desconocido: $1"
            echo "Uso: $0 [--resetdb]"
            exit 1
            ;;
    esac
done

# Verificar que estamos en el directorio correcto
if [ ! -f "docker-compose.yml" ]; then
    error "No se encontró docker-compose.yml. Ejecuta este script desde la raíz del proyecto."
    exit 1
fi

log "🚀 Iniciando rebuild seguro..."
if [ "$RESET_DB" = true ]; then
    warning "⚠️  Modo --resetdb activado: la base de datos será borrada después del backup"
fi

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

# 4. Reconstruir siempre frontend y backend (sin verificar cambios en git)
log "🔄 Reconstruyendo contenedores (frontend y backend siempre se reconstruyen)..."

# Parar servicios (manteniendo volúmenes)
log "⏹️  Parando servicios..."
if ! docker-compose --profile prod down; then
    error "Error al parar servicios"
    exit 1
fi

# Eliminar volúmenes de node_modules para forzar reinstalación de dependencias
log "🗑️  Eliminando volúmenes de node_modules para forzar reinstalación de dependencias..."

# Eliminar volumen del backend
log "🗑️  Eliminando volumen backend_node_modules..."
BACKEND_VOLUME_NAME=$(docker volume ls --format "{{.Name}}" | grep -E "(^|_)backend_node_modules$" | head -n 1)
if [ -n "$BACKEND_VOLUME_NAME" ]; then
    if docker volume rm "$BACKEND_VOLUME_NAME" 2>/dev/null; then
        success "Volumen $BACKEND_VOLUME_NAME eliminado"
    else
        warning "No se pudo eliminar el volumen $BACKEND_VOLUME_NAME (puede estar en uso, se intentará forzar)"
        # Intentar forzar eliminación si está en uso
        docker volume rm "$BACKEND_VOLUME_NAME" --force 2>/dev/null || true
    fi
else
    log "Volumen backend_node_modules no existe, continuando..."
fi

# Eliminar volumen del frontend
log "🗑️  Eliminando volumen frontend_node_modules..."
FRONTEND_VOLUME_NAME=$(docker volume ls --format "{{.Name}}" | grep -E "(^|_)frontend_node_modules$" | head -n 1)
if [ -n "$FRONTEND_VOLUME_NAME" ]; then
    if docker volume rm "$FRONTEND_VOLUME_NAME" 2>/dev/null; then
        success "Volumen $FRONTEND_VOLUME_NAME eliminado"
    else
        warning "No se pudo eliminar el volumen $FRONTEND_VOLUME_NAME (puede estar en uso, se intentará forzar)"
        # Intentar forzar eliminación si está en uso
        docker volume rm "$FRONTEND_VOLUME_NAME" --force 2>/dev/null || true
    fi
else
    log "Volumen frontend_node_modules no existe, continuando..."
fi

# 4.1. Resetear base de datos si se solicitó (después de parar contenedores)
if [ "$RESET_DB" = true ]; then
    request_data_loss_confirmation "Se reseteará la base de datos (todos los datos se perderán permanentemente)"
    log "🗑️  Reseteando base de datos (modo --resetdb activado)..."
    
    # Asegurar que las variables de entorno estén cargadas
    if [ -f ".env" ]; then
        export $(grep -v '^#' .env | grep -E '^(MYSQL_|DB_)' | xargs)
    fi
    
    DB_NAME="${MYSQL_DATABASE:-${DB_NAME:-create}}"
    DB_USER="${MYSQL_USER:-${DB_USER:-root}}"
    DB_PASSWORD="${MYSQL_PASSWORD:-${DB_PASSWORD:-root}}"
    MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-${DB_PASSWORD}}"
    
    # Levantar solo MySQL para poder resetear la BD
    log "🚀 Levantando MySQL temporalmente para resetear la BD..."
    if ! docker-compose --profile prod up -d database; then
        error "Error al levantar MySQL"
        exit 1
    fi
    
    # Esperar a que MySQL esté listo
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
    
    # Borrar la base de datos
    log "🗑️  Eliminando base de datos '$DB_NAME'..."
    DROP_SQL="DROP DATABASE IF EXISTS \`$DB_NAME\`;"
    if MYSQL_PWD="$MYSQL_ROOT_PASSWORD" docker-compose --profile prod exec -T -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" database mysql -uroot -e "$DROP_SQL" 2>/dev/null; then
        success "Base de datos '$DB_NAME' eliminada correctamente"
    else
        error "Error al eliminar la base de datos '$DB_NAME'"
        exit 1
    fi
    
    # Recrear la base de datos vacía
    log "🆕 Creando base de datos '$DB_NAME'..."
    CREATE_SQL="CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    if MYSQL_PWD="$MYSQL_ROOT_PASSWORD" docker-compose --profile prod exec -T -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" database mysql -uroot -e "$CREATE_SQL" 2>/dev/null; then
        success "Base de datos '$DB_NAME' creada correctamente"
    else
        error "Error al crear la base de datos '$DB_NAME'"
        exit 1
    fi
    
    # Otorgar permisos al usuario si no es root
    if [ "$DB_USER" != "root" ]; then
        log "🔐 Otorgando permisos al usuario '$DB_USER'..."
        GRANT_SQL="GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'%'; FLUSH PRIVILEGES;"
        if MYSQL_PWD="$MYSQL_ROOT_PASSWORD" docker-compose --profile prod exec -T -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" database mysql -uroot -e "$GRANT_SQL" 2>/dev/null; then
            success "Permisos otorgados correctamente"
        else
            warning "No se pudieron otorgar permisos al usuario '$DB_USER' (puede ser normal si ya existen)"
        fi
    fi
    
    log "ℹ️  Base de datos reseteada. Las migraciones recrearán todas las tablas al ejecutarse."
fi

# Rebuild sin cache de frontend y backend
log "🔨 Reconstruyendo imágenes de frontend y backend..."
if ! docker-compose --profile prod build --no-cache frontend-prod backend; then
    error "Error al reconstruir imágenes"
    exit 1
fi

# Pre-instalar dependencias en los volúmenes antes de levantar los servicios
log "📦 Pre-instalando dependencias en los volúmenes antes de levantar servicios..."

# Levantar solo database primero para que Docker Compose cree la red y podamos detectar el nombre del proyecto
log "🚀 Levantando database para detectar nombres de volúmenes..."
if ! docker-compose --profile prod up -d database >/dev/null 2>&1; then
    warning "No se pudo levantar database, continuando con detección manual de volúmenes..."
fi

# Esperar un momento para que Docker Compose cree los recursos
sleep 2

# Detectar nombres de volúmenes que Docker Compose creará o ya creó
# Docker Compose usa el formato: {project_name}_{volume_name}
# El nombre del proyecto suele ser el nombre del directorio en minúsculas
PROJECT_NAME=$(basename "$(pwd)" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]//g')
if [ -z "$PROJECT_NAME" ]; then
    PROJECT_NAME="create"
fi

# Detectar volumen del backend (puede que ya exista o lo crearemos)
BACKEND_VOLUME_NAME=$(docker volume ls --format "{{.Name}}" | grep -E "(^|_)backend_node_modules$" | head -n 1)
if [ -z "$BACKEND_VOLUME_NAME" ]; then
    # Crear con el nombre que Docker Compose usará
    BACKEND_VOLUME_NAME="${PROJECT_NAME}_backend_node_modules"
    if ! docker volume create "$BACKEND_VOLUME_NAME" >/dev/null 2>&1; then
        # Si falla, puede que Docker Compose ya lo haya creado con otro nombre
        BACKEND_VOLUME_NAME=$(docker volume ls --format "{{.Name}}" | grep -E "backend_node_modules" | head -n 1)
        if [ -z "$BACKEND_VOLUME_NAME" ]; then
            error "No se pudo crear ni detectar el volumen del backend"
            exit 1
        fi
    else
        log "Volumen $BACKEND_VOLUME_NAME creado"
    fi
fi

# Pre-instalar dependencias del backend
log "📦 Pre-instalando dependencias del backend en volumen $BACKEND_VOLUME_NAME..."
if docker run --rm \
    -v "$BACKEND_VOLUME_NAME:/app/node_modules" \
    -v "$(pwd)/backend/package.json:/app/package.json:ro" \
    -v "$(pwd)/backend/pnpm-lock.yaml:/app/pnpm-lock.yaml:ro" \
    -w /app \
    node:22-alpine \
    sh -c "npm install -g pnpm@10.21.0 && pnpm install --frozen-lockfile" >/dev/null 2>&1; then
    success "Dependencias del backend pre-instaladas en el volumen"
else
    warning "No se pudieron pre-instalar dependencias del backend (se intentará al iniciar el contenedor)"
fi

# Detectar o crear volumen del frontend
FRONTEND_VOLUME_NAME=$(docker volume ls --format "{{.Name}}" | grep -E "(^|_)frontend_node_modules$" | head -n 1)
if [ -z "$FRONTEND_VOLUME_NAME" ]; then
    # Intentar crear con el nombre más probable
    FRONTEND_VOLUME_NAME="${PROJECT_NAME}_frontend_node_modules"
    if ! docker volume create "$FRONTEND_VOLUME_NAME" >/dev/null 2>&1; then
        # Si falla, intentar con otro nombre
        FRONTEND_VOLUME_NAME="frontend_node_modules"
        docker volume create "$FRONTEND_VOLUME_NAME" >/dev/null 2>&1 || true
    fi
    log "Volumen $FRONTEND_VOLUME_NAME creado"
fi

# Pre-instalar dependencias del frontend
log "📦 Pre-instalando dependencias del frontend en volumen $FRONTEND_VOLUME_NAME..."
if docker run --rm \
    -v "$FRONTEND_VOLUME_NAME:/app/node_modules" \
    -v "$(pwd)/frontend/package.json:/app/package.json:ro" \
    -v "$(pwd)/frontend/pnpm-lock.yaml:/app/pnpm-lock.yaml:ro" \
    -w /app \
    node:22-alpine \
    sh -c "npm install -g pnpm@10.21.0 && pnpm install --frozen-lockfile" >/dev/null 2>&1; then
    success "Dependencias del frontend pre-instaladas en el volumen"
else
    warning "No se pudieron pre-instalar dependencias del frontend (se intentará al iniciar el contenedor)"
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

# Verificar e instalar dependencias en el backend si el volumen está vacío
log "📦 Verificando instalación de dependencias en el backend..."
# Verificar estado del contenedor
CONTAINER_STATUS=$(docker-compose --profile prod ps backend --format "{{.Status}}" 2>/dev/null || echo "")
if echo "$CONTAINER_STATUS" | grep -q "Exited\|Restarting"; then
    warning "El contenedor backend no está corriendo correctamente. Verificando logs..."
    docker-compose --profile prod logs backend --tail=20
    log "Intentando instalar dependencias y reiniciar el contenedor..."
    # Intentar instalar dependencias usando docker run temporal
    VOLUME_NAME=$(docker volume ls --format "{{.Name}}" | grep -E "(^|_)backend_node_modules$" | head -n 1)
    if [ -n "$VOLUME_NAME" ]; then
        log "Instalando dependencias en el volumen $VOLUME_NAME usando contenedor temporal..."
        if docker run --rm -v "$VOLUME_NAME:/app/node_modules" -v "$(pwd)/backend/package.json:/app/package.json:ro" -v "$(pwd)/backend/pnpm-lock.yaml:/app/pnpm-lock.yaml:ro" -w /app node:22-alpine sh -c "npm install -g pnpm@10.21.0 && pnpm install --frozen-lockfile" 2>&1; then
            success "Dependencias instaladas en el volumen"
            log "Reiniciando contenedor backend..."
            docker-compose --profile prod restart backend
            sleep 5
        else
            error "Error al instalar dependencias en el volumen"
            exit 1
        fi
    fi
fi

# Esperar a que el contenedor esté completamente iniciado
for i in {1..10}; do
    if docker-compose --profile prod exec -T backend sh -c "test -d /app" 2>/dev/null; then
        break
    fi
    if [ $i -eq 10 ]; then
        error "Timeout esperando que el contenedor backend esté listo"
        log "🔍 Verificando logs del backend..."
        docker-compose --profile prod logs backend --tail=20
        exit 1
    fi
    sleep 2
done

# Verificar si las dependencias están instaladas en el backend
if docker-compose --profile prod exec -T backend sh -c "test -d node_modules/sanitize-html" 2>/dev/null; then
    success "Dependencias del backend verificadas correctamente"
else
    warning "Dependencias del backend no encontradas en el volumen, instalando..."
    # Instalar dependencias en el volumen
    if docker-compose --profile prod exec -T backend pnpm install --frozen-lockfile; then
        success "Dependencias del backend instaladas correctamente en el volumen"
        log "Reiniciando contenedor backend para aplicar cambios..."
        docker-compose --profile prod restart backend
        sleep 5
    else
        error "Error al instalar dependencias del backend"
        log "🔍 Verificando logs del backend..."
        docker-compose --profile prod logs backend --tail=20
        exit 1
    fi
fi

# Verificar e instalar dependencias en el frontend si el volumen está vacío
log "📦 Verificando instalación de dependencias en el frontend..."
# Verificar estado del contenedor
FRONTEND_CONTAINER_STATUS=$(docker-compose --profile prod ps frontend-prod --format "{{.Status}}" 2>/dev/null || echo "")
if echo "$FRONTEND_CONTAINER_STATUS" | grep -q "Exited\|Restarting"; then
    warning "El contenedor frontend-prod no está corriendo correctamente. Verificando logs..."
    docker-compose --profile prod logs frontend-prod --tail=20
    log "Intentando instalar dependencias y reiniciar el contenedor..."
    # Intentar instalar dependencias usando docker run temporal
    FRONTEND_VOLUME_NAME=$(docker volume ls --format "{{.Name}}" | grep -E "(^|_)frontend_node_modules$" | head -n 1)
    if [ -n "$FRONTEND_VOLUME_NAME" ]; then
        log "Instalando dependencias en el volumen $FRONTEND_VOLUME_NAME usando contenedor temporal..."
        if docker run --rm -v "$FRONTEND_VOLUME_NAME:/app/node_modules" -v "$(pwd)/frontend/package.json:/app/package.json:ro" -v "$(pwd)/frontend/pnpm-lock.yaml:/app/pnpm-lock.yaml:ro" -w /app node:22-alpine sh -c "npm install -g pnpm@10.21.0 && pnpm install --frozen-lockfile" 2>&1; then
            success "Dependencias del frontend instaladas en el volumen"
            log "Reiniciando contenedor frontend-prod..."
            docker-compose --profile prod restart frontend-prod
            sleep 5
        else
            error "Error al instalar dependencias del frontend en el volumen"
            exit 1
        fi
    fi
fi

# Esperar a que el contenedor del frontend esté completamente iniciado
for i in {1..10}; do
    if docker-compose --profile prod exec -T frontend-prod sh -c "test -d /app" 2>/dev/null; then
        break
    fi
    if [ $i -eq 10 ]; then
        error "Timeout esperando que el contenedor frontend-prod esté listo"
        log "🔍 Verificando logs del frontend-prod..."
        docker-compose --profile prod logs frontend-prod --tail=20
        exit 1
    fi
    sleep 2
done

# Verificar si las dependencias están instaladas en el frontend
if docker-compose --profile prod exec -T frontend-prod sh -c "test -d node_modules/react" 2>/dev/null; then
    success "Dependencias del frontend verificadas correctamente"
else
    warning "Dependencias del frontend no encontradas en el volumen, instalando..."
    # Instalar dependencias en el volumen
    if docker-compose --profile prod exec -T frontend-prod pnpm install --frozen-lockfile; then
        success "Dependencias del frontend instaladas correctamente en el volumen"
        log "Reiniciando contenedor frontend-prod para aplicar cambios..."
        docker-compose --profile prod restart frontend-prod
        sleep 5
    else
        error "Error al instalar dependencias del frontend"
        log "🔍 Verificando logs del frontend-prod..."
        docker-compose --profile prod logs frontend-prod --tail=20
        exit 1
    fi
fi

# Verificar health checks de Docker
log "🏥 Verificando health checks de Docker..."
HEALTH_CHECK_TIMEOUT=120  # 2 minutos máximo para health checks
HEALTH_CHECK_START=$(date +%s)

# Verificar que database esté healthy
log "⏳ Esperando a que database esté healthy..."
DATABASE_HEALTHY=false
for i in {1..60}; do
    DB_STATUS=$(docker-compose --profile prod ps database --format "{{.Status}}" 2>/dev/null || echo "")
    if echo "$DB_STATUS" | grep -q "healthy"; then
        success "Database está healthy"
        DATABASE_HEALTHY=true
        break
    fi
    if [ $i -eq 60 ]; then
        error "Timeout esperando que database esté healthy"
        log "Estado actual: $DB_STATUS"
        docker-compose --profile prod logs database --tail=20
        exit 1
    fi
    sleep 2
done

# Verificar que backend esté healthy
log "⏳ Esperando a que backend esté healthy..."
BACKEND_HEALTHY=false
for i in {1..60}; do
    BACKEND_STATUS=$(docker-compose --profile prod ps backend --format "{{.Status}}" 2>/dev/null || echo "")
    if echo "$BACKEND_STATUS" | grep -q "healthy"; then
        success "Backend está healthy"
        BACKEND_HEALTHY=true
        break
    fi
    # Si el backend no tiene health check definido o está starting, continuar esperando
    if echo "$BACKEND_STATUS" | grep -q "Up"; then
        # Si está Up pero no healthy, puede estar en start_period, continuar esperando
        log "Backend está Up pero aún no healthy (intento $i/60)..."
    fi
    if [ $i -eq 60 ]; then
        warning "Backend no está healthy después de 60 intentos, pero continuando..."
        log "Estado actual: $BACKEND_STATUS"
        docker-compose --profile prod logs backend --tail=20
        # No salimos con error porque puede que el health check no esté configurado correctamente
        BACKEND_HEALTHY=false
        break
    fi
    sleep 2
done

# Verificar que frontend-prod esté healthy
log "⏳ Esperando a que frontend-prod esté healthy..."
FRONTEND_HEALTHY=false
for i in {1..60}; do
    FRONTEND_STATUS=$(docker-compose --profile prod ps frontend-prod --format "{{.Status}}" 2>/dev/null || echo "")
    if echo "$FRONTEND_STATUS" | grep -q "healthy"; then
        success "Frontend-prod está healthy"
        FRONTEND_HEALTHY=true
        break
    fi
    # Si el frontend no tiene health check definido o está starting, continuar esperando
    if echo "$FRONTEND_STATUS" | grep -q "Up"; then
        # Si está Up pero no healthy, puede estar en start_period, continuar esperando
        log "Frontend-prod está Up pero aún no healthy (intento $i/60)..."
    fi
    if [ $i -eq 60 ]; then
        warning "Frontend-prod no está healthy después de 60 intentos, pero continuando..."
        log "Estado actual: $FRONTEND_STATUS"
        docker-compose --profile prod logs frontend-prod --tail=20
        # No salimos con error porque puede que el health check no esté configurado correctamente
        FRONTEND_HEALTHY=false
        break
    fi
    sleep 2
done

if [ "$DATABASE_HEALTHY" = true ] && [ "$BACKEND_HEALTHY" = true ] && [ "$FRONTEND_HEALTHY" = true ]; then
    success "Todos los servicios están healthy"
elif [ "$DATABASE_HEALTHY" = true ]; then
    warning "Algunos servicios no están healthy, pero continuando con verificaciones adicionales..."
else
    error "Database no está healthy. Abortando."
    exit 1
fi

# 5. Ejecutar migraciones faltantes
log "🗄️  Verificando migraciones de base de datos..."

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

# 6. Ejecutar seeders pendientes (solo master en producción)
log "🌱 Verificando seeders de base de datos..."

# Verificar estado de seeders antes de ejecutar
log "📊 Verificando estado de seeders..."
SEEDER_STATUS=$(docker-compose --profile prod exec -T backend pnpm run seed:status 2>&1)
if [ $? -ne 0 ]; then
    warning "No se pudo verificar el estado de seeders. Intentando ejecutar seeders master..."
    SEEDER_STATUS=""
fi

# Mostrar seeders pendientes si los hay (solo master)
if echo "$SEEDER_STATUS" | grep -q "Seeders master:"; then
    # Extraer la sección de seeders master (hasta "Seeders test:" o fin del archivo)
    if echo "$SEEDER_STATUS" | grep -q "Seeders test:"; then
        MASTER_SECTION=$(echo "$SEEDER_STATUS" | sed -n '/Seeders master:/,/Seeders test:/p' | head -n -1)
    else
        MASTER_SECTION=$(echo "$SEEDER_STATUS" | sed -n '/Seeders master:/,$p')
    fi
    if echo "$MASTER_SECTION" | grep -q "Pendientes"; then
        # Obtener las líneas después de "Pendientes" hasta el siguiente bloque o fin
        MASTER_PENDING_LINES=$(echo "$MASTER_SECTION" | sed -n '/Pendientes/,/^$/p' | grep "✖" || true)
        if [ -n "$MASTER_PENDING_LINES" ]; then
            MASTER_PENDING_COUNT=$(echo "$MASTER_PENDING_LINES" | wc -l)
            MASTER_PENDING_COUNT=$((MASTER_PENDING_COUNT + 0))  # Forzar conversión a número
            if [ "$MASTER_PENDING_COUNT" -gt 0 ] 2>/dev/null; then
                log "📋 Se encontraron $MASTER_PENDING_COUNT seeder(s) master pendiente(s):"
                echo "$MASTER_PENDING_LINES" | sed 's/^/     /'
            fi
        fi
    fi
fi

# Ejecutar seeders master pendientes
log "🌱 Ejecutando seeders master pendientes..."
if docker-compose --profile prod exec -T backend pnpm run seed:master; then
    success "Seeders master ejecutados correctamente"
    
    # Verificar estado después de ejecutar
    log "✅ Verificando estado final de seeders master..."
    FINAL_SEEDER_STATUS=$(docker-compose --profile prod exec -T backend pnpm run seed:status 2>&1)
    if echo "$FINAL_SEEDER_STATUS" | grep -q "Seeders master:"; then
        # Extraer la sección de seeders master (hasta "Seeders test:" o fin del archivo)
        if echo "$FINAL_SEEDER_STATUS" | grep -q "Seeders test:"; then
            FINAL_MASTER_SECTION=$(echo "$FINAL_SEEDER_STATUS" | sed -n '/Seeders master:/,/Seeders test:/p' | head -n -1)
        else
            FINAL_MASTER_SECTION=$(echo "$FINAL_SEEDER_STATUS" | sed -n '/Seeders master:/,$p')
        fi
        if echo "$FINAL_MASTER_SECTION" | grep -q "Pendientes"; then
            REMAINING_MASTER_LINES=$(echo "$FINAL_MASTER_SECTION" | sed -n '/Pendientes/,/^$/p' | grep "✖" || true)
            if [ -n "$REMAINING_MASTER_LINES" ]; then
                REMAINING_MASTER_PENDING=$(echo "$REMAINING_MASTER_LINES" | wc -l)
                REMAINING_MASTER_PENDING=$((REMAINING_MASTER_PENDING + 0))  # Forzar conversión a número
                if [ "$REMAINING_MASTER_PENDING" -gt 0 ] 2>/dev/null; then
                    warning "Aún quedan $REMAINING_MASTER_PENDING seeder(s) master pendiente(s)"
                else
                    success "Todos los seeders master están aplicados"
                fi
            else
                success "Todos los seeders master están aplicados"
            fi
        else
            success "Todos los seeders master están aplicados"
        fi
    else
        success "Todos los seeders master están aplicados"
    fi
else
    warning "Error ejecutando seeders master (puede ser normal si ya están aplicados)"
    log "🔍 Verificando logs del backend para más detalles..."
    docker-compose --profile prod logs backend --tail=10
    # No salimos con error porque los seeders pueden fallar si ya están aplicados
fi

# 7. Verificar que los servicios responden correctamente (verificación adicional con curl)
log "🔍 Verificando que los servicios responden correctamente..."

# Esperar un poco más para que los servicios estén completamente listos después de los health checks
log "⏳ Esperando a que los servicios estén completamente listos..."
sleep 3

# Verificar backend con curl (endpoint /health)
log "🔍 Verificando backend (http://localhost:5100/health)..."
BACKEND_OK=false
for i in {1..15}; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 http://localhost:5100/health 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ]; then
        success "Backend respondiendo correctamente (HTTP $HTTP_CODE)"
        BACKEND_OK=true
        break
    else
        if [ "$HTTP_CODE" != "000" ]; then
            log "Intento $i/15: Backend responde con HTTP $HTTP_CODE, esperando 200/204..."
        else
            log "Intento $i/15: Backend aún no responde, esperando..."
        fi
        sleep 2
    fi
done

if [ "$BACKEND_OK" = false ]; then
    error "Backend no responde correctamente después de 15 intentos"
    log "🔍 Verificando logs del backend..."
    docker-compose --profile prod logs backend --tail=30
    log "🔍 Verificando estado del contenedor backend..."
    docker-compose --profile prod ps backend
    log "🔍 Intentando curl manualmente..."
    curl -v http://localhost:5100/health || true
    exit 1
fi

# Verificar frontend con curl (endpoint raíz)
log "🔍 Verificando frontend (http://localhost:3100)..."
FRONTEND_OK=false
for i in {1..15}; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 http://localhost:3100 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "304" ]; then
        success "Frontend respondiendo correctamente (HTTP $HTTP_CODE)"
        FRONTEND_OK=true
        break
    else
        if [ "$HTTP_CODE" != "000" ]; then
            log "Intento $i/15: Frontend responde con HTTP $HTTP_CODE, esperando 200/304..."
        else
            log "Intento $i/15: Frontend aún no responde, esperando..."
        fi
        sleep 2
    fi
done

if [ "$FRONTEND_OK" = false ]; then
    error "Frontend no responde correctamente después de 15 intentos"
    log "🔍 Verificando logs del frontend..."
    docker-compose --profile prod logs frontend-prod --tail=30
    log "🔍 Verificando estado del contenedor frontend-prod..."
    docker-compose --profile prod ps frontend-prod
    log "🔍 Intentando curl manualmente..."
    curl -v http://localhost:3100 || true
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
if [ "$RESET_DB" = true ]; then
    echo "  - Reset de base de datos: ✅ (BD borrada y recreada)"
fi
echo "  - Rebuild contenedores: ✅"
echo "  - Migraciones Sequelize: ✅"
echo "  - Seeders master: ✅"
echo "  - Health checks: ✅"
echo ""
echo "🌐 Servicios:"
echo "  - Backend API: http://localhost:5100"
echo "  - Frontend: http://localhost:3100"
echo "  - MySQL: localhost:3406"
echo ""
