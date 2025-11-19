import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { apiClient, setAuthToken, clearSession, registerUnauthorizedHandler } from '@/services/api';
import { useTenant } from './TenantContext';

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
  avatar_url: string | null;
  profile_image_url: string | null;
  is_super_admin: boolean;
  roleScopes: string[];
  avatarUrl: string;
};

type StoredAuth = {
  tenantSlug: string | null;
  user: User;
  tokens: Tokens;
  memberships: Membership[];
  activeMembership: Membership | null;
  isSuperAdmin: boolean;
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
  login: (values: { email: string; password: string }) => Promise<void>;
  hydrateSession: (payload: AuthResponsePayload) => void;
  logout: (shouldNavigate?: boolean) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type Props = { children: ReactNode };

const STORAGE_KEY = 'create.auth';

function buildAvatarUrl(user: { first_name?: string; last_name?: string; email: string; avatar_url?: string | null; profile_image_url?: string | null }) {
  // Prioridad: avatar_url > profile_image_url > generado
  if (user.avatar_url) {
    return user.avatar_url;
  }
  if (user.profile_image_url) {
    return user.profile_image_url;
  }
  const seedSource = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.email;
  const seed = encodeURIComponent(seedSource.toLowerCase());
  return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}`;
}

function mapUser(rawUser: any, roleScopes: string[]): User {
  return {
    id: rawUser.id,
    email: rawUser.email,
    first_name: rawUser.first_name,
    last_name: rawUser.last_name,
    avatar_url: rawUser.avatar_url ?? null,
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

export function AuthProvider({ children }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeMembership, setActiveMembership] = useState<Membership | null>(null);
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const { tenantSlug } = useTenant();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setLoading(false);
      return;
    }

    try {
      const parsed: StoredAuth = JSON.parse(stored);
      const isStoredSuperAdmin = Boolean(parsed.isSuperAdmin);
      
      // Si el tenantSlug cambió, solo limpiar sesión si NO es superadmin
      // Los superadmins pueden navegar entre tenants sin perder su sesión
      if (parsed?.tenantSlug && parsed.tenantSlug !== tenantSlug && !isStoredSuperAdmin) {
        localStorage.removeItem(STORAGE_KEY);
        setUser(null);
        setMemberships([]);
        setActiveMembership(null);
        setTokens(null);
        setIsSuperAdmin(false);
        setAuthToken(null);
        return;
      }

      if (parsed?.tokens?.token && parsed.user) {
        setAuthToken(parsed.tokens.token);
        setTokens(parsed.tokens);
        setMemberships(parsed.memberships ?? []);
        setIsSuperAdmin(isStoredSuperAdmin);
        const active = findActiveMembership(parsed.memberships ?? [], tenantSlug, parsed.activeMembership ?? null);
        setActiveMembership(active);
        const roleScopes = active?.roles?.map(role => role.scope) ?? [];
        setUser(mapUser(parsed.user, roleScopes));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
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
    setActiveMembership(updatedActive);
    if (user) {
      const roleScopes = updatedActive?.roles?.map(role => role.scope) ?? [];
      setUser(mapUser(user, roleScopes));
    }
  }, [tenantSlug, memberships]);

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
        isSuperAdmin: Boolean(isSuperAdmin)
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    },
    [tenantSlug]
  );

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
    localStorage.removeItem(STORAGE_KEY);
    
    // Navegar a la home del tenant después de cerrar sesión (solo si shouldNavigate es true)
    // Por defecto, la navegación se maneja desde el componente que llama logout
    if (shouldNavigate && typeof window !== 'undefined') {
      const homePath = tenantSlug ? `/${tenantSlug}` : '/';
      window.location.replace(homePath);
    }
  }, [tenantSlug]);

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
      login,
      hydrateSession: applyAuthPayload,
      logout
    }),
    [user, memberships, activeMembership, tokens, isSuperAdmin, loading, login, applyAuthPayload, logout]
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

export { buildAvatarUrl, mapUser };

