import { Suspense, useEffect } from 'react';
import { useRoutes, Navigate, Outlet, useParams } from 'react-router';
import { useAuth } from '@/context/AuthContext';
import { Spinner } from '@/components/common';
import { Toaster } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useTenant } from '@/context/TenantContext';

import LandingPage from '@/pages/public/LandingPage';
import LoginPage from '@/pages/public/LoginPage';
import AdminDashboardPage from '@/pages/admin/AdminDashboardPage';
import EventsListPage from '@/pages/admin/events/EventsListPage';
import EventDetailPage from '@/pages/admin/events/EventDetailPage';
import TeamDashboardPage from '@/pages/mentee/TeamDashboardPage';
import ParticipantDashboardPage from '@/pages/mentee/ParticipantDashboardPage';
import MentorDashboardPage from '@/pages/mentor/MentorDashboardPage';
import TaskSubmissionPage from '@/pages/mentee/TaskSubmissionPage';
import NotificationsPage from '@/pages/common/NotificationsPage';
import SuperAdminDashboardPage from '@/pages/superadmin/SuperAdminDashboardPage';

function TenantLayout() {
  const { tenantSlug, setTenantSlug } = useTenant();
  const params = useParams<{ tenantSlug?: string }>();

  useEffect(() => {
    if (!params.tenantSlug) {
      setTenantSlug(null);
      return;
    }

    if (params.tenantSlug !== tenantSlug) {
      setTenantSlug(params.tenantSlug);
    }
  }, [params.tenantSlug, tenantSlug, setTenantSlug]);

  if (!params.tenantSlug) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

function AppRoutes() {
  const { user } = useAuth();
  const { tenantSlug } = useTenant();
  const loginPath = tenantSlug ? `/tenant/${tenantSlug}/login` : '/';

  return useRoutes([
    {
      path: '/tenant/:tenantSlug/*',
      element: <TenantLayout />,
      children: [
        { index: true, element: <LandingPage /> },
        { path: 'login', element: <LoginPage /> },
        {
          path: 'dashboard',
          element: user ? <DashboardRouter /> : <Navigate to={loginPath} replace />
        },
        {
          path: 'dashboard/events',
          element: user ? <EventsListPage /> : <Navigate to={loginPath} replace />
        },
        {
          path: 'dashboard/events/:eventId',
          element: user ? <EventDetailPage /> : <Navigate to={loginPath} replace />
        },
        {
          path: 'dashboard/events/:eventId/team',
          element: user ? <TeamDashboardPage /> : <Navigate to={loginPath} replace />
        },
        {
          path: 'dashboard/events/:eventId/tasks/:taskId',
          element: user ? <TaskSubmissionPage /> : <Navigate to={loginPath} replace />
        },
        {
          path: 'dashboard/notifications',
          element: user ? <NotificationsPage /> : <Navigate to={loginPath} replace />
        }
      ]
    },
    { path: '/superadmin', element: <SuperAdminDashboardPage /> },
    { path: '/', element: <Navigate to={tenantSlug ? `/tenant/${tenantSlug}` : '/superadmin'} replace /> },
    { path: '*', element: <Navigate to={tenantSlug ? `/tenant/${tenantSlug}` : '/superadmin'} replace /> }
  ]);
}

function DashboardRouter() {
  const { user } = useAuth();
  const { tenantSlug } = useTenant();

  const loginPath = tenantSlug ? `/tenant/${tenantSlug}/login` : '/';

  if (!user) {
    return <Navigate to={loginPath} replace />;
  }

  const role = user.role?.scope;

  if (role === 'tenant_admin' || role === 'organizer') {
    return <AdminDashboardPage />;
  }

  if (role === 'mentor') {
    return <MentorDashboardPage />;
  }

  return <ParticipantDashboardPage />;
}

function App() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Suspense fallback={<Spinner fullHeight />}> 
        <AppRoutes />
      </Suspense>
      <Toaster richColors position="top-right" toastOptions={{ description: t('common.error') }} />
    </div>
  );
}

export default App;

