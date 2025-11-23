import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Trash2, ArrowLeft } from 'lucide-react';

import { DashboardLayout } from '@/components/layout';
import { ResourceListCard } from '@/components/cards';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { EventCreateModal } from '@/components/events/modals';
import { Spinner, EmptyState } from '@/components/common';
import { EventCard } from '@/components/events/EventCard';
import { safeTranslate } from '@/utils/i18n-helpers';
import { createEvent, getEvents, cloneEvent, archiveEvent, type Event } from '@/services/events';
import { useTenantPath } from '@/hooks/useTenantPath';
import { eventSchema, type EventFormValues } from '@/components/events/forms';
import { getMultilingualText } from '@/utils/multilingual';

function EventsListPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const tenantPath = useTenantPath();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const locale = i18n.language?.toLowerCase() ?? 'es';
  const currentLang = (locale.split('-')[0] || 'es') as 'es' | 'ca' | 'en';

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
      toast.success(safeTranslate(t, 'events.created'));
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      eventForm.reset();
      setIsDialogOpen(false);
    },
    onError: () => toast.error(safeTranslate(t, 'common.error'))
  });

  const cloneMutation = useMutation({
    mutationFn: cloneEvent,
    onSuccess: () => {
      toast.success(safeTranslate(t, 'events.cloned'));
      void queryClient.invalidateQueries({ queryKey: ['events'] });
    },
    onError: () => toast.error(safeTranslate(t, 'common.error'))
  });

  const deleteMutation = useMutation({
    mutationFn: archiveEvent,
    onSuccess: () => {
      toast.success(safeTranslate(t, 'events.deleted'));
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      setEventToDelete(null);
    },
    onError: () => {
      toast.error(safeTranslate(t, 'common.error'));
      setEventToDelete(null);
    }
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

  const handleDeleteClick = (event: Event) => {
    setEventToDelete(event);
  };

  const handleDeleteConfirm = () => {
    if (eventToDelete) {
      deleteMutation.mutate(eventToDelete.id);
    }
  };

  return (
    <DashboardLayout
      title={safeTranslate(t, 'dashboard.tenantAdmin')}
      subtitle={safeTranslate(t, 'events.title')}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={tenantPath('dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" aria-hidden />
              {safeTranslate(t, 'dashboard.backToDashboard')}
            </Link>
          </Button>
          <Button onClick={() => setIsDialogOpen(true)}>
            {safeTranslate(t, 'events.create')}
          </Button>
        </div>
      }
    >
      <EventCreateModal
        open={isDialogOpen}
        onOpenChange={openState => (!openState ? handleCloseDialog() : null)}
        form={eventForm}
        onSubmit={onSubmit}
        isSubmitting={createMutation.isPending}
      />

      <AlertDialog open={eventToDelete !== null} onOpenChange={open => (!open ? setEventToDelete(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{safeTranslate(t, 'events.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {eventToDelete
                ? safeTranslate(t, 'events.deleteConfirmDescription', {
                    name: getMultilingualText(eventToDelete.name, currentLang)
                  })
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{safeTranslate(t, 'common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending
                ? safeTranslate(t, 'common.processing')
                : safeTranslate(t, 'events.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isLoading ? (
        <Spinner fullHeight />
      ) : (
        <ResourceListCard
          title={safeTranslate(t, 'events.title')}
          items={events ?? []}
          renderItem={event => (
            <EventCard
              key={event.id}
              event={event}
              to={tenantPath(`events/${event.id}`)}
              showStatus={false}
              actions={
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => cloneMutation.mutate(event.id)}
                    disabled={cloneMutation.isPending}
                  >
                    {safeTranslate(t, 'events.clone')}
                  </Button>
                  <Button asChild variant="outline">
                    <Link to={tenantPath(`dashboard/events/${event.id}`)}>{safeTranslate(t, 'events.manage')}</Link>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleDeleteClick(event)}
                    disabled={deleteMutation.isPending}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4 mr-2" aria-hidden />
                    {safeTranslate(t, 'events.delete')}
                  </Button>
                </div>
              }
            />
          )}
          emptyMessage={<EmptyState message={safeTranslate(t, 'events.empty')} />}
          contentClassName="grid gap-4 md:grid-cols-2"
        />
      )}
    </DashboardLayout>
  );
}

export default EventsListPage;
