import { useEffect, useMemo, type ReactNode } from "react";
import { useTenant } from '@/context/TenantContext';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';

type Props = {
  children: ReactNode;
};

function normalizeTenantCss(rawCss: string | null) {
  if (!rawCss) {
    return null;
  }

  const trimmed = rawCss.trim();
  if (!trimmed) {
    return null;
  }

  const themeMatch = trimmed.match(/@theme\s+inline\s*\{([\s\S]+)\}$/i);
  if (!themeMatch) {
    return trimmed;
  }

  const declarations = themeMatch[1]
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const ensured = line.endsWith(';') ? line : `${line};`;
      return ensured;
    });

  if (declarations.length === 0) {
    return null;
  }

  return [
    ':root {',
    ...declarations.map(declaration => `  ${declaration}`),
    '}'
  ].join('\n');
}

function applyBrandingVariables(primary: string, secondary: string, accent: string) {
  const root = document.documentElement;
  root.style.setProperty('--tenant-primary', primary);
  root.style.setProperty('--tenant-secondary', secondary);
  root.style.setProperty('--tenant-accent', accent);
}

export function SiteLayout({ children }: Props) {
  const { branding, tenantCss } = useTenant();
  const normalizedTenantCss = useMemo(() => normalizeTenantCss(tenantCss), [tenantCss]);

  useEffect(() => {
    applyBrandingVariables(branding.primaryColor, branding.secondaryColor, branding.accentColor);
  }, [branding.primaryColor, branding.secondaryColor, branding.accentColor]);

  useEffect(() => {
    const styleElementId = 'tenant-theme-styles';
    let styleElement = document.getElementById(styleElementId) as HTMLStyleElement | null;

    if (normalizedTenantCss) {
      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleElementId;
        document.head.appendChild(styleElement);
      }
      styleElement.textContent = normalizedTenantCss;
    } else if (styleElement) {
      styleElement.remove();
      styleElement = null;
    }

    return () => {
      const existing = document.getElementById(styleElementId);
      if (existing) {
        existing.remove();
      }
    };
  }, [normalizedTenantCss]);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-background via-muted/60 to-background text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-16 h-72 w-72 rounded-full bg-[color:var(--tenant-primary)]/10 blur-3xl" />
        <div className="absolute -bottom-32 left-8 h-80 w-80 rounded-full bg-[color:var(--tenant-accent)]/10 blur-3xl" />
      </div>
      <div className="relative z-10 flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1">
          <div className="pb-16 pt-6 sm:pt-10">
            {children}
          </div>
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
