import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PageHeader } from '@/components/common';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useTenantPath } from '@/hooks/useTenantPath';

function AdminDashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const tenantPath = useTenantPath();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <PageHeader title={t('dashboard.tenantAdmin')} subtitle={user?.email ?? ''} />

      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.welcome')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('tenant.brandingFallback')}
          </p>
          <Button asChild className="mt-4">
            <Link to={tenantPath('dashboard/events')}>{t('events.title')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminDashboardPage;

