import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useTenantPath } from '@/hooks/useTenantPath';

import { Spinner } from '@/components/common';
import { DashboardLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { getEvents, getEventDetail, type Event, type Task } from '@/services/events';
import { EventCard } from '@/components/events/EventCard';
import { useExpandableEventTasks } from '@/hooks/useExpandableEventTasks';

function ParticipantDashboardPage() {
  const { t } = useTranslation();
  const tenantPath = useTenantPath();
  const { data: events, isLoading } = useQuery<Event[]>({ queryKey: ['events'], queryFn: getEvents });
  const { expandedEventId, tasksByEvent, toggle, isExpanded } = useExpandableEventTasks(async (eventId: number) => {
    const detail = await getEventDetail(eventId);
    return { tasks: (detail.tasks ?? []) as Task[] };
  });

  const visibleEvents = useMemo(() => {
    if (!events) {
      return [];
    }

    const now = new Date();
    return events.filter(event => {
      if (!event.is_public) {
        return false;
      }

      const publishStart = event.publish_start_at ? new Date(event.publish_start_at) : null;
      const publishEnd = event.publish_end_at ? new Date(event.publish_end_at) : null;

      if (publishStart && publishStart > now) {
        return false;
      }

      if (publishEnd && publishEnd < now) {
        return false;
      }

      return true;
    });
  }, [events]);

  if (isLoading) {
    return <Spinner fullHeight />;
  }

  return (
    <DashboardLayout
      title={t('dashboard.participant')}
      subtitle={t('dashboard.participantActions')}
      actions={
        <Button asChild variant="outline">
          <Link to={tenantPath('dashboard/notifications')}>{t('notifications.title')}</Link>
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        {visibleEvents.map(event => {
          const tasks = tasksByEvent[event.id] ?? [];
          return (
            <EventCard
              key={event.id}
              event={event}
              to={tenantPath(`events/${event.id}`)}
              showStatus={false}
              actions={
                <>
                  <Button asChild>
                    <Link to={tenantPath(`dashboard/events/${event.id}/team`)}>{t('teams.title')}</Link>
                  </Button>
                  <Button variant="outline" onClick={() => toggle(event.id)}>
                    {isExpanded(event.id) ? t('submissions.list') : t('events.tasksTitle')}
                  </Button>
                </>
              }
            >
              {expandedEventId === event.id ? (
                <div className="space-y-2">
                  {tasks.length ? (
                    tasks.map(task => (
                      <div key={task.id} className="rounded-md border border-border/60 p-3">
                        <p className="font-medium">{task.title}</p>
                        <p className="text-xs text-muted-foreground">{task.description}</p>
                        <Button asChild size="sm" variant="secondary" className="mt-2">
                          <Link to={tenantPath(`dashboard/events/${event.id}/tasks/${task.id}`)}>
                            {t('submissions.register')}
                          </Link>
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">{t('events.noTasks')}</p>
                  )}
                </div>
              ) : null}
            </EventCard>
          );
        })}
        {visibleEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground md:col-span-2">{t('events.noPublicEvents')}</p>
        ) : null}
      </div>
    </DashboardLayout>
  );
}

export default ParticipantDashboardPage;

