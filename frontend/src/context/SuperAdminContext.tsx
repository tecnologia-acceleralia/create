import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { superAdminLogin, setSuperAdminAuthToken, registerSuperAdminUnauthorizedHandler } from '@/services/superadmin';

const SUPERADMIN_AUTH_KEY = 'create.superadmin.auth';

type Tokens = {
  token: string;
  refreshToken: string;
};

type SuperAdminUser = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  profile_image_url: string | null;
  avatarUrl: string;
};

type StoredSuperAdminAuth = {
  tokens: Tokens;
  user: SuperAdminUser;
};

type SuperAdminContextValue = {
  user: SuperAdminUser | null;
  tokens: Tokens | null;
  loading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => void;
};

const SuperAdminContext = createContext<SuperAdminContextValue | undefined>(undefined);

type Props = {
  children: ReactNode;
};

function buildAvatarUrl(user: { first_name?: string; last_name?: string; email: string; profile_image_url?: string | null }) {
  if (user.profile_image_url) {
    return user.profile_image_url;
  }
  const seedSource = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.email;
  const seed = encodeURIComponent(seedSource.toLowerCase());
  return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}`;
}

export function SuperAdminProvider({ children }: Props) {
  const [user, setUser] = useState<SuperAdminUser | null>(null);
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const storedRaw = window.localStorage.getItem(SUPERADMIN_AUTH_KEY);
    if (!storedRaw) {
      setLoading(false);
      return;
    }

    try {
      const parsed: StoredSuperAdminAuth = JSON.parse(storedRaw);
      if (parsed.tokens?.token && parsed.user) {
        setTokens(parsed.tokens);
        const enhancedUser: SuperAdminUser = {
          ...parsed.user,
          avatarUrl: buildAvatarUrl(parsed.user)
        };
        setUser(enhancedUser);
        setSuperAdminAuthToken(parsed.tokens.token);
      } else {
        window.localStorage.removeItem(SUPERADMIN_AUTH_KEY);
      }
    } catch {
      window.localStorage.removeItem(SUPERADMIN_AUTH_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    const response = await superAdminLogin(credentials);
    const enhancedUser: SuperAdminUser = {
      ...response.user,
      avatarUrl: buildAvatarUrl(response.user)
    };
    const authPayload: StoredSuperAdminAuth = {
      tokens: response.tokens,
      user: enhancedUser
    };

    setSuperAdminAuthToken(response.tokens.token);
    setTokens(response.tokens);
    setUser(enhancedUser);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SUPERADMIN_AUTH_KEY, JSON.stringify(authPayload));
    }
  };

  const logout = useCallback(() => {
    setSuperAdminAuthToken(null);
    setTokens(null);
    setUser(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(SUPERADMIN_AUTH_KEY);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = registerSuperAdminUnauthorizedHandler(() => {
      logout();
      if (typeof window !== 'undefined') {
        window.location.replace('/superadmin');
      }
    });
    return unsubscribe;
  }, [logout]);

  const value = useMemo(
    () => ({
      user,
      tokens,
      loading,
      login,
      logout
    }),
    [user, tokens, loading]
  );

  return <SuperAdminContext.Provider value={value}>{children}</SuperAdminContext.Provider>;
}

export function useSuperAdminSession() {
  const context = useContext(SuperAdminContext);
  if (!context) {
    throw new Error('useSuperAdminSession debe usarse dentro de SuperAdminProvider');
  }

  return context;
}

