import { getModels } from '../models/index.js';
import { logger } from './logger.js';

/**
 * Reemplaza los marcadores de assets en HTML por sus URLs reales.
 * Los marcadores tienen el formato: {{asset:nombre-del-recurso}}
 *
 * @param {string} html - Contenido HTML que puede contener marcadores
 * @param {number} eventId - ID del evento
 * @param {number} tenantId - ID del tenant
 * @returns {Promise<string>} HTML con los marcadores reemplazados por URLs
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

  // Crear un mapa de nombre -> URL
  const assetMap = new Map();
  assets.forEach(asset => {
    assetMap.set(asset.name, asset.url);
  });

  // Reemplazar cada marcador por su URL (reemplazar todas las ocurrencias)
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
    const url = assetMap.get(assetName);

    if (url) {
      // Escapar caracteres especiales del regex y reemplazar todas las ocurrencias
      const escapedMatch = fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const globalRegex = new RegExp(escapedMatch, 'g');
      resolvedHtml = resolvedHtml.replace(globalRegex, url);
    } else {
      logger.warn('Marcador de asset no encontrado', {
        assetName,
        eventId,
        tenantId
      });
      // Dejar el marcador sin reemplazar o reemplazar por una cadena vacía
      const escapedMatch = fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

