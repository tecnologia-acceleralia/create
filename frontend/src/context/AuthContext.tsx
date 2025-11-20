import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, setAuthToken, clearSession, registerUnauthorizedHandler } from '@/services/api';
import { useTenant } from './TenantContext';
import { buildAvatarUrl } from '@/utils/avatar';

type MembershipRole = {
  id: number;
  name: string;
  scope: string;
};

type MembershipTenant = {
  id: number;
  slug: string;
  name: string;
  status: string;
};

export type Membership = {
  id: number;
  tenantId: number;
  status: string;
  tenant: MembershipTenant | null;
  roles: MembershipRole[];
};

type Tokens = {
  token: string;
  refreshToken: string;
};

type User = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  profile_image_url: string | null;
  is_super_admin: boolean;
  roleScopes: string[];
  avatarUrl: string;
};

export type EventSession = {
  eventId: number;
  teamId: number | null;
  teamRole: 'captain' | 'member' | 'evaluator' | null;
  lastAccessed: string; // ISO timestamp
};

type StoredAuth = {
  tenantSlug: string | null;
  user: User;
  tokens: Tokens;
  memberships: Membership[];
  activeMembership: Membership | null;
  isSuperAdmin: boolean;
  currentEventId: number | null;
  eventSessions: Record<number, EventSession>; // Map de eventId -> EventSession
};

type AuthResponsePayload = {
  tokens: Tokens;
  user: any;
  memberships: Membership[];
  activeMembership: Membership | null;
  isSuperAdmin: boolean;
};

type AuthContextValue = {
  user: User | null;
  memberships: Membership[];
  activeMembership: Membership | null;
  tokens: Tokens | null;
  isSuperAdmin: boolean;
  loading: boolean;
  currentEventId: number | null;
  currentEventSession: EventSession | null;
  login: (values: { email: string; password: string }) => Promise<void>;
  hydrateSession: (payload: AuthResponsePayload) => void;
  logout: (shouldNavigate?: boolean) => void;
  updateEventSession: (eventId: number, session: Partial<EventSession>) => void;
  setCurrentEvent: (eventId: number | null) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type Props = { children: ReactNode };

const STORAGE_KEY_PREFIX = 'create.auth';

/**
 * Obtiene la clave de almacenamiento para un tenant específico
 */
function getStorageKey(tenantSlug: string | null): string {
  if (!tenantSlug) {
    // Para la home o sin tenant, usar una clave especial
    return `${STORAGE_KEY_PREFIX}:home`;
  }
  return `${STORAGE_KEY_PREFIX}:${tenantSlug}`;
}

/**
 * Obtiene todas las claves de sesión almacenadas para un usuario
 */
function getAllSessionKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(`${STORAGE_KEY_PREFIX}:`)) {
      keys.push(key);
    }
  }
  return keys;
}

function mapUser(rawUser: any, roleScopes: string[]): User {
  return {
    id: rawUser.id,
    email: rawUser.email,
    first_name: rawUser.first_name,
    last_name: rawUser.last_name,
    profile_image_url: rawUser.profile_image_url ?? null,
    is_super_admin: Boolean(rawUser.is_super_admin),
    roleScopes,
    avatarUrl: buildAvatarUrl(rawUser)
  };
}

function findActiveMembership(memberships: Membership[], candidateSlug: string | null, fallback: Membership | null) {
  if (!candidateSlug) {
    return fallback ?? memberships[0] ?? null;
  }
  const matchBySlug = memberships.find(membership => membership.tenant?.slug === candidateSlug);
  if (matchBySlug) {
    return matchBySlug;
  }
  return fallback ?? null;
}

/**
 * Detecta el eventId de una ruta
 */
function detectEventIdFromPath(pathname: string): number | null {
  const segments = pathname.split('/').filter(Boolean);
  const dashboardIndex = segments.indexOf('dashboard');
  if (dashboardIndex === -1) return null;
  
  const nextSegment = segments[dashboardIndex + 1];
  if (nextSegment !== 'events') return null;
  
  const eventIdSegment = segments[dashboardIndex + 2] ?? null;
  if (!eventIdSegment) return null;
  
  const eventId = Number(eventIdSegment);
  return Number.isFinite(eventId) && eventId > 0 ? eventId : null;
}

