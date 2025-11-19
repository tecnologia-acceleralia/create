import { createContext, useContext, useEffect, useMemo, useState, useCallback, useLayoutEffect } from "react";
import type { ReactNode } from "react";
import { apiClient, configureTenant } from '@/services/api';
import { applyBrandingVariables } from '@/utils/color';

type TenantSocialLinks = {
  website?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  linkedin?: string | null;
  twitter?: string | null;
  youtube?: string | null;
};

type TenantPhase = {
  id: number;
  name: string;
  description?: string | null;
  eventId: number;
  eventName: string | null;
  eventStatus: string | null;
  orderIndex: number;
  viewStartDate: string | null;
  viewEndDate: string | null;
  isVisibleNow: boolean;
};

type HeroCopy = {
  title: string | null;
  subtitle: string | null;
};

type HeroContent = Record<string, HeroCopy>;

type Branding = {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  heroContent: HeroContent;
  socialLinks: TenantSocialLinks;
};

type TenantAccessWindow = {
  startDate: string | null;
  endDate: string | null;
  isActiveNow: boolean;
};

type TenantContextValue = {
  tenantSlug: string | null;
  branding: Branding;
  phases: TenantPhase[];
  setTenantSlug: (slug: string | null) => void;
  refreshBranding: () => Promise<void>;
  loading: boolean;
  tenantCss: string | null;
  accessWindow: TenantAccessWindow;
  tenantNotFound: boolean;
};

const defaultBranding: Branding = {
  logoUrl: null,
  primaryColor: '#0ea5e9',
  secondaryColor: '#1f2937',
  accentColor: '#f97316',
  heroContent: {},
  socialLinks: {}
};

const defaultAccessWindow: TenantAccessWindow = {
  startDate: null,
  endDate: null,
  isActiveNow: true
};

const BRANDING_CACHE_PREFIX = 'create:tenant-branding:';
const BRANDING_CACHE_TTL = 1000 * 60 * 60 * 24; // 24 horas

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

type Props = { readonly children: ReactNode };

type CachedTenantBranding = {
  branding: Branding;
  tenantCss: string | null;
  accessWindow: TenantAccessWindow;
  timestamp: number;
};

function getBrowserWindow(): Window | null {
  const maybeGlobal = globalThis as typeof globalThis & { window?: Window };
  if (!('window' in maybeGlobal)) {
    return null;
  }

  const maybeWindow = maybeGlobal.window;
  return maybeWindow ?? null;
}

const useIsomorphicLayoutEffect = getBrowserWindow() ? useLayoutEffect : useEffect;

function normalizeHeroContent(data: unknown): HeroContent {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const entries = Object.entries(data as Record<string, any>).reduce<HeroContent>((acc, [lang, value]) => {
    if (!value || typeof value !== 'object') {
      return acc;
    }

    const title = typeof (value as Record<string, unknown>).title === 'string' ? (value as Record<string, string>).title : null;
    const subtitle = typeof (value as Record<string, unknown>).subtitle === 'string' ? (value as Record<string, string>).subtitle : null;

    const normalizedLang = lang.toLowerCase();
    const baseLang = normalizedLang.split('-')[0];

    const heroCopy = {
      title,
      subtitle
    };

    acc[normalizedLang] = heroCopy;

    if (!acc[baseLang]) {
      acc[baseLang] = heroCopy;
    }

    return acc;
  }, {});

  return entries;
}

function detectInitialSlug(): string | null {
  const browserWindow = getBrowserWindow();
  if (!browserWindow) {
    return null;
  }

  const reservedSegments = new Set(['superadmin', 'dashboard']);

  // PRIORIDAD 1: Verificar primero el pathname (para rutas como /uic)
  // Esto permite que las redirecciones de Cloudflare funcionen correctamente
  const firstSegment = browserWindow.location.pathname.split('/').find(Boolean);
  
  // Si el pathname empieza con un segmento reservado (como superadmin), no detectar tenant
  if (firstSegment && reservedSegments.has(firstSegment.toLowerCase())) {
    return null;
  }
  
  if (firstSegment && !reservedSegments.has(firstSegment.toLowerCase())) {
    return firstSegment.toLowerCase();
  }

  // PRIORIDAD 2: Si no hay segmento en pathname, usar subdominio
  const host = browserWindow.location.hostname;
  if (host.includes('.')) {
    const [subdomain] = host.split('.');
    if (subdomain && subdomain !== 'www' && !reservedSegments.has(subdomain.toLowerCase())) {
      return subdomain.toLowerCase();
    }
  }

  return null;
}

