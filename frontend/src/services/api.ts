import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

let currentTenantSlug: string | null = null;
let currentAuthToken: string | null = null;

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
  if (currentAuthToken) {
    config.headers.set('Authorization', `Bearer ${currentAuthToken}`);
  }
  return config;
});

export function configureTenant(slug: string | null) {
  currentTenantSlug = slug;
}

export function setAuthToken(token: string | null) {
  currentAuthToken = token;
}

export function clearSession() {
  currentAuthToken = null;
}

