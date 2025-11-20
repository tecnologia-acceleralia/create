import { useMemo, useEffect } from 'react';
import { useParams, Link, useSearchParams, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Download, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { DashboardLayout } from '@/components/layout';
import { Spinner, EmptyState } from '@/components/common';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { useTenantPath } from '@/hooks/useTenantPath';
import { getEventDeliverablesTracking, getEvents, type EventDeliverablesTracking, type Event } from '@/services/events';
import { arrayToCSV, downloadCSV } from '@/utils/csv';

type DeliverableCellProps = Readonly<{
  taskId: number;
  submissionId: number | null;
  submitted: boolean;
  attachmentUrl: string | null;
  content: string | null;
  hasFinalEvaluation?: boolean;
  eventId: number;
  tenantPath: (path: string) => string;
  isReviewer: boolean;
}>;

function DeliverableCell({ 
  taskId,
  submissionId,
  submitted, 
  attachmentUrl, 
  content,
  hasFinalEvaluation,
  eventId, 
  tenantPath,
  isReviewer
}: DeliverableCellProps) {
  const { t } = useTranslation();

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-2">
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
          {t('events.deliverablesTracking.submitted')}
        </Badge>
        {(attachmentUrl || content) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-xs"
            asChild
          >
            <Link
              to={tenantPath(`dashboard/events/${eventId}/tasks/${taskId}`)}
              target="_blank"
              className="flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              {t('events.deliverablesTracking.viewSubmission')}
            </Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
      {t('events.deliverablesTracking.notSubmitted')}
    </Badge>
  );
}

type PhaseEvaluationCellProps = Readonly<{
  phaseId: number;
  teamId: number;
  eventId: number;
  tenantPath: (path: string) => string;
  isReviewer: boolean;
  hasSubmissions: boolean;
  hasFinalEvaluation?: boolean;
}>;

function PhaseEvaluationCell({
  phaseId,
  teamId,
  eventId,
  tenantPath,
  isReviewer,
  hasSubmissions,
  hasFinalEvaluation
}: PhaseEvaluationCellProps) {
  const { t } = useTranslation();
  const { branding } = useTenant();
  const primaryColor = branding.primaryColor || '#0ea5e9';

  if (!isReviewer || !hasSubmissions) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-1">
      {!hasFinalEvaluation ? (
        <Button
          variant="default"
          size="sm"
          className="h-auto text-xs"
          style={{ backgroundColor: primaryColor }}
          asChild
        >
          <Link
            to={tenantPath(`dashboard/events/${eventId}/phases/${phaseId}/teams/${teamId}/evaluate`)}
          >
            {t('evaluations.evaluatePhaseButton', { defaultValue: 'Evaluar fase' })}
          </Link>
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-auto text-xs"
          asChild
        >
          <Link
            to={tenantPath(`dashboard/events/${eventId}/phases/${phaseId}/teams/${teamId}/evaluate`)}
          >
            {t('evaluations.viewPhaseEvaluationButton', { defaultValue: 'Ver evaluación' })}
          </Link>
        </Button>
      )}
    </div>
  );
}

type TrackingTableProps = Readonly<{
  trackingData: EventDeliverablesTracking;
  sortedTeams: Array<{ id: number; name: string }>;
  sortedColumns: Array<{ phaseId: number; phaseName: string; taskId: number; taskTitle: string }>;
  columnsByPhase: Map<number, Array<{ phaseId: number; phaseName: string; taskId: number; taskTitle: string; orderIndex: number }>>;
  deliverablesMap: Map<string, { submitted: boolean; submissionId: number | null; attachmentUrl: string | null; content: string | null; hasFinalEvaluation?: boolean; hasPendingEvaluation?: boolean; finalEvaluationId?: number | null }>;
  eventId: number;
  tenantPath: (path: string) => string;
  isReviewer: boolean;
}>;