function loadCachedBranding(slug: string | null): CachedTenantBranding | null {
  const browserWindow = getBrowserWindow();
  if (!slug || !browserWindow) {
    return null;
  }

  try {
    const storageKey = `${BRANDING_CACHE_PREFIX}${slug}`;
    const raw = browserWindow.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<CachedTenantBranding>;
    if (!parsed || typeof parsed !== 'object' || !parsed.branding) {
      return null;
    }

    if (parsed.timestamp && Date.now() - parsed.timestamp > BRANDING_CACHE_TTL) {
      browserWindow.localStorage.removeItem(storageKey);
      return null;
    }

    return {
      branding: {
        ...defaultBranding,
        ...parsed.branding,
        heroContent: parsed.branding?.heroContent ?? defaultBranding.heroContent,
        socialLinks: parsed.branding?.socialLinks ?? defaultBranding.socialLinks
      },
      tenantCss: typeof parsed.tenantCss === 'string' ? parsed.tenantCss : null,
      accessWindow: {
        ...defaultAccessWindow,
        ...(parsed.accessWindow ?? defaultAccessWindow)
      },
      timestamp: parsed.timestamp ?? Date.now()
    };
  } catch {
    return null;
  }
}

function persistCachedBranding(slug: string, payload: CachedTenantBranding) {
  const browserWindow = getBrowserWindow();
  if (!slug || !browserWindow) {
    return;
  }

  try {
    const storageKey = `${BRANDING_CACHE_PREFIX}${slug}`;
    browserWindow.localStorage.setItem(
      storageKey,
      JSON.stringify({
        branding: payload.branding,
        tenantCss: payload.tenantCss,
        accessWindow: payload.accessWindow,
        timestamp: payload.timestamp
      })
    );
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('No se pudo guardar la marca en caché', error);
    }
  }
}

function clearCachedBranding(slug: string | null) {
  const browserWindow = getBrowserWindow();
  if (!slug || !browserWindow) {
    return;
  }

  try {
    browserWindow.localStorage.removeItem(`${BRANDING_CACHE_PREFIX}${slug}`);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('No se pudo limpiar la marca en caché', error);
    }
  }
}

