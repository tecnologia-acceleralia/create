import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useTenantPath } from '@/hooks/useTenantPath';

import { PageHeader, Spinner } from '@/components/common';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getEvents, getEventDetail, type Event } from '@/services/events';

function MentorDashboardPage() {
  const { t } = useTranslation();
  const tenantPath = useTenantPath();
  const { data: events, isLoading } = useQuery<Event[]>({ queryKey: ['events'], queryFn: getEvents });
  const [expanded, setExpanded] = useState<number | null>(null);
  const [eventTasks, setEventTasks] = useState<Record<number, any[]>>({});

  const handleToggle = async (eventId: number) => {
    if (expanded === eventId) {
      setExpanded(null);
      return;
    }

    if (!eventTasks[eventId]) {
      const detail = await getEventDetail(eventId);
      setEventTasks(prev => ({ ...prev, [eventId]: detail.tasks ?? [] }));
    }
    setExpanded(eventId);
  };

  if (isLoading) {
    return <Spinner fullHeight />;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title={t('dashboard.mentor')} subtitle={t('dashboard.welcome')} />
      <div>
        <Button asChild variant="outline">
          <Link to={tenantPath('dashboard/notifications')}>{t('notifications.title')}</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {events?.map(event => (
          <Card key={event.id}>
            <CardHeader>
              <CardTitle>{event.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">{event.description}</p>
              <Button variant="outline" onClick={() => handleToggle(event.id)}>
                {expanded === event.id ? t('submissions.list') : t('events.tasksTitle')}
              </Button>
              {expanded === event.id ? (
                <div className="space-y-2">
                  {eventTasks[event.id]?.length ? eventTasks[event.id].map(task => (
                    <div key={task.id} className="rounded-md border border-border/60 p-3">
                      <p className="font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground">{task.description}</p>
                      <Button asChild size="sm" variant="secondary" className="mt-2">
                        <Link to={tenantPath(`dashboard/events/${event.id}/tasks/${task.id}`)}>{t('submissions.list')}</Link>
                      </Button>
                    </div>
                  )) : <p className="text-xs text-muted-foreground">{t('events.noTasks')}</p>}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default MentorDashboardPage;

