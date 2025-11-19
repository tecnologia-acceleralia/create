/**
 * Utilidades para parseo y conversión de valores
 */

/**
 * Convierte un valor a entero
 * @param {any} value - Valor a convertir
 * @returns {number} Entero parseado
 */
export function toInt(value) {
  return Number.parseInt(value, 10);
}

/**
 * Convierte un valor a Date o null si no es válido
 * @param {any} value - Valor a convertir
 * @returns {Date|null} Fecha parseada o null
 */
export function toDateOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Convierte un valor a HTML string o null si está vacío
 * @param {any} value - Valor a convertir
 * @returns {string|null} HTML string o null
 */
export function toHtmlOrNull(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length ? value : null;
}

/**
 * Convierte un valor a entero nullable
 * @param {any} value - Valor a convertir
 * @returns {number|null} Entero o null
 */
export function coerceNullableInteger(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Convierte un valor a string nullable (trimmed)
 * @param {any} value - Valor a convertir
 * @returns {string|null} String trimmeado o null si está vacío
 */
export function coerceNullableString(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Parsea un parámetro de página con fallback
 * @param {any} value - Valor a parsear
 * @param {number} fallback - Valor por defecto
 * @returns {number} Número de página válido
 */
export function parsePageParam(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

/**
 * Parsea un parámetro de tamaño de página con fallback y máximo
 * @param {any} value - Valor a parsear
 * @param {number} fallback - Valor por defecto
 * @param {number} max - Valor máximo permitido
 * @returns {number} Tamaño de página válido
 */
export function parsePageSizeParam(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }
  if (typeof max === 'number' && parsed > max) {
    return max;
  }
  return parsed;
}

/**
 * Parsea un parámetro CSV a array
 * @param {any} value - Valor a parsear (string, array o null)
 * @returns {string[]} Array de strings
 */
export function parseCsvParam(value) {
  if (!value) {
    return [];
  }

  const source = Array.isArray(value) ? value.join(',') : value;
  return source
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

