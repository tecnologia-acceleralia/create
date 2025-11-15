import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getS3ClientAndSettings } from '../services/tenant-assets.service.js';

/**
 * Utilidades para trabajar con S3/DigitalOcean Spaces
 */

/**
 * Decodifica caracteres URL-encoded en formato _C3_B3 o %C3%B3
 * @param {string} fileName - Nombre del archivo que puede contener codificación
 * @returns {string} Nombre decodificado
 */
function decodeFileName(fileName) {
  if (!fileName) return '';
  
  try {
    let decoded = fileName;
    
    // Decodificar múltiples veces si es necesario (puede haber múltiples caracteres codificados)
    let changed = true;
    let iterations = 0;
    const maxIterations = 10; // Evitar bucles infinitos
    
    while (changed && iterations < maxIterations) {
      const before = decoded;
      
      // Si contiene patrones de codificación hexadecimal con guiones bajos
      // Patrón: _C3_B3 donde el guion bajo inicial es parte del patrón de codificación
      // Ejemplo: qu_C3_A9 -> qu + %C3%A9 -> qué (el guion bajo se elimina)
      if (decoded.includes('_')) {
        // Buscar TODOS los patrones _XX_XX y reemplazarlos por %XX%XX
        // Esto elimina el guion bajo inicial que es parte de la codificación
        // Ejemplo: qu_C3_A9 -> qu%C3%A9 -> qué
        decoded = decoded.replace(/_([A-F0-9]{2})_([A-F0-9]{2})/gi, (match, p1, p2) => {
          // Reemplazar _C3_B3 por %C3%B3 (eliminando ambos guiones bajos)
          return `%${p1}%${p2}`;
        });
      }
      
      // Si contiene codificación URL estándar (%XX)
      if (decoded.includes('%')) {
        try {
          decoded = decodeURIComponent(decoded);
        } catch (e) {
          // Si falla, puede ser que haya caracteres % que no son codificación válida
          // Intentar decodificar solo las secuencias válidas
          decoded = decoded.replace(/%[A-F0-9]{2}(%[A-F0-9]{2})?/gi, (match) => {
            try {
              return decodeURIComponent(match);
            } catch {
              return match;
            }
          });
        }
      }
      
      changed = (before !== decoded);
      iterations++;
    }
    
    return decoded;
  } catch (e) {
    // Si falla la decodificación, continuar con el nombre tal cual
    return fileName;
  }
}

/**
 * Normaliza un nombre de archivo eliminando acentos y caracteres especiales
 * @param {string} fileName - Nombre del archivo original
 * @returns {string} Nombre normalizado sin acentos
 */
export function normalizeFileName(fileName) {
  if (!fileName) return 'file.bin';
  
  // Primero decodificar caracteres URL-encoded si los hay
  const decoded = decodeFileName(fileName);
  
  // Separar extensión del nombre
  const lastDotIndex = decoded.lastIndexOf('.');
  let namePart = decoded;
  let extension = '';
  
  if (lastDotIndex > 0) {
    namePart = decoded.substring(0, lastDotIndex);
    extension = decoded.substring(lastDotIndex);
  }
  
  // Normalizar el nombre (eliminar acentos y caracteres especiales)
  namePart = namePart
    .normalize('NFD') // Descompone caracteres acentuados
    .replace(/[\u0300-\u036f]/g, '') // Elimina diacríticos (acentos)
    .replace(/[^a-zA-Z0-9.\-]/g, '-') // Reemplaza caracteres especiales por guiones (no guiones bajos)
    .replace(/_/g, '-') // Reemplaza todos los guiones bajos por guiones normales
    .replace(/-+/g, '-') // Reemplaza múltiples guiones por uno solo
    .replace(/^-+|-+$/g, '') // Elimina guiones al inicio y final
    .replace(/-+\./g, '.') // Elimina guiones antes del punto
    .replace(/\.+$/, ''); // Elimina puntos al final (si quedaron)
  
  // Combinar nombre normalizado con extensión
  return namePart + extension;
}

/**
 * Obtiene el tipo MIME basado en la extensión del archivo
 * @param {string} fileName - Nombre del archivo
 * @returns {string} Tipo MIME
 */
