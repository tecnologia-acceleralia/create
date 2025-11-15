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

// Configuración de visibilidad para logs de depuración en consola
const enableConsoleDebugLogs =
  (process.env.CONSOLE_DEBUG_LOGS || '').toLowerCase() === 'true';

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
    if (enableConsoleDebugLogs) {
      console.log(logMessage);
    }
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
    if (enableConsoleDebugLogs) {
      console.log(logMessage);
    }
    writeToFile(logFiles.auth, logMessage);
  }
};

/**
 * Logger general
 */
export const generalLogger = {
  info: (message, data = null) => {
    // Manejar caso donde message es un objeto
    let messageStr = message;
    let dataObj = data;
    
    if (message && typeof message === 'object' && !(message instanceof Error)) {
      // Si message es un objeto, tratarlo como data
      dataObj = message;
      messageStr = 'Log entry';
    } else {
      messageStr = String(message || '');
    }
    
    const logMessage = `[GENERAL-INFO] ${messageStr}${dataObj ? ` | Data: ${JSON.stringify(dataObj, null, 2)}` : ''}`;
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
    if (enableConsoleDebugLogs) {
      console.log(logMessage);
    }
    writeToFile(logFiles.general, logMessage);
  }
};

export const logger = {
  info: (...args) => {
    // Manejar diferentes formas de llamar al logger
    if (args.length === 0) {
      generalLogger.info('Log entry');
    } else if (args.length === 1) {
      // Si solo hay un argumento, verificar si es string u objeto
      if (typeof args[0] === 'string') {
        generalLogger.info(args[0]);
      } else {
        generalLogger.info('Log entry', args[0]);
      }
    } else {
      // Múltiples argumentos: primero es mensaje, resto son data
      generalLogger.info(args[0], args.length > 1 ? args.slice(1) : null);
    }
  },
  error: (...args) => {
    if (args.length === 0) {
      generalLogger.error('Error entry');
    } else if (args.length === 1) {
      if (typeof args[0] === 'string') {
        generalLogger.error(args[0]);
      } else if (args[0] instanceof Error) {
        generalLogger.error('Error occurred', args[0]);
      } else {
        generalLogger.error('Error entry', args[0]);
      }
    } else {
      generalLogger.error(args[0], args[1]);
    }
  },
  warn: (...args) => {
    if (args.length === 0) {
      generalLogger.warn('Warning entry');
    } else if (args.length === 1) {
      if (typeof args[0] === 'string') {
        generalLogger.warn(args[0]);
      } else {
        generalLogger.warn('Warning entry', args[0]);
      }
    } else {
      generalLogger.warn(args[0], args.length > 1 ? args.slice(1) : null);
    }
  },
  debug: (...args) => {
    if (args.length === 0) {
      generalLogger.debug('Debug entry');
    } else if (args.length === 1) {
      if (typeof args[0] === 'string') {
        generalLogger.debug(args[0]);
      } else {
        generalLogger.debug('Debug entry', args[0]);
      }
    } else {
      generalLogger.debug(args[0], args.length > 1 ? args.slice(1) : null);
    }
  }
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

