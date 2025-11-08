import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';

import { PageHeader, Spinner } from '@/components/common';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getEvents, getEventDetail, type Event } from '@/services/events';

function ParticipantDashboardPage() {
  const { t } = useTranslation();
  const { data: events, isLoading } = useQuery<Event[]>({ queryKey: ['events'], queryFn: getEvents });
  const [expandedEventId, setExpandedEventId] = useState<number | null>(null);
  const [eventTasks, setEventTasks] = useState<Record<number, any[]>>({});

  const handleToggleTasks = async (eventId: number) => {
    if (expandedEventId === eventId) {
      setExpandedEventId(null);
      return;
    }

    if (!eventTasks[eventId]) {
      const detail = await getEventDetail(eventId);
      const tasks = detail.tasks ?? [];
      setEventTasks(prev => ({ ...prev, [eventId]: tasks }));
    }
    setExpandedEventId(eventId);
  };

  if (isLoading) {
    return <Spinner fullHeight />;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title={t('dashboard.participant')} subtitle={t('dashboard.participantActions')} />
      <div>
        <Button asChild variant="outline">
          <Link to="/dashboard/notifications">{t('notifications.title')}</Link>
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
              <Button asChild>
                <Link to={`/dashboard/events/${event.id}/team`}>{t('teams.title')}</Link>
              </Button>
              <Button variant="outline" onClick={() => handleToggleTasks(event.id)}>
                {expandedEventId === event.id ? t('submissions.list') : t('events.tasksTitle')}
              </Button>

              {expandedEventId === event.id ? (
                <div className="space-y-2">
                  {eventTasks[event.id]?.length ? eventTasks[event.id].map(task => (
                    <div key={task.id} className="rounded-md border border-border/60 p-3">
                      <p className="font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground">{task.description}</p>
                      <Button asChild size="sm" variant="secondary" className="mt-2">
                        <Link to={`/dashboard/events/${event.id}/tasks/${task.id}`}>{t('submissions.register')}</Link>
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

export default ParticipantDashboardPage;

