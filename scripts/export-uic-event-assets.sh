#!/bin/bash

# Script wrapper para exportar assets de eventos UIC
# Detecta Node.js y ejecuta el script principal

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Detectar Node.js
detect_node() {
    if command -v node >/dev/null 2>&1; then
        NODE_CMD=$(command -v node)
        info "Node.js encontrado con 'command -v node': $NODE_CMD"
        if [ -x "$NODE_CMD" ]; then
            NODE_VERSION=$("$NODE_CMD" --version 2>/dev/null || echo "unknown")
            info "Node.js versión: $NODE_VERSION"
            return 0
        fi
    fi

    # Buscar en ubicaciones comunes
    for path in /usr/bin/node /usr/local/bin/node ~/.nvm/versions/node/*/bin/node; do
        if [ -x "$path" ]; then
            NODE_CMD="$path"
            info "Node.js encontrado en: $NODE_CMD"
            NODE_VERSION=$("$NODE_CMD" --version 2>/dev/null || echo "unknown")
            info "Node.js versión: $NODE_VERSION"
            return 0
        fi
    done

    error "Node.js no está instalado. Por favor, instálalo primero."
    return 1
}

# Obtener directorios
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

info "Directorio del script: $SCRIPT_DIR"
info "Directorio raíz del proyecto: $PROJECT_ROOT"

# Cambiar al directorio raíz del proyecto
cd "$PROJECT_ROOT" || { error "No se pudo cambiar al directorio raíz: $PROJECT_ROOT"; exit 1; }

# Detectar Node.js
info "Buscando Node.js..."
if ! detect_node; then
    exit 1
fi

# Determinar qué script Node.js usar (.mjs preferred)
JS_SCRIPT_MJS="$SCRIPT_DIR/export-uic-event-assets.mjs"
JS_SCRIPT_JS="$SCRIPT_DIR/export-uic-event-assets.js"
JS_SCRIPT=""

if [ -f "$JS_SCRIPT_MJS" ]; then
    JS_SCRIPT="$JS_SCRIPT_MJS"
    info "Script Node.js encontrado (mjs): $JS_SCRIPT"
elif [ -f "$JS_SCRIPT_JS" ]; then
    JS_SCRIPT="$JS_SCRIPT_JS"
    info "Script Node.js encontrado (js): $JS_SCRIPT"
else
    error "No se encontró el script Node.js: $JS_SCRIPT_MJS o $JS_SCRIPT_JS"
    error "Directorio actual: $(pwd)"
    error "Archivos en $SCRIPT_DIR:"
    ls -la "$SCRIPT_DIR" || true
    exit 1
fi

# Verificar mysql2 instalación
info "Verificando mysql2..."
MYSQL2_PATH=""
if [ -d "backend/node_modules/mysql2" ]; then
    MYSQL2_PATH="backend/node_modules/mysql2"
    info "mysql2 encontrado en backend/node_modules"
    info "mysql2 ya está instalado"
elif [ -d "node_modules/mysql2" ]; then
    MYSQL2_PATH="node_modules/mysql2"
    info "mysql2 encontrado en node_modules"
    info "mysql2 ya está instalado"
else
    warn "mysql2 no está instalado. Intentando instalar..."
    
    # Detectar gestor de paquetes
    PACKAGE_MANAGER=""
    if command -v pnpm >/dev/null 2>&1; then
        PACKAGE_MANAGER="pnpm"
    elif command -v npm >/dev/null 2>&1; then
        PACKAGE_MANAGER="npm"
    elif command -v yarn >/dev/null 2>&1; then
        PACKAGE_MANAGER="yarn"
    fi

    if [ -n "$PACKAGE_MANAGER" ]; then
        info "Instalando mysql2 en backend usando $PACKAGE_MANAGER..."
        cd backend || { error "No se pudo cambiar al directorio backend"; exit 1; }
        
        if [ "$PACKAGE_MANAGER" = "pnpm" ]; then
            "$PACKAGE_MANAGER" add mysql2 --save-dev || { error "Error al instalar mysql2"; exit 1; }
        elif [ "$PACKAGE_MANAGER" = "npm" ]; then
            "$PACKAGE_MANAGER" install mysql2 --save-dev || { error "Error al instalar mysql2"; exit 1; }
        elif [ "$PACKAGE_MANAGER" = "yarn" ]; then
            "$PACKAGE_MANAGER" add mysql2 --dev || { error "Error al instalar mysql2"; exit 1; }
        fi
        
        cd "$PROJECT_ROOT" || { error "No se pudo volver al directorio raíz"; exit 1; }
        success "mysql2 instalado correctamente"
    else
        error "No se encontró ningún gestor de paquetes (pnpm, npm, yarn)."
        error "mysql2 ya está en backend/package.json, pero no está instalado."
        error ""
        error "Por favor, instálalo manualmente:"
        error "  cd backend"
        error "  pnpm install    # o npm install, o yarn install"
        exit 1
    fi
fi

# Ejecutar el script Node.js
info "Ejecutando exportador de assets de eventos UIC..."
info "Comando: $NODE_CMD $JS_SCRIPT"
if ! "$NODE_CMD" "$JS_SCRIPT"; then
    error "Error al ejecutar el script Node.js"
    exit 1
fi

success "Script completado exitosamente"

