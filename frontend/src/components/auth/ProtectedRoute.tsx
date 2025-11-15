import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { Spinner } from '@/components/common';

type ProtectedRouteProps = {
  children: ReactNode;
  requiredScopes?: string[];
  match?: 'any' | 'all';
  allowSuperAdmin?: boolean;
  loadingFallback?: ReactNode;
};

function resolveLoginPath(pathname: string, tenantSlug: string | null) {
  if (pathname.startsWith('/superadmin')) {
    return '/superadmin';
  }
  if (tenantSlug) {
    return `/${tenantSlug}/login`;
  }
  return '/';
}

function resolveDashboardPath(tenantSlug: string | null) {
  if (tenantSlug) {
    return `/${tenantSlug}/dashboard`;
  }
  return '/dashboard';
}

export function ProtectedRoute({
  children,
  requiredScopes,
  match = 'any',
  allowSuperAdmin = true,
  loadingFallback
}: ProtectedRouteProps) {
  const { user, tokens, loading, activeMembership, isSuperAdmin } = useAuth();
  const { tenantSlug } = useTenant();
  const location = useLocation();

  if (loading) {
    return <>{loadingFallback ?? <Spinner fullHeight />}</>;
  }

  const loginPath = resolveLoginPath(location.pathname, tenantSlug);
  const dashboardPath = resolveDashboardPath(tenantSlug);

  if (!user || !tokens?.token) {
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  if (allowSuperAdmin && isSuperAdmin) {
    return <>{children}</>;
  }

  if (requiredScopes?.length) {
    const roleScopes = new Set(
      activeMembership?.roles?.map(role => role.scope) ?? user.roleScopes ?? []
    );

    // Check if user has active membership (backend allows this for participants)
    const hasActiveMembership = activeMembership?.status === 'active';
    const isParticipantRoute = requiredScopes.some(
      scope => scope === 'participant' || scope === 'team_captain'
    );
    
    // Backend allows access if user has active membership for participant routes
    // even without explicit scope assignment (see authorization.middleware.js)
    const hasAccessByMembership = hasActiveMembership && isParticipantRoute;
    
    const hasAccessByScope =
      match === 'all'
        ? requiredScopes.every(scope => roleScopes.has(scope))
        : requiredScopes.some(scope => roleScopes.has(scope));

    // Allow access if user has scope OR has active membership for participant routes
    if (!hasAccessByScope && !hasAccessByMembership) {
      // Redirect to dashboard instead of login if user is authenticated but lacks permissions
      return <Navigate to={dashboardPath} replace />;
    }
  }

  return <>{children}</>;
}


