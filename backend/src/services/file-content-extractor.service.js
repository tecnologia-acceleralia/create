import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getS3ClientAndSettings, extractKeyFromUrl } from './tenant-assets.service.js';
import { logger } from '../utils/logger.js';

// Nota: Estas dependencias deben instalarse con npm/pnpm
// import pdfParse from 'pdf-parse';
// import mammoth from 'mammoth';
// import { extract } from 'pptx2json';

// Límites de seguridad
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

/**
 * Descarga un archivo desde S3 y retorna su buffer
 * @param {string} url - URL pública del archivo
 * @returns {Promise<Buffer>}
 */
async function downloadFileFromS3(url) {
  const s3Config = getS3ClientAndSettings();
  if (!s3Config) {
    throw new Error('Object storage no configurado. Revisa las variables SPACES_*.');
  }
  const { client, settings } = s3Config;
  const key = extractKeyFromUrl(url, settings);
  
  if (!key) {
    throw new Error(`No se pudo extraer la clave S3 de la URL: ${url}`);
  }

  const command = new GetObjectCommand({
    Bucket: settings.bucket,
    Key: key
  });

  const response = await client.send(command);
  
  // Convertir stream a buffer
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  
  return Buffer.concat(chunks);
}

/**
 * Extrae texto de un archivo PDF
 * @param {Buffer} buffer - Buffer del archivo PDF
 * @returns {Promise<string>}
 */
