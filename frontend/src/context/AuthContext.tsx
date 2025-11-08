import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { apiClient, setAuthToken } from '@/services/api';
import { useTenant } from './TenantContext';

type User = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role?: { scope: string } | null;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (values: { email: string; password: string }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type Props = { children: ReactNode };

const STORAGE_KEY = 'create.auth';

export function AuthProvider({ children }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { tenantSlug } = useTenant();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setLoading(false);
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      if (parsed?.tenantSlug === tenantSlug) {
        setUser(parsed.user);
        setAuthToken(parsed.tokens?.token ?? null);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  const login = async ({ email, password }: { email: string; password: string }) => {
    if (!tenantSlug) {
      throw new Error('tenantSlug requerido');
    }

    const response = await apiClient.post('/auth/login', { email, password });
    const { tokens, user: userData } = response.data.data;
    setAuthToken(tokens.token);
    setUser(userData);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ tokens, user: userData, tenantSlug })
    );
  };

  const logout = () => {
    setUser(null);
    setAuthToken(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return ctx;
}

