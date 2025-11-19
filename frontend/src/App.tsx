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
import EventDeliverablesTrackingPage from '@/pages/admin/events/EventDeliverablesTrackingPage';
import MyTeamPage from '@/pages/participant/MyTeamPage';
import ProjectsPage from '@/pages/participant/ProjectsPage';
import ParticipantDashboardPage from '@/pages/participant/ParticipantDashboardPage';
import PhaseDetailParticipantPage from '@/pages/participant/PhaseDetailParticipantPage';
import EventHomePage from '@/pages/participant/EventHomePage';
import EvaluatorDashboardPage from '@/pages/evaluator/EvaluatorDashboardPage';
import TaskSubmissionPage from '@/pages/participant/TaskSubmissionPage';
import NotificationsPage from '@/pages/common/NotificationsPage';
import ProfilePage from '@/pages/common/ProfilePage';
import SuperAdminRootPage from '@/pages/superadmin/SuperAdminRootPage';
import EventLandingPage from '@/pages/public/EventLandingPage';
import PasswordResetPage from '@/pages/public/PasswordResetPage';
import RegisterPage from '@/pages/public/RegisterPage';
import PrivacyPolicyPage from '@/pages/public/PrivacyPolicyPage';
import CookiesPolicyPage from '@/pages/public/CookiesPolicyPage';
import TermsAndConditionsPage from '@/pages/public/TermsAndConditionsPage';

function TenantNotFoundRedirect() {
  const params = useParams<{ tenantSlug?: string }>();
  
  if (params.tenantSlug) {
    return <Navigate to={`/${params.tenantSlug}`} replace />;
  }
  
  return <Navigate to="/" replace />;
}

function TenantLayout() {
  const { tenantSlug, setTenantSlug, accessWindow, loading, tenantNotFound } = useTenant();
  const { isSuperAdmin } = useAuth();
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

  // Verificar si el tenant existe antes de renderizar
  useEffect(() => {
    if (!params.tenantSlug || loading) {
      return;
    }

    // Si el tenant no existe y no estamos en una ruta de superadmin, redirigir a home
    // PERO: si el usuario es superadmin, permitir acceso sin validar tenant
    if (tenantNotFound && !location.pathname.startsWith('/superadmin') && !isSuperAdmin) {
      navigate('/', { replace: true });
      return;
    }
  }, [tenantNotFound, loading, location.pathname, navigate, params.tenantSlug, isSuperAdmin]);

  useEffect(() => {
    // Superadmin puede acceder sin validar accessWindow
    if (isSuperAdmin) {
      return;
    }

    if (!params.tenantSlug || loading || tenantNotFound) {
      return;
    }

    if (
      accessWindow.isActiveNow === false &&
      !location.pathname.includes('/dashboard') &&
      !location.pathname.includes('/login') &&
      !location.pathname.includes('/legal')
    ) {
      navigate(`/${params.tenantSlug}/dashboard`, { replace: true });
    }
  }, [accessWindow.isActiveNow, loading, tenantNotFound, location.pathname, navigate, params.tenantSlug, isSuperAdmin]);

  if (!params.tenantSlug) {
    return <Navigate to="/" replace />;
  }

  // Si el tenant no existe, no renderizar nada (la redirección se maneja en el useEffect)
  // PERO: si el usuario es superadmin, permitir acceso sin validar tenant
  if (tenantNotFound && !location.pathname.startsWith('/superadmin') && !isSuperAdmin) {
    return null;
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
        { path: 'legal/privacy', element: <PrivacyPolicyPage /> },
        { path: 'legal/cookies', element: <CookiesPolicyPage /> },
        { path: 'legal/terms', element: <TermsAndConditionsPage /> },
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
              <PhaseDetailParticipantPage />
            </ProtectedRoute>
          )
        },
        {
          path: 'dashboard/events/:eventId/deliverables-tracking',
          element: (
            <ProtectedRoute requiredScopes={['tenant_admin', 'organizer']}>
              <EventDeliverablesTrackingPage />
            </ProtectedRoute>
          )
        },
        {
          path: 'dashboard/events/:eventId/team',
          element: (
            <ProtectedRoute requiredScopes={['participant', 'tenant_admin', 'organizer']}>
              <MyTeamPage />
            </ProtectedRoute>
          )
        },
        {
          path: 'dashboard/events/:eventId/projects',
          element: (
            <ProtectedRoute requiredScopes={['participant', 'tenant_admin', 'organizer']}>
              <ProjectsPage />
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
        },
        {
          path: '*',
          element: <TenantNotFoundRedirect />
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
