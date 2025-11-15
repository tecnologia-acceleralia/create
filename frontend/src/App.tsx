import { Suspense, useEffect } from 'react';
import { useRoutes, Navigate, Outlet, useParams, useNavigate, useLocation } from 'react-router';
import { Spinner } from '@/components/common';
import { Toaster } from 'sonner';
import { useTenant } from '@/context/TenantContext';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { ProtectedRoute } from '@/components/auth';
import { useAuth } from '@/context/AuthContext';

import LandingPage from '@/pages/public/LandingPage';
import LoginPage from '@/pages/public/LoginPage';
import PublicEventsHubPage from '@/pages/public/PublicEventsHubPage';
import AdminDashboardPage from '@/pages/admin/AdminDashboardPage';
import EventsListPage from '@/pages/admin/events/EventsListPage';
import EventDetailAdminPage from '@/pages/admin/events/EventDetailAdminPage';
import EventTrackingPage from '@/pages/admin/events/EventTrackingPage';
import TeamDashboardPage from '@/pages/participant/TeamDashboardPage';
import ParticipantDashboardPage from '@/pages/participant/ParticipantDashboardPage';
import EventDetailParticipantPage from '@/pages/participant/EventDetailParticipantPage';
import EventHomePage from '@/pages/participant/EventHomePage';
import PhaseZeroPage from '@/pages/participant/PhaseZeroPage';
import EvaluatorDashboardPage from '@/pages/evaluator/EvaluatorDashboardPage';
import TaskSubmissionPage from '@/pages/participant/TaskSubmissionPage';
import NotificationsPage from '@/pages/common/NotificationsPage';
import ProfilePage from '@/pages/common/ProfilePage';
import SuperAdminRootPage from '@/pages/superadmin/SuperAdminRootPage';
import EventLandingPage from '@/pages/public/EventLandingPage';
import PasswordResetPage from '@/pages/public/PasswordResetPage';
import RegisterPage from '@/pages/public/RegisterPage';

function TenantLayout() {
  const { tenantSlug, setTenantSlug, accessWindow, loading } = useTenant();
  const params = useParams<{ tenantSlug?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!params.tenantSlug) {
      setTenantSlug(null);
      return;
    }

    const normalizedSlug = params.tenantSlug.toLowerCase();

    if (normalizedSlug !== tenantSlug) {
      setTenantSlug(normalizedSlug);
    }
  }, [params.tenantSlug, tenantSlug, setTenantSlug]);

  useEffect(() => {
    if (!params.tenantSlug || loading) {
      return;
    }

    if (
      accessWindow.isActiveNow === false &&
      !location.pathname.includes('/dashboard') &&
      !location.pathname.includes('/login')
    ) {
      navigate(`/${params.tenantSlug}/dashboard`, { replace: true });
    }
  }, [accessWindow.isActiveNow, loading, location.pathname, navigate, params.tenantSlug]);

  if (!params.tenantSlug) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

function AppRoutes() {
  const { tenantSlug } = useTenant();

  return useRoutes([
    {
      path: '/:tenantSlug/*',
      element: <TenantLayout />,
      children: [
        { index: true, element: <LandingPage /> },
        { path: 'login', element: <LoginPage /> },
        { path: 'register', element: <RegisterPage /> },
        { path: 'password-reset', element: <PasswordResetPage /> },
        { path: 'events/:eventId', element: <EventLandingPage /> },
        {
          path: 'dashboard',
          element: (
            <ProtectedRoute>
              <DashboardRouter />
            </ProtectedRoute>
          )
        },
        {
          path: 'dashboard/profile',
          element: (
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          )
        },
        {
          path: 'dashboard/events',
          element: (
            <ProtectedRoute requiredScopes={['tenant_admin', 'organizer']}>
              <EventsListPage />
            </ProtectedRoute>
          )
        },
        {
          path: 'dashboard/events/:eventId',
          element: (
            <ProtectedRoute requiredScopes={['tenant_admin', 'organizer']}>
              <EventDetailAdminPage />
            </ProtectedRoute>
          )
        },
        {
          path: 'dashboard/events/:eventId/home',
          element: (
            <ProtectedRoute>
              <EventHomePage />
            </ProtectedRoute>
          )
        },
        {
          path: 'dashboard/events/:eventId/view',
          element: (
            <ProtectedRoute>
              <EventDetailParticipantPage />
            </ProtectedRoute>
          )
        },
        {
          path: 'dashboard/events/:eventId/phase-zero',
          element: (
            <ProtectedRoute>
              <PhaseZeroPage />
            </ProtectedRoute>
          )
        },
        {
          path: 'dashboard/events/:eventId/tracking',
          element: (
            <ProtectedRoute requiredScopes={['tenant_admin', 'organizer', 'evaluator']}>
              <EventTrackingPage />
            </ProtectedRoute>
          )
        },
        {
          path: 'dashboard/events/:eventId/team',
          element: (
            <ProtectedRoute requiredScopes={['participant', 'tenant_admin', 'organizer']}>
              <TeamDashboardPage />
            </ProtectedRoute>
          )
        },
        {
          path: 'dashboard/events/:eventId/tasks/:taskId',
          element: (
            <ProtectedRoute requiredScopes={['participant', 'tenant_admin', 'organizer', 'evaluator']}>
              <TaskSubmissionPage />
            </ProtectedRoute>
          )
        },
        {
          path: 'dashboard/notifications',
          element: (
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          )
        }
      ]
    },
    {
      path: '/dashboard',
      element: tenantSlug ? <Navigate to={`/${tenantSlug}/dashboard`} replace /> : <SuperAdminRootPage />
    },
    { path: '/superadmin/*', element: <SuperAdminRootPage /> },
    { path: '/', element: <PublicEventsHubPage /> },
    {
      path: '*',
      element: tenantSlug ? (
        <Navigate to={`/${tenantSlug}/dashboard`} replace />
      ) : (
        <Navigate to="/" replace />
      )
    }
  ]);
}

function DashboardRouter() {
  const { user, activeMembership, isSuperAdmin } = useAuth();
  const { tenantSlug } = useTenant();

  const loginPath = tenantSlug ? `/${tenantSlug}/login` : '/superadmin';

  if (!user) {
    return <Navigate to={loginPath} replace />;
  }

  const roleScopes = new Set<string>(
    activeMembership?.roles?.map(role => role.scope) ?? user.roleScopes ?? []
  );

  if (isSuperAdmin || roleScopes.has('tenant_admin') || roleScopes.has('organizer')) {
    return <AdminDashboardPage />;
  }

  if (roleScopes.has('evaluator')) {
    return <EvaluatorDashboardPage />;
  }

  return <ParticipantDashboardPage />;
}

function App() {
  return (
    <SiteLayout>
      <Suspense fallback={<Spinner fullHeight />}>
        <AppRoutes />
      </Suspense>
      <Toaster richColors position="top-right" />
    </SiteLayout>
  );
}

export default App;