async function extractPdfContent(buffer) {
  try {
    // Importación dinámica para evitar errores si no está instalado
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (error) {
    logger.error('Error extrayendo contenido de PDF', {
      error: error.message,
      stack: error.stack
    });
    throw new Error(`No se pudo extraer el contenido del PDF: ${error.message}`);
  }
}

/**
 * Extrae texto de un archivo DOCX
 * @param {Buffer} buffer - Buffer del archivo DOCX
 * @returns {Promise<string>}
 */
async function extractDocxContent(buffer) {
  try {
    // Importación dinámica
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (error) {
    logger.error('Error extrayendo contenido de DOCX', {
      error: error.message,
      stack: error.stack
    });
    throw new Error(`No se pudo extraer el contenido del DOCX: ${error.message}`);
  }
}

/**
 * Extrae texto de un archivo PPTX
 * @param {Buffer} buffer - Buffer del archivo PPTX
 * @returns {Promise<string>}
 */
async function extractPptxContent(buffer) {
  try {
    // Usamos node-pptx-parser que requiere un path de archivo
    // Guardamos temporalmente el buffer en un archivo temporal
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `pptx-${Date.now()}-${Math.random().toString(36).substring(7)}.pptx`);
    
    try {
      // Escribir buffer a archivo temporal
      await fs.promises.writeFile(tempFile, buffer);
      
      // Importar y usar el parser
      // Nota: node-pptx-parser puede exportar de diferentes formas
      const pptxParserModule = await import('node-pptx-parser');
      const PptxParser = pptxParserModule.default || pptxParserModule;
      
      const parser = new PptxParser(tempFile);
      
      // Intentar ambos métodos posibles según la versión de la biblioteca
      let textContent;
      if (typeof parser.extractText === 'function') {
        textContent = await parser.extractText();
      } else if (typeof parser.parse === 'function') {
        const parsed = await parser.parse(tempFile);
        textContent = parsed;
      } else {
        throw new Error('No se pudo encontrar método de extracción en node-pptx-parser');
      }
      
      // Limpiar archivo temporal
      await fs.promises.unlink(tempFile).catch(() => {
        // Ignorar errores al eliminar archivo temporal
      });
      
      // Concatenar texto de todas las slides
      let fullText = '';
      if (Array.isArray(textContent)) {
        for (const slide of textContent) {
          if (slide.text && Array.isArray(slide.text)) {
            fullText += slide.text.join('\n') + '\n\n';
          } else if (typeof slide.text === 'string') {
            fullText += slide.text + '\n\n';
          } else if (typeof slide === 'string') {
            // Si textContent es un array de strings
            fullText += slide + '\n\n';
          }
        }
      } else if (typeof textContent === 'string') {
        fullText = textContent;
      } else if (textContent && typeof textContent === 'object') {
        // Si es un objeto con estructura diferente
        logger.warn('Estructura de respuesta de PPTX parser no reconocida', {
          textContentType: typeof textContent,
          textContentKeys: Object.keys(textContent || {})
        });
        // Intentar extraer texto de alguna forma
        if (textContent.slides && Array.isArray(textContent.slides)) {
          for (const slide of textContent.slides) {
            if (slide.text) {
              fullText += (Array.isArray(slide.text) ? slide.text.join('\n') : slide.text) + '\n\n';
            }
          }
        }
      }
      
      return fullText.trim();
    } catch (parseError) {
      // Asegurarse de limpiar archivo temporal en caso de error
      await fs.promises.unlink(tempFile).catch(() => {
        // Ignorar errores al eliminar archivo temporal
      });
      throw parseError;
    }
  } catch (error) {
    logger.error('Error extrayendo contenido de PPTX', {
      error: error.message,
      stack: error.stack
    });
    throw new Error(`No se pudo extraer el contenido del PPTX: ${error.message}`);
  }
}

/**
 * Extrae contenido de un archivo basado en su MIME type
 * @param {string} url - URL pública del archivo
 * @param {string} mimeType - MIME type del archivo
 * @param {number} fileSizeBytes - Tamaño del archivo en bytes
 * @returns {Promise<string>}
 */
export async function extractFileContent(url, mimeType, fileSizeBytes) {
  // Validar tamaño
  if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new Error(`El archivo es demasiado grande (${(fileSizeBytes / 1024 / 1024).toFixed(2)}MB). Tamaño máximo permitido: ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`);
  }

  // Descargar archivo desde S3
  const buffer = await downloadFileFromS3(url);

  // Verificar que el tamaño descargado coincida
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(`El archivo descargado es demasiado grande (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`);
  }

  // Extraer contenido según el tipo MIME
  const normalizedMimeType = mimeType?.toLowerCase() || '';

  if (normalizedMimeType === 'application/pdf') {
    return await extractPdfContent(buffer);
  } else if (
    normalizedMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    normalizedMimeType === 'application/msword'
  ) {
    return await extractDocxContent(buffer);
  } else if (
    normalizedMimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    normalizedMimeType === 'application/vnd.ms-powerpoint'
  ) {
    return await extractPptxContent(buffer);
  } else {
    throw new Error(`Tipo de archivo no soportado para extracción: ${mimeType}. Tipos soportados: PDF, DOCX, PPTX`);
  }
}

/**
 * Extrae contenido de múltiples archivos
 * @param {Array<{url: string, mime_type: string, size_bytes: number, original_name: string}>} files - Array de archivos
 * @returns {Promise<Array<{original_name: string, mime_type: string, content: string, error?: string}>>}
 */
export async function extractFilesContent(files) {
  if (!Array.isArray(files) || files.length === 0) {
    return [];
  }

  const results = await Promise.allSettled(
    files.map(async (file) => {
      try {
        const content = await extractFileContent(
          file.url,
          file.mime_type,
          file.size_bytes
        );
        
        return {
          original_name: file.original_name || file.url,
          mime_type: file.mime_type,
          content: content,
          success: true
        };
      } catch (error) {
        logger.warn('Error extrayendo contenido de archivo', {
          fileName: file.original_name,
          mimeType: file.mime_type,
          error: error.message
        });
        
        return {
          original_name: file.original_name || file.url,
          mime_type: file.mime_type,
          content: '',
          error: error.message,
          success: false
        };
      }
    })
  );

  // Convertir resultados Promise.allSettled a formato esperado
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      const file = files[index];
      return {
        original_name: file?.original_name || file?.url || 'archivo',
        mime_type: file?.mime_type || 'unknown',
        content: '',
        error: result.reason?.message || 'Error desconocido al extraer contenido',
        success: false
      };
    }
  });
}
