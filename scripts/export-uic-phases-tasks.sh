#!/bin/bash
# Script wrapper para ejecutar el exportador de fases y tareas UIC
# Este script simplemente llama al script Node.js principal
# Compatible con Linux, macOS y Windows (Git Bash, WSL)
#
# Uso:
#   ./scripts/export-uic-phases-tasks.sh
#   O en Windows PowerShell: node scripts/export-uic-phases-tasks.js
#
# Requisitos:
#   - Node.js instalado
#   - mysql2 instalado (npm install mysql2 en backend/)
#   - Variables de entorno configuradas (ver README)

set -e  # Salir si hay algún error
set -u  # Error si se usa una variable no definida
set -o pipefail  # Error si un pipe falla

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Detectar Node.js
info "Buscando Node.js..."
NODE_CMD=""

# Intentar diferentes formas de encontrar node
if command -v node >/dev/null 2>&1; then
    NODE_CMD=$(command -v node)
    info "Node.js encontrado con 'command -v node': $NODE_CMD"
elif command -v nodejs >/dev/null 2>&1; then
    NODE_CMD=$(command -v nodejs)
    info "Node.js encontrado con 'command -v nodejs': $NODE_CMD"
elif [ -f "/c/Program Files/nodejs/node.exe" ]; then
    NODE_CMD="/c/Program Files/nodejs/node.exe"
    info "Node.js encontrado en ruta Windows: $NODE_CMD"
elif [ -f "/mnt/c/Program Files/nodejs/node.exe" ]; then
    NODE_CMD="/mnt/c/Program Files/nodejs/node.exe"
    info "Node.js encontrado en ruta WSL: $NODE_CMD"
else
    # Último intento: buscar en PATH común
    if [ -x "/usr/bin/node" ]; then
        NODE_CMD="/usr/bin/node"
        info "Node.js encontrado en /usr/bin/node"
    elif [ -x "/usr/local/bin/node" ]; then
        NODE_CMD="/usr/local/bin/node"
        info "Node.js encontrado en /usr/local/bin/node"
    fi
fi

# Verificar que Node.js está instalado
if [ -z "$NODE_CMD" ]; then
    error "Node.js no está instalado. Por favor, instálalo primero."
    error ""
    error "Puedes verificar con: which node"
    error "O ejecutar directamente: node scripts/export-uic-phases-tasks.js"
    exit 1
fi

# Verificar que el comando funciona
if ! "$NODE_CMD" --version >/dev/null 2>&1; then
    error "Node.js encontrado pero no funciona: $NODE_CMD"
    error "Intenta ejecutar: $NODE_CMD --version"
    exit 1
fi

NODE_VERSION=$("$NODE_CMD" --version)
info "Node.js versión: $NODE_VERSION"

