export function ensureSuperAdmin(req, res, next) {
  const token = req.headers['x-super-admin-token'];
  if (!token || token !== process.env.SUPERADMIN_API_KEY) {
    return res.status(403).json({
      success: false,
      message: 'Acceso restringido a super-administradores'
    });
  }

  return next();
}

