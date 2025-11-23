import OpenAI from 'openai';
import { logger } from '../utils/logger.js';

let cachedClient = null;
let clientOverride = null;

export function __setOpenAiClient(client) {
  clientOverride = client ?? null;
  cachedClient = client ?? null;
}

function ensureClient() {
  if (clientOverride) {
    return clientOverride;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY no está configurado');
  }

  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey });
  }

  return cachedClient;
}

/**
 * Traduce contenido desde español a otro idioma usando OpenAI
 * 
 * @param {string} text - Texto en español a traducir
 * @param {string} targetLanguage - Idioma objetivo ('ca' para catalán, 'en' para inglés)
 * @param {boolean} isHtml - Si es true, preserva el HTML en la traducción
 * @returns {Promise<string>} Texto traducido
 */
export async function translateText({ text, targetLanguage, isHtml = false }) {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return '';
  }

  const client = ensureClient();
  
  const languageMap = {
    'ca': 'catalán',
    'en': 'inglés',
    'es': 'español'
  };

  const targetLanguageName = languageMap[targetLanguage] || 'catalán';
  const model = process.env.OPENAI_TRANSLATION_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const systemPrompt = isHtml
    ? `Eres un traductor profesional especializado en traducir contenido HTML manteniendo la estructura y etiquetas HTML intactas. 
Traduce solo el texto visible, preservando todas las etiquetas HTML, atributos y estructura. 
No modifiques las etiquetas HTML, solo traduce el contenido textual entre ellas.`
    : `Eres un traductor profesional. Traduce el texto manteniendo el tono y estilo original.`;

  const userPrompt = isHtml
    ? `Traduce el siguiente contenido HTML del español al ${targetLanguageName}. 
Mantén todas las etiquetas HTML, atributos y estructura exactamente igual. 
Solo traduce el texto visible entre las etiquetas.

Contenido HTML a traducir:
${text}`
    : `Traduce el siguiente texto del español al ${targetLanguageName}:

${text}`;

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ]
    });

    const translatedText = response.choices?.[0]?.message?.content?.trim();
    
    if (!translatedText) {
      logger.warn('OpenAI no devolvió contenido traducido', { targetLanguage, isHtml });
      return text; // Devolver texto original si no hay traducción
    }

    return translatedText;
  } catch (error) {
    logger.error('Error al traducir texto con OpenAI', {
      error: error.message,
      targetLanguage,
      isHtml,
      textLength: text.length
    });
    throw new Error(`Error al traducir: ${error.message}`);
  }
}

/**
 * Traduce un objeto multiidioma desde español a otro idioma
 * 
 * @param {Object} multilingualObject - Objeto con estructura { "es": "...", "ca": "...", "en": "..." }
 * @param {string} targetLanguage - Idioma objetivo ('ca' o 'en')
 * @param {boolean} isHtml - Si es true, preserva el HTML en la traducción
 * @returns {Promise<Object>} Objeto actualizado con la traducción
 */
export async function translateMultilingualField({ multilingualObject, targetLanguage, isHtml = false }) {
  if (!multilingualObject || typeof multilingualObject !== 'object') {
    return multilingualObject;
  }

  const spanishText = multilingualObject.es || '';
  
  if (!spanishText || spanishText.trim() === '') {
    logger.warn('No hay texto en español para traducir', { targetLanguage });
    return multilingualObject;
  }

  // Si ya existe traducción, no sobrescribir
  if (multilingualObject[targetLanguage]) {
    logger.debug('Ya existe traducción para el idioma objetivo', { targetLanguage });
    return multilingualObject;
  }

  try {
    const translatedText = await translateText({
      text: spanishText,
      targetLanguage,
      isHtml
    });

    return {
      ...multilingualObject,
      [targetLanguage]: translatedText
    };
  } catch (error) {
    logger.error('Error al traducir campo multiidioma', {
      error: error.message,
      targetLanguage,
      isHtml
    });
    // Devolver objeto original si falla la traducción
    return multilingualObject;
  }
}

