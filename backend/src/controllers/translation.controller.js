import { translateText } from '../services/translation.service.js';
import { successResponse, badRequestResponse, errorResponse } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export class TranslationController {
  /**
   * Traduce texto desde español a otro idioma
   * POST /api/v1/translation/translate
   * Body: { text: string, targetLanguage: 'ca' | 'en', isHtml?: boolean }
   */
  static async translate(req, res) {
    try {
      const { text, targetLanguage, isHtml = false } = req.body;

      if (!text || typeof text !== 'string') {
        return badRequestResponse(res, 'El campo "text" es obligatorio y debe ser un string');
      }

      if (!targetLanguage || !['ca', 'en'].includes(targetLanguage)) {
        return badRequestResponse(res, 'El campo "targetLanguage" debe ser "ca" o "en"');
      }

      if (typeof isHtml !== 'boolean') {
        return badRequestResponse(res, 'El campo "isHtml" debe ser un booleano');
      }

      const translatedText = await translateText({
        text,
        targetLanguage,
        isHtml
      });

      return successResponse(res, {
        original: text,
        translated: translatedText,
        targetLanguage,
        isHtml
      });
    } catch (error) {
      logger.error('Error en traducción', {
        error: error.message,
        stack: error.stack
      });
      return errorResponse(res, `Error al traducir: ${error.message}`);
    }
  }
}

