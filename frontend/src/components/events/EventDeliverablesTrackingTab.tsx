import { useMemo } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Download } from 'lucide-react';

import { Spinner } from '@/components/common';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTenantPath } from '@/hooks/useTenantPath';
import { getEventDeliverablesTracking, type EventDeliverablesTracking } from '@/services/events';
import { arrayToCSV, downloadCSV } from '@/utils/csv';

function EventDeliverablesTrackingTab({ eventId }: { eventId: number }) {
  const { t } = useTranslation();
  const tenantPath = useTenantPath();

  const { data: trackingData, isLoading, isError } = useQuery<EventDeliverablesTracking>({
    queryKey: ['events', eventId, 'deliverables-tracking'],
    queryFn: () => getEventDeliverablesTracking(eventId),
    enabled: Number.isInteger(eventId)
  });

  // Agrupar columnas por fase y ordenar tareas por order_index
  const columnsByPhase = useMemo(() => {
    if (!trackingData) return new Map();

    const grouped = new Map<number, Array<{ phaseId: number; phaseName: string; taskId: number; taskTitle: string; orderIndex: number }>>();
    
    trackingData.columns.forEach(column => {
      if (!grouped.has(column.phaseId)) {
        grouped.set(column.phaseId, []);
      }
      grouped.get(column.phaseId)!.push({
        ...column,
        orderIndex: column.orderIndex ?? 0
      });
    });

    // Ordenar tareas por order_index dentro de cada fase
    grouped.forEach((tasks) => {
      tasks.sort((a, b) => a.orderIndex - b.orderIndex);
    });

    return grouped;
  }, [trackingData]);

  // Crear un mapa de entregables por equipo y tarea para acceso rápido
  const deliverablesMap = useMemo(() => {
    if (!trackingData) return new Map();

    const map = new Map<string, { submitted: boolean; submissionId: number | null; attachmentUrl: string | null; content: string | null }>();
    
    trackingData.teams.forEach(team => {
      team.deliverables.forEach(deliverable => {
        const key = `${team.id}:${deliverable.taskId}`;
        map.set(key, {
          submitted: deliverable.submitted,
          submissionId: deliverable.submissionId,
          attachmentUrl: deliverable.attachmentUrl,
          content: deliverable.content
        });
      });
    });

    return map;
  }, [trackingData]);

  // Ordenar equipos por nombre
  const sortedTeams = useMemo(() => {
    if (!trackingData) return [];
    return [...trackingData.teams].sort((a, b) => a.name.localeCompare(b.name));
  }, [trackingData]);

  // Ordenar columnas por fase y order_index de tareas
  const sortedColumns = useMemo(() => {
    if (!trackingData) return [];
    const phases = trackingData.phases.sort((a, b) => a.orderIndex - b.orderIndex);
    const sorted: typeof trackingData.columns = [];
    
    phases.forEach(phase => {
      const phaseColumns = columnsByPhase.get(phase.id) || [];
      sorted.push(...phaseColumns);
    });
    
    return sorted;
  }, [trackingData, columnsByPhase]);

  if (isLoading) {
    return <Spinner fullHeight />;
  }

  if (isError || !trackingData) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-destructive">
          {t('events.deliverablesTracking.error')}
        </CardContent>
      </Card>
    );
  }

  const phases = trackingData.phases.sort((a, b) => a.orderIndex - b.orderIndex);

  // Función para exportar entregables a CSV
  const exportDeliverablesToCSV = () => {
    if (!trackingData || sortedTeams.length === 0 || sortedColumns.length === 0) return;

    // Crear headers: Equipo + todas las tareas
    const teamHeader = t('events.deliverablesTracking.team');
    const taskHeaders = sortedColumns.map(col => `${col.phaseName} - ${col.taskTitle}`);
    const headers = [teamHeader, ...taskHeaders];

    // Crear filas de datos
    const csvData = sortedTeams
      .filter(team => team.name) // Filtrar equipos sin nombre
      .map(team => {
        const row: Record<string, string> = {
          [teamHeader]: team.name || ''
        };

        sortedColumns.forEach((column, index) => {
          const key = `${team.id}:${column.taskId}`;
          const deliverable = deliverablesMap.get(key);
          const submitted = deliverable?.submitted ?? false;
          const columnKey = taskHeaders[index];
          row[columnKey] = submitted 
            ? t('events.deliverablesTracking.submitted')
            : t('events.deliverablesTracking.notSubmitted');
        });

        return row;
      });

    if (csvData.length === 0) return;

    const csv = arrayToCSV(csvData, headers);
    downloadCSV(csv, `entregables-evento-${eventId}`);
  };

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t('events.deliverablesTracking.subtitle')}</CardTitle>
        <Button variant="outline" size="sm" onClick={exportDeliverablesToCSV}>
          <Download className="h-4 w-4 mr-2" />
          {t('common.export', { defaultValue: 'Exportar CSV' })}
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {sortedTeams.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {t('events.deliverablesTracking.noTeams')}
          </div>
        ) : sortedColumns.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {t('events.deliverablesTracking.noTasks')}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-background w-[200px]">
                  {t('events.deliverablesTracking.team')}
                </TableHead>
                {phases.map(phase => {
                  const phaseColumns = columnsByPhase.get(phase.id) || [];
                  if (phaseColumns.length === 0) return null;
                  
                  return (
                    <TableHead
                      key={phase.id}
                      colSpan={phaseColumns.length}
                      className="text-left bg-muted/50 w-[150px]"
                    >
                      <div className="font-semibold">{phase.name}</div>
                    </TableHead>
                  );
                })}
              </TableRow>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-background"></TableHead>
                {sortedColumns.map(column => (
                  <TableHead key={`${column.phaseId}-${column.taskId}`} className="text-center w-[150px]">
                    <div className="text-xs font-medium">{column.taskTitle}</div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTeams.map(team => (
                <TableRow key={team.id}>
                  <TableCell className="sticky left-0 z-10 bg-background font-medium w-[200px]">
                    {team.name}
                  </TableCell>
                  {sortedColumns.map(column => {
                    const key = `${team.id}:${column.taskId}`;
                    const deliverable = deliverablesMap.get(key);
                    const submitted = deliverable?.submitted ?? false;
                    const attachmentUrl = deliverable?.attachmentUrl;
                    const content = deliverable?.content;

                    return (
                      <TableCell key={`${team.id}-${column.taskId}`} className="text-center w-[150px]">
                        {submitted ? (
                          <div className="flex flex-col items-center gap-2">
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                              {t('events.deliverablesTracking.submitted')}
                            </Badge>
                            {(attachmentUrl || content) && (
                              <Button
                                variant="link"
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
                                  {t('events.deliverablesTracking.viewSubmission')}
                                </Link>
                              </Button>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                            {t('events.deliverablesTracking.notSubmitted')}
                          </Badge>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default EventDeliverablesTrackingTab;
