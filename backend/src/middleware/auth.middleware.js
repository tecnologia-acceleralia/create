import jwt from 'jsonwebtoken';
import { appConfig } from '../config/env.js';
import { getModels } from '../models/index.js';

export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token requerido' });
  }

  try {
    const payload = jwt.verify(token, appConfig.jwtSecret);

    if (req.tenant && payload.tenantId && Number(payload.tenantId) !== Number(req.tenant.id)) {
      return res.status(403).json({ success: false, message: 'Tenant inválido para el token' });
    }

    const { User, UserTenant, Role, Tenant } = getModels();
    const user = await User.findOne({
      where: { id: payload.sub }
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Usuario no encontrado' });
    }

    let membership = null;
    if (payload.membershipId) {
      membership = await UserTenant.findOne({
        where: {
          id: payload.membershipId,
          user_id: user.id
        },
        include: [
          {
            model: Tenant,
            as: 'tenant',
            attributes: ['id', 'slug', 'name', 'status']
          },
          {
            model: Role,
            as: 'assignedRoles',
            attributes: ['id', 'name', 'scope'],
            through: { attributes: [] }
          }
        ]
      });

      if (!membership && !Boolean(payload.isSuperAdmin)) {
        return res.status(403).json({ success: false, message: 'Acceso al tenant revocado' });
      }

      if (
        membership &&
        req.tenant &&
        Number(membership.tenant_id) !== Number(req.tenant.id)
      ) {
        return res.status(403).json({ success: false, message: 'Tenant inválido para la membresía' });
      }

      if (membership && membership.status !== 'active') {
        return res.status(403).json({ success: false, message: 'Membresía inactiva' });
      }
    }

    const roleScopes = membership?.assignedRoles?.map(role => role.scope) ?? payload.roleScopes ?? [];
    const isSuperAdmin = Boolean(user.is_super_admin);

    req.auth = {
      user,
      membership,
      roleScopes,
      isSuperAdmin
    };

    user.setDataValue('roleScopes', roleScopes);
    user.setDataValue('isSuperAdmin', isSuperAdmin);
    user.setDataValue('activeMembership', membership);

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token inválido' });
  }
}

