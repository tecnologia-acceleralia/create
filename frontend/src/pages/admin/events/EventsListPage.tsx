import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { DashboardLayout } from '@/components/layout';
import { ResourceListCard } from '@/components/cards';
import { Button } from '@/components/ui/button';
import { EventCreateModal } from '@/components/events/modals';
import { Spinner, EmptyState } from '@/components/common';
import { EventCard } from '@/components/events/EventCard';
import { createEvent, getEvents, type Event } from '@/services/events';
import { useTenantPath } from '@/hooks/useTenantPath';
import { eventSchema, EventForm, type EventFormValues } from '@/components/events/forms';

function EventsListPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const tenantPath = useTenantPath();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: events, isLoading } = useQuery<Event[]>({
    queryKey: ['events'],
    queryFn: getEvents
  });

  const eventForm = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      min_team_size: 2,
      max_team_size: 6,
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: 'draft',
      is_public: false,
      allow_open_registration: true,
      registration_schema: null
    }
  });

  const createMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      toast.success(t('events.created'));
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      eventForm.reset();
      setIsDialogOpen(false);
    },
    onError: () => toast.error(t('common.error'))
  });

  const onSubmit = (values: EventFormValues) => {
    createMutation.mutate({
      ...values,
      min_team_size: Number(values.min_team_size),
      max_team_size: Number(values.max_team_size),
      video_url: values.video_url || undefined,
      is_public: Boolean(values.is_public),
      allow_open_registration: Boolean(values.allow_open_registration),
      publish_start_at: values.publish_start_at || undefined,
      publish_end_at: values.publish_end_at || undefined,
      registration_schema: values.registration_schema || undefined
    });
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    eventForm.reset();
  };

  return (
    <DashboardLayout
      title={t('dashboard.tenantAdmin')}
      subtitle={t('events.title')}
      actions={
        <Button onClick={() => setIsDialogOpen(true)}>
          {t('events.create')}
        </Button>
      }
    >
      <EventCreateModal
        open={isDialogOpen}
        onOpenChange={openState => (!openState ? handleCloseDialog() : null)}
        form={eventForm}
        onSubmit={onSubmit}
        isSubmitting={createMutation.isPending}
      />

      {isLoading ? (
        <Spinner fullHeight />
      ) : (
        <ResourceListCard
          title={t('events.title')}
          items={events ?? []}
          renderItem={event => (
            <EventCard
              key={event.id}
              event={event}
              to={tenantPath(`events/${event.id}`)}
              showStatus={false}
              actions={
                <Button asChild variant="outline">
                  <Link to={tenantPath(`dashboard/events/${event.id}`)}>{t('events.manage')}</Link>
                </Button>
              }
            />
          )}
          emptyMessage={<EmptyState message={t('events.empty')} />}
          contentClassName="grid gap-4 md:grid-cols-2"
        />
      )}
    </DashboardLayout>
  );
}

export default EventsListPage;
