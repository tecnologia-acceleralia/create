import { Link } from "react-router";
import { Home, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from '@/utils/cn';
import { useTenantPath } from '@/hooks/useTenantPath';
import { safeTranslate } from '@/utils/i18n-helpers';
import { getMultilingualText } from '@/utils/multilingual';
import { TrackingMenu } from './TrackingMenu';
import { PhaseMenu } from './PhaseMenu';
import { useTenant } from '@/context/TenantContext';
import { pickContrastColor } from '@/utils/color';
import { isActivePhase } from '../utils/headerHelpers';
import type { Task } from '@/services/events';
import type { Location } from "react-router";

interface HeaderNavigationProps {
  canViewPhases: boolean;
  isEventAdmin: boolean;
  activeEventId: string | null;
  user: any;
  isSuperAdminSession: boolean;
  canAccessTracking: boolean;
  eventHomePath: string | null;
  isEventHomeActive: boolean;
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
  openPhaseMenu: number | null;
  setOpenPhaseMenu: (id: number | null) => void;
  openHomeMenu: boolean;
  setOpenHomeMenu: (open: boolean) => void;
  openTrackingMenu: boolean;
  setOpenTrackingMenu: (open: boolean) => void;
  menuPositions: Record<string, { top: number; left: number }>;
  menuRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
}

export function HeaderNavigation({
  canViewPhases,
  isEventAdmin,
  activeEventId,
  user,
  isSuperAdminSession,
  canAccessTracking,
  eventHomePath,
  isEventHomeActive,
  phaseZero,
  phaseLinks,
  tasksByPhase,
  hasTeam,
  location,
  openPhaseMenu,
  setOpenPhaseMenu,
  openHomeMenu,
  setOpenHomeMenu,
  openTrackingMenu,
  setOpenTrackingMenu,
  menuPositions,
  menuRefs
}: HeaderNavigationProps) {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language?.split('-')[0] || 'es') as 'es' | 'ca' | 'en';
  const { branding } = useTenant();
  const tenantPath = useTenantPath();

  // Detectar si estamos en una ruta de tracking sin evento activo
  const isTrackingRouteWithoutEvent = !activeEventId && location.pathname.includes('/tracking/');

  if (!canViewPhases) {
    return null;
  }

  return (
    <nav className="flex flex-nowrap items-center gap-2 rounded-full border border-[color:var(--header-border)] bg-[color:var(--header-surface)] px-2 py-1 w-auto min-w-fit max-w-none [contain:none]">
      <div className="flex flex-nowrap items-center gap-2 w-auto [contain:none]">
        {isEventAdmin && activeEventId ? (
          <Link
            to={tenantPath(`dashboard/events/${activeEventId}`)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors flex-shrink-0',
              location.pathname.includes(`/events/${activeEventId}`) && !location.pathname.includes('/team') && !location.pathname.includes('/tasks/')
                ? 'bg-[color:var(--header-hover)] text-[color:var(--header-fg)] shadow-sm'
                : 'text-[color:var(--header-muted)] hover:bg-[color:var(--header-hover)] hover:text-[color:var(--header-fg)]'
            )}
            aria-label={safeTranslate(t, 'navigation.config')}
            title={safeTranslate(t, 'navigation.config')}
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{safeTranslate(t, 'navigation.config')}</span>
          </Link>
        ) : null}

        {canAccessTracking && (user || isSuperAdminSession) ? (
          <TrackingMenu
            location={location}
            isOpen={openTrackingMenu}
            onMouseEnter={() => setOpenTrackingMenu(true)}
            onMouseLeave={() => setOpenTrackingMenu(false)}
            menuRef={(el) => { menuRefs.current['tracking'] = el; }}
            menuPosition={menuPositions['tracking']}
          />
        ) : null}

        {/* Mostrar enlace al dashboard cuando estamos en tracking sin evento activo */}
        {isTrackingRouteWithoutEvent && (user || isSuperAdminSession) ? (
          <Link
            to={tenantPath('dashboard')}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              location.pathname === tenantPath('dashboard') || location.pathname === `${tenantPath('dashboard')}/`
                ? 'bg-[color:var(--header-hover)] text-[color:var(--header-fg)] shadow-sm'
                : 'text-[color:var(--header-muted)] hover:bg-[color:var(--header-hover)] hover:text-[color:var(--header-fg)]'
            )}
            aria-label={safeTranslate(t, 'navigation.dashboard')}
            title={safeTranslate(t, 'navigation.dashboard')}
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{safeTranslate(t, 'navigation.dashboard')}</span>
          </Link>
        ) : null}

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
            <div 
              ref={(el) => { if (hasMenu) menuRefs.current['home'] = el; }}
              className="relative flex-shrink-0 overflow-visible"
              onMouseEnter={() => hasMenu && setOpenHomeMenu(true)}
              onMouseLeave={() => hasMenu && setOpenHomeMenu(false)}
            >
              <Link
                to={eventHomePath}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                  isEventHomeActive
                    ? 'bg-[color:var(--header-hover)] text-[color:var(--header-fg)] shadow-sm'
                    : 'text-[color:var(--header-muted)] hover:bg-[color:var(--header-hover)] hover:text-[color:var(--header-fg)]'
                )}
                aria-label={safeTranslate(t, 'navigation.home')}
                title={safeTranslate(t, 'navigation.home')}
                aria-haspopup={hasMenu ? 'menu' : undefined}
              >
                <Home className="h-4 w-4" aria-hidden="true" />
                <span>{safeTranslate(t, 'navigation.home')}</span>
              </Link>
              {hasMenu && openHomeMenu ? (
                <div
                  className={cn(
                    'fixed z-[110] w-72 rounded-xl border border-border/70 bg-card/95 p-3 text-foreground shadow-xl backdrop-blur transition-opacity duration-150',
                    'pointer-events-auto opacity-100'
                  )}
                  role="menu"
                  aria-label={safeTranslate(t, 'events.homeNavigation')}
                  onMouseEnter={() => setOpenHomeMenu(true)}
                  onMouseLeave={() => setOpenHomeMenu(false)}
                  style={{ 
                    top: menuPositions['home']?.top ?? 64,
                    left: menuPositions['home']?.left ?? '50%',
                    marginTop: 4
                  }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {safeTranslate(t, 'events.homeNavigation')}
                  </p>
                  <div className="mt-2 space-y-1">
                    {homeMenuItems.map(item => (
                      <Link
                        key={item.key}
                        to={item.href}
                        className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
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
          const isActive = isActivePhase(phaseZero.to, location);
          return (
            <div 
              key={phaseZero.id}
              ref={(el) => { if (hasMenu) menuRefs.current[`phase-${phaseZero.id}`] = el; }}
              className="relative flex-shrink-0 overflow-visible"
              onMouseEnter={() => hasMenu && setOpenPhaseMenu(phaseZero.id)}
              onMouseLeave={() => hasMenu && setOpenPhaseMenu(null)}
            >
              <Link
                to={phaseZero.to}
                className={cn(
                  'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'shadow-sm'
                    : 'text-[color:var(--header-muted)] hover:bg-[color:var(--header-hover)] hover:text-[color:var(--header-fg)]'
                )}
                style={isActive ? {
                  backgroundColor: branding.primaryColor,
                  color: pickContrastColor(branding.primaryColor || '#0ea5e9')
                } : undefined}
                aria-haspopup={hasMenu ? 'menu' : undefined}
              >
                {phaseZero.label}
              </Link>
              {hasMenu && openPhaseMenu === phaseZero.id ? (
                <div
                  className={cn(
                    'fixed z-[110] w-72 rounded-xl border border-border/70 bg-card/95 p-3 text-foreground shadow-xl backdrop-blur transition-opacity duration-150',
                    'pointer-events-auto opacity-100'
                  )}
                  role="menu"
                  aria-label={phaseZero.label}
                  onMouseEnter={() => setOpenPhaseMenu(phaseZero.id)}
                  onMouseLeave={() => setOpenPhaseMenu(null)}
                  style={{
                    top: menuPositions[`phase-${phaseZero.id}`]?.top ?? 64,
                    left: menuPositions[`phase-${phaseZero.id}`]?.left ?? '50%',
                    marginTop: 4
                  }}
                >
                  {phaseZero.description && phaseZero.description.trim() ? (
                    <p className="text-sm font-medium text-foreground line-clamp-3">
                      {getMultilingualText(phaseZero.description, currentLang)}
                    </p>
                  ) : (
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {phaseZero.label}
                    </p>
                  )}
                  <div className="mt-2 space-y-1">
                    {menuItems.map(item => (
                      <Link
                        key={item.key}
                        to={item.href}
                        className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
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
              isOpen={openPhaseMenu === phase.id}
              onMouseEnter={() => setOpenPhaseMenu(phase.id)}
              onMouseLeave={() => setOpenPhaseMenu(null)}
              menuRef={(el) => { menuRefs.current[`phase-${phase.id}`] = el; }}
              menuPosition={menuPositions[`phase-${phase.id}`]}
            />
          );
        })}
      </div>
    </nav>
  );
}

