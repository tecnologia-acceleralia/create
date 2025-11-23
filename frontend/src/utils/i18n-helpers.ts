import type { TFunction, TOptionsBase } from 'i18next';

type TranslationOptions = TOptionsBase & Record<string, unknown>;

/**
 * Helper function to ensure that t() always returns a string, never an object.
 * This prevents React errors when i18next returns an object instead of a string.
 * 
 * @param t - The translation function from useTranslation()
 * @param key - The translation key
 * @param options - Optional translation options
 * @returns A string translation, or the defaultValue/fallback if translation is an object
 */
export function safeTranslate(
  t: TFunction,
  key: string,
  options?: TranslationOptions
): string {
  // Type assertion necesario porque TFunction tiene múltiples sobrecargas
  // y TypeScript no puede inferir correctamente el tipo cuando options es opcional
  const translation = (t as (key: string, options?: TranslationOptions) => string | object)(key, options);
  
  // Si la traducción es una cadena, devolverla directamente
  if (typeof translation === 'string') {
    return translation;
  }
  
  // Si es un objeto, intentar usar el defaultValue o la clave como fallback
  if (options && typeof options === 'object' && 'defaultValue' in options && typeof options.defaultValue === 'string') {
    return options.defaultValue;
  }
  
  // Si no hay defaultValue, usar la clave como fallback
  return key;
}

