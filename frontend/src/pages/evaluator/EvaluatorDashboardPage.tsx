import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useTenantPath } from '@/hooks/useTenantPath';

import { Spinner } from '@/components/common';
import { DashboardLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { getEvents, type Event } from '@/services/events';
import { EventCard } from '@/components/events/EventCard';

function EvaluatorDashboardPage() {
  const { t } = useTranslation();
  const tenantPath = useTenantPath();
  const { data: events, isLoading } = useQuery<Event[]>({ queryKey: ['events'], queryFn: getEvents });

  if (isLoading) {
    return <Spinner fullHeight />;
  }

  return (
    <DashboardLayout title={t('dashboard.evaluator')} subtitle={t('dashboard.welcome')}>
      <div className="grid gap-4 md:grid-cols-2">
        {events?.map(event => {
          return (
            <EventCard
              key={event.id}
              event={event}
              to={tenantPath(`events/${event.id}`)}
              showStatus={false}
              actions={
                <Button asChild>
                  <Link to={tenantPath(`dashboard/tracking/deliverables?eventId=${event.id}`)}>
                    {t('events.tracking.title')}
                  </Link>
                </Button>
              }
            />
          );
        })}
      </div>
    </DashboardLayout>
  );
}

export default EvaluatorDashboardPage;

