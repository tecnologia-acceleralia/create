import { Link } from "react-router";
import { Home, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from '@/utils/cn';
import { useTenantPath } from '@/hooks/useTenantPath';
import { safeTranslate } from '@/utils/i18n-helpers';
import { getMultilingualText } from '@/utils/multilingual';
import { TrackingMenu } from './TrackingMenu';
import { PhaseMenu } from './PhaseMenu';
import { HeaderProfileMenu } from './HeaderProfileMenu';
import { isActivePhase } from '../utils/headerHelpers';
import type { Task } from '@/services/events';
import type { Location } from "react-router";

interface HeaderMobileMenuProps {
  mobileOpen: boolean;
  user: any;
  isSuperAdminSession: boolean;
  canAccessTracking: boolean;
  canViewPhases: boolean;
  eventHomePath: string | null;
  isEventHomeActive: boolean;
  activeEventId: string | null;
  phaseZero: {
    to: string;
    id: number;
    label: string;
    description?: string | null;
    orderIndex: number;
  } | null;
  phaseLinks: Array<{
    id: number;
    label: string;
    description?: string | null;
    to: string;
    orderIndex: number;
  }>;
  tasksByPhase: Map<number, Task[]>;
  hasTeam: boolean;
  location: Location;
  currentLanguage: string;
  toggleLanguage: () => void;
  setMobileOpen: (open: boolean) => void;
  // Profile menu props
  superAdminUser: any;
  tenantSlug: string | null;
  displayName: string | null;
  avatarNode: React.ReactNode;
  loginHref: string;
  unreadCount: number;
  shouldRenderProfileMenu: boolean;
  profileOpen: boolean;
  setProfileOpen: (open: boolean) => void;
  handleLogout: () => void;
}

export function HeaderMobileMenu({
  mobileOpen,
  user,
  isSuperAdminSession,
  canAccessTracking,
  canViewPhases,
  eventHomePath,
  isEventHomeActive,
  activeEventId,
  phaseZero,
  phaseLinks,
  tasksByPhase,
  hasTeam,
  location,
  currentLanguage,
  toggleLanguage,
  setMobileOpen,
  superAdminUser,
  tenantSlug,
  displayName,
  avatarNode,
  loginHref,
  unreadCount,
  shouldRenderProfileMenu,
  profileOpen,
  setProfileOpen,
  handleLogout
}: HeaderMobileMenuProps) {
  const { t, i18n } = useTranslation();
  const tenantPath = useTenantPath();
  const currentLang = (i18n.language?.split('-')[0] || 'es') as 'es' | 'ca' | 'en';

  const handleLinkClick = () => {
    setMobileOpen(false);
  };

  return (
    <div
      className={cn(
        'md:hidden bg-[color:var(--header-bg)] text-[color:var(--header-fg)] transition-all duration-300 ease-in-out',
        mobileOpen
          ? 'max-h-[32rem] border-t border-[color:var(--header-border)] pb-6 overflow-y-auto'
          : 'max-h-0 overflow-hidden'
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pt-4 sm:px-6">
        {canAccessTracking && (user || isSuperAdminSession) ? (
          <TrackingMenu
            location={location}
            isOpen={false}
            onMouseEnter={() => {}}
            onMouseLeave={() => {}}
            menuRef={() => {}}
            variant="mobile"
            onLinkClick={handleLinkClick}
          />
        ) : null}

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
            {eventHomePath ? (() => {
              const homeMenuItems = activeEventId
                ? [
                    {
                      key: 'description',
                      label: safeTranslate(t, 'events.description'),
                      href: tenantPath(`dashboard/events/${activeEventId}/home?tab=description`)
                    },
                    {
                      key: 'timeline',
                      label: safeTranslate(t, 'events.timeline'),
                      href: tenantPath(`dashboard/events/${activeEventId}/home?tab=timeline`)
                    },
                    {
                      key: 'dashboard',
                      label: safeTranslate(t, 'navigation.dashboard'),
                      href: tenantPath('dashboard')
                    }
                  ]
                : [];
              const hasMenu = homeMenuItems.length > 0;
              return (
                <div className="flex flex-col gap-1">
                  <Link
                    to={eventHomePath}
                    onClick={handleLinkClick}
                    className={cn(
                      'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                      isEventHomeActive
                        ? 'bg-[color:var(--header-hover)] text-[color:var(--header-fg)] shadow-sm'
                        : 'text-[color:var(--header-muted)] hover:bg-[color:var(--header-hover)] hover:text-[color:var(--header-fg)]'
                    )}
                  >
                    <Home className="h-4 w-4" aria-hidden="true" />
                    {safeTranslate(t, 'navigation.home')}
                  </Link>
                  {hasMenu ? (
                    <div className="ml-3 grid gap-1 rounded-lg border border-border/60 bg-card/80 p-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {safeTranslate(t, 'events.homeNavigation')}
                      </p>
                      {homeMenuItems.map(item => (
                        <Link
                          key={item.key}
                          to={item.href}
                          onClick={handleLinkClick}
                          className="rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })() : null}

            {phaseZero ? (() => {
              const baseTasks = tasksByPhase.get(phaseZero.id) ?? [];
              const viewProjectsItem = activeEventId
                ? [
                    {
                      key: 'view-projects',
                      label: safeTranslate(t, 'projects.title'),
                      href: tenantPath(`dashboard/events/${activeEventId}/projects`),
                      order_index: 200
                    }
                  ]
                : [];
              const myTeamItem = activeEventId && hasTeam
                ? [
                    {
                      key: 'my-team',
                      label: safeTranslate(t, 'teams.title'),
                      href: tenantPath(`dashboard/events/${activeEventId}/team`),
                      order_index: 300
                    }
                  ]
                : [];
              const phaseZeroMenuItems = [...viewProjectsItem, ...myTeamItem];
              const taskMenuItems = baseTasks.map(task => ({
                key: `task-${task.id}`,
                label: getMultilingualText(task.title, currentLang),
                href: tenantPath(`dashboard/events/${activeEventId}/tasks/${task.id}`),
                order_index: typeof task.order_index === 'number' ? task.order_index + 100 : Number.MAX_SAFE_INTEGER
              }));
              const menuItems = [...phaseZeroMenuItems, ...taskMenuItems].sort((a, b) => {
                const orderA = a.order_index ?? Number.MAX_SAFE_INTEGER;
                const orderB = b.order_index ?? Number.MAX_SAFE_INTEGER;
                if (orderA !== orderB) {
                  return orderA - orderB;
                }
                return a.label.localeCompare(b.label);
              });
              const hasMenu = menuItems.length > 0;
              return (
                <div key={phaseZero.id} className="flex flex-col gap-1">
                  <Link
                    to={phaseZero.to}
                    onClick={handleLinkClick}
                    className={cn(
                      'rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                      isActivePhase(phaseZero.to, location)
                        ? 'bg-[color:var(--header-hover)] text-[color:var(--header-fg)] shadow-sm'
                        : 'text-[color:var(--header-muted)] hover:bg-[color:var(--header-hover)] hover:text-[color:var(--header-fg)]'
                    )}
                  >
                    {phaseZero.label}
                  </Link>
                  {hasMenu ? (
                    <div className="ml-3 grid gap-1 rounded-lg border border-border/60 bg-card/80 p-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {phaseZero.label}
                      </p>
                      {menuItems.map(item => (
                        <Link
                          key={item.key}
                          to={item.href}
                          onClick={handleLinkClick}
                          className="rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })() : null}

            {phaseLinks.map(phase => {
              const baseTasks = tasksByPhase.get(phase.id) ?? [];
              return (
                <PhaseMenu
                  key={phase.id}
                  phase={phase}
                  tasks={baseTasks}
                  activeEventId={activeEventId}
                  location={location}
                  isOpen={false}
                  onMouseEnter={() => {}}
                  onMouseLeave={() => {}}
                  menuRef={() => {}}
                  variant="mobile"
                  onLinkClick={handleLinkClick}
                />
              );
            })}
          </nav>
        ) : null}
      </div>
    </div>
  );
}

