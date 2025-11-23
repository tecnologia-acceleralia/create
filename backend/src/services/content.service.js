import { getModels } from '../models/index.js';
import { logger } from '../utils/logger.js';
import {
  escapeHtml,
  escapeRegex,
  getAssetProperty,
  createImageHtml,
  isImageAsset,
  getFileIconHtml
} from '../utils/asset-markers.js';

/**
 * Convierte una URL de YouTube a formato embed.
 *
 * @param {string} url - URL de YouTube (puede ser watch, youtu.be, o embed)
 * @returns {string|null} URL de embed o null si no es YouTube
 */
function getYouTubeEmbedUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host.includes('youtube.com')) {
      // Formato: https://www.youtube.com/watch?v=VIDEO_ID
      const directId = parsed.searchParams.get('v');
      if (directId) {
        return `https://www.youtube.com/embed/${directId}`;
      }

      // Formato: https://www.youtube.com/embed/VIDEO_ID
      if (parsed.pathname.startsWith('/embed/')) {
        return `https://www.youtube.com${parsed.pathname}`;
      }

      // Formato: https://www.youtube.com/watch/VIDEO_ID o similar
      const shortId = parsed.pathname
        .split('/')
        .reverse()
        .find(Boolean);
      if (shortId && shortId !== 'watch') {
        return `https://www.youtube.com/embed/${shortId}`;
      }
    }

    // Formato: https://youtu.be/VIDEO_ID
    if (host.includes('youtu.be')) {
      const videoId = parsed.pathname.split('/').find(Boolean);
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Determina si una URL es de YouTube.
 * Verifica si el hostname contiene "youtube" o "youtu.be".
 *
 * @param {string} url - URL a verificar
 * @returns {boolean} true si es una URL de YouTube
 */
function isYouTubeUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    
    // Verificar si el hostname contiene "youtube" o "youtu.be"
    // Esto cubre: youtube.com, www.youtube.com, m.youtube.com, youtu.be, etc.
    return host.includes('youtube') || host.includes('youtu.be');
  } catch {
    // Si falla el parsing, intentar verificar directamente en la URL
    const urlLower = url.toLowerCase();
    return urlLower.includes('youtube.com') || urlLower.includes('youtu.be');
  }
}

/**
 * Genera el HTML de un reproductor de YouTube embebido.
 *
 * @param {string} embedUrl - URL de embed de YouTube ya escapada para HTML
 * @param {string} title - Título del video para accesibilidad
 * @returns {string} HTML del elemento iframe
 */
