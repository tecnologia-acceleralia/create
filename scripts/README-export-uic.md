# Script de Exportación de Fases y Tareas UIC

Este script extrae los datos de fases y tareas del evento UIC desde la base de datos de producción y genera un archivo JSON con los campos HTML (`description` e `intro_html`).

## Requisitos

- `Node.js` instalado (v16 o superior)
- `mysql2` instalado (ya está en `backend/package.json`)
- Acceso a la base de datos de producción (puede ser el contenedor Docker o un servidor remoto)

## Configuración

### Conexión al contenedor Docker

Si quieres conectarte al contenedor Docker local, el script detecta automáticamente la configuración:

- **Desde fuera del contenedor**: Usa `localhost:3406` (puerto mapeado)
- **Desde dentro de la red Docker**: Usa `database:3306` (nombre del servicio)

### Opción 1: Archivo `.env.production`

Crea un archivo `.env.production` en la raíz del proyecto con las siguientes variables:

```bash
# Para producción remota
PROD_DB_HOST=tu-servidor.com
PROD_DB_PORT=3306
PROD_DB_USER=usuario
PROD_DB_PASSWORD=contraseña
PROD_DB_NAME=nombre_bd

# O para Docker local (desde fuera del contenedor)
PROD_DB_HOST=localhost
PROD_DB_PORT=3406
PROD_DB_USER=root
PROD_DB_PASSWORD=root
PROD_DB_NAME=create
```

### Opción 2: Variables de entorno del sistema

Exporta las variables de entorno antes de ejecutar el script:

```bash
export PROD_DB_HOST=localhost
export PROD_DB_PORT=3406
export PROD_DB_USER=root
export PROD_DB_PASSWORD=root
export PROD_DB_NAME=create
```

### Opción 3: Usar `.env` local

Si no existe `.env.production`, el script intentará usar `.env` (útil para desarrollo local con Docker).

## Uso

### Método 1: Ejecutar directamente con Node.js (recomendado)

**En Windows (PowerShell):**
```powershell
node scripts\export-uic-phases-tasks.js
```

**En Linux/macOS:**
```bash
node scripts/export-uic-phases-tasks.js
```

### Método 2: Usando el script shell (Linux/macOS/Git Bash/WSL)

```bash
# Desde la raíz del proyecto
./scripts/export-uic-phases-tasks.sh
```

### Método 3: Usando el script PowerShell (Windows)

```powershell
.\scripts\export-uic-phases-tasks.ps1
```

### Método 4: Ejecutar desde dentro del contenedor Docker

Si quieres ejecutar el script desde dentro del contenedor backend:

```bash
# Entrar al contenedor
docker exec -it create-backend bash

# Ejecutar el script (ajustar rutas según sea necesario)
node /app/scripts/export-uic-phases-tasks.js
```

El script:
1. Se conecta a la base de datos usando `mysql2` (cliente Node.js)
2. Busca el tenant UIC (slug: 'uic')
3. Encuentra el evento más reciente del tenant
4. Extrae todas las fases y tareas del evento
5. Genera un archivo JSON con el formato: `uic-phases-tasks-export-YYYY-MM-DDTHH-MM-SS.json`

## Formato del archivo de salida

El archivo JSON generado tiene la siguiente estructura:

```json
{
  "export_date": "2025-01-27T10:30:00.000Z",
  "tenant_id": 1,
  "tenant_slug": "uic",
  "event_id": 1,
  "phases": [
    {
      "id": 1,
      "name": "Nombre de la fase",
      "description": "Descripción HTML (puede ser string simple o null)",
      "intro_html": "Contenido HTML de introducción (puede ser string simple o null)",
      "order_index": 1,
      "start_date": "2025-01-01 00:00:00",
      "end_date": "2025-01-31 23:59:59",
      "view_start_date": null,
      "view_end_date": null,
      "is_elimination": false
    }
  ],
  "tasks": [
    {
      "id": 1,
      "phase_id": 1,
      "title": "Título de la tarea",
      "description": "Descripción HTML (puede ser string simple o null)",
      "intro_html": "Contenido HTML de introducción (puede ser string simple o null)",
      "delivery_type": "file",
      "is_required": true,
      "due_date": "2025-01-15 23:59:59",
      "status": "active",
      "order_index": 1,
      "max_files": 1,
      "max_file_size_mb": 10,
      "allowed_mime_types": null
    }
  ]
}
```

## Notas importantes

1. **Campos HTML**: Los campos `description` e `intro_html` en producción pueden ser strings simples (no multiidioma). El script los extrae tal cual están en la base de datos.

2. **Procesamiento posterior**: Una vez generado el archivo JSON, deberás procesarlo para:
   - Convertir los campos HTML de string simple a formato multiidioma `{ "es": "...", "ca": "...", "en": "..." }`
   - Actualizar los seeders con estos datos

3. **Seguridad**: El script no expone la contraseña en la línea de comandos (usa `-p"$DB_PASSWORD"` que es más seguro que `-p$DB_PASSWORD`).

4. **Errores**: Si el script falla, verifica:
   - Que las variables de entorno estén correctamente configuradas
   - Que tengas acceso a la base de datos de producción
   - Que el tenant UIC y el evento existan en la base de datos

## Ejemplos de uso

### Ejemplo 1: Conectar a Docker local

```bash
# 1. Asegúrate de que Docker esté corriendo
docker-compose ps

# 2. Configurar variables (o usar .env existente)
cat > .env.production <<EOF
PROD_DB_HOST=localhost
PROD_DB_PORT=3406
PROD_DB_USER=root
PROD_DB_PASSWORD=root
PROD_DB_NAME=create
EOF

# 3. Ejecutar el script
# En Windows:
node scripts\export-uic-phases-tasks.js
# O en Linux/macOS:
node scripts/export-uic-phases-tasks.js

# 4. Verificar el archivo generado
ls -lh uic-phases-tasks-export-*.json

# 5. Revisar el contenido (si tienes jq instalado)
cat uic-phases-tasks-export-*.json | jq '.phases | length'
cat uic-phases-tasks-export-*.json | jq '.tasks | length'
```

### Ejemplo 2: Conectar a producción remota

```bash
# 1. Configurar variables de producción
cat > .env.production <<EOF
PROD_DB_HOST=produccion.example.com
PROD_DB_PORT=3306
PROD_DB_USER=readonly_user
PROD_DB_PASSWORD=secure_password
PROD_DB_NAME=create_production
EOF

# 2. Ejecutar el script
node scripts/export-uic-phases-tasks.js
```

### Ejemplo 3: Sin archivo .env.production (usa .env)

Si tienes un archivo `.env` configurado para desarrollo local:

```bash
# El script usará automáticamente las variables DB_* de .env
node scripts/export-uic-phases-tasks.js
```

