import { useAuth } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/auth';
import EventsListPage from '@/pages/admin/events/EventsListPage';
import LandingPage from './LandingPage';

/**
 * Componente que decide qué mostrar en la ruta raíz del tenant.
 * Si el usuario es administrador de eventos (tenant_admin u organizer),
 * muestra la lista de eventos. En caso contrario, muestra la landing page pública.
 */
function TenantHomePage() {
  const { user, activeMembership, isSuperAdmin, loading } = useAuth();

  // Si está cargando, mostrar landing page (evitar flash de contenido)
  if (loading) {
    return <LandingPage />;
  }

  // Si no hay usuario autenticado, mostrar landing page
  if (!user) {
    return <LandingPage />;
  }

  // Verificar si el usuario es administrador de eventos
  const roleScopes = new Set<string>(
    activeMembership?.roles?.map(role => role.scope) ?? user.roleScopes ?? []
  );

  const isEventAdmin = isSuperAdmin || roleScopes.has('tenant_admin') || roleScopes.has('organizer');

  // Si es administrador de eventos, mostrar lista de eventos protegida
  if (isEventAdmin) {
    return (
      <ProtectedRoute requiredScopes={['tenant_admin', 'organizer']}>
        <EventsListPage />
      </ProtectedRoute>
    );
  }

  // En caso contrario, mostrar landing page
  return <LandingPage />;
}

export default TenantHomePage;

