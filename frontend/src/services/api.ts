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
  // Usar token normal si está disponible, sino usar token de superadmin
  const tokenToUse = currentAuthToken || getSuperAdminAuthToken();
  if (tokenToUse) {
    config.headers.set('Authorization', `Bearer ${tokenToUse}`);
  }
  return config;
});

apiClient.interceptors.response.use(
  response => response,
  error => {
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

