export function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    const isSuperAdmin = Boolean(req.auth?.isSuperAdmin ?? req.user?.is_super_admin);
    if (isSuperAdmin) {
      return next();
    }

    const roleScopes = req.auth?.roleScopes ?? req.user?.roleScopes ?? [];
    if (!roleScopes.length) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    const hasRole = roleScopes.some(scope => allowedRoles.includes(scope));
    if (!hasRole) {
      return res.status(403).json({ success: false, message: 'Acceso no autorizado' });
    }

    return next();
  };
}

