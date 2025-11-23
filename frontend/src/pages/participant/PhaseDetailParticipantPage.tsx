import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { DashboardLayout } from '@/components/layout';
import { Spinner } from '@/components/common';
import { Button } from '@/components/ui/button';
import { formatDateRange, formatDateValue, parseDate } from '@/utils/date';
import { safeTranslate } from '@/utils/i18n-helpers';
import { getMultilingualText } from '@/utils/multilingual';
import {
  getEventDetail,
  type Phase,
  type Task
} from '@/services/events';
import { useTenantPath } from '@/hooks/useTenantPath';
import { useAuth } from '@/context/AuthContext';
import { PhaseContextCard, TaskContextCard } from '@/components/events';

type EventDetailData = Awaited<ReturnType<typeof getEventDetail>>;

function PhaseDetailParticipantPage() {
  const { eventId } = useParams();
  const numericId = Number(eventId);
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language?.split('-')[0] || 'es') as 'es' | 'ca' | 'en';
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
    const phaseName = getMultilingualText(activePhase.name, currentLang);
    const normalizedName = phaseName.toLowerCase();
    return (
      activePhase.order_index === 0 ||
      normalizedName.includes('fase 0') ||
      normalizedName.includes('phase 0')
    );
  }, [activePhase, currentLang]);

  if (isNaN(numericId) || isLoading) {
    return <Spinner fullHeight />;
  }

  if (!eventDetail) {
    return (
      <DashboardLayout title={safeTranslate(t, 'events.title')} subtitle={safeTranslate(t, 'common.error')}>
        <div className="rounded-2xl border border-border/70 bg-card/80 p-6 text-sm">
          <p className="text-destructive">{safeTranslate(t, 'common.error')}</p>
          <Button asChild variant="outline" className="mt-4">
            <Link to={tenantPath('dashboard')}>{safeTranslate(t, 'navigation.dashboard')}</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return <PhaseParticipantView eventDetail={eventDetail} />;
}

function PhaseParticipantView({ eventDetail }: { eventDetail: EventDetailData }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language ?? 'es';
  const currentLang = (i18n.language?.split('-')[0] || 'es') as 'es' | 'ca' | 'en';
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

  const notAvailableLabel = safeTranslate(t, 'common.notAvailable', { defaultValue: 'N/A' });
  const formatDateWithFallback = (value?: string | null) => formatDateValue(value, locale) ?? notAvailableLabel;

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
    const phaseName = getMultilingualText(activePhase.name, currentLang);
    const normalizedName = phaseName.toLowerCase();
    return (
      activePhase.order_index === 0 ||
      normalizedName.includes('fase 0') ||
      normalizedName.includes('phase 0')
    );
  }, [activePhase, currentLang]);

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
        // Manejar casos donde title puede ser null o undefined
        const titleA = a.title ? (typeof a.title === 'string' ? a.title : getMultilingualText(a.title, currentLang)) : '';
        const titleB = b.title ? (typeof b.title === 'string' ? b.title : getMultilingualText(b.title, currentLang)) : '';
        return titleA.localeCompare(titleB);
      });
    });
    return grouped;
  }, [tasks, currentLang]);

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

  const [isPhaseContextExpanded] = useState(true);

  // Actualizar el estado cuando cambian las tareas activas (expandir todas por defecto)
  useEffect(() => {
    const newExpandedSet = new Set<number>();
    for (const task of activeTasks) {
      newExpandedSet.add(task.id);
    }
    setExpandedTasks(newExpandedSet);
  }, [activeTasks]); // Cuando cambian las tareas activas

  const eventName = getMultilingualText(eventDetail.name, currentLang);
  const eventDescription = eventDetail.description ? getMultilingualText(eventDetail.description, currentLang) : '';

  return (
    <DashboardLayout title={eventName} subtitle={eventDescription}>
      <div className="space-y-6">
        {activePhase ? (
          <PhaseContextCard phase={activePhase} locale={locale} defaultExpanded={isPhaseContextExpanded} eventId={eventDetail.id} />
        ) : null}

        <div className="space-y-4">
          {activeTasks.map(task => {
            const phase = phasesMap.get(task.phase_id);
            const periodStatus = isTaskInValidPeriod(task);
            
            return (
              <TaskContextCard
                key={task.id}
                task={task}
                phase={phase}
                locale={locale}
                defaultExpanded={expandedTasks.has(task.id)}
                showActions={!isPhaseZero}
                eventId={eventDetail.id}
                isPhaseZero={isPhaseZero}
                periodStatus={periodStatus}
              />
            );
          })}
          {!activeTasks.length && phases.length ? (
            <p className="text-sm text-muted-foreground">{safeTranslate(t, 'events.noTasks')}</p>
          ) : null}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default PhaseDetailParticipantPage;

