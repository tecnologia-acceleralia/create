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
 * Reemplaza los marcadores de assets en HTML por links HTML.
 * Los marcadores tienen el formato: {{asset:nombre-del-recurso}}
 *
 * @param {string} html - Contenido HTML que puede contener marcadores
 * @param {number} eventId - ID del evento
 * @param {number} tenantId - ID del tenant
 * @returns {Promise<string>} HTML con los marcadores reemplazados por links HTML
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

  // Buscar todos los assets de una vez
  const assets = await EventAsset.findAll({
    where: {
      tenant_id: tenantId,
      event_id: eventId,
      name: assetNames
    }
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
  // Procesar solo marcadores únicos para evitar trabajo duplicado
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
      // Usar descripción si existe, sino usar el nombre original del archivo o el nombre del asset
      const linkText = asset.description || asset.original_filename || asset.name;
      const escapedText = escapeHtml(linkText);
      const escapedUrl = escapeHtml(asset.url);
      
      // Crear link HTML que se abre en nueva pestaña
      const linkHtml = `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer" class="text-primary underline hover:text-primary/80">${escapedText}</a>`;
      
      // Escapar caracteres especiales del regex y reemplazar todas las ocurrencias
      const escapedMatch = escapeRegex(fullMatch);
      const globalRegex = new RegExp(escapedMatch, 'g');
      resolvedHtml = resolvedHtml.replace(globalRegex, linkHtml);
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

