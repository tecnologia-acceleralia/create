#!/usr/bin/env node

/**
 * Script para exportar todos los assets del evento UIC SPP 2026
 * y generar un seeder completo con formato correcto.
 * 
 * Uso:
 *   node scripts/export-uic-event-assets.mjs
 * 
 * Variables de entorno:
 *   PROD_DB_HOST, PROD_DB_PORT, PROD_DB_USER, PROD_DB_PASSWORD, PROD_DB_NAME
 *   O DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Función para cargar mysql2 desde diferentes ubicaciones
async function loadMysql2() {
  try {
    // Intentar desde node_modules local
    return await import('mysql2/promise');
  } catch (e) {
    try {
      // Intentar desde backend/node_modules
      const backendPath = path.resolve(__dirname, '../backend/node_modules/mysql2/promise.js');
      if (fs.existsSync(backendPath)) {
        return await import(backendPath);
      }
      throw new Error('mysql2 no encontrado');
    } catch (e2) {
      error('No se pudo cargar mysql2. Asegúrate de que esté instalado.');
      error('Ejecuta: cd backend && npm install mysql2');
      process.exit(1);
    }
  }
}

// Colores para output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function info(msg) {
  console.log(`${colors.cyan}[INFO]${colors.reset} ${msg}`);
}

function warn(msg) {
  console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`);
}

function error(msg) {
  console.error(`${colors.red}[ERROR]${colors.reset} ${msg}`);
}

function success(msg) {
  console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`);
}

// Cargar variables de entorno
function loadEnv() {
  const envFiles = [
    '.env.production',
    '.env'
  ];

  for (const envFile of envFiles) {
    const envPath = path.join(process.cwd(), envFile);
    if (fs.existsSync(envPath)) {
      info(`Cargando variables de entorno desde: ${envFile}`);
      const content = fs.readFileSync(envPath, 'utf-8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').replace(/^["']|["']$/g, '');
            if (!process.env[key]) {
              process.env[key] = value;
            }
          }
        }
      }
      break;
    }
  }
}

// Configuración de conexión
function getDbConfig() {
  // Detectar si estamos dentro de un contenedor Docker
  // Si estamos dentro, el host 'database' funcionará
  // Si estamos fuera, necesitamos usar 'localhost' con el puerto mapeado
  const isInsideDocker = fs.existsSync('/.dockerenv') || process.env.DOCKER === 'true';
  
  // Obtener valores de entorno
  let host = process.env.PROD_DB_HOST || process.env.DB_HOST;
  let port = process.env.PROD_DB_PORT || process.env.DB_PORT;
  const user = process.env.PROD_DB_USER || process.env.DB_USER || 'root';
  const password = process.env.PROD_DB_PASSWORD || process.env.DB_PASSWORD || 'root';
  const database = process.env.PROD_DB_NAME || process.env.DB_NAME || 'create';
  
  // Si no hay host configurado explícitamente
  if (!host) {
    host = isInsideDocker ? 'database' : 'localhost';
  }
  
  // Si el host es 'database' pero estamos fuera de Docker, cambiar a localhost
  if (host === 'database' && !isInsideDocker) {
    warn('Host "database" detectado pero estamos fuera de Docker. Usando localhost:3406');
    host = 'localhost';
    // Forzar puerto 3406 cuando cambiamos de 'database' a 'localhost' fuera de Docker
    // Solo respetar PROD_DB_PORT si está explícitamente configurado
    // Si no, forzar 3406 incluso si DB_PORT está configurado (porque DB_PORT es para dentro de Docker)
    if (process.env.PROD_DB_PORT) {
      port = process.env.PROD_DB_PORT;
    } else {
      port = '3406'; // Puerto mapeado de Docker - forzar siempre cuando cambiamos host
    }
  }
  
  // Si no hay puerto configurado
  if (!port) {
    if (host === 'localhost' && !isInsideDocker) {
      port = '3406'; // Puerto mapeado de Docker por defecto cuando estamos fuera
    } else {
      port = '3306'; // Puerto estándar de MySQL
    }
  }
  
  // Asegurar que si estamos fuera de Docker y usamos localhost, usamos el puerto mapeado
  // (a menos que PROD_DB_PORT esté explícitamente configurado)
  if (host === 'localhost' && !isInsideDocker && port === '3306' && !process.env.PROD_DB_PORT) {
    warn('Ajustando puerto a 3406 (puerto mapeado de Docker)');
    port = '3406';
  }
  
  const config = {
    host,
    port: parseInt(port),
    user,
    password,
    database,
  };

  return config;
}

// Escapar strings para JavaScript
function escapeJsString(str) {
  if (str === null || str === undefined) {
    return 'null';
  }
  return JSON.stringify(String(str));
}

// Formatear fecha para JavaScript
function formatDate(dateValue) {
  if (!dateValue) {
    return 'null';
  }
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return 'null';
  }
  return `new Date('${date.toISOString()}')`;
}

async function main() {
  try {
    // Cargar mysql2 dinámicamente
    const mysql = await loadMysql2();
    
    loadEnv();
    const dbConfig = getDbConfig();

    info('Conectando a la base de datos...');
    info(`  Host: ${dbConfig.host}`);
    info(`  Puerto: ${dbConfig.port}`);
    info(`  Usuario: ${dbConfig.user}`);
    info(`  Base de datos: ${dbConfig.database}`);

    const connection = await mysql.createConnection(dbConfig);
    info('Conexión establecida');

    // Obtener tenant UIC
    const [tenantRows] = await connection.execute(
      "SELECT id FROM tenants WHERE slug = 'uic' LIMIT 1"
    );

    if (tenantRows.length === 0) {
      throw new Error('No se encontró el tenant UIC');
    }

    const tenantId = tenantRows[0].id;
    info(`Tenant UIC encontrado (ID: ${tenantId})`);

    // Verificar si la columna name de events es JSON o STRING
    const [eventsTableInfo] = await connection.execute(
      "SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'events' AND COLUMN_NAME = 'name'",
      [dbConfig.database]
    );

    const isEventsNameJSON = eventsTableInfo.length > 0 && 
      (eventsTableInfo[0].COLUMN_TYPE.includes('json') || eventsTableInfo[0].COLUMN_TYPE.toUpperCase().includes('JSON'));

    // Buscar evento SPP 2026
    const eventQuery = isEventsNameJSON
      ? `SELECT id FROM events WHERE tenant_id = ? AND JSON_EXTRACT(name, '$.es') = 'SPP 2026' LIMIT 1`
      : `SELECT id FROM events WHERE tenant_id = ? AND name = 'SPP 2026' LIMIT 1`;

    const [eventRows] = await connection.execute(eventQuery, [tenantId]);

    if (eventRows.length === 0) {
      throw new Error('No se encontró el evento SPP 2026 del tenant UIC');
    }

    const eventId = eventRows[0].id;
    info(`Evento SPP 2026 encontrado (ID: ${eventId})`);

    // Obtener usuario admin
    const [adminRows] = await connection.execute(
      "SELECT id FROM users WHERE email = 'admin@uic.es' LIMIT 1"
    );

    if (adminRows.length === 0) {
      throw new Error('No se encontró el usuario admin@uic.es');
    }

    const adminUserId = adminRows[0].id;
    info(`Usuario admin encontrado (ID: ${adminUserId})`);

    // Obtener todos los assets
    const [assets] = await connection.execute(
      `SELECT 
        name,
        original_filename,
        s3_key,
        url,
        mime_type,
        file_size,
        description,
        created_at,
        updated_at
      FROM event_assets
      WHERE tenant_id = ? AND event_id = ?
      ORDER BY name ASC`,
      [tenantId, eventId]
    );

    info(`Se encontraron ${assets.length} assets`);

    if (assets.length === 0) {
      warn('No se encontraron assets para exportar');
      await connection.end();
      return;
    }

    // Generar contenido del seeder
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const seederContent = `// Seeder generado automáticamente el ${new Date().toISOString()}
// Este seeder inserta los assets de eventos de UIC en la tabla event_assets
// Los assets ya existen en el bucket S3, este seeder solo los registra en la BD
// Generado desde la base de datos de producción con ${assets.length} assets

export async function up(queryInterface) {
  // Obtener tenant y evento
  const [[tenant]] = await queryInterface.sequelize.query(
    "SELECT id FROM tenants WHERE slug = 'uic' LIMIT 1"
  );

  if (!tenant) {
    throw new Error('No se encontró el tenant UIC');
  }

  // Verificar si la columna name es JSON (multiidioma) o STRING
  const eventsTableDesc = await queryInterface.describeTable('events').catch(() => ({}));
  const isEventsNameJSON = eventsTableDesc.name && (eventsTableDesc.name.type === 'json' || eventsTableDesc.name.type?.includes('json') || eventsTableDesc.name.type === 'JSON');

  // Buscar el evento según el tipo de columna
  const eventQuery = isEventsNameJSON
    ? \`SELECT id FROM events WHERE tenant_id = \${tenant.id} AND JSON_EXTRACT(name, '$.es') = 'SPP 2026' LIMIT 1\`
    : \`SELECT id FROM events WHERE tenant_id = \${tenant.id} AND name = 'SPP 2026' LIMIT 1\`;
  
  const [[event]] = await queryInterface.sequelize.query(eventQuery);

  if (!event) {
    throw new Error('No se encontró el evento SPP 2026 del tenant UIC');
  }

  // Obtener usuario admin para uploaded_by
  const [[adminUser]] = await queryInterface.sequelize.query(
    "SELECT id FROM users WHERE email = 'admin@uic.es' LIMIT 1"
  );

  if (!adminUser) {
    throw new Error('No se encontró el usuario admin@uic.es');
  }

  const now = new Date();

  // Assets a insertar
  const assetsToInsert = [
${assets.map((asset, index) => {
  const comma = index < assets.length - 1 ? ',' : '';
  return `    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: ${escapeJsString(asset.name)},
      original_filename: ${escapeJsString(asset.original_filename)},
      s3_key: ${escapeJsString(asset.s3_key)},
      url: ${escapeJsString(asset.url)},
      mime_type: ${escapeJsString(asset.mime_type)},
      file_size: ${asset.file_size || 0},
      description: ${asset.description ? escapeJsString(asset.description) : 'null'},
      uploaded_by: adminUser.id,
      created_at: ${formatDate(asset.created_at)},
      updated_at: ${formatDate(asset.updated_at)}
    }${comma}`;
}).join('\n')}
  ];

  // Insertar assets (solo si no existen ya)
  for (const asset of assetsToInsert) {
    const [existing] = await queryInterface.sequelize.query(
      \`SELECT id FROM event_assets WHERE tenant_id = \${tenant.id} AND event_id = \${event.id} AND name = :assetName LIMIT 1\`,
      {
        replacements: {
          assetName: asset.name
        }
      }
    );

    if (existing.length === 0) {
      await queryInterface.bulkInsert('event_assets', [asset]);
    }
  }
}

export async function down(queryInterface) {
  const [[tenant]] = await queryInterface.sequelize.query(
    "SELECT id FROM tenants WHERE slug = 'uic' LIMIT 1"
  );

  if (!tenant) {
    return;
  }

  // Verificar si la columna name es JSON (multiidioma) o STRING
  const eventsTableDesc = await queryInterface.describeTable('events').catch(() => ({}));
  const isEventsNameJSON = eventsTableDesc.name && (eventsTableDesc.name.type === 'json' || eventsTableDesc.name.type?.includes('json') || eventsTableDesc.name.type === 'JSON');

  // Buscar el evento según el tipo de columna
  const eventQuery = isEventsNameJSON
    ? \`SELECT id FROM events WHERE tenant_id = \${tenant.id} AND JSON_EXTRACT(name, '$.es') = 'SPP 2026' LIMIT 1\`
    : \`SELECT id FROM events WHERE tenant_id = \${tenant.id} AND name = 'SPP 2026' LIMIT 1\`;
  
  const [[event]] = await queryInterface.sequelize.query(eventQuery);

  if (event) {
    // Eliminar solo los assets insertados por este seeder
    // (identificados por los nombres normalizados)
    const assetNames = [
${assets.map((asset, index) => {
  const comma = index < assets.length - 1 ? ',' : '';
  return `      ${escapeJsString(asset.name)}${comma}`;
}).join('\n')}
    ];

    for (const assetName of assetNames) {
      await queryInterface.sequelize.query(
        \`DELETE FROM event_assets WHERE tenant_id = \${tenant.id} AND event_id = \${event.id} AND name = :assetName\`,
        {
          replacements: {
            assetName
          }
        }
      );
    }
  }
}
`;

    // Guardar archivo
    const outputPath = path.join(process.cwd(), 'backend', 'src', 'database', 'seeders', 'master', '0003-uic-event-assets.js');
    fs.writeFileSync(outputPath, seederContent, 'utf-8');

    success(`Seeder generado exitosamente: ${outputPath}`);
    success(`Total de assets exportados: ${assets.length}`);

    // Mostrar lista de assets
    info('\nAssets exportados:');
    assets.forEach((asset, index) => {
      console.log(`  ${index + 1}. ${asset.name} (${asset.original_filename})`);
    });

    await connection.end();
    info('Conexión cerrada');
  } catch (err) {
    error(`Error: ${err.message}`);
    if (err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

main();

