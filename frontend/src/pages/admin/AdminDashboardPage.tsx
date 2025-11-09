import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useTenantPath } from '@/hooks/useTenantPath';

function AdminDashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const tenantPath = useTenantPath();

  return (
    <DashboardLayout title={t('dashboard.tenantAdmin')} subtitle={user?.email ?? ''}>
      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>{t('dashboard.welcome')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">{t('tenant.brandingFallback')}</p>
          <Button asChild>
            <Link to={tenantPath('dashboard/events')}>{t('events.title')}</Link>
          </Button>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

export default AdminDashboardPage;
