import { Suspense } from 'react';
import { useRoutes, Navigate } from 'react-router';
import { useAuth } from '@/context/AuthContext';
import { Spinner } from '@/components/common';
import { Toaster } from 'sonner';
import { useTranslation } from 'react-i18next';

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

function AppRoutes() {
  const { user } = useAuth();

  return useRoutes([
    { path: '/', element: <LandingPage /> },
    { path: '/login', element: <LoginPage /> },
    { path: '/superadmin', element: <SuperAdminDashboardPage /> },
    {
      path: '/dashboard',
      element: user ? <DashboardRouter /> : <Navigate to="/login" replace />
    },
    {
      path: '/dashboard/events',
      element: user ? <EventsListPage /> : <Navigate to="/login" replace />
    },
    {
      path: '/dashboard/events/:eventId',
      element: user ? <EventDetailPage /> : <Navigate to="/login" replace />
    },
    {
      path: '/dashboard/events/:eventId/team',
      element: user ? <TeamDashboardPage /> : <Navigate to="/login" replace />
    },
    {
      path: '/dashboard/events/:eventId/tasks/:taskId',
      element: user ? <TaskSubmissionPage /> : <Navigate to="/login" replace />
    },
    {
      path: '/dashboard/notifications',
      element: user ? <NotificationsPage /> : <Navigate to="/login" replace />
    }
  ]);
}

function DashboardRouter() {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
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