export function AuthProvider({ children }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeMembership, setActiveMembership] = useState<Membership | null>(null);
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentEventId, setCurrentEventId] = useState<number | null>(null);
  const [eventSessions, setEventSessions] = useState<Record<number, EventSession>>({});
  const { tenantSlug } = useTenant();
  const queryClient = useQueryClient();
  
  // Detectar evento actual desde la URL cuando cambia la ruta
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const detectAndSetEventId = () => {
      const eventId = detectEventIdFromPath(window.location.pathname);
      setCurrentEventId(eventId);
    };
    
    // Detectar inicialmente
    detectAndSetEventId();
    
    // Escuchar cambios de navegación
    const handlePopState = () => {
      detectAndSetEventId();
    };
    
    window.addEventListener('popstate', handlePopState);
    
    // También escuchar cambios de pushState/replaceState usando un intervalo pequeño
    let lastPathname = window.location.pathname;
    const intervalId = setInterval(() => {
      if (window.location.pathname !== lastPathname) {
        lastPathname = window.location.pathname;
        detectAndSetEventId();
      }
    }, 100);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
      clearInterval(intervalId);
    };
  }, []);
  
  // Obtener sesión del evento actual
  const currentEventSession = useMemo(() => {
    if (!currentEventId) return null;
    return eventSessions[currentEventId] ?? null;
  }, [currentEventId, eventSessions]);

  useEffect(() => {
    // Obtener la clave de almacenamiento para el tenant actual
    const storageKey = getStorageKey(tenantSlug);
    const stored = localStorage.getItem(storageKey);
    
    // Si no hay sesión para este tenant, buscar en otros tenants
    if (!stored) {
      // Buscar si hay alguna sesión en otros tenants (útil para superadmins o usuarios con múltiples tenants)
      const allSessionKeys = getAllSessionKeys();
      if (allSessionKeys.length > 0) {
        // Cargar la primera sesión encontrada (preferiblemente la más reciente)
        // Esto permite que superadmins mantengan su sesión al navegar
        const firstSessionKey = allSessionKeys[0];
        const firstStored = localStorage.getItem(firstSessionKey);
        if (firstStored) {
          try {
            const parsed: StoredAuth = JSON.parse(firstStored);
            // Solo usar esta sesión si el usuario es superadmin o si tiene membresía para el tenant actual
            const isStoredSuperAdmin = Boolean(parsed.isSuperAdmin);
            if (isStoredSuperAdmin || (tenantSlug && findActiveMembership(parsed.memberships ?? [], tenantSlug, null))) {
              // Cargar la sesión y guardarla también en el tenant actual para mantener configuración separada
              const active = findActiveMembership(parsed.memberships ?? [], tenantSlug, parsed.activeMembership ?? null);
              setAuthToken(parsed.tokens.token);
              setTokens(parsed.tokens);
              setMemberships(parsed.memberships ?? []);
              setIsSuperAdmin(isStoredSuperAdmin);
              setActiveMembership(active);
              const roleScopes = active?.roles?.map(role => role.scope) ?? parsed.user.roleScopes ?? [];
              setUser(mapUser(parsed.user, roleScopes));
              
              // Guardar la sesión en el tenant actual con su configuración específica
              const sessionForCurrentTenant: StoredAuth = {
                tenantSlug,
                user: parsed.user,
                tokens: parsed.tokens,
                memberships: parsed.memberships ?? [],
                activeMembership: active,
                isSuperAdmin: isStoredSuperAdmin,
                currentEventId: parsed.currentEventId ?? null,
                eventSessions: parsed.eventSessions ?? {}
              };
              localStorage.setItem(storageKey, JSON.stringify(sessionForCurrentTenant));
              setEventSessions(parsed.eventSessions ?? {});
              setCurrentEventId(parsed.currentEventId ?? null);
              
              setLoading(false);
              return;
            }
          } catch {
            // Ignorar errores de parsing
          }
        }
      }
      setLoading(false);
      return;
    }

    // Usar la sesión del tenant actual
    try {
      const parsed: StoredAuth = JSON.parse(stored);
      const isStoredSuperAdmin = Boolean(parsed.isSuperAdmin);
      
      if (parsed?.tokens?.token && parsed.user) {
        setAuthToken(parsed.tokens.token);
        setTokens(parsed.tokens);
        setMemberships(parsed.memberships ?? []);
        setIsSuperAdmin(isStoredSuperAdmin);
        
        // Buscar membresía activa para el tenant actual
        const active = findActiveMembership(parsed.memberships ?? [], tenantSlug, parsed.activeMembership ?? null);
        setActiveMembership(active);
        const roleScopes = active?.roles?.map(role => role.scope) ?? parsed.user.roleScopes ?? [];
        setUser(mapUser(parsed.user, roleScopes));
        
        // Cargar información de eventos
        setEventSessions(parsed.eventSessions ?? {});
        setCurrentEventId(parsed.currentEventId ?? null);
        
        // Si el tenantSlug almacenado es diferente al actual, actualizar la clave de almacenamiento
        // Esto puede pasar cuando cambiamos de tenant
        if (parsed.tenantSlug !== tenantSlug) {
          const updated: StoredAuth = {
            ...parsed,
            tenantSlug,
            activeMembership: active,
            currentEventId: parsed.currentEventId ?? null,
            eventSessions: parsed.eventSessions ?? {}
          };
          // Guardar en la nueva clave del tenant actual
          localStorage.setItem(storageKey, JSON.stringify(updated));
          // Si había una clave anterior diferente, mantenerla (para permitir volver a ese tenant)
          if (parsed.tenantSlug && parsed.tenantSlug !== tenantSlug) {
            const oldKey = getStorageKey(parsed.tenantSlug);
            // Solo mantener si es diferente a la nueva clave
            if (oldKey !== storageKey) {
              localStorage.setItem(oldKey, JSON.stringify({ 
                ...parsed, 
                activeMembership: parsed.activeMembership,
                currentEventId: parsed.currentEventId ?? null,
                eventSessions: parsed.eventSessions ?? {}
              }));
            }
          }
        }
      } else {
        // Datos corruptos, limpiar solo esta sesión del tenant actual
        localStorage.removeItem(storageKey);
      }
    } catch {
      // Error de parsing, limpiar solo esta sesión del tenant actual
      localStorage.removeItem(storageKey);
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    if (!memberships.length) {
      setActiveMembership(null);
      return;
    }
    const updatedActive = findActiveMembership(memberships, tenantSlug, activeMembership);
    // Solo actualizar si cambió la membresía activa
    const currentId = activeMembership?.id ?? null;
    const newId = updatedActive?.id ?? null;
    if (currentId !== newId) {
      setActiveMembership(updatedActive);
      if (user) {
        const roleScopes = updatedActive?.roles?.map(role => role.scope) ?? [];
        setUser(mapUser(user, roleScopes));
      }
      // Actualizar localStorage para mantener consistencia
      const storageKey = getStorageKey(tenantSlug);
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          const parsed: StoredAuth = JSON.parse(stored);
          const updated: StoredAuth = {
            ...parsed,
            tenantSlug,
            activeMembership: updatedActive,
            currentEventId: parsed.currentEventId ?? null,
            eventSessions: parsed.eventSessions ?? {}
          };
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch {
          // Ignorar errores de parsing
        }
      }
    }
  }, [tenantSlug, memberships]);
  
  // Actualizar sesión cuando cambia el evento desde la URL
  useEffect(() => {
    if (!tenantSlug) return;
    
    const storageKey = getStorageKey(tenantSlug);
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed: StoredAuth = JSON.parse(stored);
        // Si el evento cambió, actualizar currentEventId
        if (parsed.currentEventId !== currentEventId) {
          const updated: StoredAuth = {
            ...parsed,
            currentEventId: currentEventId ?? null
          };
          localStorage.setItem(storageKey, JSON.stringify(updated));
        }
      } catch {
        // Ignorar errores de parsing
      }
    }
  }, [currentEventId, tenantSlug]);

  const applyAuthPayload = useCallback(
    (payload: AuthResponsePayload) => {
      if (!tenantSlug) {
        throw new Error('tenantSlug requerido');
      }

      const { tokens: loginTokens, user: userData, memberships: responseMemberships, activeMembership: responseActiveMembership, isSuperAdmin } = payload;

      setAuthToken(loginTokens.token);
      setTokens(loginTokens);

      const active = findActiveMembership(responseMemberships ?? [], tenantSlug, responseActiveMembership ?? null);
      setMemberships(responseMemberships ?? []);
      setActiveMembership(active);
      setIsSuperAdmin(Boolean(isSuperAdmin));

      const roleScopes = active?.roles?.map(role => role.scope) ?? [];
      const mappedUser = mapUser(userData, roleScopes);
      setUser(mappedUser);

      const stored: StoredAuth = {
        tenantSlug,
        user: mappedUser,
        tokens: loginTokens,
        memberships: responseMemberships ?? [],
        activeMembership: active,
        isSuperAdmin: Boolean(isSuperAdmin),
        currentEventId: null,
        eventSessions: {}
      };
      // Guardar la sesión en la clave específica del tenant
      const storageKey = getStorageKey(tenantSlug);
      localStorage.setItem(storageKey, JSON.stringify(stored));
      setEventSessions({});
      setCurrentEventId(null);
    },
    [tenantSlug]
  );
  
  // Función para actualizar la sesión de un evento específico
  const updateEventSession = useCallback((eventId: number, session: Partial<EventSession>) => {
    if (!tenantSlug) return;
    
    const storageKey = getStorageKey(tenantSlug);
    const stored = localStorage.getItem(storageKey);
    if (!stored) return;
    
    try {
      const parsed: StoredAuth = JSON.parse(stored);
      const existingSession = parsed.eventSessions?.[eventId] ?? {
        eventId,
        teamId: null,
        teamRole: null,
        lastAccessed: new Date().toISOString()
      };
      
      const updatedSession: EventSession = {
        ...existingSession,
        ...session,
        lastAccessed: new Date().toISOString()
      };
      
      const updated: StoredAuth = {
        ...parsed,
        currentEventId: eventId,
        eventSessions: {
          ...parsed.eventSessions,
          [eventId]: updatedSession
        }
      };
      
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setEventSessions(updated.eventSessions);
      setCurrentEventId(eventId);
    } catch {
      // Ignorar errores de parsing
    }
  }, [tenantSlug]);
  
  // Función para establecer el evento actual
  const setCurrentEvent = useCallback((eventId: number | null) => {
    setCurrentEventId(eventId);
    if (!tenantSlug) return;
    
    const storageKey = getStorageKey(tenantSlug);
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed: StoredAuth = JSON.parse(stored);
        const updated: StoredAuth = {
          ...parsed,
          currentEventId: eventId
        };
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {
        // Ignorar errores de parsing
      }
    }
  }, [tenantSlug]);

  const login = useCallback(async ({ email, password }: { email: string; password: string }) => {
    const response = await apiClient.post('/auth/login', { email, password });
    applyAuthPayload(response.data.data);
  }, [applyAuthPayload]);

  const logout = useCallback((shouldNavigate: boolean = false) => {
    setUser(null);
    setMemberships([]);
    setActiveMembership(null);
    setTokens(null);
    setIsSuperAdmin(false);
    setAuthToken(null);
    clearSession();
    
    // Limpiar TODAS las sesiones de autenticación de todos los tenants
    const allSessionKeys = getAllSessionKeys();
    allSessionKeys.forEach(key => {
      localStorage.removeItem(key);
    });
    
    // Limpiar sessionStorage del evento activo para todos los posibles tenants
    if (typeof window !== 'undefined') {
      try {
        // Limpiar el evento activo del tenant actual
        if (tenantSlug) {
          sessionStorage.removeItem(`activeEventId_${tenantSlug}`);
        }
        // Limpiar cualquier otro evento activo que pueda existir
        // Iteramos sobre todas las claves de sessionStorage que empiecen con 'activeEventId_'
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const key = sessionStorage.key(i);
          if (key && key.startsWith('activeEventId_')) {
            sessionStorage.removeItem(key);
          }
        }
      } catch {
        // Ignorar errores de sessionStorage (puede estar deshabilitado)
      }
    }
    
    // Limpiar toda la caché de React Query para evitar que datos del usuario anterior
    // se muestren si otro usuario inicia sesión en el mismo navegador
    queryClient.clear();
    
    // Navegar a la home del tenant después de cerrar sesión (solo si shouldNavigate es true)
    // Por defecto, la navegación se maneja desde el componente que llama logout
    if (shouldNavigate && typeof window !== 'undefined') {
      const homePath = tenantSlug ? `/${tenantSlug}` : '/';
      window.location.replace(homePath);
    }
  }, [tenantSlug, queryClient]);

  useEffect(() => {
    const unsubscribe = registerUnauthorizedHandler(() => {
      // No navegar automáticamente desde logout porque el handler maneja la navegación al login
      logout(false);
      if (typeof window !== 'undefined') {
        const loginPath = tenantSlug ? `/${tenantSlug}/login` : '/';
        window.location.replace(loginPath);
      }
    });
    return unsubscribe;
  }, [logout, tenantSlug]);

  const value = useMemo(
    () => ({
      user,
      memberships,
      activeMembership,
      tokens,
      isSuperAdmin,
      loading,
      currentEventId,
      currentEventSession,
      login,
      hydrateSession: applyAuthPayload,
      logout,
      updateEventSession,
      setCurrentEvent
    }),
    [user, memberships, activeMembership, tokens, isSuperAdmin, loading, currentEventId, currentEventSession, login, applyAuthPayload, logout, updateEventSession, setCurrentEvent]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return ctx;
}

export { mapUser };