export function TenantProvider({ children }: Props) {
  const initialSlug = detectInitialSlug();
  const initialCachedBranding = loadCachedBranding(initialSlug);

  const [tenantSlug, setTenantSlug] = useState<string | null>(initialSlug);
  const [branding, setBranding] = useState<Branding>(initialCachedBranding?.branding ?? defaultBranding);
  const [phases, setPhases] = useState<TenantPhase[]>([]);
  const [loading, setLoading] = useState(false);
  const [tenantCss, setTenantCss] = useState<string | null>(initialCachedBranding?.tenantCss ?? null);
  const [accessWindow, setAccessWindow] = useState<TenantAccessWindow>(initialCachedBranding?.accessWindow ?? defaultAccessWindow);
  const [tenantNotFound, setTenantNotFound] = useState(false);

  const refreshBranding = useCallback(async () => {
    if (!tenantSlug) {
      setTenantNotFound(false);
      return;
    }

    try {
      setLoading(true);
      setTenantNotFound(false);
      const [brandingResponse, phasesResponse] = await Promise.all([
        apiClient.get('/public/branding', {
          params: { slug: tenantSlug }
        }),
        apiClient.get('/public/phases', {
          params: { slug: tenantSlug }
        })
      ]);

      const data = brandingResponse.data?.data;
      const nextBranding: Branding = {
        logoUrl: data?.logo_url ?? null,
        primaryColor: data?.primary_color ?? defaultBranding.primaryColor,
        secondaryColor: data?.secondary_color ?? defaultBranding.secondaryColor,
        accentColor: data?.accent_color ?? defaultBranding.accentColor,
        heroContent: normalizeHeroContent(data?.hero_content),
        socialLinks: {
          website: data?.website_url ?? null,
          facebook: data?.facebook_url ?? null,
          instagram: data?.instagram_url ?? null,
          linkedin: data?.linkedin_url ?? null,
          twitter: data?.twitter_url ?? null,
          youtube: data?.youtube_url ?? null
        }
      };
      const nextTenantCss = data?.tenant_css ?? null;

      const startDate = data?.start_date ?? null;
      const endDate = data?.end_date ?? null;
      const isActiveNow =
        typeof data?.is_active_now === 'boolean'
          ? data.is_active_now
          : (() => {
              const now = new Date();
              const startAt = startDate ? new Date(`${startDate}T00:00:00Z`) : null;
              const endAt = endDate ? new Date(`${endDate}T23:59:59Z`) : null;
              return (!startAt || now >= startAt) && (!endAt || now <= endAt);
            })();
      const nextAccessWindow: TenantAccessWindow = {
        startDate,
        endDate,
        isActiveNow
      };

      setBranding(nextBranding);
      setTenantCss(nextTenantCss);
      setAccessWindow(nextAccessWindow);

      persistCachedBranding(tenantSlug, {
        branding: nextBranding,
        tenantCss: nextTenantCss,
        accessWindow: nextAccessWindow,
        timestamp: Date.now()
      });

      const phasesData: TenantPhase[] = (phasesResponse.data?.data ?? []).map((phase: any) => {
        const viewStart = phase.viewStartDate ? new Date(phase.viewStartDate) : null;
        const viewEnd = phase.viewEndDate ? new Date(phase.viewEndDate) : null;
        const now = new Date();
        const computedVisible =
          (!viewStart || viewStart.getTime() <= now.getTime()) &&
          (!viewEnd || viewEnd.getTime() >= now.getTime());

        return {
          id: phase.id,
          name: phase.name,
          description: phase.description ?? null,
          eventId: phase.eventId,
          eventName: phase.eventName,
          eventStatus: phase.eventStatus,
          orderIndex: phase.orderIndex,
          viewStartDate: viewStart ? viewStart.toISOString() : null,
          viewEndDate: viewEnd ? viewEnd.toISOString() : null,
          isVisibleNow: typeof phase.isVisibleNow === 'boolean' ? phase.isVisibleNow : computedVisible
        };
      });
      setPhases(phasesData);
    } catch (error: any) {
      // Verificar si el error es 404 (tenant no encontrado)
      const isNotFound = error?.response?.status === 404;
      
      if (isNotFound) {
        setTenantNotFound(true);
      } else {
        setTenantNotFound(false);
      }

      if (import.meta.env.DEV) {
        console.error('Error al refrescar el branding del tenant', error);
      }
      setBranding(defaultBranding);
      setPhases([]);
      setTenantCss(null);
      setAccessWindow(defaultAccessWindow);
      clearCachedBranding(tenantSlug);
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useIsomorphicLayoutEffect(() => {
    applyBrandingVariables(branding.primaryColor, branding.secondaryColor, branding.accentColor);
  }, [branding.primaryColor, branding.secondaryColor, branding.accentColor]);

  useEffect(() => {
    configureTenant(tenantSlug);

    if (tenantSlug) {
      const cached = loadCachedBranding(tenantSlug);
      if (cached) {
        setBranding(cached.branding);
        setTenantCss(cached.tenantCss);
        setAccessWindow(cached.accessWindow);
        setTenantNotFound(false);
      } else {
        setBranding(defaultBranding);
        setTenantCss(null);
        setAccessWindow(defaultAccessWindow);
      }
      setPhases([]);
      void refreshBranding();
    } else {
      setBranding(defaultBranding);
      setPhases([]);
      setTenantCss(null);
      setAccessWindow(defaultAccessWindow);
      setTenantNotFound(false);
    }
  }, [tenantSlug, refreshBranding]);

  const value = useMemo(
    () => ({
      tenantSlug,
      branding,
      phases,
      setTenantSlug,
      refreshBranding,
      loading,
      tenantCss,
      accessWindow,
      tenantNotFound
    }),
    [tenantSlug, branding, phases, setTenantSlug, refreshBranding, loading, tenantCss, accessWindow, tenantNotFound]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error('useTenant debe usarse dentro de TenantProvider');
  }
  return ctx;
}