function createYouTubeEmbedHtml(embedUrl, title) {
  return `<div class="aspect-video w-full max-w-4xl mx-auto overflow-hidden rounded-lg border border-border/40"><iframe title="${title}" src="${embedUrl}" class="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
}

/**
 * Reemplaza los marcadores de assets en HTML por links HTML, imágenes o reproductores de video.
 * Los marcadores tienen el formato: {{asset:nombre-del-recurso}}
 * - Si el asset es una imagen, se renderiza como <img>
 * - Si el asset es un video de YouTube, se renderiza como <iframe> embebido
 * - En caso contrario, se renderiza como <a>
 *
 * @param {string} html - Contenido HTML que puede contener marcadores
 * @param {number} eventId - ID del evento
 * @param {number} tenantId - ID del tenant
 * @returns {Promise<string>} HTML con los marcadores reemplazados por links HTML, imágenes o reproductores
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

  // Reemplazar cada marcador por un link HTML o imagen
  let resolvedHtml = html;
  
  // Procesar marcadores únicos para evitar trabajo duplicado
  const uniqueMarkers = new Map();
  matches.forEach(match => {
    const [fullMatch, assetName] = match;
    if (!uniqueMarkers.has(fullMatch)) {
      uniqueMarkers.set(fullMatch, assetName);
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
      
      // Log detallado antes de verificar el tipo de asset
      logger.debug('Procesando asset suelto', {
        assetName,
        mime_type: getAssetProperty(asset, 'mime_type'),
        original_filename: getAssetProperty(asset, 'original_filename'),
        url: assetUrl,
        isImage: isImageAsset(asset)
      });
      
      // Si es una imagen, crear un elemento <img>
      if (isImageAsset(asset)) {
        const altText = getAssetProperty(asset, 'description') || getAssetProperty(asset, 'original_filename') || getAssetProperty(asset, 'name');
        const escapedAlt = escapeHtml(altText);
        const imgHtml = createImageHtml(escapedUrl, escapedAlt);
        
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
        const mimeType = getAssetProperty(asset, 'mime_type');
        const originalFilename = getAssetProperty(asset, 'original_filename');
        const fileIconHtml = getFileIconHtml(mimeType, originalFilename);
        
        logger.debug('Generando link con icono', {
          assetName,
          mime_type: mimeType,
          original_filename: originalFilename,
          fileIconHtml,
          linkText
        });
        
        const linkHtml = `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-primary underline hover:text-primary/80">${fileIconHtml}${escapedText}</a>`;
        
        // Escapar caracteres especiales del regex y reemplazar todas las ocurrencias
        const escapedMatch = escapeRegex(fullMatch);
        const globalRegex = new RegExp(escapedMatch, 'g');
        resolvedHtml = resolvedHtml.replace(globalRegex, linkHtml);
        
        logger.debug('Marcador reemplazado como link (no es imagen)', {
          assetName,
          mime_type: getAssetProperty(asset, 'mime_type'),
          eventId,
          tenantId,
          generatedLinkHtml: linkHtml.substring(0, 500), // Primeros 500 caracteres para debug
          hasSvg: linkHtml.includes('<svg'),
          hasInlineFlex: linkHtml.includes('inline-flex')
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
 * Reemplaza URLs directas de YouTube en el HTML por reproductores embebidos.
 * Busca URLs de YouTube tanto en enlaces <a> como en texto plano.
 *
 * @param {string} html - Contenido HTML que puede contener URLs de YouTube
 * @returns {string} HTML con las URLs de YouTube reemplazadas por reproductores embebidos
 */
export function resolveYouTubeUrls(html) {
  if (!html || typeof html !== 'string') {
    return html || '';
  }

  let resolvedHtml = html;

  // Primero, buscar y procesar enlaces <a> que contienen URLs de YouTube
  // Regex para encontrar enlaces <a> con href que contiene youtube.com o youtu.be
  // Captura el enlace completo incluyendo el texto del enlace
  const linkRegex = /<a\s+[^>]*href\s*=\s*["']([^"']*youtube\.com[^"']*|[^"']*youtu\.be[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  
  const linkMatches = [...resolvedHtml.matchAll(linkRegex)];
  
  // Procesar cada enlace encontrado
  for (const linkMatch of linkMatches) {
    const fullLink = linkMatch[0]; // El enlace completo <a>...</a>
    const hrefUrl = linkMatch[1]; // La URL del href
    const linkText = linkMatch[2]; // El texto del enlace
    
    // Verificar si es una URL de YouTube válida
    if (!isYouTubeUrl(hrefUrl)) {
      continue;
    }
    
    // Convertir a URL de embed
    const embedUrl = getYouTubeEmbedUrl(hrefUrl);
    
    if (!embedUrl) {
      logger.debug('No se pudo convertir URL de YouTube a embed', { url: hrefUrl });
      continue;
    }
    
    // Crear el HTML del reproductor embebido
    const escapedEmbedUrl = escapeHtml(embedUrl);
    const escapedTitle = escapeHtml(linkText.trim() || 'Video de YouTube');
    const embedHtml = createYouTubeEmbedHtml(escapedEmbedUrl, escapedTitle);
    
    // Reemplazar el enlace completo por el reproductor embebido
    const escapedLinkMatch = escapeRegex(fullLink);
    const linkReplaceRegex = new RegExp(escapedLinkMatch, 'g');
    resolvedHtml = resolvedHtml.replace(linkReplaceRegex, embedHtml);
    
    logger.debug('✅ URL de YouTube en enlace reemplazada por reproductor embebido', {
      originalUrl: hrefUrl,
      embedUrl
    });
  }
  
  // Ahora procesar URLs que no están en enlaces (texto plano)
  // Regex mejorado para encontrar URLs de YouTube en texto plano
  // Patrón: https://www.youtube.com/watch?v=... o https://youtu.be/... o variantes
  // Incluye parámetros adicionales como &feature=youtu.be
  // Excluye URLs que ya están dentro de iframes o enlaces procesados
  const youtubeUrlRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)[\w-]+(?:\?[^<>\s"']*)?)/gi;
  
  const remainingMatches = [...resolvedHtml.matchAll(youtubeUrlRegex)];
  
  for (const match of remainingMatches) {
    const fullUrl = match[0];
    const matchIndex = match.index;
    
    // Verificar que no esté dentro de un iframe, enlace o tag de video (ya procesado)
    const contextBefore = resolvedHtml.substring(Math.max(0, matchIndex - 100), matchIndex);
    const contextAfter = resolvedHtml.substring(matchIndex, Math.min(resolvedHtml.length, matchIndex + fullUrl.length + 100));
    
    // Si está dentro de un iframe, enlace, o ya es un embed, saltar
    if (contextBefore.includes('<iframe') || contextBefore.includes('youtube.com/embed') || 
        contextBefore.includes('<a ') || contextAfter.includes('</iframe>') || 
        contextAfter.includes('</a>') || contextAfter.includes('youtube.com/embed')) {
      continue;
    }
    
    // Verificar si es una URL de YouTube válida
    if (!isYouTubeUrl(fullUrl)) {
      continue;
    }
    
    // Convertir a URL de embed
    const embedUrl = getYouTubeEmbedUrl(fullUrl);
    
    if (!embedUrl) {
      continue;
    }
    
    // Crear el HTML del reproductor embebido
    const escapedEmbedUrl = escapeHtml(embedUrl);
    const escapedTitle = escapeHtml('Video de YouTube');
    const embedHtml = createYouTubeEmbedHtml(escapedEmbedUrl, escapedTitle);
    
    // Escapar la URL para regex y reemplazar
    const escapedUrl = escapeRegex(fullUrl);
    const urlRegex = new RegExp(escapedUrl, 'g');
    resolvedHtml = resolvedHtml.replace(urlRegex, embedHtml);
    
    logger.debug('✅ URL de YouTube en texto plano reemplazada por reproductor embebido', {
      originalUrl: fullUrl,
      embedUrl
    });
  }

  return resolvedHtml;
}

/**
 * Procesa HTML para convertir saltos de línea en elementos HTML apropiados.
 * Convierte saltos de línea (\n) a <br> cuando están fuera de etiquetas HTML,
 * pero preserva el contenido dentro de <style> y <script> sin modificar.
 * 
 * @param {string} html - Contenido HTML que puede contener saltos de línea literales
 * @returns {string} HTML procesado con saltos de línea convertidos a <br>
 */
export function processHtmlLineBreaks(html) {
  if (!html || typeof html !== 'string') {
    return html || '';
  }

  // Normalizar saltos de línea primero
  let processed = html
    .replace(/\r\n/g, '\n') // Windows
    .replace(/\r/g, '\n'); // Mac antiguo

  // Si no hay saltos de línea, devolver tal cual
  if (!processed.includes('\n')) {
    return processed;
  }

  // Primero, extraer y proteger el contenido de <style> y <script>
  // Usar un enfoque más robusto que maneje bloques anidados y atributos
  const protectedBlocks = [];
  let protectedIndex = 0;
  
  // Buscar y proteger bloques <style> y <script> de forma más robusta
  const styleScriptRegex = /<(style|script)(?:\s+[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let match;
  
  // Primero encontrar todos los bloques y guardarlos
  const matches = [];
  while ((match = styleScriptRegex.exec(processed)) !== null) {
    matches.push({
      fullMatch: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length
    });
  }
  
  // Reemplazar de atrás hacia adelante para mantener los índices correctos
  for (let i = matches.length - 1; i >= 0; i--) {
    const matchData = matches[i];
    const marker = `__PROTECTED_BLOCK_${protectedIndex}__`;
    protectedBlocks[protectedIndex] = matchData.fullMatch; // Guardar el bloque completo sin modificar
    processed = processed.substring(0, matchData.startIndex) + marker + processed.substring(matchData.endIndex);
    protectedIndex++;
  }

  // Procesar el HTML restante caracter por caracter para identificar texto fuera de etiquetas HTML
  const result = [];
  let inTag = false;
  let tagBuffer = '';
  let textBuffer = '';

  for (let i = 0; i < processed.length; i++) {
    const char = processed[i];

    if (char === '<' && !inTag) {
      // Inicio de etiqueta: procesar texto acumulado antes
      if (textBuffer) {
        const processedText = textBuffer
          .replace(/\n{3,}/g, '\n\n') // Limitar saltos múltiples a máximo 2
          .replace(/\n/g, '<br>');
        result.push(processedText);
        textBuffer = '';
      }
      inTag = true;
      tagBuffer = char;
    } else if (char === '>' && inTag) {
      // Fin de etiqueta
      tagBuffer += char;
      result.push(tagBuffer);
      tagBuffer = '';
      inTag = false;
    } else if (inTag) {
      // Dentro de una etiqueta: acumular sin procesar
      tagBuffer += char;
    } else {
      // Fuera de etiquetas: acumular texto para procesar después
      textBuffer += char;
    }
  }

  // Procesar texto restante
  if (textBuffer) {
    const processedText = textBuffer
      .replace(/\n{3,}/g, '\n\n') // Limitar saltos múltiples a máximo 2
      .replace(/\n/g, '<br>');
    result.push(processedText);
  }

  // Si había una etiqueta sin cerrar, agregarla
  if (tagBuffer) {
    result.push(tagBuffer);
  }

  let finalHtml = result.join('');

  // Restaurar los bloques protegidos (limpiando cualquier <br> que pueda haber dentro)
  for (let index = 0; index < protectedBlocks.length; index++) {
    const marker = `__PROTECTED_BLOCK_${index}__`;
    let block = protectedBlocks[index];
    
    // Limpiar <br> dentro de los bloques protegidos (por si ya estaban insertados)
    // Solo limpiar <br> dentro del contenido, no en los tags de apertura/cierre
    const blockMatch = block.match(/^<(style|script)(?:\s+[^>]*)?>([\s\S]*?)<\/\1>$/i);
    if (blockMatch) {
      const tag = blockMatch[1];
      const content = blockMatch[2];
      // Limpiar <br> y <br/> del contenido, pero preservar saltos de línea reales
      const cleanedContent = content.replace(/<br\s*\/?>/gi, '\n');
      block = `<${tag}>${cleanedContent}</${tag}>`;
    }
    
    finalHtml = finalHtml.replace(marker, block);
  }

  return finalHtml;
}

/**
 * Procesa un campo HTML multiidioma, aplicando procesamiento de saltos de línea a cada idioma.
 * 
 * @param {string|object|null} html - Contenido HTML que puede ser string o objeto multiidioma
 * @returns {string|object|null} HTML procesado con la misma estructura
 */
export function processMultilingualHtml(html) {
  if (!html) {
    return html;
  }

  // Si es un string, procesarlo directamente
  if (typeof html === 'string') {
    return processHtmlLineBreaks(html);
  }

  // Si es un objeto multiidioma, procesar cada idioma
  if (typeof html === 'object' && html !== null && !Array.isArray(html)) {
    const processed = {};
    for (const [lang, content] of Object.entries(html)) {
      if (content && typeof content === 'string') {
        processed[lang] = processHtmlLineBreaks(content);
      } else {
        processed[lang] = content;
      }
    }
    return processed;
  }

  return html;
}

