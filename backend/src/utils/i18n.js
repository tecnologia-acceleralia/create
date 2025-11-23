/**
 * Utilidades para internacionalización (i18n) en el backend
 * Soporta español (es), catalán (ca) e inglés (en)
 * 
 * Las traducciones se cargan desde archivos JSON separados por idioma
 * en la carpeta i18n/locales/ siguiendo la misma estructura que el frontend
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Convierte un objeto anidado a un objeto plano con claves con puntos
 * Ejemplo: { a: { b: 'value' } } -> { 'a.b': 'value' }
 * @param {Record<string, any>} obj - Objeto anidado
 * @param {string} prefix - Prefijo para las claves (usado en recursión)
 * @returns {Record<string, string>} Objeto plano con claves con puntos
 */
function flattenTranslations(obj, prefix = '') {
  const result = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Si es un objeto, recursivamente aplanarlo
      Object.assign(result, flattenTranslations(value, newKey));
    } else {
      // Si es un valor primitivo, agregarlo directamente
      result[newKey] = value;
    }
  }
  
  return result;
}

/**
 * Carga las traducciones desde archivos JSON
 * @param {string} locale - Código de idioma ('es', 'ca', 'en')
 * @returns {Record<string, string>} Objeto plano con traducciones
 */
function loadTranslations(locale) {
  try {
    const filePath = join(__dirname, '../i18n/locales', `${locale}.json`);
    const fileContent = readFileSync(filePath, 'utf-8');
    const nestedTranslations = JSON.parse(fileContent);
    
    // Convertir estructura anidada a objeto plano con claves con puntos
    return flattenTranslations(nestedTranslations);
  } catch (error) {
    console.error(`Error loading translations for locale "${locale}":`, error);
    return {};
  }
}

// Cargar traducciones para todos los idiomas soportados
const translations = {
  es: loadTranslations('es'),
  ca: loadTranslations('ca'),
  en: loadTranslations('en')
};

/**
 * Obtiene el idioma del usuario desde req.user o usa el idioma por defecto
 * @param {import('express').Request} req - Request de Express
 * @returns {string} Código de idioma ('es', 'ca', 'en')
 */
export function getUserLanguage(req) {
  // Obtener idioma del usuario autenticado
  // Intentar acceder al campo language de diferentes formas para compatibilidad con Sequelize
  const userLanguage = req.user?.language || req.user?.get?.('language') || req.user?.dataValues?.language;
  
  // Normalizar el idioma (trim y lowercase)
  const normalizedLanguage = userLanguage ? String(userLanguage).trim().toLowerCase() : null;
  
  // Validar que el idioma sea uno de los soportados
  if (normalizedLanguage && ['es', 'ca', 'en'].includes(normalizedLanguage)) {
    return normalizedLanguage;
  }
  
  // Idioma por defecto: español
  return 'es';
}

/**
 * Traduce un mensaje según el idioma del usuario
 * @param {import('express').Request} req - Request de Express
 * @param {string} key - Clave de traducción
 * @param {Record<string, any>} params - Parámetros para interpolación
 * @returns {string} Mensaje traducido
 */
export function t(req, key, params = {}) {
  const language = getUserLanguage(req);
  let message = translations[language]?.[key] || translations.es[key] || key;

  // Interpolación de parámetros (ej: "{phaseName}" -> valor)
  if (params && Object.keys(params).length > 0) {
    Object.entries(params).forEach(([paramKey, paramValue]) => {
      message = message.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
    });
  }

  return message;
}

