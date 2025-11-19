#!/bin/bash

# Script de configuracion y arranque del entorno de desarrollo CREATE Platform.
#
# Este script automatiza la configuracion completa del entorno de desarrollo:
# - Sincroniza cambios desde Git (opcional)
# - Crea backups de configuracion (opcional)
# - Instala dependencias locales (backend y frontend)
# - Gestiona dependencias Docker con sincronizacion inteligente
# - Inicializa/configura la base de datos
# - Ejecuta migraciones y seeders
# - Arranca los contenedores Docker
#
# El script incluye proteccion contra bloqueos EPERM deteniendo automaticamente
# contenedores Docker y procesos de pnpm antes de instalar dependencias.
#
# PARAMETROS:
#   -Fresh               Modo de instalacion limpia:
#                        - Elimina archivos lock (pnpm-lock.yaml)
#                        - Detiene y elimina todos los contenedores Docker
#                        - Reinstala todas las dependencias desde cero
#                        - Reconstruye las imagenes Docker
#                        - Si se combina con -ResetDB, tambien elimina el volumen de la base de datos
#
#   -ResetDB             Resetea completamente la base de datos:
#                        - Elimina y recrea la base de datos
#                        - Ejecuta migraciones desde cero
#                        - Ejecuta todos los seeders (master + test)
#                        - Solo tiene efecto si se usa con -Fresh o si la base de datos ya existe
#
#   -SkipBackup          Omite la creacion del backup automatico antes de sincronizar cambios.
#                        Los backups incluyen archivos .env y dump de la base de datos si esta disponible.
#
#   -SkipGit             Omite todas las operaciones de Git (fetch, pull, deteccion de cambios).
#                        Util cuando trabajas offline o con cambios locales que no quieres sincronizar.
#
#   -ForceBuild          Fuerza el rebuild de las imagenes Docker aunque no se detecten cambios.
#                        Util cuando necesitas reconstruir las imagenes sin modificar archivos.
#
# EJEMPLOS:
#   ./start-development.sh
#     Ejecuta el flujo normal: sincroniza Git, crea backup, instala dependencias y arranca contenedores.
#
#   ./start-development.sh -Fresh
#     Instalacion limpia completa: elimina locks, reconstruye todo desde cero.
#
#   ./start-development.sh -Fresh -ResetDB
#     Instalacion limpia + reset completo de base de datos.
#
#   ./start-development.sh -SkipBackup -SkipGit
#     Ejecucion rapida sin backups ni operaciones Git.
#
#   ./start-development.sh -ForceBuild
#     Fuerza el rebuild de las imagenes Docker aunque no haya cambios detectados.
#
# REQUISITOS:
#   - Docker y Docker Compose instalados y ejecutandose
#   - pnpm instalado globalmente
#   - Acceso a Git remoto (a menos que uses -SkipGit)
#   - El script debe ejecutarse desde la raiz del proyecto

set -euo pipefail

# Parsear argumentos
FRESH=false
RESET_DB=false
SKIP_BACKUP=false
SKIP_GIT=false
FORCE_BUILD=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -Fresh|--Fresh)
            FRESH=true
            shift
            ;;
        -ResetDB|--ResetDB)
            RESET_DB=true
            shift
            ;;
        -SkipBackup|--SkipBackup)
            SKIP_BACKUP=true
            shift
            ;;
        -SkipGit|--SkipGit)
            SKIP_GIT=true
            shift
            ;;
        -ForceBuild|--ForceBuild)
            FORCE_BUILD=true
            shift
            ;;
        *)
            echo "Error: Opcion desconocida: $1"
            echo "Usa --help para ver las opciones disponibles"
            exit 1
            ;;
    esac
done

# Variables globales
SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_ROOT"
PROJECT_NAME="$(basename "$SCRIPT_ROOT")"
STATE_DIRECTORY="$SCRIPT_ROOT/.docker-state"

# Funciones de utilidad
write_info() {
    echo "[INFO] $1"
}

write_error() {
    echo "[ERROR] $1" >&2
}

initialize_state_directory() {
    if [[ ! -d "$STATE_DIRECTORY" ]]; then
        mkdir -p "$STATE_DIRECTORY"
    fi
}

get_file_hash_value() {
    local file_path="$1"
    
    if [[ ! -f "$file_path" ]]; then
        write_error "No se encontro el archivo para calcular hash: $file_path"
        exit 1
    fi
    
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$file_path" | cut -d' ' -f1 | tr '[:upper:]' '[:lower:]'
    elif command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "$file_path" | cut -d' ' -f1 | tr '[:upper:]' '[:lower:]'
    else
        write_error "No se encontro herramienta para calcular hash (sha256sum o shasum)"
        exit 1
    fi
}

