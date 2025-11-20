import { useMemo, useState, useRef, useEffect } from "react";
import type { CSSProperties } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Bell, ChevronDown, ChevronUp, Globe, Home, LogOut, Menu, Settings, UserRound, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { useSuperAdminSession } from '@/context/SuperAdminContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/utils/cn';
import { useTenantPath } from '@/hooks/useTenantPath';
import { createSurfaceTheme, pickContrastColor } from '@/utils/color';
import { getEventTasks, getEventDetail, type Task } from '@/services/events';
import { getMyTeams } from '@/services/teams';
import { getNotifications } from '@/services/notifications';

export function SiteHeader() {
  const { t, i18n } = useTranslation();
  const { branding, tenantSlug, phases } = useTenant();
  const { user, logout, activeMembership, isSuperAdmin } = useAuth();
  const {
    user: superAdminUser,
    tokens: superAdminTokens,
    logout: logoutSuperAdmin
  } = useSuperAdminSession();
  const tenantPath = useTenantPath();
  const location = useLocation();
  const navigate = useNavigate();
  const roleScopes = useMemo(
    () => new Set<string>(activeMembership?.roles?.map(role => role.scope) ?? user?.roleScopes ?? []),
    [activeMembership?.roles, user?.roleScopes]
  );
  const isEventAdmin = isSuperAdmin || roleScopes.has('tenant_admin') || roleScopes.has('organizer');
  const isParticipantOnly = roleScopes.has('participant') && !isEventAdmin && !roleScopes.has('evaluator');
  // Usuarios que no son admin/organizer/evaluator (incluyendo capitanes) deben usar rutas de participante
  const isNonAdminUser = !isEventAdmin && !roleScopes.has('evaluator');

  const { isEventRoute, eventId: activeEventId } = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    const dashboardIndex = segments.indexOf('dashboard');
    if (dashboardIndex === -1) {
      return { isEventRoute: false, eventId: null as string | null };
    }

    const nextSegment = segments[dashboardIndex + 1];
    if (nextSegment !== 'events') {
      return { isEventRoute: false, eventId: null as string | null };
    }

    const eventIdSegment = segments[dashboardIndex + 2] ?? null;
    if (!eventIdSegment) {
      return { isEventRoute: false, eventId: null as string | null };
    }

    return { isEventRoute: true, eventId: eventIdSegment };
  }, [location.pathname]);

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
  const shouldRenderProfileMenu = Boolean(tenantSlug || isSuperAdminSession);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [openPhaseMenu, setOpenPhaseMenu] = useState<number | null>(null);
  const [openHomeMenu, setOpenHomeMenu] = useState(false);
  const [menuPositions, setMenuPositions] = useState<Record<string, { top: number; left: number }>>({});
  
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  
  useEffect(() => {
    const updateMenuPositions = () => {
      const positions: Record<string, { top: number; left: number }> = {};
      Object.entries(menuRefs.current).forEach(([key, element]) => {
        if (element) {
          const rect = element.getBoundingClientRect();
          // Para position: fixed, usamos coordenadas del viewport directamente
          positions[key] = {
            top: rect.bottom,
            left: rect.left
          };
        }
      });
      setMenuPositions(positions);
    };
    
    if (openHomeMenu || openPhaseMenu !== null) {
      updateMenuPositions();
      window.addEventListener('scroll', updateMenuPositions, true);
      window.addEventListener('resize', updateMenuPositions);
      
      return () => {
        window.removeEventListener('scroll', updateMenuPositions, true);
        window.removeEventListener('resize', updateMenuPositions);
      };
    }
  }, [openHomeMenu, openPhaseMenu]);

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

  // Los administradores ven todas las fases, los demás solo las visibles
  const visiblePhases = useMemo(() => {
    if (isEventAdmin) {
      return phases; // Administradores ven todas las fases
    }
    return phases.filter(phase => phase.isVisibleNow);
  }, [phases, isEventAdmin]);
  const eventPhases = useMemo(
    () =>
      activeEventId && isEventRoute
        ? visiblePhases.filter(phase => String(phase.eventId) === activeEventId)
        : [],
    [activeEventId, isEventRoute, visiblePhases]
  );

  // Detectar la Fase 0 para mostrarla como menú separado
  const phaseZero = useMemo(() => {
    if (!activeEventId) {
      return null;
    }
    
    for (const phase of eventPhases) {
      const normalizedName = phase.name?.toLowerCase() ?? '';
      const looksLikePhaseZero =
        phase.orderIndex === 0 ||
        normalizedName.includes('fase 0') ||
        normalizedName.includes('phase 0');
      if (looksLikePhaseZero) {
        // El menú Fase 0 siempre navega a /view?phase=${phase.id}
        const to = tenantPath(`dashboard/events/${activeEventId}/view?phase=${phase.id}`);
        return { 
          to, 
          id: phase.id, 
          label: phase.name,
          description: phase.description,
          orderIndex: phase.orderIndex,
          isPreparationPhase: true 
        };
      }
    }
    return null;
  }, [eventPhases, tenantPath, activeEventId]);

  const phaseLinks = useMemo(() => {
    if (!activeEventId) {
      return [];
    }

    return eventPhases
      .map(phase => {
        const normalizedName = phase.name?.toLowerCase() ?? '';
        const looksLikePhaseZero =
          phase.orderIndex === 0 ||
          normalizedName.includes('fase 0') ||
          normalizedName.includes('phase 0');
        // Para admin/organizer: usar ruta base del evento
        // Para usuarios no admin (incluyendo capitanes): usar /view
        const adminTarget = tenantPath(`dashboard/events/${activeEventId}?phase=${phase.id}`);
        const participantTarget = tenantPath(`dashboard/events/${activeEventId}/view?phase=${phase.id}`);
        const preparationTarget = tenantPath(`dashboard/events/${activeEventId}/team`);
        const to = isNonAdminUser
          ? (isParticipantOnly && looksLikePhaseZero ? preparationTarget : participantTarget)
          : adminTarget;

        return {
          id: phase.id,
          label: phase.name,
          description: phase.description,
          to,
          orderIndex: phase.orderIndex,
          isPreparationPhase: looksLikePhaseZero
        };
      })
      .filter(phase => !phase.isPreparationPhase); // Filtrar Fase 0, se mostrará como menú separado
  }, [eventPhases, tenantPath, activeEventId, isParticipantOnly, isNonAdminUser]);

  // Determinar la ruta principal del evento según el rol del usuario
  // La nueva página de inicio siempre apunta a /home
  const eventHomePath = useMemo(() => {
    if (!isEventRoute || !activeEventId) {
      return null;
    }

    if (!user && !isSuperAdminSession) {
      return null;
    }

    // La nueva página de inicio siempre es /home
    return tenantPath(`dashboard/events/${activeEventId}/home`);
  }, [isEventRoute, activeEventId, user, isSuperAdminSession, tenantPath]);

  const canViewPhases = (user || isSuperAdminSession) && isEventRoute && (eventHomePath !== null || phaseLinks.length > 0 || phaseZero !== null);

  const numericEventId = useMemo(() => {
    if (!activeEventId) {
      return null;
    }
    const parsed = Number(activeEventId);
    return Number.isFinite(parsed) ? parsed : null;
  }, [activeEventId]);

  const canFetchTasks = useMemo(
    () => Boolean((user || isSuperAdminSession) && isEventRoute && numericEventId),
    [user, isSuperAdminSession, isEventRoute, numericEventId]
  );

  const { data: eventTasks } = useQuery({
    queryKey: ['eventTasks', numericEventId],
    queryFn: () => getEventTasks(numericEventId as number),
    enabled: canFetchTasks,
    staleTime: 60_000,
    gcTime: 5 * 60_000
  });

  const { data: eventDetail } = useQuery({
    queryKey: ['events', numericEventId],
    queryFn: () => getEventDetail(numericEventId as number),
    enabled: canFetchTasks,
    staleTime: 60_000,
    gcTime: 5 * 60_000
  });

  const { data: myTeams } = useQuery({
    queryKey: ['my-teams'],
    queryFn: getMyTeams,
    enabled: Boolean(user && !isSuperAdmin && !isSuperAdminSession),
    staleTime: 30_000,
    gcTime: 5 * 60_000
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    enabled: Boolean(user && !isSuperAdminSession),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchInterval: 60_000 // Refrescar cada minuto
  });

  const unreadCount = useMemo(() => {
    if (!notifications || !Array.isArray(notifications)) {
      return 0;
    }
    return notifications.filter(n => !n.is_read).length;
  }, [notifications]);

  const hasTeam = useMemo(() => {
    if (!numericEventId || !myTeams || !Array.isArray(myTeams)) {
      return false;
    }
    return myTeams.some(membership => {
      const teamEventId = membership?.team?.event_id;
      if (!teamEventId) {
        return false;
      }
      // Comparar como números para evitar problemas de tipos
      return Number(teamEventId) === numericEventId;
    });
  }, [myTeams, numericEventId]);

  const tasksByPhase = useMemo(() => {
    const grouped = new Map<number, Task[]>();
    if (!Array.isArray(eventTasks)) {
      return grouped;
    }
    eventTasks.forEach(task => {
      const bucket = grouped.get(task.phase_id) ?? [];
      bucket.push(task);
      grouped.set(task.phase_id, bucket);
    });

    const getOrderValue = (task: Task) =>
      typeof task.order_index === 'number' ? task.order_index : Number.MAX_SAFE_INTEGER;

    const getTimeValue = (value?: string) => {
      if (!value) {
        return Number.MAX_SAFE_INTEGER;
      }
      const timestamp = new Date(value).getTime();
      return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
    };

    grouped.forEach(list => {
      list.sort((a, b) => {
        const orderDiff = getOrderValue(a) - getOrderValue(b);
        if (orderDiff !== 0) {
          return orderDiff;
        }
        const dueDiff = getTimeValue(a.due_date) - getTimeValue(b.due_date);
        if (dueDiff !== 0) {
          return dueDiff;
        }
        const createdDiff = getTimeValue(a.created_at) - getTimeValue(b.created_at);
        if (createdDiff !== 0) {
          return createdDiff;
        }
        return a.title.localeCompare(b.title);
      });
    });

    return grouped;
  }, [eventTasks]);

  const isEventHomeActive = useMemo(() => {
    if (!eventHomePath) {
      return false;
    }
    // Comparar solo el pathname sin parámetros de query
    const currentPath = location.pathname;
    
    // La página de inicio está activa si estamos en /home o en sus subrutas (descripción, cronograma)
    return currentPath === eventHomePath || currentPath.startsWith(eventHomePath + '?');
  }, [eventHomePath, location.pathname]);

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
    // Navegar a la home del tenant antes de cerrar sesión
    const homePath = tenantSlug ? `/${tenantSlug}` : '/';
    navigate(homePath, { replace: true });
    // Llamar a logout sin navegación automática (ya navegamos arriba)
    logout(false);
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
      
      // Si hay un phaseId, comparar por fase
      // Las rutas /dashboard/events/:eventId y /dashboard/events/:eventId/view son equivalentes
      if (phaseId) {
        const currentPhaseId = new URLSearchParams(location.search).get('phase');
        if (currentPhaseId !== phaseId) {
          return false;
        }
        
        // Verificar que estamos en una ruta válida del evento
        const currentPath = location.pathname;
        const isTargetAdminPath = path.includes(`/events/`) && !path.includes('/view') && !path.includes('/home') && !path.includes('/team') && !path.includes('/tasks/');
        const isTargetParticipantPath = path.includes(`/events/`) && path.includes('/view');
        const isCurrentAdminPath = currentPath.includes(`/events/`) && !currentPath.includes('/view') && !currentPath.includes('/home') && !currentPath.includes('/team') && !currentPath.includes('/tasks/');
        const isCurrentParticipantPath = currentPath.includes(`/events/`) && currentPath.includes('/view');
        
        // Si el target es ruta admin, aceptar si estamos en ruta admin
        if (isTargetAdminPath && isCurrentAdminPath) return true;
        // Si el target es ruta participante, aceptar si estamos en ruta participante
        if (isTargetParticipantPath && isCurrentParticipantPath) return true;
        
        return false;
      }
      
      // Si no hay phaseId, comparar path exacto
      return location.pathname === path;
    } catch (error) {
      return false;
    }
  };

  return (
    <header
      className="sticky top-0 z-[100] border-b border-[color:var(--header-border)] bg-[color:var(--header-bg)] text-[color:var(--header-fg)] shadow-sm backdrop-blur overflow-visible"
      style={headerStyle}
    >
      <div className="mx-auto grid h-16 w-full max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4 sm:px-6 lg:px-8 overflow-visible">
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link to="/" className="text-xl font-semibold text-[color:var(--header-fg)]">
            {brandLabel}
          </Link>
          {tenantBrandNode ? (
            <Link to={tenantHomePath} className="flex items-center">
              {tenantBrandNode}
            </Link>
          ) : null}
        </div>

        <div className="hidden items-center justify-center min-w-0 md:flex relative overflow-visible">
          {canViewPhases ? (
            <nav className="flex flex-nowrap items-center gap-2 rounded-full border border-[color:var(--header-border)] bg-[color:var(--header-surface)] px-2 py-1 w-full max-w-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] [contain:none]">
              <div className="flex flex-nowrap items-center gap-2 overflow-x-auto overflow-y-visible w-full [contain:none]">
              {isEventAdmin && activeEventId ? (
                <Link
                  to={tenantPath(`dashboard/events/${activeEventId}`)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors flex-shrink-0',
                    location.pathname.includes(`/events/${activeEventId}`) && !location.pathname.includes('/team') && !location.pathname.includes('/tasks/')
                      ? 'bg-[color:var(--header-hover)] text-[color:var(--header-fg)] shadow-sm'
                      : 'text-[color:var(--header-muted)] hover:bg-[color:var(--header-hover)] hover:text-[color:var(--header-fg)]'
                  )}
                  aria-label={t('navigation.config')}
                  title={t('navigation.config')}
                >
                  <Settings className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{t('navigation.config')}</span>
                </Link>
              ) : null}
              {eventHomePath ? (() => {
                // Submenús para la página de inicio: Descripción y Cronograma
                const homeMenuItems = activeEventId
                  ? [
                      {
                        key: 'description',
                        label: t('events.description'),
                        href: tenantPath(`dashboard/events/${activeEventId}/home?tab=description`)
                      },
                      {
                        key: 'timeline',
                        label: t('events.timeline'),
                        href: tenantPath(`dashboard/events/${activeEventId}/home?tab=timeline`)
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
                      aria-label={t('navigation.home')}
                      title={t('navigation.home')}
                      aria-haspopup={hasMenu ? 'menu' : undefined}
                    >
                      <Home className="h-4 w-4" aria-hidden="true" />
                      <span>{t('navigation.home')}</span>
                    </Link>
                    {hasMenu && openHomeMenu ? (
                      <div
                        className={cn(
                          'fixed z-[110] w-72 rounded-xl border border-border/70 bg-card/95 p-3 text-foreground shadow-xl backdrop-blur transition-opacity duration-150',
                          'pointer-events-auto opacity-100'
                        )}
                        role="menu"
                        aria-label={t('events.homeNavigation')}
                        onMouseEnter={() => setOpenHomeMenu(true)}
                        onMouseLeave={() => setOpenHomeMenu(false)}
                        style={{ 
                          top: menuPositions['home']?.top ?? 64,
                          left: menuPositions['home']?.left ?? '50%',
                          marginTop: 4,
                          paddingTop: 14
                        }}
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {t('events.homeNavigation')}
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
                        label: t('projects.title'),
                        href: tenantPath(`dashboard/events/${activeEventId}/projects`),
                        order_index: 200
                      }
                    ]
                  : [];
                const myTeamItem = activeEventId && hasTeam
                  ? [
                      {
                        key: 'my-team',
                        label: t('teams.title'),
                        href: tenantPath(`dashboard/events/${activeEventId}/team`),
                        order_index: 300
                      }
                    ]
                  : [];
                const phaseZeroMenuItems = [...viewProjectsItem, ...myTeamItem];
                const taskMenuItems = baseTasks.map(task => ({
                  key: `task-${task.id}`,
                  label: task.title,
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
                        isActivePhase(phaseZero.to)
                          ? 'shadow-sm'
                          : 'text-[color:var(--header-muted)] hover:bg-[color:var(--header-hover)] hover:text-[color:var(--header-fg)]'
                      )}
                      style={isActivePhase(phaseZero.to) ? {
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
                            {phaseZero.description}
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
                const taskMenuItems = baseTasks.map(task => ({
                  key: `task-${task.id}`,
                  label: task.title,
                  href: tenantPath(`dashboard/events/${activeEventId}/tasks/${task.id}`),
                  order_index: typeof task.order_index === 'number' ? task.order_index : Number.MAX_SAFE_INTEGER
                }));
                const menuItems = [...taskMenuItems].sort((a, b) => {
                  const orderA = a.order_index ?? Number.MAX_SAFE_INTEGER;
                  const orderB = b.order_index ?? Number.MAX_SAFE_INTEGER;
                  if (orderA !== orderB) {
                    return orderA - orderB;
                  }
                  return a.label.localeCompare(b.label);
                });
                const hasMenu = menuItems.length > 0;
                return (
                  <div 
                    key={phase.id}
                    ref={(el) => { if (hasMenu) menuRefs.current[`phase-${phase.id}`] = el; }}
                    className="relative flex-shrink-0 overflow-visible"
                    onMouseEnter={() => hasMenu && setOpenPhaseMenu(phase.id)}
                    onMouseLeave={() => hasMenu && setOpenPhaseMenu(null)}
                  >
                    <Link
                      to={phase.to}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                        isActivePhase(phase.to)
                          ? 'shadow-sm'
                          : 'text-[color:var(--header-muted)] hover:bg-[color:var(--header-hover)] hover:text-[color:var(--header-fg)]'
                      )}
                      style={isActivePhase(phase.to) ? {
                        backgroundColor: branding.primaryColor,
                        color: pickContrastColor(branding.primaryColor || '#0ea5e9')
                      } : undefined}
                      aria-haspopup={hasMenu ? 'menu' : undefined}
                    >
                      {phase.label}
                    </Link>
                    {hasMenu && openPhaseMenu === phase.id ? (
                      <div
                        className={cn(
                          'fixed z-[110] w-72 rounded-xl border border-border/70 bg-card/95 p-3 text-foreground shadow-xl backdrop-blur transition-opacity duration-150',
                          'pointer-events-auto opacity-100'
                        )}
                        role="menu"
                        aria-label={phase.label}
                        onMouseEnter={() => setOpenPhaseMenu(phase.id)}
                        onMouseLeave={() => setOpenPhaseMenu(null)}
                        style={{
                          top: menuPositions[`phase-${phase.id}`]?.top ?? 64,
                          left: menuPositions[`phase-${phase.id}`]?.left ?? '50%',
                          marginTop: 4
                        }}
                      >
                        {phase.description && phase.description.trim() ? (
                          <p className="text-sm font-medium text-foreground line-clamp-3">
                            {phase.description}
                          </p>
                        ) : (
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {phase.label}
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
              })}
              </div>
            </nav>
          ) : null}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 justify-end">
          {user && !isSuperAdminSession ? (
            <Link
              to={tenantPath('dashboard/notifications')}
              className="relative hidden items-center justify-center rounded-full border border-[color:var(--header-border)] p-2 text-[color:var(--header-muted)] transition-colors hover:border-[color:var(--header-fg)] hover:text-[color:var(--header-fg)] md:inline-flex"
              aria-label={t('notifications.title')}
              title={t('notifications.title')}
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

          <button
            type="button"
            onClick={toggleLanguage}
            className="hidden items-center gap-2 rounded-full border border-[color:var(--header-border)] px-3 py-1 text-xs font-semibold uppercase text-[color:var(--header-muted)] transition-colors hover:border-[color:var(--header-fg)] hover:text-[color:var(--header-fg)] md:inline-flex"
          >
            <Globe className="h-4 w-4" />
            {currentLanguage.toUpperCase()}
          </button>

          {shouldRenderProfileMenu ? (
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
                  'absolute right-0 z-[110] mt-2 w-60 overflow-hidden rounded-2xl border border-border/70 bg-card p-2 text-foreground shadow-xl backdrop-blur-md transition-all',
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
                ) : tenantSlug ? (
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
                ) : null}
              </div>
            </div>
          ) : null}

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
          {user && !isSuperAdminSession ? (
            <Link
              to={tenantPath('dashboard/notifications')}
              onClick={() => setMobileOpen(false)}
              className="relative inline-flex items-center justify-center gap-2 rounded-xl border border-[color:var(--header-border)] px-3 py-2 text-sm font-medium text-[color:var(--header-muted)] transition-colors hover:border-[color:var(--header-fg)] hover:text-[color:var(--header-fg)]"
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
              <span>{t('notifications.title')}</span>
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
                // Submenús para la página de inicio: Descripción y Cronograma
                const homeMenuItems = activeEventId
                  ? [
                      {
                        key: 'description',
                        label: t('events.description'),
                        href: tenantPath(`dashboard/events/${activeEventId}/home?tab=description`)
                      },
                      {
                        key: 'timeline',
                        label: t('events.timeline'),
                        href: tenantPath(`dashboard/events/${activeEventId}/home?tab=timeline`)
                      }
                    ]
                  : [];
                const hasMenu = homeMenuItems.length > 0;
                return (
                  <div className="flex flex-col gap-1">
                    <Link
                      to={eventHomePath}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                        isEventHomeActive
                          ? 'bg-[color:var(--header-hover)] text-[color:var(--header-fg)] shadow-sm'
                          : 'text-[color:var(--header-muted)] hover:bg-[color:var(--header-hover)] hover:text-[color:var(--header-fg)]'
                      )}
                    >
                      <Home className="h-4 w-4" aria-hidden="true" />
                      {t('navigation.home')}
                    </Link>
                    {hasMenu ? (
                      <div className="ml-3 grid gap-1 rounded-lg border border-border/60 bg-card/80 p-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {t('events.homeNavigation')}
                        </p>
                        {homeMenuItems.map(item => (
                          <Link
                            key={item.key}
                            to={item.href}
                            onClick={() => setMobileOpen(false)}
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
                        label: t('projects.title'),
                        href: tenantPath(`dashboard/events/${activeEventId}/projects`),
                        order_index: 200
                      }
                    ]
                  : [];
                const myTeamItem = activeEventId && hasTeam
                  ? [
                      {
                        key: 'my-team',
                        label: t('teams.title'),
                        href: tenantPath(`dashboard/events/${activeEventId}/team`),
                        order_index: 300
                      }
                    ]
                  : [];
                const phaseZeroMenuItems = [...viewProjectsItem, ...myTeamItem];
                const taskMenuItems = baseTasks.map(task => ({
                  key: `task-${task.id}`,
                  label: task.title,
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
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                        isActivePhase(phaseZero.to)
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
                            onClick={() => setMobileOpen(false)}
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
                const taskMenuItems = baseTasks.map(task => ({
                  key: `task-${task.id}`,
                  label: task.title,
                  href: tenantPath(`dashboard/events/${activeEventId}/tasks/${task.id}`),
                  order_index: typeof task.order_index === 'number' ? task.order_index : Number.MAX_SAFE_INTEGER
                }));
                const menuItems = [...taskMenuItems].sort((a, b) => {
                  const orderA = a.order_index ?? Number.MAX_SAFE_INTEGER;
                  const orderB = b.order_index ?? Number.MAX_SAFE_INTEGER;
                  if (orderA !== orderB) {
                    return orderA - orderB;
                  }
                  return a.label.localeCompare(b.label);
                });
                const hasMenu = menuItems.length > 0;
                return (
                  <div key={phase.id} className="flex flex-col gap-1">
                    <Link
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
                    {hasMenu ? (
                      <div className="ml-3 grid gap-1 rounded-lg border border-border/60 bg-card/80 p-2">
                        {phase.description && phase.description.trim() ? (
                          <p className="text-sm font-medium text-foreground line-clamp-3">
                            {phase.description}
                          </p>
                        ) : (
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {phase.label}
                          </p>
                        )}
                        {menuItems.map(item => (
                          <Link
                            key={item.key}
                            to={item.href}
                            onClick={() => setMobileOpen(false)}
                            className="rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </nav>
          ) : null}

          {shouldRenderProfileMenu ? (
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
              ) : tenantSlug ? (
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
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
