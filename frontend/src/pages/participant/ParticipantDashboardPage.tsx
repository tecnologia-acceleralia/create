import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { Spinner, EmptyState } from '@/components/common';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardEventCard } from '@/components/ui/dashboard';
import { getEvents, type Event } from '@/services/events';

function ParticipantDashboardPage() {
  const { t } = useTranslation();
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
                {registeredEvents.map(event => (
                  <DashboardEventCard key={event.id} event={event} />
                ))}
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
                  <DashboardEventCard key={event.id} event={event} />
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

