# Exportador de Assets de Eventos UIC

Script para exportar todos los assets del evento UIC SPP 2026 desde la base de datos de producción y generar un seeder completo.

## Descripción

Este script extrae todos los registros de la tabla `event_assets` del tenant UIC y evento SPP 2026, y genera un archivo seeder (`0003-uic-event-assets.js`) con formato correcto que puede reemplazar al seeder actual.

## Requisitos

- Node.js instalado
- `mysql2` instalado (se instala automáticamente si falta)
- Acceso a la base de datos de producción
- Variables de entorno configuradas

## Uso

### En Linux/macOS:

```bash
./scripts/export-uic-event-assets.sh
```

### En Windows (PowerShell):

```powershell
node scripts/export-uic-event-assets.mjs
```

### Directamente con Node.js:

```bash
node scripts/export-uic-event-assets.mjs
```

## Configuración

### Variables de Entorno

El script busca variables de entorno en este orden:

1. Variables `PROD_DB_*` (para producción)
2. Variables `DB_*` (para desarrollo)
3. Valores por defecto

#### Para Producción:

Crea un archivo `.env.production` en la raíz del proyecto:

```env
PROD_DB_HOST=tu-servidor-db
PROD_DB_PORT=3306
PROD_DB_USER=tu-usuario
PROD_DB_PASSWORD=tu-password
PROD_DB_NAME=create
```

#### Para Desarrollo Local (Docker):

Si ejecutas el script desde tu máquina local y la base de datos está en Docker:

```env
DB_HOST=localhost
DB_PORT=3406
DB_USER=create_user
DB_PASSWORD=tu-password
DB_NAME=create
```

El script detecta automáticamente si está ejecutándose fuera de Docker y ajusta el puerto a `3406` (puerto mapeado de Docker).

#### Para Ejecución dentro de Docker:

```env
DB_HOST=database
DB_PORT=3306
DB_USER=create_user
DB_PASSWORD=tu-password
DB_NAME=create
```

## Salida

El script genera un archivo seeder en:

```
backend/src/database/seeders/master/0003-uic-event-assets.js
```

Este archivo contiene:

- Todos los assets del tenant UIC y evento SPP 2026
- Formato correcto para usar con Umzug/Sequelize
- Funciones `up()` y `down()` para migración y rollback
- Verificación de existencia antes de insertar (idempotente)

## Campos Exportados

Para cada asset se exportan los siguientes campos:

- `name`: Nombre identificador del recurso (usado en marcadores `{{asset:nombre}}`)
- `original_filename`: Nombre original del archivo
- `s3_key`: Clave del objeto en S3/Spaces
- `url`: URL pública del archivo
- `mime_type`: Tipo MIME del archivo
- `file_size`: Tamaño del archivo en bytes
- `description`: Descripción del recurso (opcional)
- `created_at`: Fecha de creación
- `updated_at`: Fecha de actualización

## Ejemplo de Uso

```bash
# 1. Configurar variables de entorno
export PROD_DB_HOST=produccion.example.com
export PROD_DB_USER=admin
export PROD_DB_PASSWORD=secret
export PROD_DB_NAME=create

# 2. Ejecutar el script
./scripts/export-uic-event-assets.sh

# 3. El seeder se genera en:
# backend/src/database/seeders/master/0003-uic-event-assets.js

# 4. Revisar el archivo generado y reemplazar el seeder actual si es necesario
```

## Notas

- El script es **idempotente**: verifica si los assets ya existen antes de insertarlos
- Los assets se ordenan alfabéticamente por nombre
- El script muestra un resumen de todos los assets exportados
- Si no se encuentran assets, el script muestra una advertencia pero no falla

## Solución de Problemas

### Error: "No se encontró el tenant UIC"

Asegúrate de que el tenant UIC existe en la base de datos con el slug `'uic'`.

### Error: "No se encontró el evento SPP 2026"

Verifica que el evento SPP 2026 existe para el tenant UIC.

### Error: "mysql2 no está instalado"

El script intenta instalar `mysql2` automáticamente. Si falla, instálalo manualmente:

```bash
cd backend
npm install mysql2
# o
pnpm install mysql2
# o
yarn add mysql2
```

### Error de conexión a la base de datos

- Verifica que las variables de entorno estén configuradas correctamente
- Asegúrate de que el servidor de base de datos esté accesible
- Si estás en Docker, verifica que el puerto esté mapeado correctamente (3406:3306)

## Verificación

Después de generar el seeder, puedes verificar que funciona correctamente:

```bash
cd backend
npm run seed:master
```

O ejecutar solo este seeder específico (si tu setup lo permite).

