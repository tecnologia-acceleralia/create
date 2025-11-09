import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Activity, Building2, Users2 } from 'lucide-react';
import { Spinner } from '@/components/common';
import { SuperAdminStatsCard } from '@/components/superadmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  getSuperAdminOverview,
  runSuperAdminHealthcheck,
  testSuperAdminService,
  type HealthcheckStatus
} from '@/services/superadmin';

type HealthcheckResult = {
  mailersend: HealthcheckStatus;
  openai: HealthcheckStatus;
  spaces: HealthcheckStatus;
};

const EMPTY_STATUS: Record<string, number> = {};

function SuperAdminDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [healthResult, setHealthResult] = useState<HealthcheckResult | null>(null);
  const [testingService, setTestingService] = useState<keyof HealthcheckResult | null>(null);
  const [showHealthPanel, setShowHealthPanel] = useState(false);
  const [detailsDialog, setDetailsDialog] = useState<'tenants' | 'users' | null>(null);

  const overviewQuery = useQuery({
    queryKey: ['superadmin', 'overview'],
    queryFn: getSuperAdminOverview,
    refetchOnWindowFocus: false
  });

  const healthcheckMutation = useMutation({
    mutationFn: runSuperAdminHealthcheck,
    onSuccess: data => {
      setHealthResult(data);
    },
    onError: () => {
      toast.error(t('superadmin.healthcheck.error'));
    }
  });

  const testServiceMutation = useMutation({
    mutationFn: (service: keyof HealthcheckResult) => testSuperAdminService(service),
    onMutate: service => {
      setTestingService(service);
    },
    onSuccess: data => {
      setHealthResult(prev => ({
        ...(prev ?? {}),
        [data.service]: data.status
      }) as HealthcheckResult);
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

  const isTestingService = (service: keyof HealthcheckResult) =>
    testServiceMutation.isPending && testingService === service;

  const handleTestService = (service: keyof HealthcheckResult) => {
    testServiceMutation.mutate(service);
  };

  const handleHealthPanelToggle = () => {
    if (showHealthPanel) {
      setShowHealthPanel(false);
      setHealthResult(null);
    } else {
      setShowHealthPanel(true);
      setHealthResult(null);
      healthcheckMutation.mutate();
    }
  };

  const handleHealthRefresh = () => {
    setHealthResult(null);
    healthcheckMutation.mutate();
  };

  const tenantsByStatus = overviewQuery.data?.tenants.byStatus ?? EMPTY_STATUS;
  const usersByStatus = overviewQuery.data?.users.byStatus ?? EMPTY_STATUS;

  const tenantStatusEntries = useMemo(
    () =>
      Object.entries(tenantsByStatus).map(([status, value]) => ({
        status,
        value
      })),
    [tenantsByStatus]
  );

  const userStatusEntries = useMemo(
    () =>
      Object.entries(usersByStatus).map(([status, value]) => ({
        status,
        value
      })),
    [usersByStatus]
  );

  const detailsTitle =
    detailsDialog === 'tenants'
      ? t('superadmin.dashboard.tenantsByStatus')
      : detailsDialog === 'users'
      ? t('superadmin.dashboard.usersByStatus')
      : '';
  const detailsEntries =
    detailsDialog === 'tenants'
      ? tenantStatusEntries
      : detailsDialog === 'users'
      ? userStatusEntries
      : [];
  const detailsEmptyMessage =
    detailsDialog === 'tenants'
      ? t('superadmin.dashboard.noTenantsStats')
      : detailsDialog === 'users'
      ? t('superadmin.dashboard.noUsersStats')
      : '';
  const detailsNamespace =
    detailsDialog === 'tenants'
      ? 'superadmin.tenantStatus'
      : detailsDialog === 'users'
      ? 'superadmin.userStatus'
      : '';
  const detailsPath =
    detailsDialog === 'tenants'
      ? '/superadmin/tenants'
      : detailsDialog === 'users'
      ? '/superadmin/users'
      : null;

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
      <div className="grid gap-4 md:grid-cols-3">
        <SuperAdminStatsCard
          label={t('superadmin.dashboard.tenants')}
          primaryValue={tenantTotal}
          secondaryLabel={t('superadmin.dashboard.active')}
          secondaryValue={tenantActive}
          icon={<Building2 className="h-5 w-5" aria-hidden />}
          onClick={() => setDetailsDialog('tenants')}
        />
        <SuperAdminStatsCard
          label={t('superadmin.dashboard.users')}
          primaryValue={userTotal}
          secondaryLabel={t('superadmin.dashboard.active')}
          secondaryValue={userActive}
          icon={<Users2 className="h-5 w-5" aria-hidden />}
          onClick={() => setDetailsDialog('users')}
        />
        <SuperAdminStatsCard
          label={t('superadmin.healthcheck.title')}
          primaryValue={t('superadmin.healthcheck.subtitle')}
          icon={<Activity className="h-5 w-5" aria-hidden />}
          onClick={handleHealthPanelToggle}
        />
      </div>

      {showHealthPanel ? (
        <Card className="border-border/70">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>{t('superadmin.healthcheck.title')}</CardTitle>
              <p className="text-sm text-muted-foreground">{t('superadmin.healthcheck.description')}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleHealthPanelToggle}>
                {t('common.close')}
              </Button>
              <Button
                size="sm"
                onClick={handleHealthRefresh}
                disabled={healthcheckMutation.isPending}
              >
                {healthcheckMutation.isPending
                  ? t('superadmin.healthcheck.running')
                  : t('superadmin.healthcheck.testButton')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {healthcheckMutation.isPending && !healthResult ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                <span>{t('superadmin.healthcheck.running')}</span>
              </div>
            ) : null}
            {healthResult ? (
              <>
                <HealthcheckRow
                  label={t('superadmin.healthcheck.services.mailersend')}
                  status={healthResult.mailersend}
                  onTest={() => handleTestService('mailersend')}
                  testing={isTestingService('mailersend')}
                />
                <HealthcheckRow
                  label={t('superadmin.healthcheck.services.openai')}
                  status={healthResult.openai}
                  onTest={() => handleTestService('openai')}
                  testing={isTestingService('openai')}
                />
                <HealthcheckRow
                  label={t('superadmin.healthcheck.services.spaces')}
                  status={healthResult.spaces}
                  onTest={() => handleTestService('spaces')}
                  testing={isTestingService('spaces')}
                />
              </>
            ) : null}
            {!healthcheckMutation.isPending && !healthResult ? (
              <p className="text-sm text-muted-foreground">{t('superadmin.healthcheck.error')}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Dialog
        open={detailsDialog !== null}
        onOpenChange={open => {
          if (!open) {
            setDetailsDialog(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detailsTitle}</DialogTitle>
            <DialogDescription>
              {detailsDialog
                ? `${t('superadmin.dashboard.active')}: ${
                    detailsDialog === 'tenants' ? tenantActive : userActive
                  }`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {detailsEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">{detailsEmptyMessage}</p>
            ) : (
              detailsEntries.map(entry => (
                <div
                  key={entry.status}
                  className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2"
                >
                  <span className="text-sm font-medium capitalize">
                    {detailsNamespace
                      ? t(`${detailsNamespace}.${entry.status}`)
                      : entry.status}
                  </span>
                  <Badge variant="secondary">{entry.value}</Badge>
                </div>
              ))
            )}
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => setDetailsDialog(null)}>
              {t('common.close')}
            </Button>
            {detailsPath ? (
              <Button
                onClick={() => {
                  setDetailsDialog(null);
                  navigate(detailsPath);
                }}
              >
                {detailsDialog === 'tenants'
                  ? t('superadmin.dashboard.tenants')
                  : t('superadmin.dashboard.users')}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type HealthcheckRowProps = {
  label: string;
  status: HealthcheckStatus;
  onTest: () => void;
  testing: boolean;
};

function HealthcheckRow({ label, status, onTest, testing }: HealthcheckRowProps) {
  const { t } = useTranslation();
  const badgeVariant: BadgeProps['variant'] =
    status.status === 'ok'
      ? 'success'
      : status.status === 'warning'
      ? 'warning'
      : 'destructive';

  return (
    <div className="rounded-md border border-border/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <Badge variant={badgeVariant}>{status.status.toUpperCase()}</Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{status.message}</p>
      {status.details ? (
        <pre className="mt-2 max-h-32 overflow-auto rounded bg-muted/70 p-2 text-xs text-muted-foreground">
          {JSON.stringify(status.details, null, 2)}
        </pre>
      ) : null}
      <div className="mt-3 flex justify-end">
        <Button variant="outline" size="sm" onClick={onTest} disabled={testing}>
          {testing ? t('superadmin.healthcheck.testing') : t('superadmin.healthcheck.testButton')}
        </Button>
      </div>
    </div>
  );
}

export default SuperAdminDashboardPage;