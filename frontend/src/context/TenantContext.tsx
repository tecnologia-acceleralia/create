import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { apiClient, configureTenant } from '@/services/api';

type Branding = {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};

type TenantContextValue = {
  tenantSlug: string | null;
  branding: Branding;
  setTenantSlug: (slug: string) => void;
  refreshBranding: () => Promise<void>;
  loading: boolean;
};

const defaultBranding: Branding = {
  logoUrl: null,
  primaryColor: '#0ea5e9',
  secondaryColor: '#1f2937',
  accentColor: '#f97316'
};

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

type Props = { children: ReactNode };

function detectInitialSlug(): string | null {
  const host = window.location.hostname;
  if (host.includes('.')) {
    const [subdomain] = host.split('.');
    if (subdomain && subdomain !== 'www') {
      return subdomain;
    }
  }
  const [, maybeSlug] = window.location.pathname.split('/tenant/');
  if (maybeSlug) {
    return maybeSlug.split('/')[0];
  }
  return null;
}

export function TenantProvider({ children }: Props) {
  const [tenantSlug, setTenantSlug] = useState<string | null>(detectInitialSlug());
  const [branding, setBranding] = useState<Branding>(defaultBranding);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tenantSlug) {
      configureTenant(tenantSlug);
      void refreshBranding();
    }
  }, [tenantSlug]);

  const refreshBranding = async () => {
    if (!tenantSlug) {
      return;
    }

    try {
      setLoading(true);
      const response = await apiClient.get('/public/tenant/branding', {
        params: { slug: tenantSlug }
      });

      setBranding({
        logoUrl: response.data?.data?.logo_url ?? null,
        primaryColor: response.data?.data?.primary_color ?? defaultBranding.primaryColor,
        secondaryColor: response.data?.data?.secondary_color ?? defaultBranding.secondaryColor,
        accentColor: response.data?.data?.accent_color ?? defaultBranding.accentColor
      });
    } catch (error) {
      setBranding(defaultBranding);
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo(() => ({ tenantSlug, branding, setTenantSlug, refreshBranding, loading }), [tenantSlug, branding, loading]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error('useTenant debe usarse dentro de TenantProvider');
  }
  return ctx;
}

