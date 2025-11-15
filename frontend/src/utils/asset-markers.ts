import { getEventAssets, type EventAsset } from '@/services/event-assets';

/**
 * Reemplaza los marcadores de assets en HTML por sus URLs reales.
 * Los marcadores tienen el formato: {{asset:nombre-del-recurso}}
 *
 * @param html - Contenido HTML que puede contener marcadores
 * @param assets - Array de assets del evento
 * @returns HTML con los marcadores reemplazados por URLs
 */
export function resolveAssetMarkers(html: string | null | undefined, assets: EventAsset[]): string {
  if (!html || typeof html !== 'string') {
    return html || '';
  }

  const markerRegex = /\{\{asset:([a-zA-Z0-9_-]+)\}\}/g;
  const matches = [...html.matchAll(markerRegex)];

  if (matches.length === 0) {
    return html;
  }

  // Crear un mapa de nombre -> URL
  const assetMap = new Map<string, string>();
  assets.forEach(asset => {
    assetMap.set(asset.name, asset.url);
  });

  // Reemplazar cada marcador por su URL
  let resolvedHtml = html;
  matches.forEach(match => {
    const [fullMatch, assetName] = match;
    const url = assetMap.get(assetName);

    if (url) {
      resolvedHtml = resolvedHtml.replace(fullMatch, url);
    } else {
      // Dejar el marcador sin reemplazar si no se encuentra el asset
      console.warn(`Asset marker not found: ${assetName}`);
    }
  });

  return resolvedHtml;
}

/**
 * Extrae todos los nombres de assets mencionados en un HTML.
 *
 * @param html - Contenido HTML
 * @returns Array de nombres de assets mencionados
 */
export function extractAssetNames(html: string | null | undefined): string[] {
  if (!html || typeof html !== 'string') {
    return [];
  }

  const markerRegex = /\{\{asset:([a-zA-Z0-9_-]+)\}\}/g;
  const matches = [...html.matchAll(markerRegex)];
  return [...new Set(matches.map(match => match[1]))];
}

