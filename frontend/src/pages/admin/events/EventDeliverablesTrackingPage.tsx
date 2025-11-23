import { useMemo } from 'react';
import { useParams, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Check, X, ExternalLink, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

import { DashboardLayout } from '@/components/layout';
import { Spinner } from '@/components/common';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTenantPath } from '@/hooks/useTenantPath';
import { safeTranslate } from '@/utils/i18n-helpers';
import { getMultilingualText } from '@/utils/multilingual';
import { getEventDeliverablesTracking, type EventDeliverablesTracking } from '@/services/events';
import { getEventDetail } from '@/services/events';

export default function EventDeliverablesTrackingPage() {
  const { t, i18n } = useTranslation();
  const tenantPath = useTenantPath();
  const { eventId } = useParams<{ eventId: string }>();
  // Limpiar eventId: tomar solo la parte antes de ":" o "."
  const cleanedEventId = eventId ? String(eventId).trim().split(':')[0].split('.')[0] : null;
  const numericEventId = cleanedEventId ? Number.parseInt(cleanedEventId, 10) : NaN;
  const currentLang = (i18n.language?.split('-')[0] || 'es') as 'es' | 'ca' | 'en';

  const { data: eventDetail } = useQuery({
    queryKey: ['events', numericEventId],
    queryFn: () => getEventDetail(numericEventId),
    enabled: Number.isFinite(numericEventId)
  });

  const { data: trackingData, isLoading, isError } = useQuery<EventDeliverablesTracking>({
    queryKey: ['events', numericEventId, 'deliverables-tracking'],
    queryFn: () => getEventDeliverablesTracking(numericEventId),
    enabled: Number.isFinite(numericEventId)
  });

  // Agrupar columnas por fase para mostrar headers agrupados
  const columnsByPhase = useMemo(() => {
    if (!trackingData) return new Map();

    const grouped = new Map<number, Array<{ phaseId: number; phaseName: string; taskId: number; taskTitle: string }>>();
    
    trackingData.columns.forEach(column => {
      if (!grouped.has(column.phaseId)) {
        grouped.set(column.phaseId, []);
      }
      grouped.get(column.phaseId)!.push(column);
    });

    return grouped;
  }, [trackingData]);

  const { isSuperAdmin, activeMembership, user } = useAuth();
  const roleScopes = useMemo(
    () => new Set<string>(activeMembership?.roles?.map(role => role.scope) ?? user?.roleScopes ?? []),
    [activeMembership, user]
  );
  const isReviewer = isSuperAdmin || roleScopes.has('evaluator') || roleScopes.has('organizer') || roleScopes.has('tenant_admin');

  // Crear un mapa de entregables por equipo y tarea para acceso rápido
  const deliverablesMap = useMemo(() => {
    if (!trackingData) return new Map();

    const map = new Map<string, { submitted: boolean; submissionId: number | null; attachmentUrl: string | null; content: string | null; hasFinalEvaluation?: boolean; hasPendingEvaluation?: boolean; finalEvaluationId?: number | null }>();
    
    trackingData.teams.forEach(team => {
      team.deliverables.forEach(deliverable => {
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
      });
    });

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

  if (!Number.isFinite(numericEventId)) {
    return (
      <DashboardLayout title={safeTranslate(t, 'events.deliverablesTracking.title')} subtitle="">
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {safeTranslate(t, 'events.deliverablesTracking.error')}
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  if (isLoading) {
    return <Spinner fullHeight />;
  }

  if (isError || !trackingData) {
    return (
      <DashboardLayout title={safeTranslate(t, 'events.deliverablesTracking.title')} subtitle="">
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            {safeTranslate(t, 'events.deliverablesTracking.error')}
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const eventName = useMemo(() => {
    if (!eventDetail?.name) {
      return '';
    }
    return getMultilingualText(eventDetail.name, currentLang);
  }, [eventDetail?.name, currentLang]);
  const phases = trackingData.phases.sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <DashboardLayout
      title={safeTranslate(t, 'events.deliverablesTracking.title')}
      subtitle={eventName}
      actions={
        <Button variant="outline" asChild>
          <Link to={tenantPath(`dashboard/events/${eventId}`)}>
            {safeTranslate(t, 'events.tracking.backToEvent', { defaultValue: 'Volver al evento' })}
          </Link>
        </Button>
      }
    >
      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>{safeTranslate(t, 'events.deliverablesTracking.subtitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isReviewer && pendingEvaluationsCount > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>
                {(() => {
                  const pluralText = pendingEvaluationsCount === 1
                    ? safeTranslate(t, 'evaluations.pendingEvaluationsAlertSingular')
                    : safeTranslate(t, 'evaluations.pendingEvaluationsAlertPlural');
                  const verbText = pendingEvaluationsCount === 1
                    ? safeTranslate(t, 'evaluations.pendingEvaluationsAlertVerbSingular', { defaultValue: '' })
                    : safeTranslate(t, 'evaluations.pendingEvaluationsAlertVerbPlural', { defaultValue: '' });
                  let message = safeTranslate(t, 'evaluations.pendingEvaluationsAlert', {
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
          {trackingData.teams.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {safeTranslate(t, 'events.deliverablesTracking.noTeams')}
            </div>
          ) : trackingData.columns.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {safeTranslate(t, 'events.deliverablesTracking.noTasks')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 bg-background min-w-[200px]">
                    {safeTranslate(t, 'events.deliverablesTracking.team')}
                  </TableHead>
                  {phases.map(phase => {
                    const phaseColumns = columnsByPhase.get(phase.id) || [];
                    if (phaseColumns.length === 0) return null;
                    
                    return (
                      <TableHead
                        key={phase.id}
                        colSpan={phaseColumns.length}
                        className="text-center bg-muted/50"
                      >
                        <div className="font-semibold">{getMultilingualText(phase.name, currentLang)}</div>
                        <div className="text-xs text-muted-foreground font-normal mt-1">
                          {safeTranslate(t, 'events.deliverablesTracking.phase')}
                        </div>
                      </TableHead>
                    );
                  })}
                </TableRow>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 bg-background"></TableHead>
                  {trackingData.columns.map(column => (
                    <TableHead key={`${column.phaseId}-${column.taskId}`} className="text-center min-w-[120px]">
                      <div className="text-xs font-medium">{column.taskTitle}</div>
                      <div className="text-xs text-muted-foreground font-normal mt-1">
                        {safeTranslate(t, 'events.deliverablesTracking.task')}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {trackingData.teams.map(team => (
                  <TableRow key={team.id}>
                    <TableCell className="sticky left-0 z-10 bg-background font-medium">
                      {team.name}
                    </TableCell>
                    {trackingData.columns.map(column => {
                      const key = `${team.id}:${column.taskId}`;
                      const deliverable = deliverablesMap.get(key);
                      const submitted = deliverable?.submitted ?? false;
                      const submissionId = deliverable?.submissionId;
                      const attachmentUrl = deliverable?.attachmentUrl;
                      const content = deliverable?.content;
                      const hasFinalEvaluation = deliverable?.hasFinalEvaluation ?? false;

                      return (
                        <TableCell key={`${team.id}-${column.taskId}`} className="text-center">
                          {submitted ? (
                            <div className="flex flex-col items-center gap-2">
                              <div className="flex items-center gap-2">
                                <Check className="h-5 w-5 text-green-600" aria-hidden />
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                  {safeTranslate(t, 'events.deliverablesTracking.submitted')}
                                </Badge>
                              </div>
                              {isReviewer && (
                                <div className="flex flex-col gap-1">
                                  {!hasFinalEvaluation ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-auto text-xs"
                                      asChild
                                    >
                                      <Link
                                        to={tenantPath(`dashboard/events/${eventId}/tasks/${column.taskId}/submissions/${submissionId}/evaluate`)}
                                      >
                                        {safeTranslate(t, 'evaluations.evaluateButton', { defaultValue: 'Evaluar' })}
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
                                        to={tenantPath(`dashboard/events/${eventId}/tasks/${column.taskId}/submissions/${submissionId}/evaluate`)}
                                      >
                                        {safeTranslate(t, 'evaluations.viewEvaluationButton', { defaultValue: 'Ver evaluación' })}
                                      </Link>
                                    </Button>
                                  )}
                                </div>
                              )}
                              {(attachmentUrl || content) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-0 text-xs"
                                  asChild
                                >
                                  <Link
                                    to={tenantPath(`dashboard/events/${eventId}/tasks/${column.taskId}`)}
                                    target="_blank"
                                    className="flex items-center gap-1"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    {safeTranslate(t, 'events.deliverablesTracking.viewSubmission')}
                                  </Link>
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              <X className="h-5 w-5 text-red-600" aria-hidden />
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                                {safeTranslate(t, 'events.deliverablesTracking.notSubmitted')}
                              </Badge>
                            </div>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}