export function getMimeTypeFromFileName(fileName) {
  const extension = fileName.split('.').pop()?.toLowerCase();
  const mimeTypes = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'webp': 'image/webp'
  };
  return mimeTypes[extension] || 'application/octet-stream';
}

/**
 * Extrae el nombre del archivo original de una clave S3
 * Formato esperado: tenants/{tenantId}/events/{eventId}/assets/{timestamp}-{uuid}-{filename}
 * @param {string} s3Key - Clave S3 completa
 * @returns {string} Nombre del archivo original (decodificado)
 */
export function extractFileNameFromS3Key(s3Key) {
  const parts = s3Key.split('/');
  const fileNamePart = parts[parts.length - 1];
  // El formato es: {timestamp}-{uuid}-{filename}
  // Extraemos el nombre del archivo después del último guion
  const match = fileNamePart.match(/^[\d]+-[a-f0-9-]+-(.+)$/i);
  let fileName = match && match[1] ? match[1] : fileNamePart;
  
  // Decodificar caracteres URL-encoded
  // Puede estar en formato: %C3%B3 o con guiones bajos donde había espacios/caracteres especiales
  try {
    // Primero intentar decodificar si está en formato URL encoding estándar (%XX)
    if (fileName.includes('%')) {
      fileName = decodeURIComponent(fileName);
    }
    // Nota: Si el nombre fue normalizado con /[^\w.\-]+/g, los acentos ya se perdieron
    // y no podemos recuperarlos. En ese caso, el nombre ya está en su forma final.
  } catch (e) {
    // Si falla la decodificación, devolver el nombre tal cual
  }
  
  return fileName;
}

/**
 * Lista todos los objetos en S3 para un evento específico
 * @param {number} tenantId - ID del tenant
 * @param {number} eventId - ID del evento
 * @returns {Promise<Array<{s3Key: string, fileName: string, fileSize: number, lastModified: Date}>>}
 */
export async function listEventAssetsFromS3(tenantId, eventId) {
  const s3Config = getS3ClientAndSettings();
  
  if (!s3Config) {
    console.warn('⚠ S3 no está configurado. Saltando obtención de recursos desde S3.');
    return [];
  }

  const { client, settings } = s3Config;
  const prefix = `tenants/${tenantId}/events/${eventId}/assets/`;
  
  const objects = [];
  let continuationToken;

  do {
    const command = new ListObjectsV2Command({
      Bucket: settings.bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken
    });

    const response = await client.send(command);
    
    if (response.Contents) {
      for (const item of response.Contents) {
        if (item.Key && item.Key !== prefix) {
          const fileName = extractFileNameFromS3Key(item.Key);
          
          objects.push({
            s3Key: item.Key,
            fileName: fileName,
            fileSize: item.Size || 0,
            lastModified: item.LastModified
          });
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return objects;
}

/**
 * Lista todos los objetos en S3 bajo un prefijo específico
 * @param {string} prefix - Prefijo de la ruta en S3 (ej: "tenants/1/events/2/assets/")
 * @returns {Promise<Array<{s3Key: string, fileName: string, fileSize: number, lastModified: Date}>>}
 */
export async function listObjectsByPrefix(prefix) {
  const s3Config = getS3ClientAndSettings();
  
  if (!s3Config) {
    console.warn('⚠ S3 no está configurado. Saltando obtención de recursos desde S3.');
    return [];
  }

  const { client, settings } = s3Config;
  
  const objects = [];
  let continuationToken;

  do {
    const command = new ListObjectsV2Command({
      Bucket: settings.bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken
    });

    const response = await client.send(command);
    
    if (response.Contents) {
      for (const item of response.Contents) {
        if (item.Key && item.Key !== prefix) {
          objects.push({
            s3Key: item.Key,
            fileName: item.Key.split('/').pop() || item.Key,
            fileSize: item.Size || 0,
            lastModified: item.LastModified
          });
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return objects;
}

/**
 * Construye la URL pública de un objeto S3
 * @param {string} s3Key - Clave S3 del objeto
 * @returns {string|null} URL pública del objeto o null si no se puede construir
 */
export function buildPublicUrl(s3Key) {
  const s3Config = getS3ClientAndSettings();
  
  if (!s3Config || !s3Config.settings.publicBaseUrl) {
    return null;
  }

  return `${s3Config.settings.publicBaseUrl}/${s3Key}`;
}

