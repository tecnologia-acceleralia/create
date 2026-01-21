import { useParams, useSearchParams, Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Calendar, FileText, ArrowRight, ClipboardList } from 'lucide-react';
import { useMemo } from 'react';

import { DashboardLayout } from '@/components/layout';
import { Spinner } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { safeTranslate } from '@/utils/i18n-helpers';
import { getMultilingualText } from '@/utils/multilingual';
import { getEventDetail } from '@/services/events';
import { useTenantPath } from '@/hooks/useTenantPath';
import { EventDescriptionTab } from '@/components/events/EventDescriptionTab';
import { EventTimelineTab } from '@/components/events/EventTimelineTab';

function EventHomePage() {
  const { eventId } = useParams();
  const numericId = Number(eventId);
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language?.split('-')[0] || 'es') as 'es' | 'ca' | 'en';
  const tenantPath = useTenantPath();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'description';

  const { data: eventDetail, isLoading } = useQuery({
    queryKey: ['events', numericId, currentLang],
    queryFn: () => getEventDetail(numericId),
    enabled: Number.isInteger(numericId)
  });

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

  const handleTabChange = (newTab: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', newTab);
    setSearchParams(newParams, { replace: true });
  };

  const eventName = getMultilingualText(eventDetail.name, currentLang);
  const eventDescription = eventDetail.description ? getMultilingualText(eventDetail.description, currentLang) : '';

  // Buscar la tarea de inscripción en la fase 0
  const registrationTask = useMemo(() => {
    if (!eventDetail?.phases || !eventDetail?.tasks) {
      return null;
    }

    // Buscar la fase 0
    const phaseZero = eventDetail.phases.find(phase => {
      const phaseName = getMultilingualText(phase.name, currentLang).toLowerCase();
      return phase.order_index === 0 || phaseName.includes('fase 0') || phaseName.includes('phase 0');
    });

    if (!phaseZero) {
      return null;
    }

    // Buscar la tarea de inscripción en la fase 0
    const task = eventDetail.tasks.find(t => {
      if (t.phase_id !== phaseZero.id) {
        return false;
      }
      const taskTitle = getMultilingualText(t.title, currentLang).toLowerCase();
      return (
        taskTitle.includes('inscripción') ||
        taskTitle.includes('inscription') ||
        taskTitle.includes('descripción de la idea') ||
        taskTitle.includes('description of the idea') ||
        taskTitle.includes('descripció de la idea')
      );
    });

    return task || null;
  }, [eventDetail, currentLang]);

  return (
    <DashboardLayout title={eventName} subtitle={eventDescription}>
      <div className="space-y-6">
        {/* Card destacado para la tarea de inscripción */}
        {registrationTask && (
          <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 rounded-full bg-primary/10 p-3">
                  <ClipboardList className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    {getMultilingualText(registrationTask.title, currentLang)}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {safeTranslate(t, 'events.registrationTaskDescription')}
                  </p>
                  <Button asChild className="gap-2">
                    <Link to={tenantPath(`dashboard/events/${numericId}/tasks/${registrationTask.id}`)}>
                      {safeTranslate(t, 'events.goToRegistrationTask')}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs Navigation */}
        <div className="flex gap-2 border-b border-border/70">
          <button
            type="button"
            onClick={() => handleTabChange('description')}
            className={`
              flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors
              ${
                tab === 'description'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }
            `}
          >
            <FileText className="h-4 w-4" />
            {safeTranslate(t, 'events.description')}
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('timeline')}
            className={`
              flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors
              ${
                tab === 'timeline'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }
            `}
          >
            <Calendar className="h-4 w-4" />
            {safeTranslate(t, 'events.timeline')}
          </button>
        </div>

        {/* Tab Content */}
        <Card>
          <CardContent className="p-6">
            {tab === 'description' ? (
              <EventDescriptionTab event={eventDetail} />
            ) : (
              <EventTimelineTab event={eventDetail} />
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default EventHomePage;

