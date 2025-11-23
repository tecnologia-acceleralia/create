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

    const { User, UserTenant, Role, Tenant } = getModels();
    const user = await User.findOne({
      where: { id: payload.sub }
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Usuario no encontrado' });
    }

    const isSuperAdmin = Boolean(user.is_super_admin);

    // Verificar si el usuario tiene membresía activa en el tenant actual
    // Esto permite que usuarios con múltiples tenants puedan cambiar entre ellos sin re-login
    let hasActiveMembershipInCurrentTenant = false;
    if (req.tenant && !isSuperAdmin) {
      const currentTenantMembership = await UserTenant.findOne({
        where: {
          user_id: user.id,
          tenant_id: req.tenant.id,
          status: 'active'
        },
        skipTenant: true
      });
      hasActiveMembershipInCurrentTenant = Boolean(currentTenantMembership);
    }

    // Permitir superadmins incluso si el tenantId del token no coincide con req.tenant
    // También permitir usuarios con membresía activa en el tenant actual (útil para cambiar entre tenants)
    // Esto permite que superadmins y usuarios con múltiples tenants accedan a cualquier tenant donde tengan membresía
    if (
      req.tenant &&
      payload.tenantId &&
      Number(payload.tenantId) !== Number(req.tenant.id) &&
      !isSuperAdmin &&
      !hasActiveMembershipInCurrentTenant
    ) {
      return res.status(403).json({ success: false, message: 'Tenant inválido para el token' });
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

      // Permitir superadmins incluso si la membresía es de otro tenant
      // También permitir si el usuario tiene membresía activa en el tenant actual
      // Esto permite que superadmins y usuarios con múltiples tenants accedan a cualquier tenant donde tengan membresía
      if (
        membership &&
        req.tenant &&
        Number(membership.tenant_id) !== Number(req.tenant.id) &&
        !Boolean(user.is_super_admin) &&
        !hasActiveMembershipInCurrentTenant
      ) {
        return res.status(403).json({ success: false, message: 'Tenant inválido para la membresía' });
      }

      if (membership && membership.status !== 'active') {
        return res.status(403).json({ success: false, message: 'Membresía inactiva' });
      }
    }

    // Si el usuario tiene membresía activa en el tenant actual pero el token es de otro tenant,
    // buscar la membresía del tenant actual para usarla en lugar de la del token
    if (hasActiveMembershipInCurrentTenant && req.tenant && (!membership || Number(membership.tenant_id) !== Number(req.tenant.id))) {
      membership = await UserTenant.findOne({
        where: {
          user_id: user.id,
          tenant_id: req.tenant.id,
          status: 'active'
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
        ],
        skipTenant: true
      });
    }

    const roleScopes = membership?.assignedRoles?.map(role => role.scope) ?? payload.roleScopes ?? [];

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

