import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { apiClient, configureTenant } from '@/services/api';

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

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

type Props = { children: ReactNode };

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

    acc[lang] = {
      title,
      subtitle
    };
    return acc;
  }, {});

  return entries;
}

function detectInitialSlug(): string | null {
  const host = window.location.hostname;
  if (host.includes('.')) {
    const [subdomain] = host.split('.');
    if (subdomain && subdomain !== 'www') {
      return subdomain.toLowerCase();
    }
  }

  const [firstSegment] = window.location.pathname.split('/').filter(Boolean);
  const reservedSegments = new Set(['superadmin', 'dashboard']);
  if (firstSegment && !reservedSegments.has(firstSegment.toLowerCase())) {
    return firstSegment.toLowerCase();
  }

  return null;
}

export function TenantProvider({ children }: Props) {
  const [tenantSlug, setTenantSlug] = useState<string | null>(detectInitialSlug());
  const [branding, setBranding] = useState<Branding>(defaultBranding);
  const [phases, setPhases] = useState<TenantPhase[]>([]);
  const [loading, setLoading] = useState(false);
  const [tenantCss, setTenantCss] = useState<string | null>(null);
  const [accessWindow, setAccessWindow] = useState<TenantAccessWindow>(defaultAccessWindow);

  const refreshBranding = useCallback(async () => {
    if (!tenantSlug) {
      return;
    }

    try {
      setLoading(true);
      const [brandingResponse, phasesResponse] = await Promise.all([
        apiClient.get('/public/branding', {
          params: { slug: tenantSlug }
        }),
        apiClient.get('/public/phases', {
          params: { slug: tenantSlug }
        })
      ]);

      const data = brandingResponse.data?.data;
      setBranding({
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
      });
      setTenantCss(data?.tenant_css ?? null);

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
      setAccessWindow({
        startDate,
        endDate,
        isActiveNow
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
    } catch (error) {
      setBranding(defaultBranding);
      setPhases([]);
      setTenantCss(null);
      setAccessWindow(defaultAccessWindow);
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    configureTenant(tenantSlug);

    if (tenantSlug) {
      void refreshBranding();
    } else {
      setBranding(defaultBranding);
      setPhases([]);
      setTenantCss(null);
      setAccessWindow(defaultAccessWindow);
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
      accessWindow
    }),
    [tenantSlug, branding, phases, setTenantSlug, refreshBranding, loading, tenantCss, accessWindow]
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
