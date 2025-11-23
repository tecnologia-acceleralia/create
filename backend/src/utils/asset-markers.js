import { logger } from './logger.js';

/**
 * Escapa caracteres especiales HTML para prevenir XSS.
 */
export function escapeHtml(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Escapa caracteres especiales para usar en regex de reemplazo.
 */
export function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Obtiene una propiedad de un asset de manera segura (funciona con modelos Sequelize y objetos planos)
 */
export function getAssetProperty(asset, property) {
  if (!asset) return null;
  // Si es un modelo Sequelize, usar get(), sino acceso directo
  if (typeof asset.get === 'function') {
    return asset.get(property);
  }
  return asset[property];
}

/**
 * Genera el HTML de una imagen con las clases CSS apropiadas.
 * La imagen ocupa el 75% del ancho y está centrada.
 *
 * @param {string} escapedUrl - URL del asset ya escapada para HTML
 * @param {string} escapedAlt - Texto alternativo ya escapado para HTML
 * @returns {string} HTML del elemento img con contenedor
 */
export function createImageHtml(escapedUrl, escapedAlt) {
  return `<div class="flex justify-center my-4"><img src="${escapedUrl}" alt="${escapedAlt}" style="width: 75%; max-width: 75%; height: auto;" class="block mx-auto" /></div>`;
}

/**
 * Determina si un asset es una imagen basándose en su mime_type o extensión del archivo.
 */
export function isImageAsset(asset) {
  if (!asset) {
    logger.warn('isImageAsset recibió asset null/undefined');
    return false;
  }
  
  // Obtener propiedades de manera segura
  const mimeType = getAssetProperty(asset, 'mime_type');
  const originalFilename = getAssetProperty(asset, 'original_filename');
  const url = getAssetProperty(asset, 'url');
  const name = getAssetProperty(asset, 'name');
  
  // Log para depuración
  const debugInfo = {
    name,
    mime_type: mimeType,
    original_filename: originalFilename,
    url,
    mime_type_type: typeof mimeType,
    mime_type_value: mimeType
  };
  
  // Verificar por mime_type primero
  if (mimeType) {
    const mimeTypeLower = String(mimeType).toLowerCase().trim();
    // Verificar si comienza con 'image/' (cubre image/jpeg, image/png, image/jpg, etc.)
    if (mimeTypeLower.startsWith('image/')) {
      logger.debug('Asset detectado como imagen por mime_type', { ...debugInfo, detected: true, method: 'mime_type', mimeTypeLower });
      return true;
    }
  }
  
  // Fallback: verificar por extensión del archivo si el mime_type no está disponible o no es válido
  const fileName = (originalFilename || url || '').toLowerCase();
  if (fileName) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];
    const isImage = imageExtensions.some(ext => fileName.endsWith(ext));
    if (isImage) {
      logger.debug('Asset detectado como imagen por extensión', { ...debugInfo, detected: true, method: 'file_extension', fileName });
      return true;
    }
  }
  
  logger.debug('Asset NO detectado como imagen', { ...debugInfo, detected: false });
  return false;
}


/**
 * Extrae todos los nombres de assets mencionados en un HTML.
 * Útil para validar que los assets existen antes de guardar.
 *
 * @param {string} html - Contenido HTML
 * @returns {string[]} Array de nombres de assets mencionados
 */
export function extractAssetNames(html) {
  if (!html || typeof html !== 'string') {
    return [];
  }

  const markerRegex = /\{\{asset:([a-zA-Z0-9_.-]+)\}\}/g;
  const matches = [...html.matchAll(markerRegex)];
  return [...new Set(matches.map(match => match[1]))];
}

/**
 * Determina el tipo de icono y color según el tipo de archivo (mime type o extensión).
 * 
 * IMPORTANTE: Esta función debe usar la MISMA lógica que getFileIcon en frontend/src/utils/files.ts
 * La lógica está duplicada aquí porque frontend y backend tienen diferentes sistemas de módulos.
 * Si cambias la lógica aquí, DEBES actualizar también frontend/src/utils/files.ts para mantener consistencia.
 * 
 * Mapeo de iconos Lucide a strings:
 * - FileIcon -> 'file'
 * - FileText -> 'fileText'
 * - FileImage -> 'fileImage'
 * - FileVideo -> 'fileVideo'
 * - FileAudio -> 'fileAudio'
 * - FileSpreadsheet -> 'fileSpreadsheet'
 * - FileCode -> 'fileCode'
 * - FileArchive -> 'fileArchive'
 *
 * @param {string} mimeType - Tipo MIME del archivo
 * @param {string} fileName - Nombre del archivo (para extraer extensión)
 * @returns {{iconType: string, color: string}} Objeto con el tipo de icono y el color hexadecimal
 */
