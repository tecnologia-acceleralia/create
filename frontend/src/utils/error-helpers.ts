import { isAxiosError } from 'axios';

/**
 * Extrae el mensaje de error de una respuesta de axios
 * @param error - Error de axios o cualquier error
 * @param fallbackMessage - Mensaje por defecto si no se puede extraer
 * @returns Mensaje de error extraído o el mensaje por defecto
 */
export function extractErrorMessage(error: unknown, fallbackMessage: string): string {
  if (isAxiosError(error)) {
    // Intentar obtener el mensaje del backend
    const backendMessage = error.response?.data?.message;
    if (backendMessage && typeof backendMessage === 'string') {
      return backendMessage;
    }
    
    // Si hay errores de validación, intentar extraerlos
    const validationErrors = error.response?.data?.errors;
    if (Array.isArray(validationErrors) && validationErrors.length > 0) {
      const firstError = validationErrors[0];
      if (typeof firstError === 'string') {
        return firstError;
      }
      if (firstError?.msg) {
        return firstError.msg;
      }
    }
    
    // Usar el mensaje del error HTTP si está disponible
    if (error.message) {
      return error.message;
    }
  }
  
  // Si es un Error estándar, usar su mensaje
  if (error instanceof Error) {
    return error.message;
  }
  
  return fallbackMessage;
}

/**
 * Loggea un error en desarrollo con información detallada
 * @param error - Error a loggear
 * @param context - Contexto adicional para el log
 */
export function logError(error: unknown, context?: string): void {
  if (import.meta.env.DEV) {
    const prefix = context ? `[${context}]` : '[Error]';
    console.error(`${prefix} Error:`, error);
    
    if (isAxiosError(error)) {
      console.error(`${prefix} Request URL:`, error.config?.url);
      console.error(`${prefix} Response Status:`, error.response?.status);
      console.error(`${prefix} Response Data:`, error.response?.data);
    }
  }
}

