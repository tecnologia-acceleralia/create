import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useTenantPath } from '@/hooks/useTenantPath';

import { Spinner, EmptyState } from '@/components/common';
import { DashboardLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getEvents, type Event } from '@/services/events';
import { EventCard } from '@/components/events/EventCard';

function ParticipantDashboardPage() {
  const { t } = useTranslation();
  const tenantPath = useTenantPath();
  const { data: events, isLoading } = useQuery<Event[]>({ queryKey: ['events'], queryFn: getEvents });

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

  if (isLoading) {
    return <Spinner fullHeight />;
  }

  return (
    <DashboardLayout
      title={t('dashboard.participant')}
      subtitle={t('dashboard.participantActions')}
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
                            <>
                              <Button asChild>
                                <Link to={tenantPath(`dashboard/events/${event.id}/team`)}>{t('teams.title')}</Link>
                              </Button>
                              <Button asChild variant="outline">
                                <Link to={tenantPath(`dashboard/events/${event.id}/view`)}>{t('auth.submit')}</Link>
                              </Button>
                            </>
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
                              <Button asChild variant="outline">
                                <Link to={tenantPath(`dashboard/events/${event.id}/view`)}>{t('auth.submit')}</Link>
                              </Button>
                            </>
                          )}
                        </>
                      }
                    />
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

