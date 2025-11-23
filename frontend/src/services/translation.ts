import { apiClient } from './api';

export interface TranslateRequest {
  text: string;
  targetLanguage: 'ca' | 'en';
  isHtml?: boolean;
}

export interface TranslateResponse {
  original: string;
  translated: string;
  targetLanguage: 'ca' | 'en';
  isHtml: boolean;
}

/**
 * Traduce texto desde español a otro idioma usando OpenAI
 */
export async function translateText(request: TranslateRequest): Promise<string> {
  const response = await apiClient.post<{ success: true; data: TranslateResponse }>(
    '/translation/translate',
    request
  );
  
  if (!response.data.success) {
    throw new Error('Error en la respuesta del servidor');
  }
  
  return response.data.data.translated;
}

