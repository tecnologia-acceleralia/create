import { getModels } from '../models/index.js';
import { t } from '../utils/i18n.js';

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
      return res.status(403).json({ success: false, message: t(req, 'common.unauthorized') });
    }

    const hasRole = roleScopes.some(scope => allowedRoles.includes(scope));
    if (!hasRole) {
      return res.status(403).json({ success: false, message: t(req, 'common.unauthorized') });
    }

    return next();
  };
}

/**
 * Middleware que autoriza roles pero también permite acceso si el usuario es capitán del equipo
 * Útil para rutas de equipos donde un capitán puede no tener el rol team_captain asignado
 * @param {...string} allowedRoles - Roles permitidos
 * @param {string} teamIdParam - Nombre del parámetro de ruta que contiene el teamId (default: 'teamId')
 * @returns {Function} Middleware de Express
 */
export function authorizeRolesOrTeamCaptain(...allowedRoles) {
  const teamIdParam = allowedRoles[allowedRoles.length - 1]?.startsWith?.('teamIdParam:') 
    ? allowedRoles.pop().replace('teamIdParam:', '')
    : 'teamId';

  return async (req, res, next) => {
    const isSuperAdmin = Boolean(req.auth?.isSuperAdmin ?? req.user?.is_super_admin);
    if (isSuperAdmin) {
      return next();
    }

    const roleScopes = req.auth?.roleScopes ?? req.user?.roleScopes ?? [];
    const membership = req.auth?.membership ?? null;

    // Primero verificar si tiene los roles requeridos
    if (roleScopes.length) {
      const hasRole = roleScopes.some(scope => allowedRoles.includes(scope));
      if (hasRole) {
        return next();
      }
    }

    // Si no tiene los roles, verificar si es capitán del equipo
    // Solo verificar si 'team_captain' está en los roles permitidos
    if (allowedRoles.includes('team_captain')) {
      try {
        const teamId = req.params[teamIdParam];
        if (teamId) {
          const { Team } = getModels();
          const team = await Team.findOne({
            where: { id: teamId },
            attributes: ['id', 'captain_id']
          });

          if (team) {
            const captainId = team.captain_id != null ? Number(team.captain_id) : null;
            const userId = req.user?.id != null ? Number(req.user.id) : null;
            
            if (captainId !== null && userId !== null && captainId === userId) {
              // Es capitán del equipo, permitir acceso
              return next();
            }
          }
        }
      } catch (error) {
        // Si hay error al verificar, continuar con la validación normal
        // (no bloquear por errores de base de datos)
      }
    }

    // Si no tiene roles y no es capitán, verificar membresía activa para participant/team_captain
    if (!roleScopes.length) {
      if (
        membership &&
        membership.status === 'active' &&
        (allowedRoles.includes('participant') || allowedRoles.includes('team_captain'))
      ) {
        return next();
      }
    }

    return res.status(403).json({ success: false, message: t(req, 'common.unauthorized') });
  };
}