test_docker_volume_exists() {
    local volume_name="$1"
    local project_name="$2"
    
    local candidates=()
    if [[ -n "$volume_name" ]]; then
        candidates+=("$volume_name")
    fi
    if [[ -n "$project_name" ]]; then
        candidates+=("${project_name}_${volume_name}")
    fi
    
    for candidate in "${candidates[@]}"; do
        if [[ -z "$candidate" ]]; then
            continue
        fi
        if docker volume ls --quiet --filter "name=$candidate" 2>/dev/null | grep -q .; then
            return 0
        fi
    done
    
    return 1
}

update_docker_dependencies() {
    local service_name="$1"
    local volume_name="$2"
    local lock_file_path="$3"
    local hash_file_name="$4"
    shift 4
    local install_command_args=("$@")
    
    initialize_state_directory
    
    local volume_exists=false
    if test_docker_volume_exists "$volume_name" "$PROJECT_NAME"; then
        volume_exists=true
    fi
    
    local current_hash
    current_hash=$(get_file_hash_value "$lock_file_path")
    local hash_file_path="$STATE_DIRECTORY/$hash_file_name"
    local stored_hash=""
    
    if [[ -f "$hash_file_path" ]]; then
        stored_hash=$(cat "$hash_file_path" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')
    fi
    
    local needs_install=false
    local reason=""
    
    if [[ "$volume_exists" == false ]]; then
        needs_install=true
        reason="el volumen '$volume_name' no existe"
    elif [[ "$stored_hash" != "$current_hash" ]]; then
        needs_install=true
        reason="se detectaron cambios en $lock_file_path"
    fi
    
    if [[ "$needs_install" == true ]]; then
        if [[ -n "$reason" ]]; then
            write_info "Reinstalando dependencias de Docker para '$service_name' porque $reason"
        else
            write_info "Reinstalando dependencias de Docker para '$service_name'"
        fi
        invoke_cli docker "${install_command_args[@]}"
        echo "$current_hash" > "$hash_file_path"
    else
        write_info "Dependencias Docker para '$service_name' ya estan sincronizadas"
    fi
}

invoke_cli() {
    local command="$1"
    shift
    local arguments=("$@")
    
    local processed_arguments=("${arguments[@]}")
    
    if [[ "$command" == "docker" && ${#arguments[@]} -gt 0 && "${arguments[0]}" == "compose" ]]; then
        local has_env_file=false
        for arg in "${arguments[@]}"; do
            if [[ "$arg" == "--env-file" ]]; then
                has_env_file=true
                break
            fi
        done
        
        if [[ "$has_env_file" == false ]]; then
            local env_file="$SCRIPT_ROOT/.env"
            if [[ -f "$env_file" ]]; then
                local remaining_args=()
                if [[ ${#arguments[@]} -gt 1 ]]; then
                    remaining_args=("${arguments[@]:1}")
                fi
                processed_arguments=("compose" "--env-file" "$env_file" "${remaining_args[@]}")
            fi
        fi
    fi
    
    write_info "$command ${processed_arguments[*]}"
    "$command" "${processed_arguments[@]}"
}

invoke_cli_output() {
    local command="$1"
    shift
    local arguments=("$@")
    
    local processed_arguments=("${arguments[@]}")
    
    if [[ "$command" == "docker" && ${#arguments[@]} -gt 0 && "${arguments[0]}" == "compose" ]]; then
        local has_env_file=false
        for arg in "${arguments[@]}"; do
            if [[ "$arg" == "--env-file" ]]; then
                has_env_file=true
                break
            fi
        done
        
        if [[ "$has_env_file" == false ]]; then
            local env_file="$SCRIPT_ROOT/.env"
            if [[ -f "$env_file" ]]; then
                local remaining_args=()
                if [[ ${#arguments[@]} -gt 1 ]]; then
                    remaining_args=("${arguments[@]:1}")
                fi
                processed_arguments=("compose" "--env-file" "$env_file" "${remaining_args[@]}")
            fi
        fi
    fi
    
    local result
    result=$("$command" "${processed_arguments[@]}" 2>&1)
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        write_error "$command failed with exit code $exit_code"
        exit 1
    fi
    echo "$result"
}

remove_project_docker_resources() {
    local project_name="$1"
    
    if [[ -z "$project_name" ]]; then
        return
    fi
    
    write_info "Eliminando recursos Docker del proyecto '$project_name'"
    
    # Eliminar volúmenes
    local volumes
    volumes=$(docker volume ls --filter "label=com.docker.compose.project=$project_name" --format "{{.Name}}" 2>/dev/null || true)
    if [[ -n "$volumes" ]]; then
        while IFS= read -r volume; do
            if [[ -n "$volume" ]]; then
                write_info "Eliminando volumen: $volume"
                docker volume rm -f "$volume" 2>/dev/null || write_info "No se pudo eliminar el volumen '$volume'"
            fi
        done <<< "$volumes"
    fi
    
    # Eliminar redes
    local networks
    networks=$(docker network ls --filter "label=com.docker.compose.project=$project_name" --format "{{.Name}}" 2>/dev/null || true)
    if [[ -n "$networks" ]]; then
        while IFS= read -r network; do
            if [[ -n "$network" ]]; then
                write_info "Eliminando red: $network"
                docker network rm "$network" 2>/dev/null || write_info "No se pudo eliminar la red '$network'"
            fi
        done <<< "$networks"
    fi
}

get_env_file_values() {
    local file_path="$1"
    
    if [[ ! -f "$file_path" ]]; then
        write_error "No se encontro el archivo de entorno: $file_path"
        exit 1
    fi
    
    declare -A values
    while IFS= read -r line || [[ -n "$line" ]]; do
        line=$(echo "$line" | xargs)
        if [[ -z "$line" || "$line" =~ ^# ]]; then
            continue
        fi
        if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
            local key="${BASH_REMATCH[1]}"
            local value="${BASH_REMATCH[2]}"
            key=$(echo "$key" | xargs)
            value=$(echo "$value" | xargs)
            if [[ "$value" =~ ^\"(.*)\"$ ]]; then
                value="${BASH_REMATCH[1]}"
            fi
            values["$key"]="$value"
        fi
    done < "$file_path"
    
    # Exportar valores como variables de entorno temporales
    for key in "${!values[@]}"; do
        export "${key}=${values[$key]}"
    fi
}

wait_for_database() {
    local root_password="$1"
    local retries="${2:-30}"
    local delay_seconds="${3:-2}"
    
    for ((attempt=1; attempt<=retries; attempt++)); do
        if docker compose exec -T database env MYSQL_PWD="$root_password" mysqladmin ping -h localhost -uroot >/dev/null 2>&1; then
            return 0
        fi
        if [[ $attempt -eq $retries ]]; then
            write_error "La base de datos no respondio despues de $retries intentos"
            exit 1
        fi
        sleep "$delay_seconds"
    done
}

initialize_database() {
    local env_file_path="$SCRIPT_ROOT/.env"
    
    if [[ ! -f "$env_file_path" ]]; then
        write_error "No se encontro el archivo .env"
        exit 1
    fi
    
    # Cargar variables de entorno
    source <(grep -v '^#' "$env_file_path" | grep '=' | sed 's/^/export /')
    
    local root_password="${MYSQL_ROOT_PASSWORD:-}"
    if [[ -z "$root_password" ]]; then
        write_error "Falta MYSQL_ROOT_PASSWORD en .env"
        exit 1
    fi
    
    local db_name="${DB_NAME:-${MYSQL_DATABASE:-}}"
    if [[ -z "$db_name" ]]; then
        write_error "Falta DB_NAME o MYSQL_DATABASE en .env"
        exit 1
    fi
    
    local db_user="${DB_USER:-${MYSQL_USER:-}}"
    local db_password="${DB_PASSWORD:-${MYSQL_PASSWORD:-}}"
    
    write_info "Esperando a que la base de datos este lista"
    wait_for_database "$root_password"
    
    write_info "Creando base de datos '$db_name' si no existe"
    local create_database_sql="CREATE DATABASE IF NOT EXISTS \`$db_name\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    invoke_cli docker compose exec -T database env MYSQL_PWD="$root_password" mysql -uroot -e "$create_database_sql"
    
    if [[ -n "$db_user" && -n "$db_password" ]]; then
        write_info "Asegurando usuario '$db_user'"
        local escaped_password="${db_password//\'/\'\'}"
        local grant_sql="CREATE USER IF NOT EXISTS '$db_user'@'%' IDENTIFIED BY '$escaped_password';
ALTER USER '$db_user'@'%' IDENTIFIED BY '$escaped_password';
GRANT ALL PRIVILEGES ON \`$db_name\`.* TO '$db_user'@'%';
FLUSH PRIVILEGES;"
        invoke_cli docker compose exec -T database env MYSQL_PWD="$root_password" mysql -uroot -e "$grant_sql"
    fi
}

reset_database() {
    local env_file_path="$SCRIPT_ROOT/.env"
    
    if [[ ! -f "$env_file_path" ]]; then
        write_error "No se encontro el archivo .env"
        exit 1
    fi
    
    # Cargar variables de entorno
    source <(grep -v '^#' "$env_file_path" | grep '=' | sed 's/^/export /')
    
    write_info "Reseteando base de datos (eliminando y recreando)"
    
    local root_password="${MYSQL_ROOT_PASSWORD:-}"
    if [[ -z "$root_password" ]]; then
        write_error "Falta MYSQL_ROOT_PASSWORD en .env"
        exit 1
    fi
    
    local db_name="${DB_NAME:-${MYSQL_DATABASE:-}}"
    if [[ -z "$db_name" ]]; then
        write_error "Falta DB_NAME o MYSQL_DATABASE en .env"
        exit 1
    fi
    
    write_info "Esperando a que la base de datos este lista"
    wait_for_database "$root_password"
    
    write_info "Eliminando base de datos '$db_name' si existe"
    local drop_database_sql="DROP DATABASE IF EXISTS \`$db_name\`;"
    if ! invoke_cli docker compose exec -T database env MYSQL_PWD="$root_password" mysql -uroot -e "$drop_database_sql" 2>/dev/null; then
        write_info "No se pudo eliminar la base de datos (puede que no exista)"
    fi
    
    initialize_database
}

invoke_migrations() {
    write_info "Ejecutando migraciones pendientes"
    invoke_cli docker compose exec -T backend pnpm run migrate:up
}

invoke_seeders() {
    write_info "Ejecutando seeders master"
    invoke_cli docker compose exec -T backend pnpm run seed:master
    
    write_info "Ejecutando seeders de prueba"
    invoke_cli docker compose exec -T backend pnpm run seed:test
}

get_seeders_status() {
    local raw_output
    raw_output=$(invoke_cli_output docker compose exec -T backend node src/scripts/db.js seed:status --json 2>/dev/null || echo "")
    
    if [[ -z "$raw_output" ]]; then
        echo "{}"
        return
    fi
    
    # Intentar parsear JSON
    if command -v jq >/dev/null 2>&1; then
        echo "$raw_output" | jq -r '.' 2>/dev/null || echo "{}"
    else
        # Fallback: buscar primera línea que parezca JSON
        while IFS= read -r line; do
            if [[ -n "$line" && "$line" =~ ^\{ ]]; then
                echo "$line"
                return
            fi
        done <<< "$raw_output"
        echo "{}"
    fi
}

invoke_seeders_if_pending() {
    local force="${1:-false}"
    
    local status
    status=$(get_seeders_status)
    
    if [[ "$force" == "true" || "$status" == "{}" || -z "$status" ]]; then
        if [[ "$status" == "{}" || -z "$status" ]]; then
            write_info "Estado de seeders no disponible. Ejecutando seeders por defecto."
        fi
        invoke_seeders
        return
    fi
    
    # Verificar si hay seeders pendientes usando jq si está disponible
    local has_pending=false
    if command -v jq >/dev/null 2>&1; then
        if echo "$status" | jq -e '.[] | select(.pending != null and (.pending | length) > 0)' >/dev/null 2>&1; then
            has_pending=true
        fi
    else
        # Fallback: si contiene "pending" probablemente hay pendientes
        if echo "$status" | grep -q "pending"; then
            has_pending=true
        fi
    fi
    
    if [[ "$force" == "true" || "$has_pending" == "true" ]]; then
        if [[ "$force" != "true" ]]; then
            write_info "Seeders pendientes detectados. Ejecutando seeders."
        fi
        invoke_seeders
    else
        write_info "Seeders ya aplicados. No se ejecutan nuevas semillas."
    fi
}

get_generated_passwords() {
    local raw_output
    raw_output=$(invoke_cli_output docker compose exec -T backend node src/scripts/show-passwords.js 2>/dev/null || echo "")
    
    if [[ -z "$raw_output" ]]; then
        echo "{}"
        return
    fi
    
    # Buscar contenido JSON
    local json_content=""
    while IFS= read -r line; do
        if [[ -n "$line" && "$line" =~ ^\{ ]]; then
            json_content="$line"
            break
        fi
    done <<< "$raw_output"
    
    if [[ -z "$json_content" || "$json_content" == "{}" ]]; then
        echo "{}"
        return
    fi
    
    echo "$json_content"
}

write_environment_summary() {
    echo ""
    echo "=================================================="
    echo " create Platform lista"
    echo "=================================================="
    echo "Frontend:      http://localhost:3100/demo"
    echo "Login tenant:  http://localhost:3100/demo/login"
    echo "Backend API:   http://localhost:5100/api"
    echo ""
    
    local passwords_json
    passwords_json=$(get_generated_passwords)
    
    if [[ -n "$passwords_json" && "$passwords_json" != "{}" ]]; then
        echo "Credenciales:"
        echo ""
        
        # Superadmin
        if command -v jq >/dev/null 2>&1; then
            local superadmin_email="superadmin@create.dev"
            local superadmin_password
            superadmin_password=$(echo "$passwords_json" | jq -r ".[\"$superadmin_email\"].password // empty" 2>/dev/null || echo "")
            if [[ -n "$superadmin_password" ]]; then
                echo "Superadmin global:"
                echo "  - Acceso:     http://localhost:3100/superadmin"
                echo "  - Email:      $superadmin_email"
                echo "  - Password:   $superadmin_password"
                echo ""
            fi
            
            # Demo tenant
            echo "Credenciales de demo (tenant 'demo'):"
            echo "$passwords_json" | jq -r 'to_entries[] | select(.key | contains("@demo.com")) | "  - \(.key)\(if .value.role then " (\(.value.role))" else "" end) / \(.value.password)"' 2>/dev/null || true
            echo ""
            
            # UIC tenant
            local has_uic=false
            echo "$passwords_json" | jq -r 'to_entries[] | select(.key | contains("@uic.")) | .key' 2>/dev/null | while read -r uic_user; do
                if [[ -n "$uic_user" && "$has_uic" == false ]]; then
                    echo "Tenant UIC:"
                    echo "  - Frontend:   http://localhost:3100/uic"
                    has_uic=true
                fi
                if [[ -n "$uic_user" ]]; then
                    local uic_role
                    uic_role=$(echo "$passwords_json" | jq -r ".[\"$uic_user\"].role // empty" 2>/dev/null || echo "")
                    local uic_password
                    uic_password=$(echo "$passwords_json" | jq -r ".[\"$uic_user\"].password // empty" 2>/dev/null || echo "")
                    if [[ -n "$uic_role" ]]; then
                        echo "  - $uic_user ($uic_role) / $uic_password"
                    else
                        echo "  - $uic_user / $uic_password"
                    fi
                fi
            done
            if echo "$passwords_json" | jq -e 'to_entries[] | select(.key | contains("@uic."))' >/dev/null 2>&1; then
                echo ""
            fi
        else
            # Fallback sin jq: mostrar todo el JSON
            echo "$passwords_json"
            echo ""
        fi
    fi
    
    echo "=================================================="
}

new_backup() {
    local backup_dir="$SCRIPT_ROOT/backups"
    if [[ ! -d "$backup_dir" ]]; then
        write_info "Creating backups directory"
        mkdir -p "$backup_dir"
    fi
    
    local timestamp
    timestamp=$(date +"%Y%m%d-%H%M%S")
    local backup_path="$backup_dir/create-backup-$timestamp.zip"
    local database_dump_local_path=""
    local container_dump_path=""
    
    write_info "Creating backup at $backup_path"
    
    local should_dump_database=false
    
    # Verificar si el contenedor de base de datos está corriendo
    if docker compose --profile dev ps --services --filter "status=running" 2>/dev/null | grep -q "^database$"; then
        should_dump_database=true
    else
        write_info "El contenedor 'database' no esta en ejecucion. Se omitira el backup de la base de datos."
    fi
    
    if [[ "$should_dump_database" == true ]]; then
        local env_file_path="$SCRIPT_ROOT/.env"
        if [[ ! -f "$env_file_path" ]]; then
            write_info "No se pudo leer .env. Se omitira el backup de la base de datos."
            should_dump_database=false
        else
            # Cargar variables de entorno
            source <(grep -v '^#' "$env_file_path" | grep '=' | sed 's/^/export /')
            
            local root_password="${MYSQL_ROOT_PASSWORD:-}"
            if [[ -z "$root_password" ]]; then
                write_info "Falta MYSQL_ROOT_PASSWORD en .env. Se omitira el backup de la base de datos."
                should_dump_database=false
            else
                local db_name="${DB_NAME:-${MYSQL_DATABASE:-}}"
                if [[ -z "$db_name" ]]; then
                    write_info "Falta DB_NAME o MYSQL_DATABASE en .env. Se omitira el backup de la base de datos."
                    should_dump_database=false
                else
                    container_dump_path="/tmp/db-backup-$timestamp.sql"
                    database_dump_local_path="$SCRIPT_ROOT/db-backup-$timestamp.sql"
                    
                    write_info "Generando backup de la base de datos '$db_name'"
                    invoke_cli docker compose exec -T database env MYSQL_PWD="$root_password" mysqldump -uroot --single-transaction --routines --events --databases "$db_name" --result-file="$container_dump_path"
                    invoke_cli docker compose cp "database:$container_dump_path" "$database_dump_local_path"
                    invoke_cli docker compose exec -T database rm -f "$container_dump_path"
                fi
            fi
        fi
    fi
    
    # Crear archivo temporal con lista de archivos a incluir
    local temp_list
    temp_list=$(mktemp)
    
    # Buscar archivos .env
    find "$SCRIPT_ROOT" -maxdepth 1 -name ".env*" -type f -print >> "$temp_list" 2>/dev/null || true
    
    # Agregar dump de base de datos si existe
    if [[ -n "$database_dump_local_path" && -f "$database_dump_local_path" ]]; then
        echo "$database_dump_local_path" >> "$temp_list"
    fi
    
    # Verificar si hay archivos para incluir
    if [[ ! -s "$temp_list" ]]; then
        write_info "No se encontraron ficheros .env ni dump de base de datos para incluir en el backup"
        rm -f "$temp_list"
        return
    fi
    
    # Crear zip
    if command -v zip >/dev/null 2>&1; then
        cd "$SCRIPT_ROOT"
        zip -q -j "$backup_path" $(cat "$temp_list") 2>/dev/null || {
            write_info "Error al crear el archivo zip. Intentando con tar..."
            rm -f "$backup_path"
            local tar_backup_path="${backup_path%.zip}.tar.gz"
            tar -czf "$tar_backup_path" -T "$temp_list" 2>/dev/null || {
                write_info "Error al crear el backup"
                rm -f "$temp_list"
                return
            }
            write_info "Backup ready: $tar_backup_path"
        }
        write_info "Backup ready: $backup_path"
    elif command -v tar >/dev/null 2>&1; then
        local tar_backup_path="${backup_path%.zip}.tar.gz"
        tar -czf "$tar_backup_path" -T "$temp_list" 2>/dev/null || {
            write_info "Error al crear el backup"
            rm -f "$temp_list"
            return
        }
        write_info "Backup ready: $tar_backup_path"
    else
        write_info "No se encontro herramienta para crear archivo comprimido (zip o tar)"
        rm -f "$temp_list"
        return
    fi
    
    rm -f "$temp_list"
    
    # Limpiar dump local temporal
    if [[ -n "$database_dump_local_path" && -f "$database_dump_local_path" ]]; then
        rm -f "$database_dump_local_path"
    fi
}

test_rebuild_required() {
    local paths=("$@")
    
    if [[ ${#paths[@]} -eq 0 ]]; then
        return 1
    fi
    
    local patterns=(
        "^backend/"
        "^frontend/"
        "^docker/"
        "docker-compose\.ya?ml$"
        "Dockerfile"
        "package\.json$"
        "pnpm-lock\.yaml$"
        "package-lock\.json$"
        "yarn\.lock$"
        "\.env"
    )
    
    for path in "${paths[@]}"; do
        local normalized_path="${path//\\//}"
        for pattern in "${patterns[@]}"; do
            if echo "$normalized_path" | grep -qE "$pattern"; then
                return 0
            fi
        done
    done
    
    return 1
}

stop_docker_containers() {
    write_info "Deteniendo contenedores Docker para evitar bloqueos..."
    
    if docker compose --profile dev down --remove-orphans >/dev/null 2>&1; then
        write_info "Contenedores Docker detenidos exitosamente"
    else
        write_info "docker compose down completo con codigo $?"
    fi
    sleep 2
}

stop_pnpm_processes() {
    write_info "Verificando procesos de pnpm que puedan estar bloqueando archivos..."
    
    local pnpm_pids
    pnpm_pids=$(pgrep -f "pnpm" 2>/dev/null || echo "")
    
    if [[ -n "$pnpm_pids" ]]; then
        local count
        count=$(echo "$pnpm_pids" | grep -c . || echo "0")
        write_info "Detectados $count proceso(s) de pnpm. Intentando cerrarlos..."
        echo "$pnpm_pids" | while read -r pid; do
            if [[ -n "$pid" ]]; then
                kill -9 "$pid" 2>/dev/null && write_info "Proceso pnpm (PID: $pid) cerrado" || write_info "No se pudo cerrar el proceso pnpm (PID: $pid)"
            fi
        done
        sleep 2
    fi
}

install_dependencies() {
    local working_directory="$1"
    local command="$2"
    shift 2
    local arguments=("$@")
    local max_retries="${MAX_RETRIES:-3}"
    
    write_info "Installing dependencies in $working_directory"
    
    local attempt=0
    local success=false
    
    while [[ $attempt -lt $max_retries && "$success" == false ]]; do
        attempt=$((attempt + 1))
        
        if [[ $attempt -gt 1 ]]; then
            write_info "Intento $attempt de $max_retries..."
            if [[ $attempt -eq 2 ]]; then
                write_info "Deteniendo procesos y contenedores que puedan estar bloqueando archivos..."
                stop_docker_containers
                stop_pnpm_processes
                write_info "Esperando 3 segundos antes de reintentar..."
                sleep 3
            elif [[ $attempt -eq 3 ]]; then
                write_info "Limpiando node_modules antes del ultimo intento..."
                stop_docker_containers
                local node_modules_path="$working_directory/node_modules"
                if [[ -d "$node_modules_path" ]]; then
                    rm -rf "$node_modules_path" 2>/dev/null && write_info "node_modules eliminado" || write_info "No se pudo eliminar node_modules completamente"
                fi
                sleep 2
            fi
        fi
        
        if (cd "$working_directory" && "$command" "${arguments[@]}" >/dev/null 2>&1); then
            success=true
        else
            local exit_code=$?
            if [[ $exit_code -ne 0 ]]; then
                if [[ $attempt -lt $max_retries ]]; then
                    write_info "Error detectado (código $exit_code). Reintentando..."
                    continue
                else
                    write_error "Error persistente despues de $max_retries intentos."
                    write_error "Posibles soluciones:"
                    write_error "  1. Cierra editores de texto o IDEs que puedan tener abiertos archivos en $working_directory"
                    write_error "  2. Ejecuta el script con permisos de administrador"
                    write_error "  3. Desactiva temporalmente el antivirus o agrega una exclusion para $working_directory"
                    write_error "  4. Cierra otros procesos de pnpm o node que puedan estar ejecutandose"
                    write_error "  5. Intenta eliminar manualmente: rm -rf '$working_directory/node_modules'"
                    exit 1
                fi
            fi
        fi
    done
}

invoke_audit_fix() {
    local working_directory="$1"
    local command="$2"
    shift 2
    local arguments=("$@")
    
    write_info "Ejecutando $command audit fix en $working_directory"
    
    if (cd "$working_directory" && "$command" "${arguments[@]}" >/dev/null 2>&1); then
        write_info "audit fix completado exitosamente"
    else
        local exit_code=$?
        write_info "audit fix completo con codigo de salida $exit_code. Algunas vulnerabilidades pueden requerir cambios breaking. El script continuara."
    fi
}

# Flujo principal
main() {
    write_info "Starting development setup"
    
    local pending_remote_changes=()
    local local_changes_raw=()
    
    if [[ "$SKIP_GIT" == true ]]; then
        write_info "Git operations skipped by request"
    else
        if ! invoke_cli git fetch --all; then
            write_error "git fetch failed. Vuelve a intentarlo o ejecuta el script con -SkipGit para continuar sin operaciones remotas."
            exit 1
        fi
        
        local upstream_ref=""
        upstream_ref=$(invoke_cli_output git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>/dev/null || echo "")
        upstream_ref=$(echo "$upstream_ref" | xargs)
        
        if [[ -n "$upstream_ref" ]]; then
            write_info "Detecting remote changes against $upstream_ref"
            pending_remote_changes=($(invoke_cli_output git diff --name-only HEAD "$upstream_ref" 2>/dev/null || echo ""))
        fi
    fi
    
    if [[ "$SKIP_BACKUP" == true ]]; then
        write_info "Backup skipped by request"
    else
        new_backup || true
    fi
    
    if [[ "$SKIP_GIT" != true ]]; then
        if ! invoke_cli git pull; then
            write_error "git pull failed. Usa -SkipGit si deseas continuar sin sincronizar."
            exit 1
        fi
    fi
    
    local env_file_path="$SCRIPT_ROOT/.env"
    if [[ ! -f "$env_file_path" ]]; then
        write_error "No se encontro el archivo .env"
        exit 1
    fi
    
    local backend_lock_file="$SCRIPT_ROOT/backend/pnpm-lock.yaml"
    local frontend_lock_file="$SCRIPT_ROOT/frontend/pnpm-lock.yaml"
    
    if [[ "$FRESH" == true ]]; then
        write_info "Fresh mode selected"
        
        write_info "Eliminando archivos lock para instalacion limpia"
        if [[ -f "$backend_lock_file" ]]; then
            rm -f "$backend_lock_file"
            write_info "Eliminado: $backend_lock_file"
        fi
        local legacy_backend_lock_file="$SCRIPT_ROOT/backend/package-lock.json"
        if [[ -f "$legacy_backend_lock_file" ]]; then
            rm -f "$legacy_backend_lock_file"
            write_info "Eliminado (legacy): $legacy_backend_lock_file"
        fi
        if [[ -f "$frontend_lock_file" ]]; then
            rm -f "$frontend_lock_file"
            write_info "Eliminado: $frontend_lock_file"
        fi
        
        if [[ "$RESET_DB" == true ]]; then
            write_info "ResetDB activado: se eliminara el volumen de la base de datos"
            invoke_cli docker compose --profile dev down --volumes --remove-orphans
        else
            write_info "ResetDB no activado: se preserva el volumen de la base de datos"
            invoke_cli docker compose --profile dev down --remove-orphans
            if test_docker_volume_exists "mysql_data" "$PROJECT_NAME"; then
                write_info "Preservando volumen de base de datos: ${PROJECT_NAME}_mysql_data"
            fi
        fi
        
        remove_project_docker_resources "$PROJECT_NAME"
        
        write_info "Instalando dependencias locales sin archivos lock"
        install_dependencies "$SCRIPT_ROOT/backend" pnpm install
        install_dependencies "$SCRIPT_ROOT/frontend" pnpm install
        
        write_info "Construyendo imágenes Docker"
        invoke_cli docker compose --profile dev build backend frontend
        
        update_docker_dependencies "backend" "backend_node_modules" "$backend_lock_file" "backend-deps.hash" compose --profile dev run --build --rm backend pnpm install
        update_docker_dependencies "frontend" "frontend_node_modules" "$frontend_lock_file" "frontend-deps.hash" compose --profile dev run --build --rm frontend pnpm install
        invoke_cli docker compose --profile dev up -d
        
        if [[ "$RESET_DB" == true ]]; then
            reset_database
            invoke_migrations
            invoke_seeders_if_pending true
        else
            initialize_database
            invoke_migrations
            invoke_seeders_if_pending false
        fi
        
        invoke_cli docker compose --profile dev ps
        write_info "Fresh setup completed"
        write_environment_summary
        exit 0
    fi
    
    # Detener contenedores Docker antes de instalar dependencias para evitar bloqueos EPERM
    stop_docker_containers
    
    install_dependencies "$SCRIPT_ROOT/backend" pnpm install
    invoke_audit_fix "$SCRIPT_ROOT/backend" pnpm audit fix
    
    install_dependencies "$SCRIPT_ROOT/frontend" pnpm install
    invoke_audit_fix "$SCRIPT_ROOT/frontend" pnpm audit fix
    
    local local_changes=()
    if [[ "$SKIP_GIT" != true ]]; then
        local_changes_raw=($(invoke_cli_output git status --porcelain 2>/dev/null || echo ""))
    fi
    
    for line in "${local_changes_raw[@]}"; do
        if [[ -z "$line" ]]; then
            continue
        fi
        if [[ "$line" =~ ^R.*->.* ]]; then
            # Archivo renombrado
            local parts=(${line//->/ })
            for part in "${parts[@]}"; do
                part=$(echo "$part" | xargs)
                if [[ -n "$part" && ${#part} -gt 3 ]]; then
                    local_changes+=("${part:3}")
                fi
            done
        elif [[ ${#line} -gt 3 ]]; then
            local_changes+=("${line:3}")
        else
            local_changes+=("$line")
        fi
    done
    
    local all_changes=("${pending_remote_changes[@]}" "${local_changes[@]}")
    # Eliminar duplicados y ordenar
    all_changes=($(printf '%s\n' "${all_changes[@]}" | sort -u))
    
    update_docker_dependencies "backend" "backend_node_modules" "$backend_lock_file" "backend-deps.hash" compose --profile dev run --build --rm backend pnpm install --frozen-lockfile
    update_docker_dependencies "frontend" "frontend_node_modules" "$frontend_lock_file" "frontend-deps.hash" compose --profile dev run --build --rm frontend pnpm install --frozen-lockfile
    
    if [[ "$FORCE_BUILD" == true ]] || test_rebuild_required "${all_changes[@]}"; then
        if [[ "$FORCE_BUILD" == true ]]; then
            write_info "ForceBuild activado: forzando rebuild de imagenes Docker"
        else
            write_info "Changes require rebuild"
        fi
        invoke_cli docker compose --profile dev up --build -d
    else
        write_info "No rebuild required, starting containers"
        invoke_cli docker compose --profile dev up -d
    fi
    
    if [[ "$RESET_DB" == true ]]; then
        write_info "ResetDB activado: reseteando base de datos"
        reset_database
        invoke_migrations
        invoke_seeders_if_pending true
    else
        initialize_database
        invoke_migrations
        invoke_seeders_if_pending false
    fi
    
    invoke_cli docker compose --profile dev ps
    write_info "Setup completed"
    write_environment_summary
}

# Ejecutar función principal
main "$@"

