import { AuthService } from '../services/auth.service.js';
import { logger } from '../utils/logger.js';

function serializeMembership(membership) {
  if (!membership) {
    return null;
  }

  return {
    id: membership.id,
    tenantId: membership.tenant_id,
    status: membership.status,
    tenant: membership.tenant
      ? {
          id: membership.tenant.id,
          slug: membership.tenant.slug,
          name: membership.tenant.name,
          status: membership.tenant.status
        }
      : null,
    roles:
      membership.assignedRoles?.map(role => ({
        id: role.id,
        name: role.name,
        scope: role.scope
      })) ?? []
  };
}

export class AuthController {
  static async login(req, res) {
    try {
      const tenant = req.tenant;
      const { email, password } = req.body;

      if (!tenant) {
        return res.status(400).json({ success: false, message: 'Tenant no resuelto' });
      }

      const authResult = await AuthService.validateCredentials({
        email,
        password,
        tenantId: tenant.id
      });

      if (!authResult || !authResult.user) {
        return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
      }

      const { user, memberships, activeMembership } = authResult;

      if (!user.is_super_admin && !activeMembership) {
        return res.status(403).json({
          success: false,
          message: 'El usuario no pertenece a este tenant'
        });
      }

      if (activeMembership && activeMembership.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'El usuario no tiene acceso activo a este tenant'
        });
      }

      const tokens = AuthService.generateTokens({
        user,
        tenant,
        membership: activeMembership ?? null
      });

      return res.json({
        success: true,
        data: {
          tokens,
          user: user.toSafeJSON(),
          tenant: tenant.toJSON(),
          isSuperAdmin: Boolean(user.is_super_admin),
          memberships: memberships.map(serializeMembership),
          activeMembership: serializeMembership(activeMembership)
        }
      });
    } catch (error) {
      logger.error('Error en login', { error: error.message });
      return res.status(500).json({ success: false, message: 'Error al iniciar sesión' });
    }
  }

  static async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;
      const tokens = AuthService.refreshToken(refreshToken);
      return res.json({ success: true, data: tokens });
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Refresh token inválido' });
    }
  }

  static async superAdminLogin(req, res) {
    try {
      const { email, password } = req.body;

      const authResult = await AuthService.validateCredentials({
        email,
        password,
        tenantId: null
      });

      if (!authResult || !authResult.user) {
        return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
      }

      const { user, memberships } = authResult;

      if (!user.is_super_admin) {
        return res.status(403).json({
          success: false,
          message: 'Acceso restringido a super-administradores'
        });
      }

      const tokens = AuthService.generateTokens({
        user,
        tenant: null,
        membership: null
      });

      return res.json({
        success: true,
        data: {
          tokens,
          user: user.toSafeJSON(),
          isSuperAdmin: true,
          memberships: memberships.map(serializeMembership)
        }
      });
    } catch (error) {
      logger.error('Error en login de superadmin', { error: error.message });
      return res.status(500).json({ success: false, message: 'Error al iniciar sesión' });
    }
  }
}

