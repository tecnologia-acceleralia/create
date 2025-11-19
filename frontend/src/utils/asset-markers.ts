import type { EventAsset } from '@/services/event-assets';

/**
 * Escapa caracteres especiales HTML para prevenir XSS.
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Escapa caracteres especiales para usar en regex de reemplazo.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normaliza un nombre de asset de la misma forma que el backend.
 * Elimina acentos y normaliza caracteres especiales.
 */
function normalizeAssetName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9.\-_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Reemplaza los marcadores de assets en HTML por links con descripción.
 * Los marcadores tienen el formato: {{asset:nombre-del-recurso}}
 *
 * @param html - Contenido HTML que puede contener marcadores
 * @param assets - Array de assets del evento
 * @returns HTML con los marcadores reemplazados por links HTML
 */
export function resolveAssetMarkers(html: string | null | undefined, assets: EventAsset[]): string {
  if (!html || typeof html !== 'string') {
    return html || '';
  }

  const markerRegex = /\{\{asset:([a-zA-Z0-9_.-]+)\}\}/g;
  const matches = [...html.matchAll(markerRegex)];

  if (matches.length === 0) {
    return html;
  }

  // Debug: Log para ver qué marcadores se encontraron
  console.log('[resolveAssetMarkers] Marcadores encontrados:', matches.map(m => m[1]));
  console.log('[resolveAssetMarkers] Assets disponibles:', assets.map(a => ({ name: a.name, original_filename: a.original_filename, description: a.description })));

  // Crear mapas de búsqueda por name y original_filename (case-insensitive para mayor robustez)
  const assetMapByName = new Map<string, EventAsset>();
  const assetMapByNameLower = new Map<string, EventAsset>();
  const assetMapByOriginalFilename = new Map<string, EventAsset>();
  const assetMapByOriginalFilenameLower = new Map<string, EventAsset>();
  
  for (const asset of assets) {
    // Indexar por name
    assetMapByName.set(asset.name, asset);
    assetMapByNameLower.set(asset.name.toLowerCase(), asset);
    
    // Indexar por original_filename si existe
    if (asset.original_filename) {
      assetMapByOriginalFilename.set(asset.original_filename, asset);
      assetMapByOriginalFilenameLower.set(asset.original_filename.toLowerCase(), asset);
    }
  }

  // Reemplazar cada marcador por un link HTML
  let resolvedHtml = html;
  // Procesar solo marcadores únicos para evitar trabajo duplicado
  const uniqueMarkers = new Map<string, string>();
  for (const match of matches) {
    const [fullMatch, assetName] = match;
    if (!uniqueMarkers.has(fullMatch)) {
      uniqueMarkers.set(fullMatch, assetName);
    }
  }

  for (const [fullMatch, assetName] of uniqueMarkers) {
    // Normalizar el nombre del marcador (igual que el backend)
    const normalizedName = normalizeAssetName(assetName);
    
    // Buscar por name primero (exacto, luego case-insensitive)
    let asset = assetMapByName.get(assetName);
    if (!asset) {
      asset = assetMapByNameLower.get(assetName.toLowerCase());
    }
    
    // Si no se encuentra por name, buscar por original_filename (exacto, luego case-insensitive)
    if (!asset) {
      asset = assetMapByOriginalFilename.get(assetName);
      if (!asset) {
        asset = assetMapByOriginalFilenameLower.get(assetName.toLowerCase());
      }
    }
    
    // Si aún no se encuentra y el nombre fue normalizado, buscar por el nombre normalizado
    if (!asset && normalizedName !== assetName) {
      asset = assetMapByName.get(normalizedName);
      if (!asset) {
        asset = assetMapByNameLower.get(normalizedName.toLowerCase());
      }
      if (!asset) {
        asset = assetMapByOriginalFilename.get(normalizedName);
        if (!asset) {
          asset = assetMapByOriginalFilenameLower.get(normalizedName.toLowerCase());
        }
      }
    }

    if (asset) {
      // Usar descripción si existe, sino usar el nombre original del archivo o el nombre del asset
      const linkText = asset.description || asset.original_filename || asset.name;
      const escapedText = escapeHtml(linkText);
      const escapedUrl = escapeHtml(asset.url);
      
      // Crear link HTML que se abre en nueva pestaña
      const linkHtml = `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer" class="text-primary underline hover:text-primary/80">${escapedText}</a>`;
      
      // Escapar caracteres especiales del regex para reemplazo seguro
      const escapedMatch = escapeRegex(fullMatch);
      resolvedHtml = resolvedHtml.replaceAll(escapedMatch, linkHtml);
      console.log(`[resolveAssetMarkers] ✅ Reemplazado: ${fullMatch} -> ${asset.name} (${linkHtml.substring(0, 80)}...)`);
    } else {
      // Dejar el marcador sin reemplazar si no se encuentra el asset
      const foundByName = assetMapByName.has(assetName);
      const foundByNameLower = assetMapByNameLower.has(assetName.toLowerCase());
      const foundByOriginalFilename = assetMapByOriginalFilename.has(assetName);
      const foundByOriginalFilenameLower = assetMapByOriginalFilenameLower.has(assetName.toLowerCase());
      const normalizedFound = normalizedName !== assetName && (
        assetMapByName.has(normalizedName) || 
        assetMapByNameLower.has(normalizedName.toLowerCase()) ||
        assetMapByOriginalFilename.has(normalizedName) ||
        assetMapByOriginalFilenameLower.has(normalizedName.toLowerCase())
      );
      
      console.warn(`[resolveAssetMarkers] ❌ Asset marker not found: "${assetName}"`);
      console.warn(`  - Búsqueda exacta por name: ${foundByName}`);
      console.warn(`  - Búsqueda case-insensitive por name: ${foundByNameLower}`);
      console.warn(`  - Búsqueda exacta por original_filename: ${foundByOriginalFilename}`);
      console.warn(`  - Búsqueda case-insensitive por original_filename: ${foundByOriginalFilenameLower}`);
      if (normalizedName !== assetName) {
        console.warn(`  - Nombre normalizado: "${normalizedName}"`);
        console.warn(`  - Búsqueda por nombre normalizado: ${normalizedFound}`);
      }
    }
  }

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

  const markerRegex = /\{\{asset:([a-zA-Z0-9_.-]+)\}\}/g;
  const matches = [...html.matchAll(markerRegex)];
  return [...new Set(matches.map(match => match[1]))];
}

