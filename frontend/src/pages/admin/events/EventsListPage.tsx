import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { DashboardLayout } from '@/components/layout';
import { FormField, FormGrid } from '@/components/form';
import { ResourceListCard } from '@/components/cards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/common';
import { EventCard } from '@/components/events/EventCard';
import { createEvent, getEvents, type Event } from '@/services/events';
import { useTenantPath } from '@/hooks/useTenantPath';

const eventSchema = z
  .object({
    name: z.string().min(3),
    description: z.string().optional(),
    start_date: z.string(),
    end_date: z.string(),
    min_team_size: z.number().min(1),
    max_team_size: z.number().min(1),
    video_url: z
      .union([z.string().url({ message: 'events.invalidVideo' }), z.literal('')])
      .optional()
      .transform(value => (value ? value : undefined)),
    is_public: z.boolean().optional(),
    publish_start_at: z.string().optional(),
    publish_end_at: z.string().optional()
  })
  .superRefine((values, ctx) => {
    if (values.publish_start_at && values.publish_end_at) {
      const start = new Date(values.publish_start_at);
      const end = new Date(values.publish_end_at);
      if (start > end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'events.publishEndAfterStart',
          path: ['publish_end_at']
        });
      }
    }

    if (values.is_public && (!values.publish_start_at || !values.publish_end_at)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'events.publishDatesRequired',
        path: ['publish_start_at']
      });
    }
  });

type FormValues = z.infer<typeof eventSchema>;

function EventsListPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const tenantPath = useTenantPath();

  const { data: events, isLoading } = useQuery<Event[]>({
    queryKey: ['events'],
    queryFn: getEvents
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      min_team_size: 2,
      max_team_size: 6,
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      is_public: false
    }
  });

  const createMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      toast.success(t('events.created'));
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      reset();
    },
    onError: () => toast.error(t('common.error'))
  });

  const onSubmit = (values: FormValues) => {
    createMutation.mutate({
      ...values,
      min_team_size: Number(values.min_team_size),
      max_team_size: Number(values.max_team_size),
      video_url: values.video_url || undefined,
      publish_start_at: values.publish_start_at || undefined,
      publish_end_at: values.publish_end_at || undefined
    });
  };

  const translateError = (message?: string) => (message ? t(message, { defaultValue: message }) : undefined);

  return (
    <DashboardLayout title={t('dashboard.tenantAdmin')} subtitle={t('events.title')}>
      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>{t('events.formTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormGrid columns={2}>
              <FormField
                label={t('events.name')}
                htmlFor="name"
                required
                error={translateError(errors.name?.message)}
              >
                <Input id="name" {...register('name')} />
              </FormField>
              <FormField label={t('events.description')} htmlFor="description">
                <Input id="description" {...register('description')} />
              </FormField>
              <FormField label={t('events.start')} htmlFor="start_date">
                <Input id="start_date" type="date" {...register('start_date')} />
              </FormField>
              <FormField label={t('events.end')} htmlFor="end_date">
                <Input id="end_date" type="date" {...register('end_date')} />
              </FormField>
              <FormField
                label={t('events.minTeam')}
                htmlFor="min_team_size"
                error={translateError(errors.min_team_size?.message)}
              >
                <Input
                  id="min_team_size"
                  type="number"
                  min={1}
                  {...register('min_team_size', { valueAsNumber: true })}
                />
              </FormField>
              <FormField
                label={t('events.maxTeam')}
                htmlFor="max_team_size"
                error={translateError(errors.max_team_size?.message)}
              >
                <Input
                  id="max_team_size"
                  type="number"
                  min={1}
                  {...register('max_team_size', { valueAsNumber: true })}
                />
              </FormField>
              <FormField
                label={t('events.videoUrl')}
                htmlFor="video_url"
                error={translateError(errors.video_url?.message)}
              >
                <Input
                  id="video_url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  {...register('video_url')}
                />
              </FormField>
              <div className="flex items-center gap-2">
                <input id="is_public" type="checkbox" className="h-4 w-4" {...register('is_public')} />
                <label className="text-sm font-medium" htmlFor="is_public">
                  {t('events.isPublic')}
                </label>
              </div>
              <FormField
                label={t('events.publishStart')}
                htmlFor="publish_start_at"
                error={translateError(errors.publish_start_at?.message)}
              >
                <Input id="publish_start_at" type="date" {...register('publish_start_at')} />
              </FormField>
              <FormField
                label={t('events.publishEnd')}
                htmlFor="publish_end_at"
                error={translateError(errors.publish_end_at?.message)}
              >
                <Input id="publish_end_at" type="date" {...register('publish_end_at')} />
              </FormField>
            </FormGrid>
            <Button type="submit" disabled={createMutation.isLoading}>
              {createMutation.isLoading ? t('common.loading') : t('events.create')}
            </Button>
          </form>
        </CardContent>
      </Card>

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
          emptyMessage={<p className="text-sm text-muted-foreground">{t('events.empty')}</p>}
          contentClassName="grid gap-4 md:grid-cols-2"
        />
      )}
    </DashboardLayout>
  );
}

export default EventsListPage;
