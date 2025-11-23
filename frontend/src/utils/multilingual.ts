import type { MultilingualText } from '@/services/events';

/**
 * Obtiene el texto en el idioma preferido de un campo multiidioma
 * 
 * @param value - Valor multiidioma (puede ser string para compatibilidad o objeto MultilingualText)
 * @param preferredLanguage - Idioma preferido ('es', 'ca', 'en')
 * @param fallbackLanguage - Idioma de fallback si no existe el preferido (default: 'es')
 * @returns El texto en el idioma preferido o fallback
 */
export function getMultilingualText(
  value: MultilingualText | string | null | undefined,
  preferredLanguage: 'es' | 'ca' | 'en' = 'es',
  fallbackLanguage: 'es' | 'ca' | 'en' = 'es'
): string {
  if (!value) return '';
  
  // Si es un string, verificar si es JSON stringificado
  if (typeof value === 'string') {
    // Intentar parsear si parece ser JSON (empieza con { o [)
    const trimmed = value.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(value);
        // Si se parseó correctamente y es un objeto, procesarlo recursivamente
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          return getMultilingualText(parsed, preferredLanguage, fallbackLanguage);
        }
      } catch {
        // Si falla el parseo, no es JSON válido, devolver el string original
      }
    }
    return value;
  }
  
  // Si es un objeto multiidioma
  if (typeof value === 'object' && value !== null) {
    // Verificar que sea un objeto plano (no Array, Date, etc.)
    if (Array.isArray(value) || value instanceof Date) {
      return '';
    }
    
    // Función auxiliar para extraer string de un valor (puede ser string u objeto anidado)
    const extractString = (val: unknown): string | null => {
      if (typeof val === 'string' && val.trim()) {
        return val.trim();
      }
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        // Si es un objeto anidado, intentar extraer el string del idioma preferido o español
        const nestedVal = (val as any)[preferredLanguage] || (val as any).es;
        if (nestedVal && typeof nestedVal === 'string' && nestedVal.trim()) {
          return nestedVal.trim();
        }
      }
      return null;
    };
    
    // Intentar obtener el idioma preferido
    const preferred = value[preferredLanguage];
    const preferredStr = extractString(preferred);
    if (preferredStr) {
      return preferredStr;
    }
    
    // Si no existe, usar el fallback
    const fallback = value[fallbackLanguage];
    const fallbackStr = extractString(fallback);
    if (fallbackStr) {
      return fallbackStr;
    }
    
    // Si no existe el fallback, usar español
    const spanish = value.es;
    const spanishStr = extractString(spanish);
    if (spanishStr) {
      return spanishStr;
    }
    
    // Intentar cualquier propiedad de string que exista
    for (const key of ['es', 'ca', 'en']) {
      const text = value[key as keyof MultilingualText];
      const textStr = extractString(text);
      if (textStr) {
        return textStr;
      }
    }
    
    // Si no hay nada válido, devolver string vacío
    return '';
  }
  
  return '';
}

/**
 * Normaliza un valor multiidioma para el formulario
 * Convierte strings a objetos multiidioma con estructura { es, ca?, en? }
 */
export function normalizeMultilingualValue(
  value: string | MultilingualText | null | undefined
): { es: string; ca: string; en: string } | null {
  if (!value) return null;
  if (typeof value === 'string') {
    return { es: value, ca: '', en: '' };
  }
  if (typeof value === 'object') {
    return {
      es: value.es || '',
      ca: value.ca || '',
      en: value.en || ''
    };
  }
  return null;
}

/**
 * Limpia un objeto multiidioma antes de enviarlo al backend
 * Elimina propiedades vacías y retorna null si todos los campos están vacíos
 * Para campos requeridos (como name), siempre debe tener al menos 'es'
 */
export function cleanMultilingualValue(
  value: { es: string; ca: string; en: string } | null | undefined,
  required: boolean = false
): MultilingualText | null | undefined {
  if (!value) return null;
  
  // Si es requerido y tiene texto en español, siempre retornar al menos { es }
  if (required) {
    const cleaned: MultilingualText = {};
    if (value.es?.trim()) {
      cleaned.es = value.es.trim();
    }
    if (value.ca?.trim()) {
      cleaned.ca = value.ca.trim();
    }
    if (value.en?.trim()) {
      cleaned.en = value.en.trim();
    }
    // Si no tiene español, retornar null (será rechazado por validación)
    if (!cleaned.es) {
      return null;
    }
    return cleaned;
  }
  
  // Para campos opcionales, eliminar propiedades vacías
  const cleaned: MultilingualText = {};
  if (value.es?.trim()) {
    cleaned.es = value.es.trim();
  }
  if (value.ca?.trim()) {
    cleaned.ca = value.ca.trim();
  }
  if (value.en?.trim()) {
    cleaned.en = value.en.trim();
  }
  
  // Si no hay ningún campo con contenido, retornar null
  if (Object.keys(cleaned).length === 0) {
    return null;
  }
  
  return cleaned;
}

