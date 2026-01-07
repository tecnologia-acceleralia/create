import { useMemo, useState, useRef, useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { useSuperAdminSession } from '@/context/SuperAdminContext';
import { useTenantPath } from '@/hooks/useTenantPath';
import { createSurfaceTheme } from '@/utils/color';
import { safeTranslate } from '@/utils/i18n-helpers';
import { getMultilingualText } from '@/utils/multilingual';
import { getEventTasks, getEventDetail, type Task } from '@/services/events';
import { getMyTeams } from '@/services/teams';
import { getNotifications } from '@/services/notifications';

export function useSiteHeader() {
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
  const isNonAdminUser = !isEventAdmin && !roleScopes.has('evaluator');
  const canAccessTracking = isSuperAdmin || isEventAdmin || roleScopes.has('evaluator');

  // Clave para almacenar el evento activo en sessionStorage
  const ACTIVE_EVENT_STORAGE_KEY = `activeEventId_${tenantSlug ?? 'default'}`;

  // Detectar evento desde la URL
  const { isEventRoute, eventId: eventIdFromUrl } = useMemo(() => {
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

  // Detectar evento desde query params (fallback)
  const eventIdFromQuery = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get('eventId');
  }, [location.search]);

  // Obtener evento desde sessionStorage
  const eventIdFromStorage = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      return sessionStorage.getItem(ACTIVE_EVENT_STORAGE_KEY);
    } catch {
      return null;
    }
  }, [ACTIVE_EVENT_STORAGE_KEY]);

  // Determinar el evento activo: prioridad URL > query params > sessionStorage
  const activeEventId = useMemo(() => {
    return eventIdFromUrl || eventIdFromQuery || eventIdFromStorage;
  }, [eventIdFromUrl, eventIdFromQuery, eventIdFromStorage]);

  // Guardar evento activo en sessionStorage cuando se detecta desde la URL o query params
  useEffect(() => {
    const eventIdToStore = eventIdFromUrl || eventIdFromQuery;
    if (eventIdToStore && typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(ACTIVE_EVENT_STORAGE_KEY, eventIdToStore);
      } catch {
        // Ignorar errores de sessionStorage (puede estar deshabilitado)
      }
    }
  }, [eventIdFromUrl, eventIdFromQuery, ACTIVE_EVENT_STORAGE_KEY]);

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
  const [openTrackingMenu, setOpenTrackingMenu] = useState(false);
  const [menuPositions, setMenuPositions] = useState<Record<string, { top: number; left: number }>>({});
  
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  
  useEffect(() => {
    const updateMenuPositions = () => {
      const positions: Record<string, { top: number; left: number }> = {};
      Object.entries(menuRefs.current).forEach(([key, element]) => {
        if (element) {
          const rect = element.getBoundingClientRect();
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
    displayName = safeTranslate(t, 'navigation.superadmin');
  }

  const avatarNode = useMemo<ReactNode>(() => {
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
    return null;
  }, [user, displayName, isSuperAdminSession, superAdminUser]);

  const loginHref = tenantSlug ? tenantPath('login') : '/superadmin';

  // Los administradores ven todas las fases, los demás solo las visibles
  const visiblePhases = useMemo(() => {
    if (isEventAdmin) {
      return phases;
    }
    return phases.filter(phase => phase.isVisibleNow);
  }, [phases, isEventAdmin]);

  const eventPhases = useMemo(
    () =>
      activeEventId
        ? visiblePhases.filter(phase => String(phase.eventId) === activeEventId)
        : [],
    [activeEventId, visiblePhases]
  );

  // Detectar la Fase 0 para mostrarla como menú separado
  const phaseZero = useMemo(() => {
    if (!activeEventId) {
      return null;
    }
    
    const currentLang = (i18n.language?.split('-')[0] || 'es') as 'es' | 'ca' | 'en';
    
    for (const phase of eventPhases) {
      const phaseName = getMultilingualText(phase.name, currentLang);
      // Asegurar que siempre sea un string válido
      const safePhaseName = typeof phaseName === 'string' ? phaseName : String(phaseName || '');
      const normalizedName = safePhaseName.toLowerCase();
      const looksLikePhaseZero =
        phase.orderIndex === 0 ||
        normalizedName.includes('fase 0') ||
        normalizedName.includes('phase 0');
      if (looksLikePhaseZero) {
        const to = tenantPath(`dashboard/events/${activeEventId}/view?phase=${phase.id}`);
        const phaseDescription = getMultilingualText(phase.description, currentLang);
        const safeDescription = typeof phaseDescription === 'string' ? phaseDescription : String(phaseDescription || '');
        return { 
          to, 
          id: phase.id, 
          label: safePhaseName,
          description: safeDescription,
          orderIndex: phase.orderIndex,
          isPreparationPhase: true 
        };
      }
    }
    return null;
  }, [eventPhases, tenantPath, activeEventId, i18n.language]);

  const phaseLinks = useMemo(() => {
    if (!activeEventId) {
      return [];
    }

    const currentLang = (i18n.language?.split('-')[0] || 'es') as 'es' | 'ca' | 'en';

    return eventPhases
      .map(phase => {
        const phaseName = getMultilingualText(phase.name, currentLang);
        // Asegurar que siempre sea un string válido
        const safePhaseName = typeof phaseName === 'string' ? phaseName : String(phaseName || '');
        const normalizedName = safePhaseName.toLowerCase();
        const looksLikePhaseZero =
          phase.orderIndex === 0 ||
          normalizedName.includes('fase 0') ||
          normalizedName.includes('phase 0');
        const adminTarget = tenantPath(`dashboard/events/${activeEventId}?phase=${phase.id}`);
        const participantTarget = tenantPath(`dashboard/events/${activeEventId}/view?phase=${phase.id}`);
        const preparationTarget = tenantPath(`dashboard/events/${activeEventId}/team`);
        const to = isNonAdminUser
          ? (isParticipantOnly && looksLikePhaseZero ? preparationTarget : participantTarget)
          : adminTarget;
        const phaseDescription = getMultilingualText(phase.description, currentLang);
        const safeDescription = typeof phaseDescription === 'string' ? phaseDescription : String(phaseDescription || '');

        return {
          id: phase.id,
          label: safePhaseName,
          description: safeDescription,
          to,
          orderIndex: phase.orderIndex,
          isPreparationPhase: looksLikePhaseZero
        };
      })
      .filter(phase => !phase.isPreparationPhase);
  }, [eventPhases, tenantPath, activeEventId, isParticipantOnly, isNonAdminUser, i18n.language]);

  // Determinar la ruta principal del evento según el rol del usuario
  const eventHomePath = useMemo(() => {
    if (!activeEventId) {
      return null;
    }

    if (!user && !isSuperAdminSession) {
      return null;
    }

    return tenantPath(`dashboard/events/${activeEventId}/home`);
  }, [activeEventId, user, isSuperAdminSession, tenantPath]);

  // Detectar si estamos en una ruta de tracking
  const isTrackingRoute = useMemo(() => {
    return location.pathname.includes('/tracking/');
  }, [location.pathname]);

  const canViewPhases = (user || isSuperAdminSession) && (
    (activeEventId && isEventRoute && (eventHomePath !== null || phaseLinks.length > 0 || phaseZero !== null)) ||
    (canAccessTracking && isTrackingRoute)
  );

  const numericEventId = useMemo(() => {
    if (!activeEventId) {
      return null;
    }
    const parsed = Number(activeEventId);
    return Number.isFinite(parsed) ? parsed : null;
  }, [activeEventId]);

  const canFetchTasks = useMemo(
    () => Boolean((user || isSuperAdminSession) && activeEventId && numericEventId),
    [user, isSuperAdminSession, activeEventId, numericEventId]
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
    refetchInterval: 60_000
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
        // Obtener el texto del título en el idioma actual para la comparación
        const titleA = typeof a.title === 'string' ? a.title : getMultilingualText(a.title, i18n.language);
        const titleB = typeof b.title === 'string' ? b.title : getMultilingualText(b.title, i18n.language);
        return titleA.localeCompare(titleB);
      });
    });

    return grouped;
  }, [eventTasks, i18n.language]);

  const isEventHomeActive = useMemo(() => {
    if (!eventHomePath) {
      return false;
    }
    const currentPath = location.pathname;
    return currentPath === eventHomePath || currentPath.startsWith(eventHomePath + '?');
  }, [eventHomePath, location.pathname]);

  const availableLanguages = ['es', 'ca', 'en'];
  const currentLanguage =
    availableLanguages.find(language => i18n.language?.startsWith(language)) ?? 'es';

  const toggleLanguage = () => {
    const currentIndex = availableLanguages.indexOf(currentLanguage);
    const nextLanguage = availableLanguages[(currentIndex + 1) % availableLanguages.length];
    void i18n.changeLanguage(nextLanguage);
  };

  const handleLogout = () => {
    setProfileOpen(false);
    
    const hasSuperAdminSession = Boolean(superAdminTokens?.token && superAdminUser);
    
    if (hasSuperAdminSession) {
      logoutSuperAdmin();
    }
    
    if (isSuperAdminRoute) {
      logout(false);
      navigate('/superadmin', { replace: true });
    } else {
      const homePath = tenantSlug ? `/${tenantSlug}` : '/';
      navigate(homePath, { replace: true });
      logout(false);
    }
  };

  return {
    // Context values
    t,
    branding,
    tenantSlug,
    user,
    superAdminUser,
    isSuperAdminSession,
    shouldRenderProfileMenu,
    tenantPath,
    location,
    navigate,
    
    // Computed values
    roleScopes,
    isEventAdmin,
    isParticipantOnly,
    isNonAdminUser,
    canAccessTracking,
    activeEventId,
    numericEventId,
    isEventRoute,
    eventHomePath,
    canViewPhases,
    phaseZero,
    phaseLinks,
    tasksByPhase,
    hasTeam,
    isEventHomeActive,
    displayName,
    avatarNode,
    loginHref,
    unreadCount,
    currentLanguage,
    
    // Styles
    headerStyle,
    
    // State
    mobileOpen,
    setMobileOpen,
    profileOpen,
    setProfileOpen,
    openPhaseMenu,
    setOpenPhaseMenu,
    openHomeMenu,
    setOpenHomeMenu,
    openTrackingMenu,
    setOpenTrackingMenu,
    menuPositions,
    menuRefs,
    
    // Handlers
    toggleLanguage,
    handleLogout
  };
}

