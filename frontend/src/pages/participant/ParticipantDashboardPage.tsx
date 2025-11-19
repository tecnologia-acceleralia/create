import { useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { useTenantPath } from '@/hooks/useTenantPath';

import { Spinner, EmptyState } from '@/components/common';
import { DashboardLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getEvents, getEventDetail, type Event, type Task } from '@/services/events';
import { EventCard } from '@/components/events/EventCard';
import { useExpandableEventTasks } from '@/hooks/useExpandableEventTasks';

function ParticipantDashboardPage() {
  const { t } = useTranslation();
  const tenantPath = useTenantPath();
  const navigate = useNavigate();
  const { data: events, isLoading } = useQuery<Event[]>({ queryKey: ['events'], queryFn: getEvents });
  const { expandedEventId, tasksByEvent, toggle, isExpanded } = useExpandableEventTasks(async (eventId: number) => {
    const detail = await getEventDetail(eventId);
    return { tasks: (detail.tasks ?? []) as Task[] };
  });

  const { registeredEvents, tenantEvents } = useMemo(() => {
    if (!events) {
      return { registeredEvents: [] as Event[], tenantEvents: [] as Event[] };
    }

    const registered = events.filter(event => Boolean(event.is_registered));

    return {
      registeredEvents: registered,
      tenantEvents: events
    };
  }, [events]);

  // Redirigir automáticamente si solo hay un evento registrado
  useEffect(() => {
    if (!isLoading && registeredEvents.length === 1) {
      const event = registeredEvents[0];
      navigate(tenantPath(`dashboard/events/${event.id}/home`), { replace: true });
    }
  }, [isLoading, registeredEvents, navigate, tenantPath]);

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
      <div className="grid gap-8 md:grid-cols-2 md:items-start">
        <section aria-label={t('dashboard.registeredEvents')} className="flex flex-col">
          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle>{t('dashboard.registeredEvents')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {registeredEvents.map(event => {
                  const tasks = tasksByEvent[event.id] ?? [];
                  const hasTeam = Boolean(event.has_team);
                  return (
                    <EventCard
                      key={event.id}
                      event={event}
                      to={tenantPath(`dashboard/events/${event.id}/view`)}
                      showStatus={false}
                      actions={
                        <>
                          {hasTeam ? (
                            <Button asChild>
                              <Link to={tenantPath(`dashboard/events/${event.id}/team`)}>{t('teams.title')}</Link>
                            </Button>
                          ) : (
                            <>
                              <Button asChild variant="outline">
                                <Link to={tenantPath(`dashboard/events/${event.id}/projects`)}>
                                  {t('projects.title')}
                                </Link>
                              </Button>
                              <Button asChild>
                                <Link to={tenantPath(`dashboard/events/${event.id}/projects#create`)}>
                                  {t('projects.create')}
                                </Link>
                              </Button>
                            </>
                          )}
                          {hasTeam && (
                            <Button variant="outline" onClick={() => void toggle(event.id)}>
                              {isExpanded(event.id) ? t('submissions.list') : t('events.tasksTitle')}
                            </Button>
                          )}
                        </>
                      }
                    >
                      {expandedEventId === event.id && hasTeam ? (
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
                {registeredEvents.length === 0 ? (
                  <EmptyState message={t('events.noRegisteredEvents')} />
                ) : null}
              </div>
            </CardContent>
          </Card>
        </section>

        <section aria-label={t('dashboard.tenantEvents')} className="flex flex-col">
          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle>{t('dashboard.tenantEvents')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {tenantEvents.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    to={tenantPath(`events/${event.id}`)}
                    showStatus={false}
                    actions={
                      <Button asChild variant="outline">
                        <Link to={tenantPath(`events/${event.id}`)}>{t('events.viewDetails')}</Link>
                      </Button>
                    }
                  />
                ))}
                {tenantEvents.length === 0 ? (
                  <EmptyState message={t('events.empty')} />
                ) : null}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </DashboardLayout>
  );
}

export default ParticipantDashboardPage;

