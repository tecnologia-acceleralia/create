export function ensureSuperAdmin(req, res, next) {
  const isSuperAdmin = Boolean(req.auth?.isSuperAdmin ?? req.user?.is_super_admin);

  if (!isSuperAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Acceso restringido a super-administradores'
    });
  }

  return next();
}

