import { Suspense, useEffect, lazy } from 'react';
import { useRoutes, Navigate, Outlet, useParams, useNavigate, useLocation } from 'react-router';
import { Spinner } from '@/components/common';
import { Toaster } from 'sonner';
import { useTenant } from '@/context/TenantContext';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { ProtectedRoute } from '@/components/auth';
import { useAuth } from '@/context/AuthContext';

// Lazy load de páginas públicas (cargadas frecuentemente)
const TenantHomePage = lazy(() => import('@/pages/public/TenantHomePage'));
const LandingPage = lazy(() => import('@/pages/public/LandingPage'));
const LoginPage = lazy(() => import('@/pages/public/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/public/RegisterPage'));
const PasswordResetPage = lazy(() => import('@/pages/public/PasswordResetPage'));
const EventLandingPage = lazy(() => import('@/pages/public/EventLandingPage'));
const PublicEventsHubPage = lazy(() => import('@/pages/public/PublicEventsHubPage'));

// Lazy load de páginas legales (poco frecuentes)
const PrivacyPolicyPage = lazy(() => import('@/pages/public/PrivacyPolicyPage'));
const CookiesPolicyPage = lazy(() => import('@/pages/public/CookiesPolicyPage'));
const TermsAndConditionsPage = lazy(() => import('@/pages/public/TermsAndConditionsPage'));

// Lazy load de páginas comunes
const ProfilePage = lazy(() => import('@/pages/common/ProfilePage'));
const NotificationsPage = lazy(() => import('@/pages/common/NotificationsPage'));
const DeliverablesTrackingPage = lazy(() => import('@/pages/common/DeliverablesTrackingPage'));

// Lazy load de páginas de administrador
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'));
const EventsListPage = lazy(() => import('@/pages/admin/events/EventsListPage'));
const EventDetailAdminPage = lazy(() => import('@/pages/admin/events/EventDetailAdminPage'));
const EventDeliverablesTrackingPage = lazy(() => import('@/pages/admin/events/EventDeliverablesTrackingPage'));

// Lazy load de páginas de participante
const ParticipantDashboardPage = lazy(() => import('@/pages/participant/ParticipantDashboardPage'));
const EventHomePage = lazy(() => import('@/pages/participant/EventHomePage'));
const PhaseDetailParticipantPage = lazy(() => import('@/pages/participant/PhaseDetailParticipantPage'));
const MyTeamPage = lazy(() => import('@/pages/participant/MyTeamPage'));
const ProjectsPage = lazy(() => import('@/pages/participant/ProjectsPage'));
const TaskSubmissionPage = lazy(() => import('@/pages/participant/TaskSubmissionPage'));

// Lazy load de páginas de evaluador
const EvaluatorDashboardPage = lazy(() => import('@/pages/evaluator/EvaluatorDashboardPage'));
const EvaluationPage = lazy(() => import('@/pages/evaluator/EvaluationPage'));
const PhaseEvaluationPage = lazy(() => import('@/pages/evaluator/PhaseEvaluationPage'));

// Lazy load de páginas de superadmin
const SuperAdminRootPage = lazy(() => import('@/pages/superadmin/SuperAdminRootPage'));

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
        { index: true, element: <TenantHomePage /> },
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
          path: 'dashboard/events/:eventId/tasks/:taskId/submissions/:submissionId/evaluate',
          element: (
            <ProtectedRoute requiredScopes={['tenant_admin', 'organizer', 'evaluator']}>
              <EvaluationPage />
            </ProtectedRoute>
          )
        },
        {
          path: 'dashboard/events/:eventId/phases/:phaseId/teams/:teamId/evaluate',
          element: (
            <ProtectedRoute requiredScopes={['tenant_admin', 'organizer', 'evaluator']}>
              <PhaseEvaluationPage />
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
          path: 'dashboard/events/:eventId/notifications',
          element: (
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          )
        },
        {
          path: 'dashboard/tracking/deliverables',
          element: (
            <ProtectedRoute requiredScopes={['tenant_admin', 'organizer', 'evaluator']}>
              <DeliverablesTrackingPage />
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