export function getFileIconType(mimeType, fileName) {
  // NOTA: Esta función debe replicar EXACTAMENTE la lógica de getFileIcon en frontend/src/utils/files.ts
  // Ver esa función como fuente de verdad para cambios futuros
  
  const extension = (fileName || '').split('.').pop()?.toLowerCase() || '';
  const mime = (mimeType || '').toLowerCase();

  // PDF - debe ir primero porque algunos PDFs pueden tener mime types genéricos
  if (extension === 'pdf' || mime === 'application/pdf') {
    return { iconType: 'fileText', color: '#dc2626' }; // red-600
  }

  // PowerPoint - verificar extensión primero
  if (extension === 'ppt' || extension === 'pptx' || 
      mime.includes('presentation') || mime.includes('powerpoint')) {
    return { iconType: 'fileText', color: '#ea580c' }; // orange-600
  }

  // Word - verificar extensión primero
  if (extension === 'doc' || extension === 'docx' || 
      mime.includes('word') || mime === 'application/msword') {
    return { iconType: 'fileText', color: '#2563eb' }; // blue-600
  }

  // Excel - verificar extensión primero
  if (extension === 'xls' || extension === 'xlsx' || 
      mime.includes('spreadsheet') || mime.includes('excel')) {
    return { iconType: 'fileSpreadsheet', color: '#16a34a' }; // green-600
  }

  // Imágenes
  if (mime.startsWith('image/')) {
    return { iconType: 'fileImage', color: '#9333ea' }; // purple-600
  }

  // Videos
  if (mime.startsWith('video/')) {
    return { iconType: 'fileVideo', color: '#db2777' }; // pink-600
  }

  // Audio
  if (mime.startsWith('audio/')) {
    return { iconType: 'fileAudio', color: '#4f46e5' }; // indigo-600
  }

  // Archivos comprimidos
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension) ||
      mime.includes('zip') || mime.includes('rar') || mime.includes('tar') || mime.includes('gzip')) {
    return { iconType: 'fileArchive', color: '#ca8a04' }; // yellow-600
  }

  // Código
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'html', 'css', 'json', 'xml'].includes(extension) ||
      (mime.includes('text/') && ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'html', 'css', 'json', 'xml'].includes(extension))) {
    return { iconType: 'fileCode', color: '#0891b2' }; // cyan-600
  }

  // Texto plano
  if (extension === 'txt' || mime.startsWith('text/')) {
    return { iconType: 'fileText', color: '#4b5563' }; // gray-600
  }

  // Por defecto
  return { iconType: 'file', color: '#6b7280' }; // gray-500
}

/**
 * Genera el HTML de un icono SVG según el tipo de archivo (mime type o extensión).
 * Usa la misma lógica que getFileIcon del frontend para mantener consistencia.
 *
 * @param {string} mimeType - Tipo MIME del archivo
 * @param {string} fileName - Nombre del archivo (para extraer extensión)
 * @returns {string} HTML del icono SVG inline con color
 */
export function getFileIconHtml(mimeType, fileName) {
  const { iconType, color } = getFileIconType(mimeType, fileName);

  // Definir iconos SVG (simplificados basados en Lucide icons)
  // Cada icono es un SVG de 16x16 píxeles - deben coincidir con los iconos usados en el frontend
  const icons = {
    file: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>',
    fileText: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>',
    fileImage: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m10 12 2 2 4-4"/><circle cx="16" cy="10" r="1.5"/></svg>',
    fileVideo: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m10 14 6-4-6-4v8Z"/></svg>',
    fileAudio: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 10v4"/><path d="M14 8v8"/></svg>',
    fileSpreadsheet: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9h6"/><path d="M10 13h6"/><path d="M10 17h4"/></svg>',
    fileCode: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m10 12-2 2 2 2"/><path d="m14 12 2 2-2 2"/></svg>',
    fileArchive: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9h4"/><path d="M10 13h4"/></svg>'
  };

  const iconSvg = icons[iconType] || icons.file;

  // Reemplazar el color del stroke en el SVG
  const escapedColor = escapeHtml(color);
  let coloredSvg = iconSvg.replace('stroke="currentColor"', `stroke="${escapedColor}"`);
  
  // Añadir clases de Tailwind h-4 w-4 al SVG para que coincida con el frontend
  // El SVG ya tiene width="16" height="16" en el código, pero añadimos clases Tailwind
  // para asegurar consistencia y que Tailwind pueda aplicar sus estilos
  coloredSvg = coloredSvg.replace(
    /<svg\s+([^>]*?)>/,
    `<svg $1 class="h-4 w-4" style="flex-shrink: 0; display: inline-block; vertical-align: text-bottom;">`
  );

  // Contenedor siguiendo el patrón del frontend
  // El frontend usa: <span className="flex-shrink-0"> para contener el icono
  return `<span class="inline-flex items-center shrink-0 mr-1.5" aria-hidden="true">${coloredSvg}</span>`;
}

