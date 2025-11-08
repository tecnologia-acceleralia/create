export function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    const role = req.user?.role?.scope;
    if (!role) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ success: false, message: 'Acceso no autorizado' });
    }

    return next();
  };
}

