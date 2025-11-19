import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Calendar, Users, FolderKanban, FileText, ClipboardCheck, UserPlus, Archive, Info } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Spinner, ErrorDisplay } from '@/components/common';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { useTenantPath } from '@/hooks/useTenantPath';
import { getTenantOverview, type TenantOverview } from '@/services/tenants';
import { getEvents, createEvent, type Event } from '@/services/events';
import { getPublicBranding } from '@/services/public';
import { eventSchema, type EventFormValues } from '@/components/events/forms';
import { EventCreateModal } from '@/components/events/modals';
import { formatDateTime } from '@/utils/date';

type StatsCardProps = {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  onClick?: () => void;
  secondaryLabel?: string;
  secondaryValue?: number | string;
  tooltip?: string;
};

function StatsCard({ label, value, icon, onClick, secondaryLabel, secondaryValue, tooltip }: StatsCardProps) {
  return (
    <Card
      className={`border-border/70 shadow-sm transition-shadow ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>{icon}</span>
            <span className="text-sm font-medium text-foreground">{label}</span>
            {tooltip && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">{value}</span>
          {secondaryLabel && secondaryValue !== undefined && (
            <span className="text-sm text-muted-foreground">
              {secondaryLabel}: {secondaryValue}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AdminDashboardPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { tenantSlug } = useTenant();
  const tenantPath = useTenantPath();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const locale = i18n.language ?? 'es';

  const overviewQuery = useQuery<TenantOverview>({
    queryKey: ['tenant', 'overview'],
    queryFn: getTenantOverview,
    refetchOnWindowFocus: false
  });

  const eventsQuery = useQuery<Event[]>({
    queryKey: ['events'],
    queryFn: getEvents,
    refetchOnWindowFocus: false
  });

  const tenantBrandingQuery = useQuery({
    queryKey: ['tenant', 'branding', tenantSlug],
    queryFn: () => tenantSlug ? getPublicBranding(tenantSlug) : null,
    enabled: Boolean(tenantSlug),
    refetchOnWindowFocus: false
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
      void queryClient.invalidateQueries({ queryKey: ['tenant', 'overview'] });
      eventForm.reset();
      setIsCreateModalOpen(false);
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
    setIsCreateModalOpen(false);
    eventForm.reset();
  };

  // Obtener eventos (siempre ejecutar este hook antes de los returns tempranos)
  const allEvents = eventsQuery.data ?? [];

  // Clasificar eventos por estado temporal (siempre ejecutar este hook antes de los returns tempranos)
  const { allEventsList, pastEvents, currentEvents, futureEvents } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const past: Event[] = [];
    const current: Event[] = [];
    const future: Event[] = [];

    allEvents.forEach(event => {
      const startDate = new Date(event.start_date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(event.end_date);
      endDate.setHours(23, 59, 59, 999);

      if (endDate < now) {
        past.push(event);
      } else if (startDate <= now && endDate >= now) {
        current.push(event);
      } else if (startDate > now) {
        future.push(event);
      }
    });

    return {
      allEventsList: allEvents,
      pastEvents: past.sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime()),
      currentEvents: current.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()),
      futureEvents: future.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
    };
  }, [allEvents]);

  // Obtener nombre del tenant para el subtítulo (siempre ejecutar antes de los returns tempranos)
  const tenantName = tenantBrandingQuery.data?.data?.name || tenantSlug || '';

  if (overviewQuery.isLoading) {
    return (
      <DashboardLayout title={t('dashboard.tenantAdmin')} subtitle={tenantName}>
        <Spinner fullHeight />
      </DashboardLayout>
    );
  }

  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <DashboardLayout title={t('dashboard.tenantAdmin')} subtitle={tenantName}>
        <ErrorDisplay
          message={t('dashboard.overview.error')}
          onRetry={() => overviewQuery.refetch()}
        />
      </DashboardLayout>
    );
  }

  const { statistics } = overviewQuery.data;

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'published':
        return 'default';
      case 'draft':
        return 'secondary';
      case 'archived':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const renderEventList = (events: Event[]) => {
    if (events.length === 0) {
      return <p className="text-sm text-muted-foreground">{t('dashboard.noEvents')}</p>;
    }

    return (
      <div className="space-y-3">
        {events.map(event => (
          <div
            key={event.id}
            className="flex flex-col rounded-lg border p-3 hover:bg-accent/50 transition-colors cursor-pointer"
            onClick={() => navigate(tenantPath(`dashboard/events/${event.id}`))}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium">{event.name}</span>
              <Badge variant={getStatusBadgeVariant(event.status)}>
                {t(`events.status.${event.status}`)}
              </Badge>
            </div>
            {event.description && (
              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                {event.description}
              </p>
            )}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>
                <span className="font-medium">{t('events.start')}:</span>{' '}
                {formatDateTime(locale, event.start_date)}
              </span>
              <span>
                <span className="font-medium">{t('events.end')}:</span>{' '}
                {formatDateTime(locale, event.end_date)}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <TooltipProvider>
      <DashboardLayout title={t('dashboard.tenantAdmin')} subtitle={tenantName}>
        <div className="space-y-6">
          {/* Acciones rápidas */}
          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle>{t('dashboard.quickActions')}</CardTitle>
              <CardDescription>{t('dashboard.quickActionsDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link to={tenantPath('dashboard/events')}>{t('events.title')}</Link>
                </Button>
                <Button variant="outline" onClick={() => setIsCreateModalOpen(true)}>
                  {t('events.create')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tarjetas de estadísticas */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <StatsCard
            label={t('dashboard.stats.teams')}
            value={statistics.teams}
            icon={<Users className="h-5 w-5" aria-hidden />}
            tooltip={t('dashboard.stats.teamsTooltip')}
          />
          <StatsCard
            label={t('dashboard.stats.projects')}
            value={statistics.projects}
            icon={<FolderKanban className="h-5 w-5" aria-hidden />}
            tooltip={t('dashboard.stats.projectsTooltip')}
          />
          <StatsCard
            label={t('dashboard.stats.users')}
            value={statistics.users}
            icon={<UserPlus className="h-5 w-5" aria-hidden />}
            tooltip={t('dashboard.stats.usersTooltip')}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <StatsCard
            label={t('dashboard.stats.submissions')}
            value={statistics.submissions}
            icon={<FileText className="h-5 w-5" aria-hidden />}
            tooltip={t('dashboard.stats.submissionsTooltip')}
          />
          <StatsCard
            label={t('dashboard.stats.evaluations')}
            value={statistics.evaluations}
            icon={<ClipboardCheck className="h-5 w-5" aria-hidden />}
            tooltip={t('dashboard.stats.evaluationsTooltip')}
          />
          <StatsCard
            label={t('dashboard.stats.registrations')}
            value={statistics.registrations}
            icon={<Archive className="h-5 w-5" aria-hidden />}
            tooltip={t('dashboard.stats.registrationsTooltip')}
          />
        </div>

        {/* Eventos unificados con tabs */}
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-lg">{t('dashboard.events')}</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link to={tenantPath('dashboard/events')}>{t('common.viewAll')}</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <TooltipProvider>
              <Tabs defaultValue="all" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex w-full">
                        <TabsTrigger value="all" className="flex items-center gap-2 w-full">
                          {t('dashboard.eventsTabs.all')}
                          <Info className="h-3 w-3" />
                        </TabsTrigger>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('dashboard.eventsTabs.allTooltip')}</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex w-full">
                        <TabsTrigger value="past" className="flex items-center gap-2 w-full">
                          {t('dashboard.eventsTabs.past')}
                          <Info className="h-3 w-3" />
                        </TabsTrigger>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('dashboard.eventsTabs.pastTooltip')}</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex w-full">
                        <TabsTrigger value="current" className="flex items-center gap-2 w-full">
                          {t('dashboard.eventsTabs.current')}
                          <Info className="h-3 w-3" />
                        </TabsTrigger>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('dashboard.eventsTabs.currentTooltip')}</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex w-full">
                        <TabsTrigger value="future" className="flex items-center gap-2 w-full">
                          {t('dashboard.eventsTabs.future')}
                          <Info className="h-3 w-3" />
                        </TabsTrigger>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('dashboard.eventsTabs.futureTooltip')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TabsList>
                <TabsContent value="all" className="mt-4">
                  {renderEventList(allEventsList)}
                </TabsContent>
                <TabsContent value="past" className="mt-4">
                  {renderEventList(pastEvents)}
                </TabsContent>
                <TabsContent value="current" className="mt-4">
                  {renderEventList(currentEvents)}
                </TabsContent>
                <TabsContent value="future" className="mt-4">
                  {renderEventList(futureEvents)}
                </TabsContent>
              </Tabs>
            </TooltipProvider>
          </CardContent>
        </Card>
      </div>

      <EventCreateModal
        open={isCreateModalOpen}
        onOpenChange={openState => (!openState ? handleCloseDialog() : null)}
        form={eventForm}
        onSubmit={onSubmit}
        isSubmitting={createMutation.isPending}
      />
      </DashboardLayout>
    </TooltipProvider>
  );
}

export default AdminDashboardPage;
