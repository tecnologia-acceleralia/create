export function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    const isSuperAdmin = Boolean(req.auth?.isSuperAdmin ?? req.user?.is_super_admin);
    if (isSuperAdmin) {
      return next();
    }

    const roleScopes = req.auth?.roleScopes ?? req.user?.roleScopes ?? [];
    const membership = req.auth?.membership ?? null;

    if (!roleScopes.length) {
      if (
        membership &&
        membership.status === 'active' &&
        (allowedRoles.includes('participant') || allowedRoles.includes('team_captain'))
      ) {
        return next();
      }
      return res.status(403).json({ success: false, message: 'Acceso no autorizado' });
    }

    const hasRole = roleScopes.some(scope => allowedRoles.includes(scope));
    if (!hasRole) {
      return res.status(403).json({ success: false, message: 'Acceso no autorizado' });
    }

    return next();
  };
}

