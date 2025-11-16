import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useSearchParams, Navigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Minus } from 'lucide-react';

import { DashboardLayout } from '@/components/layout';
import { Spinner } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDateValue, formatDateRange, parseDate } from '@/utils/date';
import {
  getEventDetail,
  type Phase,
  type Task
} from '@/services/events';
import { useTenantPath } from '@/hooks/useTenantPath';
import { useAuth } from '@/context/AuthContext';

type EventDetailData = Awaited<ReturnType<typeof getEventDetail>>;

function EventDetailParticipantPage() {
  const { eventId } = useParams();
  const numericId = Number(eventId);
  const { t } = useTranslation();
  const tenantPath = useTenantPath();
  const [searchParams] = useSearchParams();

  const { data: eventDetail, isLoading } = useQuery({
    queryKey: ['events', numericId],
    queryFn: () => getEventDetail(numericId),
    enabled: Number.isInteger(numericId)
  });

  const phases = useMemo(
    () =>
      ((eventDetail?.phases ?? []) as Phase[])
        .slice()
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
    [eventDetail?.phases]
  );

  const activePhaseIdParam = searchParams.get('phase');
  const activePhaseId = activePhaseIdParam ? Number(activePhaseIdParam) : phases[0]?.id ?? null;
  const activePhase = phases.find(phase => phase.id === activePhaseId) ?? phases[0] ?? null;
  
  const isPhaseZero = useMemo(() => {
    if (!activePhase) return false;
    const normalizedName = activePhase.name?.toLowerCase() ?? '';
    return (
      activePhase.order_index === 0 ||
      normalizedName.includes('fase 0') ||
      normalizedName.includes('phase 0')
    );
  }, [activePhase]);

  if (isNaN(numericId) || isLoading) {
    return <Spinner fullHeight />;
  }

  if (!eventDetail) {
    return (
      <DashboardLayout title={t('events.title')} subtitle={t('common.error')}>
        <div className="rounded-2xl border border-border/70 bg-card/80 p-6 text-sm">
          <p className="text-destructive">{t('common.error')}</p>
          <Button asChild variant="outline" className="mt-4">
            <Link to={tenantPath('dashboard')}>{t('navigation.dashboard')}</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  // Check if current phase is Phase 0, redirect to PhaseZeroPage
  if (isPhaseZero) {
    return <Navigate to={tenantPath(`dashboard/events/${eventId}/phase-zero?phase=${activePhaseId}`)} replace />;
  }

  return <EventParticipantView eventDetail={eventDetail} />;
}

function EventParticipantView({ eventDetail }: { eventDetail: EventDetailData }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language ?? 'es';
  const tenantPath = useTenantPath();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, activeMembership } = useAuth();

  const roleScopes = useMemo(
    () => new Set<string>(activeMembership?.roles?.map(role => role.scope) ?? user?.roleScopes ?? []),
    [activeMembership, user]
  );
  const isParticipantOnly = roleScopes.has('participant') && !roleScopes.has('tenant_admin') && !roleScopes.has('organizer') && !roleScopes.has('evaluator');

  const phases = useMemo(
    () =>
      ((eventDetail?.phases ?? []) as Phase[])
        .slice()
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
    [eventDetail?.phases]
  );
  const tasks = useMemo(() => (eventDetail?.tasks ?? []) as Task[], [eventDetail?.tasks]);
  
  const hasTeam = eventDetail?.has_team ?? false;

  const notAvailableLabel = t('common.notAvailable', { defaultValue: 'N/A' });
  const formatDateWithFallback = (value?: string | null) => formatDateValue(value) ?? notAvailableLabel;

  useEffect(() => {
    if (!phases.length) {
      return;
    }
    const current = searchParams.get('phase');
    const hasPhase = current ? phases.some(phase => phase.id === Number(current)) : false;
    if (!hasPhase) {
      const next = new URLSearchParams(searchParams);
      next.set('phase', String(phases[0].id));
      setSearchParams(next, { replace: true });
    }
  }, [phases, searchParams, setSearchParams]);

  const activePhaseIdParam = searchParams.get('phase');
  const activePhaseId = activePhaseIdParam ? Number(activePhaseIdParam) : phases[0]?.id ?? null;
  const activePhase = phases.find(phase => phase.id === activePhaseId) ?? phases[0] ?? null;

  const isPhaseZero = useMemo(() => {
    if (!activePhase) return false;
    const normalizedName = activePhase.name?.toLowerCase() ?? '';
    return (
      activePhase.order_index === 0 ||
      normalizedName.includes('fase 0') ||
      normalizedName.includes('phase 0')
    );
  }, [activePhase]);

  const tasksByPhase = useMemo(() => {
    const grouped = new Map<number, Task[]>();
    tasks.forEach(task => {
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
  }, [tasks]);

  const activeTasks = activePhase ? tasksByPhase.get(activePhase.id) ?? [] : [];

  // Mapa de fases por ID para acceso rápido
  const phasesMap = useMemo(() => {
    const map = new Map<number, Phase>();
    for (const phase of phases) {
      map.set(phase.id, phase);
    }
    return map;
  }, [phases]);

  // Función para verificar si una tarea está en su periodo válido
  const isTaskInValidPeriod = (task: Task): { isValid: boolean; reason: 'not_started' | 'ended' | 'no_dates' | 'valid' } => {
    const phase = phasesMap.get(task.phase_id);
    if (!phase) {
      return { isValid: false, reason: 'no_dates' };
    }

    const startDate = phase.start_date ? parseDate(phase.start_date) : null;
    const endDate = phase.end_date ? parseDate(phase.end_date) : null;

    // Si no hay fechas, permitir entregas (comportamiento por defecto)
    if (!startDate && !endDate) {
      return { isValid: true, reason: 'valid' };
    }

    const now = new Date();
    const nowNormalized = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (startDate) {
      const startNormalized = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      if (nowNormalized < startNormalized) {
        return { isValid: false, reason: 'not_started' };
      }
    }

    if (endDate) {
      const endNormalized = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);
      if (nowNormalized > endNormalized) {
        return { isValid: false, reason: 'ended' };
      }
    }

    return { isValid: true, reason: 'valid' };
  };

  // Estado para controlar qué tasks están expandidas (por defecto todas expandidas)
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(() => {
    const initialSet = new Set<number>();
    activeTasks.forEach(task => initialSet.add(task.id));
    return initialSet;
  });

  const [isPhaseContextExpanded, setIsPhaseContextExpanded] = useState(true);

  // Actualizar el estado cuando cambian las tareas activas (expandir todas por defecto)
  useEffect(() => {
    const newExpandedSet = new Set<number>();
    for (const task of activeTasks) {
      newExpandedSet.add(task.id);
    }
    setExpandedTasks(newExpandedSet);
  }, [activeTasks]); // Cuando cambian las tareas activas

  const toggleTask = (taskId: number) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  return (
    <DashboardLayout title={eventDetail.name} subtitle={eventDetail.description ?? ''}>
      <div className="space-y-6">
        {activePhase?.intro_html ? (
          <div className="rounded-2xl border border-border/70 bg-card/80 p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 flex-1">
                <button
                  onClick={() => setIsPhaseContextExpanded(!isPhaseContextExpanded)}
                  className="mt-0.5 flex-shrink-0 rounded-md border border-border/60 bg-background p-1.5 text-muted-foreground transition-all hover:bg-accent hover:text-foreground hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--tenant-primary)]"
                  aria-label={isPhaseContextExpanded ? t('common.collapse') : t('common.expand')}
                >
                  {isPhaseContextExpanded ? (
                    <Minus className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-muted-foreground mb-1">
                    Fase
                  </p>
                  <p className="text-base font-semibold text-foreground">{activePhase.name}</p>
                  {(activePhase.start_date || activePhase.end_date) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDateRange(locale, activePhase.start_date ?? null, activePhase.end_date ?? null) ?? t('events.taskPeriodNotSet')}
                    </p>
                  )}
                  {isPhaseContextExpanded && (
                    <div
                      className="prose prose-sm max-w-none mt-3"
                      dangerouslySetInnerHTML={{ __html: activePhase.intro_html }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {isPhaseZero ? (
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to={tenantPath(`dashboard/events/${eventDetail.id}/team#projects-list`)}>
                {t('teams.viewTeams')}
              </Link>
            </Button>
            {isParticipantOnly && !hasTeam ? (
              <Button asChild variant="outline">
                <Link to={tenantPath(`dashboard/events/${eventDetail.id}/team#projects-create`)}>
                  {t('teams.createTeam')}
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-4">
          {activeTasks.map(task => {
            const isExpanded = expandedTasks.has(task.id);
            const phase = phasesMap.get(task.phase_id);
            const periodStatus = isTaskInValidPeriod(task);
            const hasValidDates = phase?.start_date || phase?.end_date;
            
            return (
              <div key={task.id} className="rounded-2xl border border-border/70 bg-card/80 p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-2 flex-1">
                    <button
                      onClick={() => toggleTask(task.id)}
                      className="mt-0.5 flex-shrink-0 rounded-md border border-border/60 bg-background p-1.5 text-muted-foreground transition-all hover:bg-accent hover:text-foreground hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--tenant-primary)]"
                      aria-label={isExpanded ? t('common.collapse') : t('common.expand')}
                    >
                      {isExpanded ? (
                        <Minus className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Plus className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-muted-foreground mb-1">
                        Actividad
                      </p>
                      <p className="text-base font-semibold text-foreground">{task.title}</p>
                      {hasValidDates && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDateRange(locale, phase?.start_date ?? null, phase?.end_date ?? null) ?? t('events.taskPeriodNotSet')}
                        </p>
                      )}
                      {task.description && isExpanded ? (
                        <p className="text-sm text-muted-foreground mt-2">{task.description}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {task.is_required ? <Badge variant="secondary">{t('events.taskRequiredBadge')}</Badge> : null}
                  </div>
                </div>
                {isExpanded && (
                  <div className="space-y-3 mt-3">
                    {task.intro_html ? (
                      <div
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: task.intro_html }}
                      />
                    ) : null}
                    {isPhaseZero ? null : (
                      <div className="flex flex-wrap gap-3 items-center">
                        {periodStatus.isValid ? (
                          <Button asChild>
                            <Link to={tenantPath(`dashboard/events/${eventDetail.id}/tasks/${task.id}`)}>
                              {t('submissions.register')}
                            </Link>
                          </Button>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <p className="text-sm text-muted-foreground">
                              {(() => {
                                if (periodStatus.reason === 'not_started') {
                                  return t('events.taskPeriodNotStarted');
                                }
                                if (periodStatus.reason === 'ended') {
                                  return t('events.taskPeriodEnded');
                                }
                                return t('events.taskPeriodNotAvailable');
                              })()}
                            </p>
                            <Button variant="outline" disabled>
                              {t('submissions.register')}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {!activeTasks.length && phases.length ? (
            <p className="text-sm text-muted-foreground">{t('events.noTasks')}</p>
          ) : null}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default EventDetailParticipantPage;

