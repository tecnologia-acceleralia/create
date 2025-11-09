import { Suspense } from 'react';
import { Navigate, useRoutes } from 'react-router';
import { useSuperAdminSession } from '@/context/SuperAdminContext';
import { Spinner, PageContainer } from '@/components/common';
import { SuperAdminLayout, SuperAdminLoginCard } from '@/components/superadmin';
import SuperAdminDashboardPage from './SuperAdminDashboardPage';
import SuperAdminTenantsPage from './SuperAdminTenantsPage';
import SuperAdminUsersPage from './SuperAdminUsersPage';

function SuperAdminAppRoutes() {
  const element = useRoutes([
    { index: true, element: <SuperAdminDashboardPage /> },
    { path: 'tenants', element: <SuperAdminTenantsPage /> },
    { path: 'users', element: <SuperAdminUsersPage /> },
    { path: '*', element: <Navigate to="/superadmin" replace /> }
  ]);

  if (!element) {
    return null;
  }

  return <SuperAdminLayout>{element}</SuperAdminLayout>;
}

function SuperAdminRootPage() {
  const { user, tokens, loading } = useSuperAdminSession();

  if (loading) {
    return <Spinner fullHeight />;
  }

  if (!user || !tokens?.token) {
    return (
      <PageContainer className="flex justify-center">
        <SuperAdminLoginCard />
      </PageContainer>
    );
  }

  return (
    <Suspense fallback={<Spinner fullHeight />}>
      <SuperAdminAppRoutes />
    </Suspense>
  );
}

export default SuperAdminRootPage;

