import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Users2, Bot, Mail, Cloud } from 'lucide-react';
import { Spinner } from '@/components/common';
import { SuperAdminStatsCard } from '@/components/superadmin';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import {
  getSuperAdminOverview,
  testSuperAdminService,
  runSuperAdminHealthcheck,
  type HealthcheckStatus
} from '@/services/superadmin';

const HEALTH_SERVICES = [
  { key: 'openai', icon: <Bot className="h-5 w-5" aria-hidden /> },
  { key: 'mailersend', icon: <Mail className="h-5 w-5" aria-hidden /> },
  { key: 'spaces', icon: <Cloud className="h-5 w-5" aria-hidden /> }
] as const;

type HealthServiceKey = (typeof HEALTH_SERVICES)[number]['key'];

function SuperAdminDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [testingService, setTestingService] = useState<HealthServiceKey | null>(null);

  const overviewQuery = useQuery({
    queryKey: ['superadmin', 'overview'],
    queryFn: getSuperAdminOverview,
    refetchOnWindowFocus: false
  });

  const healthcheckQuery = useQuery({
    queryKey: ['superadmin', 'healthcheck'],
    queryFn: runSuperAdminHealthcheck,
    refetchOnWindowFocus: false,
    enabled: false
  });

  const testServiceMutation = useMutation({
    mutationFn: (service: HealthServiceKey) => testSuperAdminService(service),
    onMutate: service => {
      setTestingService(service);
    },
    onSuccess: data => {
      queryClient.setQueryData(['superadmin', 'healthcheck'], (prev: Record<HealthServiceKey, HealthcheckStatus> | undefined) => ({
        ...(prev ?? {}),
        [data.service]: data.status
      }));
      toast.success(
        t('superadmin.healthcheck.testSuccess', {
          service: t(`superadmin.healthcheck.services.${data.service}`)
        })
      );
    },
    onError: () => {
      toast.error(t('superadmin.healthcheck.testError'));
    },
    onSettled: () => {
      setTestingService(null);
    }
  });

  const isTestingService = (service: HealthServiceKey) =>
    testServiceMutation.isPending && testingService === service;

  const handleTestService = (service: HealthServiceKey) => {
    testServiceMutation.mutate(service);
  };

  const handleHealthRefresh = () => {
    void healthcheckQuery.refetch();
  };

  if (overviewQuery.isLoading) {
    return <Spinner fullHeight />;
  }

  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <Card className="border-destructive/40 bg-destructive/10">
        <CardHeader>
          <CardTitle className="text-destructive">{t('common.error')}</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const tenantActive = overviewQuery.data.tenants.active ?? 0;
  const tenantTotal = overviewQuery.data.tenants.total ?? 0;
  const userTotal = overviewQuery.data.users.total ?? 0;
  const userActive = overviewQuery.data.users.byStatus?.active ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SuperAdminStatsCard
          label={t('superadmin.dashboard.tenants')}
          primaryValue={tenantTotal}
          secondaryLabel={t('superadmin.dashboard.active')}
          secondaryValue={tenantActive}
          icon={<Building2 className="h-5 w-5" aria-hidden />}
          onClick={() => navigate('/superadmin/tenants')}
        />
        <SuperAdminStatsCard
          label={t('superadmin.dashboard.users')}
          primaryValue={userTotal}
          secondaryLabel={t('superadmin.dashboard.active')}
          secondaryValue={userActive}
          icon={<Users2 className="h-5 w-5" aria-hidden />}
          onClick={() => navigate('/superadmin/users')}
        />
      </div>

      <Card className="border-border/70">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{t('superadmin.healthcheck.title')}</CardTitle>
            <CardDescription>{t('superadmin.healthcheck.description')}</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleHealthRefresh}
            disabled={healthcheckQuery.isFetching}
          >
            {healthcheckQuery.isFetching ? t('superadmin.healthcheck.running') : t('common.retry')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {healthcheckQuery.isFetching ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
              <span>{t('superadmin.healthcheck.running')}</span>
            </div>
          ) : null}
          {healthcheckQuery.isError ? (
            <p className="text-sm text-destructive">{t('superadmin.healthcheck.error')}</p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {HEALTH_SERVICES.map(service => (
              <HealthcheckCard
                key={service.key}
                label={t(`superadmin.healthcheck.services.${service.key}`)}
                status={healthcheckQuery.data?.[service.key] ?? null}
                icon={service.icon}
                onTest={() => handleTestService(service.key)}
                testing={isTestingService(service.key)}
                disabled={healthcheckQuery.isFetching}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type HealthcheckCardProps = {
  label: string;
  status: HealthcheckStatus | null;
  icon: JSX.Element;
  onTest: () => void;
  testing: boolean;
  disabled: boolean;
};

function HealthcheckCard({ label, status, icon, onTest, testing, disabled }: HealthcheckCardProps) {
  const { t } = useTranslation();
  const badgeVariant: BadgeProps['variant'] = status
    ? status.status === 'ok'
      ? 'success'
      : status.status === 'warning'
      ? 'warning'
      : 'destructive'
    : 'secondary';

  const badgeLabel = status
    ? t(`superadmin.healthcheck.status.${status.status}`)
    : t('superadmin.healthcheck.status.pending');

  const message = status?.message ?? t('superadmin.healthcheck.notRun');

  return (
    <Card className="h-full border-border/70">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>{icon}</span>
            <span className="text-sm font-medium text-foreground">{label}</span>
          </div>
          <Badge variant={badgeVariant}>{badgeLabel}</Badge>
        </div>
        <CardDescription className="text-sm text-muted-foreground">{message}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {status?.details ? (
          <pre className="max-h-32 overflow-auto rounded bg-muted/70 p-2 text-xs text-muted-foreground">
            {JSON.stringify(status.details, null, 2)}
          </pre>
        ) : null}
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onTest} disabled={testing || disabled}>
            {testing ? t('superadmin.healthcheck.testing') : t('superadmin.healthcheck.testButton')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default SuperAdminDashboardPage;