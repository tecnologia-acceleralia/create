#!/usr/bin/env node
/**
 * Script para extraer datos de fases y tareas del evento UIC desde producción
 * Genera un archivo JSON con los campos HTML (description, intro_html) de phases y tasks
 * 
 * Uso:
 *   node scripts/export-uic-phases-tasks.mjs
 * 
 * Requisitos:
 *   - Node.js instalado
 *   - mysql2 instalado (npm install mysql2)
 *   - Variables de entorno configuradas (ver README)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colores para output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m'
};

function info(msg) {
  console.log(`${colors.green}[INFO]${colors.reset} ${msg}`);
}

function warn(msg) {
  console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`);
}

function error(msg) {
  console.error(`${colors.red}[ERROR]${colors.reset} ${msg}`);
}

// Cargar variables de entorno
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.production');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          process.env[key.trim()] = value.trim();
        }
      }
    });
    info('Variables de entorno cargadas desde .env.production');
  } else {
    const envLocalPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envLocalPath)) {
      warn('Usando .env en lugar de .env.production');
      const envContent = fs.readFileSync(envLocalPath, 'utf8');
      envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').replace(/^["']|["']$/g, '');
            process.env[key.trim()] = value.trim();
          }
        }
      });
    } else {
      warn('No se encontró archivo .env. Usando variables de entorno del sistema.');
    }
  }
}

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
    host: host,
    port: parseInt(port),
    user: user,
    password: password,
    database: database
  };

  return config;
}

// Función para normalizar valores
function normalizeValue(value) {
  if (value === null || value === undefined || value === 'NULL' || value === '') {
    return null;
  }
  return value;
}

// Función para normalizar fechas
function normalizeDate(dateStr) {
  if (!dateStr || dateStr === 'NULL' || dateStr === '') {
    return null;
  }
  if (dateStr instanceof Date) {
    return dateStr.toISOString().replace('T', ' ').substring(0, 19);
  }
  return dateStr;
}

async function main() {
  try {
    // Cargar mysql2
    const mysql = await loadMysql2();
    
    // Cargar variables de entorno
    loadEnv();

    // Obtener configuración de base de datos
    const dbConfig = getDbConfig();

    info('Conectando a la base de datos...');
    info(`  Host: ${dbConfig.host}`);
    info(`  Puerto: ${dbConfig.port}`);
    info(`  Usuario: ${dbConfig.user}`);
    info(`  Base de datos: ${dbConfig.database}`);

    // Crear conexión
    const connection = await mysql.createConnection(dbConfig);
    info('Conexión establecida');

    try {
      // Obtener tenant_id de UIC
      info('Obteniendo tenant_id de UIC...');
      const [tenantRows] = await connection.execute(
        "SELECT id FROM tenants WHERE slug = 'uic' LIMIT 1"
      );

      if (!tenantRows || tenantRows.length === 0) {
        error('No se encontró el tenant UIC en la base de datos');
        process.exit(1);
      }

      const tenantId = tenantRows[0].id;
      info(`Tenant UIC encontrado con ID: ${tenantId}`);

      // Obtener event_id del evento UIC
      info('Obteniendo eventos del tenant UIC...');
      const [eventRows] = await connection.execute(
        `SELECT id FROM events WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1`,
        [tenantId]
      );

      if (!eventRows || eventRows.length === 0) {
        error('No se encontró ningún evento para el tenant UIC');
        process.exit(1);
      }

      const eventId = eventRows[0].id;
      info(`Evento encontrado con ID: ${eventId}`);

      // Extraer fases
      info('Extrayendo fases...');
      const [phases] = await connection.execute(
        `SELECT 
          id,
          name,
          description,
          intro_html,
          order_index,
          start_date,
          end_date,
          view_start_date,
          view_end_date,
          is_elimination
        FROM phases 
        WHERE tenant_id = ? AND event_id = ? 
        ORDER BY order_index ASC`,
        [tenantId, eventId]
      );

      info(`Fases encontradas: ${phases.length}`);

      // Procesar fases
      const processedPhases = phases.map(phase => ({
        id: phase.id,
        name: normalizeValue(phase.name) || '',
        description: normalizeValue(phase.description),
        intro_html: normalizeValue(phase.intro_html),
        order_index: phase.order_index || 1,
        start_date: normalizeDate(phase.start_date),
        end_date: normalizeDate(phase.end_date),
        view_start_date: normalizeDate(phase.view_start_date),
        view_end_date: normalizeDate(phase.view_end_date),
        is_elimination: Boolean(phase.is_elimination)
      }));

      // Extraer tareas
      info('Extrayendo tareas...');
      const [tasks] = await connection.execute(
        `SELECT 
          id,
          phase_id,
          title,
          description,
          intro_html,
          delivery_type,
          is_required,
          due_date,
          status,
          order_index,
          max_files,
          max_file_size_mb,
          allowed_mime_types
        FROM tasks 
        WHERE tenant_id = ? AND event_id = ? 
        ORDER BY phase_id ASC, order_index ASC`,
        [tenantId, eventId]
      );

      info(`Tareas encontradas: ${tasks.length}`);

      // Procesar tareas
      const processedTasks = tasks.map(task => {
        let allowedMimeTypes = null;
        try {
          const mimeValue = normalizeValue(task.allowed_mime_types);
          if (mimeValue && mimeValue !== 'null' && mimeValue !== 'NULL') {
            // Intentar parsear como JSON si es un string JSON
            if (typeof mimeValue === 'string' && (mimeValue.startsWith('[') || mimeValue.startsWith('{'))) {
              allowedMimeTypes = JSON.parse(mimeValue);
            } else if (typeof mimeValue === 'object') {
              allowedMimeTypes = mimeValue;
            } else {
              allowedMimeTypes = mimeValue;
            }
          }
        } catch (e) {
          // Si falla el parseo, dejarlo como null
          allowedMimeTypes = null;
        }

        return {
          id: task.id,
          phase_id: task.phase_id,
          title: normalizeValue(task.title) || '',
          description: normalizeValue(task.description),
          intro_html: normalizeValue(task.intro_html),
          delivery_type: normalizeValue(task.delivery_type) || 'file',
          is_required: Boolean(task.is_required),
          due_date: normalizeDate(task.due_date),
          status: normalizeValue(task.status) || 'draft',
          order_index: task.order_index || 1,
          max_files: task.max_files || 1,
          max_file_size_mb: task.max_file_size_mb ? parseInt(task.max_file_size_mb) : null,
          allowed_mime_types: allowedMimeTypes
        };
      });

      // Crear objeto de exportación
      const exportData = {
        export_date: new Date().toISOString(),
        tenant_id: tenantId,
        tenant_slug: 'uic',
        event_id: eventId,
        phases: processedPhases,
        tasks: processedTasks
      };

      // Generar nombre de archivo
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const outputFile = path.resolve(process.cwd(), `uic-phases-tasks-export-${timestamp}.json`);

      // Escribir archivo
      fs.writeFileSync(outputFile, JSON.stringify(exportData, null, 2), 'utf8');

      info('Exportación completada:');
      info(`  - Archivo: ${outputFile}`);
      info(`  - Fases: ${processedPhases.length}`);
      info(`  - Tareas: ${processedTasks.length}`);

    } finally {
      // Cerrar conexión
      await connection.end();
      info('Conexión cerrada');
    }

  } catch (err) {
    error(`Error: ${err.message}`);
    if (err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

// Ejecutar
main();

