/**
 * Sistema de Logging a Archivo
 * 
 * Este logger guarda los logs en archivos que se montan en un volumen de Docker
 * para facilitar el debugging en desarrollo
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Crear directorio de logs si no existe
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Archivos de log
const logFiles = {
  tenant: path.join(logsDir, 'tenant-creation.log'),
  auth: path.join(logsDir, 'auth.log'),
  general: path.join(logsDir, 'general.log'),
  error: path.join(logsDir, 'error.log')
};

/**
 * Función para escribir en archivo de log
 */
const writeToFile = (filename, message) => {
  try {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(filename, logMessage);
  } catch (error) {
    console.error('Error writing to log file:', error);
  }
};

/**
 * Logger para creación de tenants
 */
export const tenantLogger = {
  info: (message, data = null) => {
    const logMessage = `[TENANT-INFO] ${message}${data ? ` | Data: ${JSON.stringify(data, null, 2)}` : ''}`;
    console.log(logMessage);
    writeToFile(logFiles.tenant, logMessage);
  },
  
  error: (message, error = null) => {
    const logMessage = `[TENANT-ERROR] ${message}${error ? ` | Error: ${error.message} | Stack: ${error.stack}` : ''}`;
    console.error(logMessage);
    writeToFile(logFiles.tenant, logMessage);
    writeToFile(logFiles.error, logMessage);
  },
  
  warn: (message, data = null) => {
    const logMessage = `[TENANT-WARN] ${message}${data ? ` | Data: ${JSON.stringify(data, null, 2)}` : ''}`;
    console.warn(logMessage);
    writeToFile(logFiles.tenant, logMessage);
  },
  
  debug: (message, data = null) => {
    const logMessage = `[TENANT-DEBUG] ${message}${data ? ` | Data: ${JSON.stringify(data, null, 2)}` : ''}`;
    console.log(logMessage);
    writeToFile(logFiles.tenant, logMessage);
  }
};

/**
 * Logger para autenticación
 */
export const authLogger = {
  info: (message, data = null) => {
    const logMessage = `[AUTH-INFO] ${message}${data ? ` | Data: ${JSON.stringify(data, null, 2)}` : ''}`;
    console.log(logMessage);
    writeToFile(logFiles.auth, logMessage);
  },
  
  error: (message, error = null) => {
    const logMessage = `[AUTH-ERROR] ${message}${error ? ` | Error: ${error.message} | Stack: ${error.stack}` : ''}`;
    console.error(logMessage);
    writeToFile(logFiles.auth, logMessage);
    writeToFile(logFiles.error, logMessage);
  },
  
  warn: (message, data = null) => {
    const logMessage = `[AUTH-WARN] ${message}${data ? ` | Data: ${JSON.stringify(data, null, 2)}` : ''}`;
    console.warn(logMessage);
    writeToFile(logFiles.auth, logMessage);
  },
  
  debug: (message, data = null) => {
    const logMessage = `[AUTH-DEBUG] ${message}${data ? ` | Data: ${JSON.stringify(data, null, 2)}` : ''}`;
    console.log(logMessage);
    writeToFile(logFiles.auth, logMessage);
  }
};

/**
 * Logger general
 */
export const generalLogger = {
  info: (message, data = null) => {
    const logMessage = `[GENERAL-INFO] ${message}${data ? ` | Data: ${JSON.stringify(data, null, 2)}` : ''}`;
    console.log(logMessage);
    writeToFile(logFiles.general, logMessage);
  },
  
  error: (message, error = null) => {
    let extra = '';

    if (error instanceof Error) {
      extra = ` | Error: ${error.message} | Stack: ${error.stack}`;
    } else if (error && typeof error === 'object') {
      extra = ` | Data: ${JSON.stringify(error, null, 2)}`;
    } else if (error) {
      extra = ` | Error: ${String(error)}`;
    }

    const logMessage = `[GENERAL-ERROR] ${message}${extra}`;
    console.error(logMessage);
    writeToFile(logFiles.general, logMessage);
    writeToFile(logFiles.error, logMessage);
  },
  
  warn: (message, data = null) => {
    const logMessage = `[GENERAL-WARN] ${message}${data ? ` | Data: ${JSON.stringify(data, null, 2)}` : ''}`;
    console.warn(logMessage);
    writeToFile(logFiles.general, logMessage);
  },
  
  debug: (message, data = null) => {
    const logMessage = `[GENERAL-DEBUG] ${message}${data ? ` | Data: ${JSON.stringify(data, null, 2)}` : ''}`;
    console.log(logMessage);
    writeToFile(logFiles.general, logMessage);
  }
};

export const logger = {
  info: (...args) => generalLogger.info(...args),
  error: (...args) => generalLogger.error(...args),
  warn: (...args) => generalLogger.warn(...args),
  debug: (...args) => generalLogger.debug(...args)
};

/**
 * Función para limpiar logs antiguos (opcional)
 */
export const cleanOldLogs = (daysToKeep = 7) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  Object.values(logFiles).forEach(filePath => {
    try {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          generalLogger.info(`Cleaned old log file: ${path.basename(filePath)}`);
        }
      }
    } catch (error) {
      generalLogger.error(`Error cleaning log file ${filePath}:`, error);
    }
  });
};

export default {
  tenantLogger,
  authLogger,
  generalLogger,
  logger,
  cleanOldLogs
};