# Obtener directorio del script (compatible con diferentes shells)
if [ -n "${BASH_SOURCE:-}" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
elif [ -n "${ZSH_VERSION:-}" ]; then
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
else
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

info "Directorio del script: $SCRIPT_DIR"
info "Directorio raíz del proyecto: $PROJECT_ROOT"

# Cambiar al directorio raíz del proyecto
cd "$PROJECT_ROOT" || {
    error "No se pudo cambiar al directorio raíz: $PROJECT_ROOT"
    exit 1
}

# Verificar que el script Node.js existe
info "Verificando script Node.js..."
MJS_SCRIPT="$SCRIPT_DIR/export-uic-phases-tasks.mjs"
JS_SCRIPT="$SCRIPT_DIR/export-uic-phases-tasks.js"

# Preferir .mjs si existe (ES modules), sino usar .js
if [ -f "$MJS_SCRIPT" ]; then
    JS_SCRIPT="$MJS_SCRIPT"
    info "Script Node.js encontrado (mjs): $JS_SCRIPT"
elif [ -f "$JS_SCRIPT" ]; then
    info "Script Node.js encontrado: $JS_SCRIPT"
else
    error "No se encontró el script Node.js: $JS_SCRIPT o $MJS_SCRIPT"
    error "Directorio actual: $(pwd)"
    error "Archivos en $SCRIPT_DIR:"
    ls -la "$SCRIPT_DIR" || true
    exit 1
fi

# Verificar que mysql2 está instalado
info "Verificando mysql2..."
MYSQL2_FOUND=false
if [ -d "backend/node_modules/mysql2" ]; then
    info "mysql2 encontrado en backend/node_modules"
    MYSQL2_FOUND=true
elif [ -d "node_modules/mysql2" ]; then
    info "mysql2 encontrado en node_modules"
    MYSQL2_FOUND=true
fi

if [ "$MYSQL2_FOUND" = false ]; then
    warn "mysql2 no está instalado. Intentando instalar..."
    
    # Buscar gestor de paquetes (pnpm, npm, yarn)
    PKG_MANAGER=""
    PKG_CMD=""
    
    info "Buscando gestor de paquetes..."
    
    # Buscar pnpm
    if command -v pnpm >/dev/null 2>&1; then
        PKG_MANAGER="pnpm"
        PKG_CMD=$(command -v pnpm)
        info "pnpm encontrado: $PKG_CMD"
    elif [ -x "/usr/bin/pnpm" ]; then
        PKG_MANAGER="pnpm"
        PKG_CMD="/usr/bin/pnpm"
        info "pnpm encontrado en /usr/bin/pnpm"
    elif [ -x "/usr/local/bin/pnpm" ]; then
        PKG_MANAGER="pnpm"
        PKG_CMD="/usr/local/bin/pnpm"
        info "pnpm encontrado en /usr/local/bin/pnpm"
    fi
    
    # Si no hay pnpm, buscar npm
    if [ -z "$PKG_CMD" ]; then
        if command -v npm >/dev/null 2>&1; then
            PKG_MANAGER="npm"
            PKG_CMD=$(command -v npm)
            info "npm encontrado: $PKG_CMD"
        elif [ -x "/usr/bin/npm" ]; then
            PKG_MANAGER="npm"
            PKG_CMD="/usr/bin/npm"
            info "npm encontrado en /usr/bin/npm"
        elif [ -x "/usr/local/bin/npm" ]; then
            PKG_MANAGER="npm"
            PKG_CMD="/usr/local/bin/npm"
            info "npm encontrado en /usr/local/bin/npm"
        fi
    fi
    
    # Si no hay pnpm ni npm, buscar yarn
    if [ -z "$PKG_CMD" ]; then
        if command -v yarn >/dev/null 2>&1; then
            PKG_MANAGER="yarn"
            PKG_CMD=$(command -v yarn)
            info "yarn encontrado: $PKG_CMD"
        elif [ -x "/usr/bin/yarn" ]; then
            PKG_MANAGER="yarn"
            PKG_CMD="/usr/bin/yarn"
            info "yarn encontrado en /usr/bin/yarn"
        elif [ -x "/usr/local/bin/yarn" ]; then
            PKG_MANAGER="yarn"
            PKG_CMD="/usr/local/bin/yarn"
            info "yarn encontrado en /usr/local/bin/yarn"
        fi
    fi
    
    # Último intento: usar node para ejecutar npm
    if [ -z "$PKG_CMD" ]; then
        info "Intentando usar npm a través de node..."
        if "$NODE_CMD" -e "require('child_process').execSync('npm --version', {stdio: 'pipe'})" >/dev/null 2>&1; then
            PKG_MANAGER="npm"
            PKG_CMD="node_npm_wrapper"
            info "npm disponible a través de node"
        fi
    fi
    
    if [ -n "$PKG_CMD" ]; then
        info "Instalando mysql2 usando $PKG_MANAGER..."
        if [ -f "backend/package.json" ]; then
            info "Instalando mysql2 en backend..."
            cd backend || exit 1
            if [ "$PKG_CMD" = "node_npm_wrapper" ]; then
                # Usar node para ejecutar npm
                if ! "$NODE_CMD" -e "require('child_process').execSync('npm install mysql2', {stdio: 'inherit', cwd: process.cwd()})"; then
                    error "Error al instalar mysql2 con npm (a través de node)"
                    exit 1
                fi
            elif [ "$PKG_MANAGER" = "pnpm" ]; then
                if ! "$PKG_CMD" install mysql2; then
                    error "Error al instalar mysql2 con pnpm"
                    exit 1
                fi
            elif [ "$PKG_MANAGER" = "yarn" ]; then
                if ! "$PKG_CMD" add mysql2; then
                    error "Error al instalar mysql2 con yarn"
                    exit 1
                fi
            else
                if ! "$PKG_CMD" install mysql2; then
                    error "Error al instalar mysql2 con npm"
                    exit 1
                fi
            fi
            cd .. || exit 1
        else
            info "Instalando mysql2 en raíz..."
            if [ "$PKG_CMD" = "node_npm_wrapper" ]; then
                # Usar node para ejecutar npm
                if ! "$NODE_CMD" -e "require('child_process').execSync('npm install mysql2', {stdio: 'inherit'})"; then
                    error "Error al instalar mysql2 con npm (a través de node)"
                    exit 1
                fi
            elif [ "$PKG_MANAGER" = "pnpm" ]; then
                if ! "$PKG_CMD" install mysql2; then
                    error "Error al instalar mysql2 con pnpm"
                    exit 1
                fi
            elif [ "$PKG_MANAGER" = "yarn" ]; then
                if ! "$PKG_CMD" add mysql2; then
                    error "Error al instalar mysql2 con yarn"
                    exit 1
                fi
            else
                if ! "$PKG_CMD" install mysql2; then
                    error "Error al instalar mysql2 con npm"
                    exit 1
                fi
            fi
        fi
        info "mysql2 instalado correctamente"
    else
        error "No se encontró ningún gestor de paquetes (pnpm, npm, yarn)."
        error "mysql2 ya está en backend/package.json, pero no está instalado."
        error ""
        error "Por favor, instálalo manualmente:"
        if [ -f "backend/package.json" ]; then
            error "  cd backend"
            error "  npm install    # o pnpm install, o yarn install"
            error ""
            error "O instala solo mysql2:"
            error "  cd backend"
            error "  npm install mysql2"
        else
            error "  npm install mysql2    # o pnpm install mysql2, o yarn add mysql2"
        fi
        error ""
        error "Si npm no está en el PATH, prueba:"
        error "  which npm"
        error "  /usr/bin/npm --version"
        exit 1
    fi
else
    info "mysql2 ya está instalado"
fi

# Ejecutar el script Node.js
info "Ejecutando exportador de fases y tareas UIC..."
info "Comando: $NODE_CMD $JS_SCRIPT"

if ! "$NODE_CMD" "$JS_SCRIPT"; then
    error "Error al ejecutar el script Node.js"
    exit 1
fi

info "Script completado exitosamente"

