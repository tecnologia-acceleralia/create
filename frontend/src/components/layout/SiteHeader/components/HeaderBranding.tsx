import { useMemo } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useTenant } from '@/context/TenantContext';
import { useTenantPath } from '@/hooks/useTenantPath';
import { createSurfaceTheme } from '@/utils/color';
import { safeTranslate } from '@/utils/i18n-helpers';

interface HeaderBrandingProps {
  tenantSlug: string | null;
}

export function HeaderBranding({ tenantSlug }: HeaderBrandingProps) {
  const { t } = useTranslation();
  const { branding } = useTenant();
  const tenantPath = useTenantPath();
  
  const headerTheme = useMemo(() => createSurfaceTheme(branding.primaryColor), [branding.primaryColor]);
  const tenantHomePath = tenantSlug ? tenantPath('') : '/';
  const tenantLogoUrl = branding.logoUrl?.trim() ? branding.logoUrl : undefined;
  const hasTenantLogo = Boolean(tenantLogoUrl);
  const brandLabel = safeTranslate(t, 'navigation.brand', { defaultValue: 'Create' });

  const tenantBrandNode = useMemo(() => {
    if (!tenantSlug) {
      return null;
    }

    if (hasTenantLogo && tenantLogoUrl) {
      return (
        <div
          className="flex h-10 w-auto items-center justify-center rounded border border-[color:var(--header-border)] p-2"
          style={{ backgroundColor: branding.primaryColor || headerTheme.background }}
        >
          <img
            src={tenantLogoUrl}
            alt={brandLabel}
            className="h-full w-auto max-h-full max-w-full object-contain"
          />
        </div>
      );
    }

    return (
      <span className="inline-flex items-center rounded-full border border-[color:var(--header-border)] bg-[color:var(--header-subtle)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--header-fg)]">
        {tenantSlug}
      </span>
    );
  }, [brandLabel, hasTenantLogo, tenantLogoUrl, tenantSlug, branding.primaryColor, headerTheme]);

  if (!tenantSlug) {
    return null;
  }

  return (
    <Link to={tenantHomePath} className="flex items-center">
      {tenantBrandNode}
    </Link>
  );
}

