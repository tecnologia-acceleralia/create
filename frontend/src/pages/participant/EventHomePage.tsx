import { useParams, useSearchParams, Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Calendar, FileText } from 'lucide-react';

import { DashboardLayout } from '@/components/layout';
import { Spinner } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getEventDetail } from '@/services/events';
import { useTenantPath } from '@/hooks/useTenantPath';
import { useTenant } from '@/context/TenantContext';
import { EventDescriptionTab } from '@/components/events/EventDescriptionTab';
import { EventTimelineTab } from '@/components/events/EventTimelineTab';

function EventHomePage() {
  const { eventId } = useParams();
  const numericId = Number(eventId);
  const { t } = useTranslation();
  const tenantPath = useTenantPath();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'description';

  const { data: eventDetail, isLoading } = useQuery({
    queryKey: ['events', numericId],
    queryFn: () => getEventDetail(numericId),
    enabled: Number.isInteger(numericId)
  });

  if (isNaN(numericId) || isLoading) {
    return <Spinner fullHeight />;
  }

  if (!eventDetail) {
    return (
      <DashboardLayout title={t('events.title')} subtitle={t('common.error')}>
        <div className="rounded-2xl border border-border/70 bg-card/80 p-6 text-sm">
          <p className="text-destructive">{t('common.error')}</p>
          <Button asChild variant="outline" className="mt-4">
            <Link to={tenantPath('dashboard')}>{t('navigation.dashboard')}</Link>
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

  return (
    <DashboardLayout title={eventDetail.name} subtitle={eventDetail.description ?? ''}>
      <div className="space-y-6">
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
            {t('events.description')}
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
            {t('events.timeline')}
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

