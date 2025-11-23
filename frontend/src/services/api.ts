import axios from 'axios';
import { getSuperAdminAuthToken } from './superadmin';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5100/api';

let currentTenantSlug: string | null = null;
let currentAuthToken: string | null = null;
type UnauthorizedHandler = () => void;
const unauthorizedHandlers = new Set<UnauthorizedHandler>();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

apiClient.interceptors.request.use(config => {
  if (currentTenantSlug) {
    config.headers.set('x-tenant-slug', currentTenantSlug);
  }
  // Solo usar token de tenant en rutas de tenant
  // NO usar token de superadmin como fallback para evitar conflictos de contexto
  if (currentAuthToken) {
    config.headers.set('Authorization', `Bearer ${currentAuthToken}`);
  }
  
  // Logging en desarrollo para diagnosticar problemas con URLs
  if (import.meta.env.DEV && config.url?.includes('/events/')) {
    const fullUrl = `${config.baseURL}${config.url}`;
    console.log(`[apiClient] Request URL:`, fullUrl, { 
      baseURL: config.baseURL, 
      url: config.url,
      method: config.method 
    });
  }
  
  return config;
});

apiClient.interceptors.response.use(
  response => response,
  error => {
    // Logging de errores en desarrollo
    if (import.meta.env.DEV) {
      const requestUrl = error?.config?.url || '';
      const status = error?.response?.status;
      const statusText = error?.response?.statusText;
      const responseData = error?.response?.data;
      
      console.error('[apiClient] Error en petición:');
      console.error('  URL:', requestUrl);
      console.error('  Método:', error?.config?.method);
      console.error('  Status:', status);
      console.error('  Status Text:', statusText);
      console.error('  Response Data:', responseData);
      console.error('  Error Message:', error?.message);
      console.error('  Error completo:', error);
      
      // Si hay datos de respuesta, mostrar el mensaje específico
      if (responseData) {
        if (responseData.message) {
          console.error('  Mensaje del backend:', responseData.message);
        }
        if (responseData.errors && Array.isArray(responseData.errors)) {
          console.error('  Errores de validación:', responseData.errors);
        }
      }
    }
    
    if (error?.response?.status === 401) {
      // No ejecutar el handler de unauthorized para errores de login
      // Estos errores deben manejarse en el componente de login
      const requestUrl = error?.config?.url || '';
      const isLoginRequest = requestUrl.includes('/auth/login');
      
      if (!isLoginRequest) {
        unauthorizedHandlers.forEach(handler => {
          try {
            handler();
          } catch (callbackError) {
            if (import.meta.env.DEV) {
              console.warn('Error al manejar 401 en apiClient', callbackError);
            }
          }
        });
      }
    }
    return Promise.reject(error);
  }
);

export function configureTenant(slug: string | null) {
  currentTenantSlug = slug;
}

export function setAuthToken(token: string | null) {
  currentAuthToken = token;
}

export function clearSession() {
  currentAuthToken = null;
}

export function registerUnauthorizedHandler(handler: UnauthorizedHandler) {
  unauthorizedHandlers.add(handler);
  return () => {
    unauthorizedHandlers.delete(handler);
  };
}

