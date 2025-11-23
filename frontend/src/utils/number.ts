/**
 * Utilidades para parseo y validación de números
 */

/**
 * Parsea un valor a número entero válido
 * Rechaza valores como "1:1", "1.5", "abc", etc.
 * @param value - Valor a parsear (string, number, undefined, null)
 * @returns Número entero válido o NaN si no es válido
 */
export function parseIntegerId(value: string | number | undefined | null): number {
  if (value === undefined || value === null) {
    return NaN;
  }
  
  // Si ya es un número, verificar que sea entero
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : NaN;
  }
  
  // Si es string, verificar que sea un entero válido
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Verificar que el string parseado sea exactamente igual al original (rechaza "1:1", "1.5", etc.)
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isNaN(parsed) || parsed.toString() !== trimmed) {
      return NaN;
    }
    return parsed;
  }
  
  return NaN;
}

/**
 * Valida que un valor sea un ID entero válido
 * @param value - Valor a validar
 * @returns true si es un ID válido, false en caso contrario
 */
export function isValidIntegerId(value: string | number | undefined | null): boolean {
  return !Number.isNaN(parseIntegerId(value));
}