function TrackingTable({ 
  trackingData, 
  sortedTeams, 
  sortedColumns, 
  columnsByPhase, 
  deliverablesMap, 
  eventId, 
  tenantPath,
  isReviewer
}: TrackingTableProps) {
  const { t } = useTranslation();
  const sortedPhases = [...trackingData.phases].sort((a, b) => a.orderIndex - b.orderIndex);

  // Crear estructura de columnas con evaluación de fase
  const columnsWithEvaluation = useMemo(() => {
    const result: Array<{ type: 'task' | 'evaluation'; phaseId: number; taskId?: number; taskTitle?: string }> = [];
    
    for (const phase of sortedPhases) {
      const phaseColumns = columnsByPhase.get(phase.id) || [];
      // Agregar columnas de tareas
      phaseColumns.forEach(col => {
        result.push({ type: 'task', phaseId: phase.id, taskId: col.taskId, taskTitle: col.taskTitle });
      });
      // Agregar columna de evaluación de fase si hay tareas
      if (phaseColumns.length > 0) {
        result.push({ type: 'evaluation', phaseId: phase.id });
      }
    }
    
    return result;
  }, [sortedPhases, columnsByPhase]);

  // Verificar si hay entregas en una fase para un equipo
  const hasPhaseSubmissions = (phaseId: number, teamId: number) => {
    const phaseColumns = columnsByPhase.get(phaseId) || [];
    return phaseColumns.some(col => {
      const key = `${teamId}:${col.taskId}`;
      const deliverable = deliverablesMap.get(key);
      return deliverable?.submitted ?? false;
    });
  };

  // Verificar si hay evaluación final de fase
  const hasPhaseFinalEvaluation = (phaseId: number, teamId: number) => {
    // TODO: Implementar cuando tengamos el endpoint para obtener evaluaciones de fase
    return false;
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="sticky left-0 z-10 bg-background w-[200px]">
            {t('events.deliverablesTracking.team')}
          </TableHead>
          {sortedPhases.map(phase => {
            const phaseColumns = columnsByPhase.get(phase.id) || [];
            if (phaseColumns.length === 0) return null;
            
            return (
              <TableHead
                key={phase.id}
                colSpan={phaseColumns.length + 1}
                className="text-left bg-muted/50"
              >
                <div className="font-semibold">{phase.name}</div>
              </TableHead>
            );
          })}
        </TableRow>
        <TableRow>
          <TableHead className="sticky left-0 z-10 bg-background"></TableHead>
          {columnsWithEvaluation.map((col, index) => {
            if (col.type === 'evaluation') {
              return (
                <TableHead key={`eval-${col.phaseId}`} className="text-center w-[120px]">
                  <div className="text-xs font-medium">{t('evaluations.evaluation', { defaultValue: 'Evaluación' })}</div>
                </TableHead>
              );
            }
            return (
              <TableHead key={`${col.phaseId}-${col.taskId}`} className="text-center w-[150px]">
                <div className="text-xs font-medium">{col.taskTitle}</div>
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedTeams.map(team => (
          <TableRow key={team.id}>
            <TableCell className="sticky left-0 z-10 bg-background font-medium w-[200px]">
              {team.name}
            </TableCell>
            {columnsWithEvaluation.map(col => {
              if (col.type === 'evaluation') {
                const hasSubmissions = hasPhaseSubmissions(col.phaseId, team.id);
                const hasFinalEval = hasPhaseFinalEvaluation(col.phaseId, team.id);
                return (
                  <TableCell key={`eval-${col.phaseId}-${team.id}`} className="text-center w-[120px]">
                    <PhaseEvaluationCell
                      phaseId={col.phaseId}
                      teamId={team.id}
                      eventId={eventId}
                      tenantPath={tenantPath}
                      isReviewer={isReviewer}
                      hasSubmissions={hasSubmissions}
                      hasFinalEvaluation={hasFinalEval}
                    />
                  </TableCell>
                );
              }
              
              const key = `${team.id}:${col.taskId}`;
              const deliverable = deliverablesMap.get(key);
              const submitted = deliverable?.submitted ?? false;
              const submissionId = deliverable?.submissionId ?? null;
              const attachmentUrl = deliverable?.attachmentUrl ?? null;
              const content = deliverable?.content ?? null;
              const hasFinalEvaluation = deliverable?.hasFinalEvaluation ?? false;

              return (
                <TableCell key={`${team.id}-${col.taskId}`} className="text-center w-[150px]">
                  <DeliverableCell
                    taskId={col.taskId!}
                    submissionId={submissionId}
                    submitted={submitted}
                    attachmentUrl={attachmentUrl}
                    content={content}
                    hasFinalEvaluation={hasFinalEvaluation}
                    eventId={eventId}
                    tenantPath={tenantPath}
                    isReviewer={isReviewer}
                  />
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

type TrackingContentProps = Readonly<{
  selectedEventId: number | null;
  isLoadingTracking: boolean;
  isError: boolean;
  trackingData: EventDeliverablesTracking | undefined;
  sortedTeams: Array<{ id: number; name: string }>;
  sortedColumns: Array<{ phaseId: number; phaseName: string; taskId: number; taskTitle: string }>;
  columnsByPhase: Map<number, Array<{ phaseId: number; phaseName: string; taskId: number; taskTitle: string; orderIndex: number }>>;
  deliverablesMap: Map<string, { submitted: boolean; submissionId: number | null; attachmentUrl: string | null; content: string | null; hasFinalEvaluation?: boolean; hasPendingEvaluation?: boolean; finalEvaluationId?: number | null }>;
  tenantPath: (path: string) => string;
  isReviewer: boolean;
  pendingEvaluationsCount: number;
}>;

function TrackingContent({
  selectedEventId,
  isLoadingTracking,
  isError,
  trackingData,
  sortedTeams,
  sortedColumns,
  columnsByPhase,
  deliverablesMap,
  tenantPath,
  isReviewer,
  pendingEvaluationsCount
}: TrackingContentProps) {
  const { t } = useTranslation();

  if (!selectedEventId) {
    return <EmptyState message={t('tracking.deliverables.noEventSelected')} />;
  }

  if (isLoadingTracking) {
    return <Spinner />;
  }

  if (isError || !trackingData) {
    return (
      <div className="py-10 text-center text-sm text-destructive">
        {t('events.deliverablesTracking.error')}
      </div>
    );
  }

  if (sortedTeams.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        {t('events.deliverablesTracking.noTeams')}
      </div>
    );
  }

  if (sortedColumns.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        {t('events.deliverablesTracking.noTasks')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isReviewer && pendingEvaluationsCount > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>
            {(() => {
              const pluralText = pendingEvaluationsCount === 1
                ? t('evaluations.pendingEvaluationsAlertSingular')
                : t('evaluations.pendingEvaluationsAlertPlural');
              const verbText = pendingEvaluationsCount === 1
                ? t('evaluations.pendingEvaluationsAlertVerbSingular', { defaultValue: '' })
                : t('evaluations.pendingEvaluationsAlertVerbPlural', { defaultValue: '' });
              let message = t('evaluations.pendingEvaluationsAlert', {
                count: pendingEvaluationsCount,
                plural: pluralText,
                verb: verbText
              });
              // Eliminar el placeholder {{verb}} si está vacío (para español y catalán)
              if (!verbText) {
                message = message.replace(/\{\{verb\}\}/g, '').replace(/\s+/g, ' ').trim();
              }
              return message;
            })()}
          </span>
        </div>
      )}
      <div className="overflow-x-auto">
        <TrackingTable
          trackingData={trackingData}
          sortedTeams={sortedTeams}
          sortedColumns={sortedColumns}
          columnsByPhase={columnsByPhase}
          deliverablesMap={deliverablesMap}
          eventId={selectedEventId}
          tenantPath={tenantPath}
          isReviewer={isReviewer}
        />
      </div>
    </div>
  );
}

export default function DeliverablesTrackingPage() {
  const { t } = useTranslation();
  const tenantPath = useTenantPath();
  const location = useLocation();
  const { eventId: eventIdParam } = useParams<{ eventId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isSuperAdmin, activeMembership, user, currentEventId } = useAuth();
  const roleScopes = useMemo(
    () => new Set<string>(activeMembership?.roles?.map(role => role.scope) ?? user?.roleScopes ?? []),
    [activeMembership, user]
  );
  const isReviewer = isSuperAdmin || roleScopes.has('evaluator') || roleScopes.has('organizer') || roleScopes.has('tenant_admin');
  
  // Detectar eventId de la URL si estamos en contexto de evento
  const activeEventIdFromPath = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    const dashboardIndex = segments.indexOf('dashboard');
    if (dashboardIndex === -1) return null;
    
    const nextSegment = segments[dashboardIndex + 1];
    if (nextSegment !== 'events') return null;
    
    const eventIdSegment = segments[dashboardIndex + 2] ?? null;
    return eventIdSegment ? Number(eventIdSegment) : null;
  }, [location.pathname]);
  
  // Obtener lista de eventos
  const { data: events, isLoading: isLoadingEvents } = useQuery<Event[]>({
    queryKey: ['events'],
    queryFn: getEvents
  });

  // Obtener eventId de la URL, search params, contexto de evento o evento actual del AuthContext
  const eventIdFromUrl = eventIdParam || searchParams.get('eventId') || (activeEventIdFromPath ? String(activeEventIdFromPath) : null);
  const selectedEventId = eventIdFromUrl ? Number(eventIdFromUrl) : (currentEventId ?? null);
  
  // Si hay un evento activo en la URL o en el contexto pero no está seleccionado, seleccionarlo automáticamente
  // También verificar que el evento existe en la lista de eventos disponibles
  useEffect(() => {
    if (isLoadingEvents || !events) return;
    
    const eventIdToSelect = activeEventIdFromPath || currentEventId;
    if (eventIdToSelect && !eventIdParam && !searchParams.get('eventId')) {
      // Verificar que el evento existe en la lista de eventos disponibles
      const eventExists = events.some(event => event.id === eventIdToSelect);
      if (eventExists) {
        setSearchParams({ eventId: String(eventIdToSelect) }, { replace: true });
      }
    }
  }, [activeEventIdFromPath, currentEventId, eventIdParam, searchParams, setSearchParams, events, isLoadingEvents]);

  // Obtener datos de seguimiento si hay un evento seleccionado
  const { data: trackingData, isLoading: isLoadingTracking, isError } = useQuery<EventDeliverablesTracking>({
    queryKey: ['events', selectedEventId, 'deliverables-tracking'],
    queryFn: () => getEventDeliverablesTracking(selectedEventId!),
    enabled: selectedEventId !== null && Number.isFinite(selectedEventId)
  });

  // Agrupar columnas por fase y ordenar tareas por order_index
  const columnsByPhase = useMemo(() => {
    if (!trackingData) return new Map();

    const grouped = new Map<number, Array<{ phaseId: number; phaseName: string; taskId: number; taskTitle: string; orderIndex: number }>>();
    
    for (const column of trackingData.columns) {
      if (!grouped.has(column.phaseId)) {
        grouped.set(column.phaseId, []);
      }
      grouped.get(column.phaseId)!.push({
        ...column,
        orderIndex: column.orderIndex ?? 0
      });
    }

    // Ordenar tareas por order_index dentro de cada fase
    for (const tasks of grouped.values()) {
      tasks.sort((a, b) => a.orderIndex - b.orderIndex);
    }

    return grouped;
  }, [trackingData]);

  // Crear un mapa de entregables por equipo y tarea para acceso rápido
  const deliverablesMap = useMemo(() => {
    if (!trackingData) return new Map();

    const map = new Map<string, { submitted: boolean; submissionId: number | null; attachmentUrl: string | null; content: string | null; hasFinalEvaluation?: boolean; hasPendingEvaluation?: boolean; finalEvaluationId?: number | null }>();
    
    for (const team of trackingData.teams) {
      for (const deliverable of team.deliverables) {
        const key = `${team.id}:${deliverable.taskId}`;
        map.set(key, {
          submitted: deliverable.submitted,
          submissionId: deliverable.submissionId,
          attachmentUrl: deliverable.attachmentUrl,
          content: deliverable.content,
          hasFinalEvaluation: deliverable.hasFinalEvaluation,
          hasPendingEvaluation: deliverable.hasPendingEvaluation,
          finalEvaluationId: deliverable.finalEvaluationId
        });
      }
    }

    return map;
  }, [trackingData]);

  // Contar evaluaciones pendientes
  const pendingEvaluationsCount = useMemo(() => {
    if (!trackingData) return 0;
    let count = 0;
    trackingData.teams.forEach(team => {
      team.deliverables.forEach(deliverable => {
        if (deliverable.submitted && !deliverable.hasFinalEvaluation) {
          count++;
        }
      });
    });
    return count;
  }, [trackingData]);

  // Ordenar equipos por nombre
  const sortedTeams = useMemo(() => {
    if (!trackingData) return [];
    return [...trackingData.teams].sort((a, b) => a.name.localeCompare(b.name));
  }, [trackingData]);

  // Ordenar columnas por fase y order_index de tareas
  const sortedColumns = useMemo(() => {
    if (!trackingData) return [];
    const phases = [...trackingData.phases].sort((a, b) => a.orderIndex - b.orderIndex);
    const sorted: typeof trackingData.columns = [];
    
    for (const phase of phases) {
      const phaseColumns = columnsByPhase.get(phase.id) || [];
      sorted.push(...phaseColumns);
    }
    
    return sorted;
  }, [trackingData, columnsByPhase]);

  const handleEventChange = (eventId: string) => {
    const newSearchParams = new URLSearchParams(searchParams);
    if (eventId) {
      newSearchParams.set('eventId', eventId);
    } else {
      newSearchParams.delete('eventId');
    }
    setSearchParams(newSearchParams, { replace: true });
  };

  // Función para exportar entregables a CSV
  const exportDeliverablesToCSV = () => {
    if (!trackingData || sortedTeams.length === 0 || sortedColumns.length === 0) return;

    const teamHeader = t('events.deliverablesTracking.team');
    const taskHeaders = sortedColumns.map(col => `${col.phaseName} - ${col.taskTitle}`);
    const headers = [teamHeader, ...taskHeaders];

    const csvData = sortedTeams
      .filter(team => team.name)
      .map(team => {
        const row: Record<string, string> = {
          [teamHeader]: team.name || ''
        };

        for (let index = 0; index < sortedColumns.length; index++) {
          const column = sortedColumns[index];
          const key = `${team.id}:${column.taskId}`;
          const deliverable = deliverablesMap.get(key);
          const submitted = deliverable?.submitted ?? false;
          const columnKey = taskHeaders[index];
          row[columnKey] = submitted 
            ? t('events.deliverablesTracking.submitted')
            : t('events.deliverablesTracking.notSubmitted');
        }

        return row;
      });

    if (csvData.length === 0) return;

    const csv = arrayToCSV(csvData, headers);
    const eventName = events?.find(e => e.id === selectedEventId)?.name || 'evento';
    const sanitizedEventName = eventName.toLowerCase().replaceAll(/\s+/g, '-');
    downloadCSV(csv, `entregables-${sanitizedEventName}`);
  };

  const selectedEvent = events?.find(e => e.id === selectedEventId);

  if (isLoadingEvents) {
    return <Spinner fullHeight />;
  }

  return (
    <DashboardLayout
      title={t('tracking.deliverables.title')}
      subtitle={selectedEvent ? selectedEvent.name : t('tracking.deliverables.subtitle')}
    >
      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>{t('tracking.deliverables.selectEvent')}</CardTitle>
            {selectedEventId && trackingData && (
              <Button variant="outline" size="sm" onClick={exportDeliverablesToCSV}>
                <Download className="h-4 w-4 mr-2" />
                {t('common.export', { defaultValue: 'Exportar CSV' })}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Select
            value={selectedEventId?.toString() || ''}
            onValueChange={handleEventChange}
            placeholder={t('tracking.deliverables.selectEventPlaceholder')}
            className="w-full sm:w-[300px]"
          >
            {events && events.length > 0 ? (
              events.map(event => (
                <option key={event.id} value={event.id.toString()}>
                  {event.name}
                </option>
              ))
            ) : (
              <option value="" disabled>
                {t('events.empty')}
              </option>
            )}
          </Select>

          <TrackingContent
            selectedEventId={selectedEventId}
            isLoadingTracking={isLoadingTracking}
            isError={isError}
            trackingData={trackingData}
            sortedTeams={sortedTeams}
            sortedColumns={sortedColumns}
            columnsByPhase={columnsByPhase}
            deliverablesMap={deliverablesMap}
            tenantPath={tenantPath}
            isReviewer={isReviewer}
            pendingEvaluationsCount={pendingEvaluationsCount}
          />
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

