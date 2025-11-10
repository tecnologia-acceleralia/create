import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useLocation } from "react-router";
import { ChevronDown, ChevronUp, Globe, LogOut, Menu, UserRound, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { useSuperAdminSession } from '@/context/SuperAdminContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import { useTenantPath } from '@/hooks/useTenantPath';
import { createSurfaceTheme } from '@/utils/color';

export function SiteHeader() {
  const { t, i18n } = useTranslation();
  const { branding, tenantSlug, phases } = useTenant();
  const { user, logout } = useAuth();
  const {
    user: superAdminUser,
    tokens: superAdminTokens,
    logout: logoutSuperAdmin
  } = useSuperAdminSession();
  const tenantPath = useTenantPath();
  const location = useLocation();

  const headerTheme = useMemo(() => createSurfaceTheme(branding.primaryColor), [branding.primaryColor]);
  const headerStyle = useMemo<CSSProperties>(
    () => ({
      '--header-bg': headerTheme.background,
      '--header-fg': headerTheme.foreground,
      '--header-muted': headerTheme.muted,
      '--header-border': headerTheme.border,
      '--header-subtle': headerTheme.subtle,
      '--header-surface': headerTheme.surface,
      '--header-hover': headerTheme.hover,
      color: headerTheme.foreground,
      backgroundColor: headerTheme.background
    }),
    [headerTheme]
  );

  const isSuperAdminRoute = location.pathname.startsWith('/superadmin');
  const isSuperAdminSession = Boolean(superAdminTokens?.token && isSuperAdminRoute);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  let displayName: string | null = null;
  if (user) {
    const parts = [user.first_name, user.last_name].filter(Boolean);
    displayName = parts.length ? parts.join(' ') : user.email;
  } else if (isSuperAdminSession && superAdminUser) {
    const parts = [superAdminUser.first_name, superAdminUser.last_name].filter(Boolean);
    displayName = parts.length ? parts.join(' ') : superAdminUser.email;
  } else if (isSuperAdminSession) {
    displayName = t('navigation.superadmin');
  }

  const avatarNode = useMemo(() => {
    if (user) {
      return (
        <img
          src={user.avatarUrl}
          alt={displayName ?? user.email}
          className="h-full w-full rounded-full object-cover"
        />
      );
    }
    if (isSuperAdminSession && superAdminUser) {
      return (
        <img
          src={superAdminUser.avatarUrl}
          alt={displayName ?? superAdminUser.email}
          className="h-full w-full rounded-full object-cover"
        />
      );
    }
    if (isSuperAdminSession) {
      return <span className="text-xs font-semibold uppercase">SA</span>;
    }
    return <UserRound className="h-4 w-4" aria-hidden="true" />;
  }, [user, displayName, isSuperAdminSession, superAdminUser]);
  const loginHref = tenantSlug ? tenantPath('login') : '/superadmin';

  const visiblePhases = useMemo(() => phases.filter(phase => phase.isVisibleNow), [phases]);

  const phaseLinks = useMemo(
    () =>
      visiblePhases.map(phase => ({
        id: phase.id,
        label: phase.name,
        to: tenantPath(`dashboard/events/${phase.eventId}?phase=${phase.id}`)
      })),
    [visiblePhases, tenantPath]
  );
  const canViewPhases = (user || isSuperAdminSession) && phaseLinks.length > 0;

  const availableLanguages = ['es', 'ca', 'en'];
  const currentLanguage =
    availableLanguages.find(language => i18n.language?.startsWith(language)) ?? 'es';

  const tenantLogoUrl = branding.logoUrl?.trim() ? branding.logoUrl : undefined;
  const hasTenantLogo = Boolean(tenantLogoUrl);
  const brandLabel = t('navigation.brand', { defaultValue: 'Create' });
  const tenantHomePath = tenantSlug ? tenantPath('') : '/';
  const tenantBrandNode = useMemo(() => {
    if (!tenantSlug) {
      return null;
    }

    if (hasTenantLogo && tenantLogoUrl) {
      return (
        <img
          src={tenantLogoUrl}
          alt={brandLabel}
          className="h-10 w-auto"
        />
      );
    }

    return (
      <span className="inline-flex items-center rounded-full border border-[color:var(--header-border)] bg-[color:var(--header-subtle)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--header-fg)]">
        {tenantSlug}
      </span>
    );
  }, [brandLabel, hasTenantLogo, tenantLogoUrl, tenantSlug, headerTheme]);

  const toggleLanguage = () => {
    const currentIndex = availableLanguages.indexOf(currentLanguage);
    const nextLanguage = availableLanguages[(currentIndex + 1) % availableLanguages.length];
    void i18n.changeLanguage(nextLanguage);
  };

  const handleLogout = () => {
    setProfileOpen(false);
    if (isSuperAdminSession) {
      logoutSuperAdmin();
      return;
    }
    logout();
  };

  const isActivePhase = (target: string) => {
    if (!target) {
      return false;
    }

    try {
      const url = new URL(target, window.location.origin);
      const path = url.pathname;
      const searchParams = url.searchParams;
      const phaseId = searchParams.get('phase');
      const matchesPath = location.pathname === path;
      if (!phaseId) {
        return matchesPath;
      }
      return matchesPath && location.search.includes(`phase=${phaseId}`);
    } catch (error) {
      return false;
    }
  };

  return (
    <header
      className="sticky top-0 z-50 border-b border-[color:var(--header-border)] bg-[color:var(--header-bg)] text-[color:var(--header-fg)] shadow-sm backdrop-blur"
      style={headerStyle}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-xl font-semibold text-[color:var(--header-fg)]">
            {brandLabel}
          </Link>
          {tenantBrandNode ? (
            <Link to={tenantHomePath} className="flex items-center">
              {tenantBrandNode}
            </Link>
          ) : null}
        </div>

        <div className="hidden flex-1 items-center md:flex">
          {canViewPhases ? (
            <nav className="flex items-center gap-2 overflow-x-auto rounded-full border border-[color:var(--header-border)] bg-[color:var(--header-surface)] px-2 py-1">
              {phaseLinks.map(phase => (
                <Link
                  key={phase.id}
                  to={phase.to}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                    isActivePhase(phase.to)
                      ? 'bg-[color:var(--header-hover)] text-[color:var(--header-fg)] shadow-sm'
                      : 'text-[color:var(--header-muted)] hover:bg-[color:var(--header-hover)] hover:text-[color:var(--header-fg)]'
                  )}
                >
                  {phase.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleLanguage}
            className="hidden items-center gap-2 rounded-full border border-[color:var(--header-border)] px-3 py-1 text-xs font-semibold uppercase text-[color:var(--header-muted)] transition-colors hover:border-[color:var(--header-fg)] hover:text-[color:var(--header-fg)] md:inline-flex"
          >
            <Globe className="h-4 w-4" />
            {currentLanguage.toUpperCase()}
          </button>

          <div className="relative hidden md:block">
            <button
              type="button"
              onClick={() => setProfileOpen(prev => !prev)}
              className="flex items-center gap-2 rounded-full border border-[color:var(--header-border)] bg-[color:var(--header-surface)] px-3 py-1.5 text-sm font-medium text-[color:var(--header-fg)] transition-colors hover:border-[color:var(--header-fg)]"
            >
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[color:var(--header-subtle)] text-xs font-semibold uppercase text-[color:var(--header-fg)]">
                {avatarNode}
              </div>
              {displayName ? (
                <span className="max-w-[9rem] truncate text-left text-[color:var(--header-fg)]">
                  {displayName}
                </span>
              ) : null}
              {profileOpen ? (
                <ChevronUp className="h-4 w-4 text-[color:var(--header-muted)]" />
              ) : (
                <ChevronDown className="h-4 w-4 text-[color:var(--header-muted)]" />
              )}
            </button>

            <div
              className={cn(
                'absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-2xl border border-border/70 bg-card p-2 text-foreground shadow-xl backdrop-blur-md transition-all',
                profileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
              )}
            >
              {user ? (
                <div className="flex flex-col gap-2">
                  <Link
                    to={tenantPath('dashboard/profile')}
                    onClick={() => setProfileOpen(false)}
                    className="rounded-xl px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
                  >
                    {t('navigation.profile')}
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="inline-flex items-center justify-start gap-2 rounded-xl bg-destructive/15 text-sm font-medium text-destructive hover:bg-destructive/25"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    {t('navigation.logout')}
                  </Button>
                </div>
              ) : isSuperAdminSession ? (
                <div className="flex flex-col gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="inline-flex items-center justify-start gap-2 rounded-xl bg-destructive/15 text-sm font-medium text-destructive hover:bg-destructive/25"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    {t('navigation.logout')}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    onClick={() => setProfileOpen(false)}
                  >
                    <Link to={loginHref}>{t('navigation.login')}</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[color:var(--header-border)] text-[color:var(--header-muted)] shadow-sm transition-colors hover:border-[color:var(--header-fg)] hover:text-[color:var(--header-fg)] md:hidden"
            onClick={() => setMobileOpen(prev => !prev)}
            aria-label={t('navigation.toggleMenu')}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div
        className={cn(
          'md:hidden bg-[color:var(--header-bg)] text-[color:var(--header-fg)] transition-all duration-300 ease-in-out',
          mobileOpen
            ? 'max-h-[32rem] border-t border-[color:var(--header-border)] pb-6'
            : 'max-h-0 overflow-hidden'
        )}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pt-4 sm:px-6">
          <button
            type="button"
            onClick={() => {
              toggleLanguage();
              setMobileOpen(false);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[color:var(--header-border)] px-3 py-2 text-xs font-semibold uppercase text-[color:var(--header-muted)] transition-colors hover:border-[color:var(--header-fg)] hover:text-[color:var(--header-fg)]"
          >
            <Globe className="h-4 w-4" />
            {currentLanguage.toUpperCase()}
          </button>

          {canViewPhases ? (
            <nav className="grid gap-2">
              {phaseLinks.map(phase => (
                <Link
                  key={phase.id}
                  to={phase.to}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                    isActivePhase(phase.to)
                      ? 'bg-[color:var(--header-hover)] text-[color:var(--header-fg)] shadow-sm'
                      : 'text-[color:var(--header-muted)] hover:bg-[color:var(--header-hover)] hover:text-[color:var(--header-fg)]'
                  )}
                >
                  {phase.label}
                </Link>
              ))}
            </nav>
          ) : null}

          <div className="rounded-2xl border border-border/70 bg-card p-4 text-foreground shadow-sm">
            {user ? (
              <div className="flex flex-col gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start hover:bg-muted/40"
                  asChild
                >
                  <Link to={tenantPath('dashboard/profile')} onClick={() => setMobileOpen(false)}>
                    {t('navigation.profile')}
                  </Link>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="inline-flex items-center justify-center gap-2"
                  onClick={() => {
                    setMobileOpen(false);
                    handleLogout();
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  {t('navigation.logout')}
                </Button>
              </div>
            ) : isSuperAdminSession ? (
              <div className="flex flex-col gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="inline-flex items-center justify-center gap-2"
                  onClick={() => {
                    setMobileOpen(false);
                    handleLogout();
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  {t('navigation.logout')}
                </Button>
              </div>
            ) : (
              <div className="grid gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="hover:bg-muted/40"
                  asChild
                >
                  <Link to={loginHref} onClick={() => setMobileOpen(false)}>
                    {t('navigation.login')}
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
