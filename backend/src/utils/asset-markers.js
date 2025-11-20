import { getModels } from '../models/index.js';
import { logger } from './logger.js';

/**
 * Escapa caracteres especiales HTML para prevenir XSS.
 */
function escapeHtml(text) {
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
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Obtiene una propiedad de un asset de manera segura (funciona con modelos Sequelize y objetos planos)
 */
function getAssetProperty(asset, property) {
  if (!asset) return null;
  // Si es un modelo Sequelize, usar get(), sino acceso directo
  if (typeof asset.get === 'function') {
    return asset.get(property);
  }
  return asset[property];
}

/**
 * Determina si un asset es una imagen basándose en su mime_type o extensión del archivo.
 */
function isImageAsset(asset) {
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
 * Reemplaza los marcadores de assets en HTML por links HTML o imágenes.
 * Los marcadores tienen el formato: {{asset:nombre-del-recurso}}
 * Si el asset es una imagen, se renderiza como <img>, si no, como <a>.
 *
 * @param {string} html - Contenido HTML que puede contener marcadores
 * @param {number} eventId - ID del evento
 * @param {number} tenantId - ID del tenant
 * @returns {Promise<string>} HTML con los marcadores reemplazados por links HTML o imágenes
 */
export async function resolveAssetMarkers(html, eventId, tenantId) {
  if (!html || typeof html !== 'string') {
    return html || '';
  }

  const markerRegex = /\{\{asset:([a-zA-Z0-9_.-]+)\}\}/g;
  const matches = [...html.matchAll(markerRegex)];

  if (matches.length === 0) {
    return html;
  }

  const { EventAsset } = getModels();

  // Obtener todos los assets únicos mencionados en los marcadores
  const assetNames = [...new Set(matches.map(match => match[1]))];

  // Buscar todos los assets de una vez (asegurarse de cargar todos los atributos)
  const assets = await EventAsset.findAll({
    where: {
      tenant_id: tenantId,
      event_id: eventId,
      name: assetNames
    },
    attributes: ['id', 'name', 'original_filename', 'url', 'mime_type', 'file_size', 'description', 's3_key']
  });
  
  // Log para depuración
  logger.debug('Assets encontrados para marcadores', {
    eventId,
    tenantId,
    assetNames,
    assetsFound: assets.map(a => ({
      name: a.name,
      mime_type: a.mime_type,
      original_filename: a.original_filename,
      url: a.url
    }))
  });

  // Crear mapas de búsqueda por name (exacto y case-insensitive)
  const assetMapByName = new Map();
  const assetMapByNameLower = new Map();
  assets.forEach(asset => {
    assetMapByName.set(asset.name, asset);
    assetMapByNameLower.set(asset.name.toLowerCase(), asset);
  });

  // Reemplazar cada marcador por un link HTML
  let resolvedHtml = html;
  
  // Primero procesar marcadores que están dentro de elementos <a> para evitar links anidados
  // Regex para encontrar <a> tags completos que contienen marcadores en el href
  // Maneja atributos en cualquier orden, espacios, y contenido del link (incluyendo múltiples líneas)
  // El patrón busca: <a ... href="..." o href='...' ...> contenido </a>
  const linkWithMarkerRegex = /<a\s+[^>]*href\s*=\s*["']\{\{asset:([a-zA-Z0-9_.-]+)\}\}["'][^>]*>([\s\S]*?)<\/a>/gi;
  const linkMatches = [...html.matchAll(linkWithMarkerRegex)];
  
  // Crear un Set de marcadores que ya fueron procesados como parte de <a> tags
  const processedInLinks = new Set();
  
  // Procesar cada <a> que contiene un marcador
  linkMatches.forEach(linkMatch => {
    const [fullLinkMatch, assetName, linkText] = linkMatch;
    
    // Buscar el asset
    let asset = assetMapByName.get(assetName);
    if (!asset) {
      asset = assetMapByNameLower.get(assetName.toLowerCase());
    }
    
    if (asset) {
      const assetUrl = getAssetProperty(asset, 'url');
      const escapedUrl = escapeHtml(assetUrl);
      
      // Log detallado antes de verificar si es imagen
      logger.debug('Procesando asset en <a> tag', {
        assetName,
        mime_type: getAssetProperty(asset, 'mime_type'),
        original_filename: getAssetProperty(asset, 'original_filename'),
        url: assetUrl
      });
      
      // Si es una imagen, crear un elemento <img> en lugar de un link
      if (isImageAsset(asset)) {
        const altText = linkText.trim() || getAssetProperty(asset, 'description') || getAssetProperty(asset, 'original_filename') || getAssetProperty(asset, 'name');
        const escapedAlt = escapeHtml(altText);
        const imgHtml = `<img src="${escapedUrl}" alt="${escapedAlt}" class="max-w-full h-auto" />`;
        
        // Escapar el link completo para regex y reemplazarlo por la imagen
        const escapedLinkMatch = escapeRegex(fullLinkMatch);
        const linkRegex = new RegExp(escapedLinkMatch, 'g');
        resolvedHtml = resolvedHtml.replace(linkRegex, imgHtml);
        
        logger.info('✅ Marcador de imagen reemplazado en <a> tag', {
          assetName,
          mime_type: getAssetProperty(asset, 'mime_type'),
          eventId,
          tenantId
        });
      } else {
        // Si no es una imagen, crear nuevo link HTML reemplazando todo el <a> completo
        const finalLinkText = linkText.trim() || getAssetProperty(asset, 'description') || getAssetProperty(asset, 'original_filename') || getAssetProperty(asset, 'name');
        const escapedText = escapeHtml(finalLinkText);
        
        const newLinkHtml = `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer" class="text-primary underline hover:text-primary/80">${escapedText}</a>`;
        
        // Escapar el link completo para regex
        const escapedLinkMatch = escapeRegex(fullLinkMatch);
        const linkRegex = new RegExp(escapedLinkMatch, 'g');
        resolvedHtml = resolvedHtml.replace(linkRegex, newLinkHtml);
        
        logger.debug('Marcador reemplazado como link (no es imagen)', {
          assetName,
          mime_type: getAssetProperty(asset, 'mime_type'),
          eventId,
          tenantId
        });
      }
      
      // Marcar este marcador como procesado
      processedInLinks.add(`{{asset:${assetName}}}`);
    } else {
      logger.warn('Marcador de asset no encontrado en <a> tag', {
        assetName,
        eventId,
        tenantId
      });
      // Eliminar el <a> completo si el asset no existe
      const escapedLinkMatch = escapeRegex(fullLinkMatch);
      const linkRegex = new RegExp(escapedLinkMatch, 'g');
      resolvedHtml = resolvedHtml.replace(linkRegex, '');
      
      // Marcar como procesado para no intentar reemplazarlo de nuevo
      processedInLinks.add(`{{asset:${assetName}}}`);
    }
  });
  
  // Ahora procesar marcadores que NO están dentro de <a> tags (marcadores sueltos)
  const uniqueMarkers = new Map();
  matches.forEach(match => {
    const [fullMatch, assetName] = match;
    // Solo procesar si no fue procesado como parte de un <a>
    if (!processedInLinks.has(fullMatch)) {
      if (!uniqueMarkers.has(fullMatch)) {
        uniqueMarkers.set(fullMatch, assetName);
      }
    }
  });

  uniqueMarkers.forEach((assetName, fullMatch) => {
    // Buscar por name (exacto, luego case-insensitive)
    let asset = assetMapByName.get(assetName);
    if (!asset) {
      asset = assetMapByNameLower.get(assetName.toLowerCase());
    }

    if (asset) {
      const assetUrl = getAssetProperty(asset, 'url');
      const escapedUrl = escapeHtml(assetUrl);
      
      // Log detallado antes de verificar si es imagen
      logger.debug('Procesando asset suelto', {
        assetName,
        mime_type: getAssetProperty(asset, 'mime_type'),
        original_filename: getAssetProperty(asset, 'original_filename'),
        url: assetUrl
      });
      
      // Si es una imagen, crear un elemento <img>
      if (isImageAsset(asset)) {
        const altText = getAssetProperty(asset, 'description') || getAssetProperty(asset, 'original_filename') || getAssetProperty(asset, 'name');
        const escapedAlt = escapeHtml(altText);
        const imgHtml = `<img src="${escapedUrl}" alt="${escapedAlt}" class="max-w-full h-auto" />`;
        
        // Escapar caracteres especiales del regex y reemplazar todas las ocurrencias
        const escapedMatch = escapeRegex(fullMatch);
        const globalRegex = new RegExp(escapedMatch, 'g');
        resolvedHtml = resolvedHtml.replace(globalRegex, imgHtml);
        
        logger.info('✅ Marcador de imagen reemplazado', {
          assetName,
          mime_type: getAssetProperty(asset, 'mime_type'),
          eventId,
          tenantId
        });
      } else {
        // Si no es una imagen, crear link HTML que se abre en nueva pestaña
        const linkText = getAssetProperty(asset, 'description') || getAssetProperty(asset, 'original_filename') || getAssetProperty(asset, 'name');
        const escapedText = escapeHtml(linkText);
        const linkHtml = `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer" class="text-primary underline hover:text-primary/80">${escapedText}</a>`;
        
        // Escapar caracteres especiales del regex y reemplazar todas las ocurrencias
        const escapedMatch = escapeRegex(fullMatch);
        const globalRegex = new RegExp(escapedMatch, 'g');
        resolvedHtml = resolvedHtml.replace(globalRegex, linkHtml);
        
        logger.debug('Marcador reemplazado como link (no es imagen)', {
          assetName,
          mime_type: getAssetProperty(asset, 'mime_type'),
          eventId,
          tenantId
        });
      }
    } else {
      logger.warn('Marcador de asset no encontrado', {
        assetName,
        eventId,
        tenantId
      });
      // Dejar el marcador sin reemplazar (eliminar el marcador)
      const escapedMatch = escapeRegex(fullMatch);
      const globalRegex = new RegExp(escapedMatch, 'g');
      resolvedHtml = resolvedHtml.replace(globalRegex, '');
    }
  });

  return resolvedHtml;
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

