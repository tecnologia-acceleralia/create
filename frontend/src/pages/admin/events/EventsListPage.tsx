import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader, Spinner } from '@/components/common';
import { createEvent, getEvents, type Event } from '@/services/events';

const eventSchema = z.object({
  name: z.string().min(3),
  description: z.string().optional(),
  start_date: z.string(),
  end_date: z.string(),
  min_team_size: z.number().min(1),
  max_team_size: z.number().min(1)
});

type FormValues = z.infer<typeof eventSchema>;

function EventsListPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: events, isLoading } = useQuery<Event[]>({
    queryKey: ['events'],
    queryFn: getEvents
  });

  const { register, handleSubmit, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      min_team_size: 2,
      max_team_size: 6,
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
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
      max_team_size: Number(values.max_team_size)
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title={t('dashboard.tenantAdmin')} subtitle={t('events.title')} />

      <Card>
        <CardHeader>
          <CardTitle>{t('events.formTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="name">{t('events.name')}</label>
              <Input id="name" {...register('name')} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="description">{t('events.description')}</label>
              <Input id="description" {...register('description')} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="start_date">{t('events.start')}</label>
              <Input id="start_date" type="date" {...register('start_date')} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="end_date">{t('events.end')}</label>
              <Input id="end_date" type="date" {...register('end_date')} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="min_team_size">{t('events.minTeam')}</label>
              <Input id="min_team_size" type="number" min={1} {...register('min_team_size', { valueAsNumber: true })} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="max_team_size">{t('events.maxTeam')}</label>
              <Input id="max_team_size" type="number" min={1} {...register('max_team_size', { valueAsNumber: true })} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={createMutation.isLoading}>
                {createMutation.isLoading ? t('common.loading') : t('events.create')}
              </Button>
            </div>
            {formState.errors.name ? <p className="text-sm text-destructive">{formState.errors.name.message}</p> : null}
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <Spinner fullHeight />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {events?.map(event => (
            <Card key={event.id}>
              <CardHeader>
                <CardTitle>{event.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">{event.description}</p>
                <p>
                  {new Date(event.start_date).toLocaleDateString()} - {new Date(event.end_date).toLocaleDateString()}
                </p>
                <Button asChild variant="outline">
                  <Link to={`/dashboard/events/${event.id}`}>{t('events.manage')}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default EventsListPage;

