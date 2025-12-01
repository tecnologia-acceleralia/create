#!/usr/bin/env node
/**
 * Script para extraer datos de fases y tareas del evento UIC desde producción
 * Genera un archivo JSON con los campos HTML (description, intro_html) de phases y tasks
 * 
 * Uso:
 *   node scripts/export-uic-phases-tasks.js
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

// Configuración de conexión
function getDbConfig() {
  // Para producción, puede venir de PROD_DB_* o DB_*
  const dbHost = (process.env.PROD_DB_HOST || process.env.DB_HOST || '').trim();
  const dbPort = (process.env.PROD_DB_PORT || process.env.DB_PORT || '').trim();
  const isDockerEnv = process.env.DOCKER === 'true';
  
  let host = dbHost || 'localhost';
  let port = dbPort ? parseInt(dbPort) : 3306;
  
  // Si el host es 'database' (hostname de Docker), siempre cambiar a localhost
  // a menos que estemos explícitamente en Docker (DOCKER=true)
  if (host === 'database') {
    if (!isDockerEnv) {
      host = 'localhost';
      port = 3406;
      info('Host "database" detectado pero ejecutándose fuera de Docker. Usando localhost:3406');
    } else {
      info('Host "database" detectado y ejecutándose dentro de Docker. Usando database:3306');
    }
  }
  // Si no hay host configurado, usar localhost con puerto mapeado por defecto
  else if (!dbHost) {
    host = 'localhost';
    port = 3406;
    info('Usando configuración por defecto: localhost:3406 (puerto mapeado de Docker)');
  }
  // Si el host es localhost pero no hay puerto explícito, usar puerto mapeado
  else if (host === 'localhost' && !dbPort) {
    port = 3406;
    info('Usando puerto mapeado de Docker: 3406');
  }
  
  const config = {
    host: host,
    port: port,
    user: process.env.PROD_DB_USER || process.env.DB_USER || 'root',
    password: process.env.PROD_DB_PASSWORD || process.env.DB_PASSWORD || 'root',
    database: process.env.PROD_DB_NAME || process.env.DB_NAME || 'create'
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

// Función para extraer valor de campo multilingüe (JSON)
// Si es un string JSON, lo parsea y extrae el valor en español
// Si es un objeto, extrae el valor en español
// Si es un string simple, lo devuelve tal cual
// SIEMPRE devuelve string o null (nunca objetos)
function extractMultilingualValue(value) {
  if (value === null || value === undefined || value === 'NULL' || value === '') {
    return null;
  }
  
  // Si ya es un objeto (MySQL puede devolver JSON como objeto parseado), extraer el valor
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    // Es un objeto multilingüe, extraer español o el primer valor disponible
    const extracted = value.es || value.ca || value.en || Object.values(value)[0] || null;
    // Asegurar que siempre devolvemos string o null
    if (extracted === null) {
      return null;
    }
    // Convertir a string si no lo es
    return typeof extracted === 'string' ? extracted : String(extracted);
  }
  
  // Si es un string que parece JSON, intentar parsearlo
  if (typeof value === 'string') {
    // Si no parece JSON, devolverlo tal cual
    const trimmed = value.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return value;
    }
    
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        // Es un objeto multilingüe, extraer español o el primer valor disponible
        const extracted = parsed.es || parsed.ca || parsed.en || Object.values(parsed)[0] || null;
        // Asegurar que siempre devolvemos string o null
        if (extracted === null) {
          return null;
        }
        // Convertir a string si no lo es
        return typeof extracted === 'string' ? extracted : String(extracted);
      }
      // Si no es un objeto, devolver el string original
      return value;
    } catch (e) {
      // Si falla el parseo, devolver el string original
      return value;
    }
  }
  
  // Si es cualquier otro tipo, convertirlo a string
  return value !== null ? String(value) : null;
}

// Función para normalizar fechas a ISO8601 (formato esperado por el endpoint de importación)
function normalizeDate(dateStr) {
  if (!dateStr || dateStr === 'NULL' || dateStr === '') {
    return null;
  }
  if (dateStr instanceof Date) {
    return dateStr.toISOString();
  }
  // Si es un string de fecha MySQL, convertir a ISO8601
  if (typeof dateStr === 'string') {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return null;
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

      // Obtener event_id y nombre del evento UIC
      info('Obteniendo eventos del tenant UIC...');
      const [eventRows] = await connection.execute(
        `SELECT id, name FROM events WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1`,
        [tenantId]
      );

      if (!eventRows || eventRows.length === 0) {
        error('No se encontró ningún evento para el tenant UIC');
        process.exit(1);
      }

      const eventId = eventRows[0].id;
      const eventName = eventRows[0].name || 'UIC Event';
      info(`Evento encontrado con ID: ${eventId}, Nombre: ${eventName}`);

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
      const processedPhases = phases.map(phase => {
        // Extraer valores multilingües y asegurar que sean strings
        const phaseName = extractMultilingualValue(phase.name);
        const phaseDescription = extractMultilingualValue(phase.description);
        const phaseIntroHtml = extractMultilingualValue(phase.intro_html);
        
        // Verificar que los valores extraídos sean strings (no objetos)
        const finalName = (typeof phaseName === 'string' ? phaseName : 
                          (phaseName && typeof phaseName === 'object' ? 
                           (phaseName.es || phaseName.ca || phaseName.en || Object.values(phaseName)[0] || '') : 
                           '')) || '';
        
        const finalDescription = (phaseDescription === null || phaseDescription === undefined) ? null :
                                (typeof phaseDescription === 'string' ? phaseDescription :
                                 (phaseDescription && typeof phaseDescription === 'object' ?
                                  (phaseDescription.es || phaseDescription.ca || phaseDescription.en || Object.values(phaseDescription)[0] || null) :
                                  null));
        
        const finalIntroHtml = (phaseIntroHtml === null || phaseIntroHtml === undefined) ? null :
                              (typeof phaseIntroHtml === 'string' ? phaseIntroHtml :
                               (phaseIntroHtml && typeof phaseIntroHtml === 'object' ?
                                (phaseIntroHtml.es || phaseIntroHtml.ca || phaseIntroHtml.en || Object.values(phaseIntroHtml)[0] || null) :
                                null));
        
        return {
          id: phase.id,
          name: finalName,
          description: finalDescription,
          intro_html: finalIntroHtml,
          order_index: phase.order_index || 1,
          start_date: normalizeDate(phase.start_date),
          end_date: normalizeDate(phase.end_date),
          view_start_date: normalizeDate(phase.view_start_date),
          view_end_date: normalizeDate(phase.view_end_date),
          is_elimination: Boolean(phase.is_elimination)
        };
      });

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

        // Extraer valores multilingües y asegurar que sean strings
        const taskTitle = extractMultilingualValue(task.title);
        const taskDescription = extractMultilingualValue(task.description);
        const taskIntroHtml = extractMultilingualValue(task.intro_html);
        
        // Verificar que los valores extraídos sean strings (no objetos)
        const finalTitle = (typeof taskTitle === 'string' ? taskTitle : 
                           (taskTitle && typeof taskTitle === 'object' ? 
                            (taskTitle.es || taskTitle.ca || taskTitle.en || Object.values(taskTitle)[0] || '') : 
                            '')) || '';
        
        const finalDescription = (taskDescription === null || taskDescription === undefined) ? null :
                                (typeof taskDescription === 'string' ? taskDescription :
                                 (taskDescription && typeof taskDescription === 'object' ?
                                  (taskDescription.es || taskDescription.ca || taskDescription.en || Object.values(taskDescription)[0] || null) :
                                  null));
        
        const finalIntroHtml = (taskIntroHtml === null || taskIntroHtml === undefined) ? null :
                              (typeof taskIntroHtml === 'string' ? taskIntroHtml :
                               (taskIntroHtml && typeof taskIntroHtml === 'object' ?
                                (taskIntroHtml.es || taskIntroHtml.ca || taskIntroHtml.en || Object.values(taskIntroHtml)[0] || null) :
                                null));
        
        return {
          id: task.id,
          phase_id: task.phase_id,
          title: finalTitle,
          description: finalDescription,
          intro_html: finalIntroHtml,
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

      // Crear objeto de exportación con formato compatible con el endpoint de importación
      // El formato debe ser: { phases: [{ ..., tasks: [...] }] }
      // donde las tareas están anidadas dentro de cada fase
      
      // Primero, agrupar tareas por phase_id
      const tasksByPhaseId = {};
      processedTasks.forEach(task => {
        if (!tasksByPhaseId[task.phase_id]) {
          tasksByPhaseId[task.phase_id] = [];
        }
        // Eliminar phase_id e id de la tarea (no se necesitan en el formato de importación)
        const { phase_id, id, ...taskData } = task;
        
        // Construir objeto de tarea, omitiendo campos undefined pero manteniendo null
        const taskPayload = {
          title: taskData.title,
          delivery_type: taskData.delivery_type,
          is_required: taskData.is_required,
          status: taskData.status,
          order_index: taskData.order_index,
          max_files: taskData.max_files
        };
        
        // Agregar campos opcionales solo si no son undefined
        if (taskData.description !== undefined) {
          taskPayload.description = taskData.description;
        }
        if (taskData.intro_html !== undefined) {
          taskPayload.intro_html = taskData.intro_html;
        }
        if (taskData.due_date !== undefined) {
          taskPayload.due_date = taskData.due_date;
        }
        if (taskData.max_file_size_mb !== undefined) {
          taskPayload.max_file_size_mb = taskData.max_file_size_mb;
        }
        if (taskData.allowed_mime_types !== undefined) {
          taskPayload.allowed_mime_types = taskData.allowed_mime_types;
        }
        
        tasksByPhaseId[task.phase_id].push(taskPayload);
      });

      // Crear fases con tareas anidadas (eliminar id de las fases)
      const phasesWithTasks = processedPhases.map(phase => {
        const { id, ...phaseData } = phase;
        
        // Asegurar que name sea siempre un string (no objeto)
        const phaseName = typeof phaseData.name === 'string' ? phaseData.name : 
                         (phaseData.name && typeof phaseData.name === 'object' ? 
                          (phaseData.name.es || phaseData.name.ca || phaseData.name.en || Object.values(phaseData.name)[0] || '') : 
                          '');
        
        // Construir objeto de fase, omitiendo campos undefined pero manteniendo null
        const phasePayload = {
          name: phaseName,
          order_index: phaseData.order_index,
          is_elimination: phaseData.is_elimination,
          tasks: tasksByPhaseId[phase.id] || []
        };
        
        // Agregar campos opcionales solo si no son undefined, asegurando que sean strings o null
        if (phaseData.description !== undefined) {
          if (phaseData.description === null) {
            phasePayload.description = null;
          } else if (typeof phaseData.description === 'string') {
            phasePayload.description = phaseData.description;
          } else if (typeof phaseData.description === 'object') {
            // Si todavía es un objeto, extraer el valor
            phasePayload.description = phaseData.description.es || phaseData.description.ca || phaseData.description.en || Object.values(phaseData.description)[0] || null;
          }
        }
        if (phaseData.intro_html !== undefined) {
          if (phaseData.intro_html === null) {
            phasePayload.intro_html = null;
          } else if (typeof phaseData.intro_html === 'string') {
            phasePayload.intro_html = phaseData.intro_html;
          } else if (typeof phaseData.intro_html === 'object') {
            // Si todavía es un objeto, extraer el valor
            phasePayload.intro_html = phaseData.intro_html.es || phaseData.intro_html.ca || phaseData.intro_html.en || Object.values(phaseData.intro_html)[0] || null;
          }
        }
        if (phaseData.start_date !== undefined) {
          phasePayload.start_date = phaseData.start_date;
        }
        if (phaseData.end_date !== undefined) {
          phasePayload.end_date = phaseData.end_date;
        }
        if (phaseData.view_start_date !== undefined) {
          phasePayload.view_start_date = phaseData.view_start_date;
        }
        if (phaseData.view_end_date !== undefined) {
          phasePayload.view_end_date = phaseData.view_end_date;
        }
        
        return phasePayload;
      });

      // Crear objeto de exportación en el formato esperado por el endpoint
      const exportData = {
        version: '1.0',
        event_name: eventName,
        exported_at: new Date().toISOString(),
        phases: phasesWithTasks
      };

      // Generar nombre de archivo
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const outputFile = path.resolve(process.cwd(), `uic-phases-tasks-export-${timestamp}.json`);

      // Escribir archivo
      fs.writeFileSync(outputFile, JSON.stringify(exportData, null, 2), 'utf8');

      info('Exportación completada:');
      info(`  - Archivo: ${outputFile}`);
      info(`  - Fases: ${phasesWithTasks.length}`);
      info(`  - Tareas totales: ${processedTasks.length}`);
      info(`  - Formato: Compatible con endpoint de importación (tareas anidadas en fases)`);

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

