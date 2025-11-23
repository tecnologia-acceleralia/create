import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, LogOut, UserRound } from "lucide-react";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell } from "lucide-react";
import { cn } from '@/utils/cn';
import { useTenantPath } from '@/hooks/useTenantPath';
import { safeTranslate } from '@/utils/i18n-helpers';

interface HeaderProfileMenuProps {
  user: any;
  superAdminUser: any;
  isSuperAdminSession: boolean;
  tenantSlug: string | null;
  displayName: string | null;
  avatarNode: React.ReactNode;
  loginHref: string;
  unreadCount: number;
  activeEventId: string | null;
  profileOpen: boolean;
  setProfileOpen: (open: boolean) => void;
  handleLogout: () => void;
  variant?: 'desktop' | 'mobile';
  onLinkClick?: () => void;
}

export function HeaderProfileMenu({
  user,
  superAdminUser,
  isSuperAdminSession,
  tenantSlug,
  displayName,
  avatarNode,
  loginHref,
  unreadCount,
  activeEventId,
  profileOpen,
  setProfileOpen,
  handleLogout,
  variant = 'desktop',
  onLinkClick
}: HeaderProfileMenuProps) {
  const { t } = useTranslation();
  const tenantPath = useTenantPath();

  if (variant === 'mobile') {
    return (
      <>
        {user && !isSuperAdminSession ? (
          <Link
            to={activeEventId ? tenantPath(`dashboard/events/${activeEventId}/notifications`) : tenantPath('dashboard/notifications')}
            onClick={onLinkClick}
            className="relative inline-flex items-center justify-center gap-2 rounded-xl border border-[color:var(--header-border)] px-3 py-2 text-sm font-medium text-[color:var(--header-muted)] transition-colors hover:border-[color:var(--header-fg)] hover:text-[color:var(--header-fg)]"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
            <span>{safeTranslate(t, 'notifications.title')}</span>
            {unreadCount > 0 ? (
              <Badge
                variant="destructive"
                className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            ) : null}
          </Link>
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
                <Link to={activeEventId ? `${tenantPath('dashboard/profile')}?eventId=${activeEventId}` : tenantPath('dashboard/profile')} onClick={onLinkClick}>
                  {safeTranslate(t, 'navigation.profile')}
                </Link>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="inline-flex items-center justify-center gap-2"
                onClick={() => {
                  if (onLinkClick) onLinkClick();
                  handleLogout();
                }}
              >
                <LogOut className="h-4 w-4" />
                {safeTranslate(t, 'navigation.logout')}
              </Button>
            </div>
          ) : isSuperAdminSession ? (
            <div className="flex flex-col gap-2">
              <Button
                variant="destructive"
                size="sm"
                className="inline-flex items-center justify-center gap-2"
                onClick={() => {
                  if (onLinkClick) onLinkClick();
                  handleLogout();
                }}
              >
                <LogOut className="h-4 w-4" />
                {safeTranslate(t, 'navigation.logout')}
              </Button>
            </div>
          ) : tenantSlug ? (
            <div className="grid gap-2">
              <Button
                variant="outline"
                size="sm"
                className="hover:bg-muted/40"
                asChild
              >
                <Link to={loginHref} onClick={onLinkClick}>
                  {safeTranslate(t, 'navigation.login')}
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
      </>
    );
  }

  return (
    <>
      {user && !isSuperAdminSession ? (
        <Link
          to={activeEventId ? tenantPath(`dashboard/events/${activeEventId}/notifications`) : tenantPath('dashboard/notifications')}
          className="relative hidden items-center justify-center rounded-full border border-[color:var(--header-border)] p-2 text-[color:var(--header-muted)] transition-colors hover:border-[color:var(--header-fg)] hover:text-[color:var(--header-fg)] md:inline-flex"
          aria-label={safeTranslate(t, 'notifications.title')}
          title={safeTranslate(t, 'notifications.title')}
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unreadCount > 0 ? (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-[10px] font-bold"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          ) : null}
        </Link>
      ) : null}

      <div className="relative hidden md:block">
        <button
          type="button"
          onClick={() => setProfileOpen(prev => !prev)}
          className="flex items-center gap-2 rounded-full border border-[color:var(--header-border)] bg-[color:var(--header-surface)] px-3 py-1.5 text-sm font-medium text-[color:var(--header-fg)] transition-colors hover:border-[color:var(--header-fg)]"
        >
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[color:var(--header-subtle)] text-xs font-semibold uppercase text-[color:var(--header-fg)]">
            {avatarNode || <UserRound className="h-4 w-4" aria-hidden="true" />}
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
            'absolute right-0 z-[110] mt-2 w-60 overflow-hidden rounded-2xl border border-border/70 bg-card p-2 text-foreground shadow-xl backdrop-blur-md transition-all',
            profileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
          )}
        >
          {user ? (
            <div className="flex flex-col gap-2">
              <Link
                to={activeEventId ? `${tenantPath('dashboard/profile')}?eventId=${activeEventId}` : tenantPath('dashboard/profile')}
                onClick={() => setProfileOpen(false)}
                className="rounded-xl px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
              >
                {safeTranslate(t, 'navigation.profile')}
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="inline-flex items-center justify-start gap-2 rounded-xl bg-destructive/15 text-sm font-medium text-destructive hover:bg-destructive/25"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                {safeTranslate(t, 'navigation.logout')}
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
                {safeTranslate(t, 'navigation.logout')}
              </Button>
            </div>
          ) : tenantSlug ? (
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                asChild
                onClick={() => setProfileOpen(false)}
              >
                <Link to={loginHref}>{safeTranslate(t, 'navigation.login')}</Link>
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

