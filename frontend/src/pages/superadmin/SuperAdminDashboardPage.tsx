import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { PageHeader, Spinner } from '@/components/common';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createTenantSuperAdmin, getTenantsSuperAdmin } from '@/services/superadmin';

const TOKEN_KEY = 'create.superadmin.token';

function SuperAdminDashboardPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string>(() => localStorage.getItem(TOKEN_KEY) ?? '');
  const [pendingToken, setPendingToken] = useState(token);

  const tenantsQuery = useQuery({
    queryKey: ['superadmin-tenants', token],
    queryFn: () => getTenantsSuperAdmin(token),
    enabled: Boolean(token)
  });

  const createTenantMutation = useMutation({
    mutationFn: (payload: { slug: string; name: string; email: string }) =>
      createTenantSuperAdmin(token, {
        slug: payload.slug,
        name: payload.name,
        admin: { email: payload.email }
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['superadmin-tenants', token] });
    }
  });

  useEffect(() => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    }
  }, [token]);

  if (!token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6">
      <Card className="max-w-md">
          <CardHeader>
          <CardTitle>{t('superadmin.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('superadmin.tokenPrompt')}</p>
          <Input value={pendingToken} onChange={event => setPendingToken(event.target.value)} placeholder="token" />
          <Button onClick={() => setToken(pendingToken)}>{t('landing.login')}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (tenantsQuery.isLoading) {
    return <Spinner fullHeight />;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title={t('superadmin.title')} subtitle={`Token ${token.slice(0, 4)}***`} />

      <Card>
        <CardHeader>
          <CardTitle>{t('superadmin.createTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-3"
            onSubmit={event => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget as HTMLFormElement);
              createTenantMutation.mutate({
                slug: formData.get('slug') as string,
                name: formData.get('name') as string,
                email: formData.get('email') as string
              });
              (event.currentTarget as HTMLFormElement).reset();
            }}
          >
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="slug">Slug</label>
              <Input id="slug" name="slug" required />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="name">Nombre</label>
              <Input id="name" name="name" required />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="email">Email admin</label>
              <Input id="email" name="email" type="email" required />
            </div>
            <Button type="submit" className="md:col-span-3" disabled={createTenantMutation.isLoading}>
              {createTenantMutation.isLoading ? t('superadmin.creating') : t('superadmin.create')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {tenantsQuery.data?.map(tenant => (
          <Card key={tenant.id}>
            <CardHeader>
              <CardTitle>{tenant.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Slug: {tenant.slug}</p>
              <p>Plan: {tenant.plan_type}</p>
              <span className="rounded-full bg-muted px-3 py-1 text-xs uppercase tracking-wide">{tenant.status}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default SuperAdminDashboardPage;

