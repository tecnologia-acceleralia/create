import { PasswordResetService, PasswordResetError } from '../services/password-reset.service.js';
import { MailersendService } from '../services/mailersend.service.js';
import { AuthService } from '../services/auth.service.js';
import { logger } from '../utils/logger.js';

function normalizeTenant(tenant) {
  if (!tenant) {
    return null;
  }
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    status: tenant.status ?? 'active'
  };
}

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

export class PasswordResetController {
  static async requestCode(req, res) {
    const tenant = req.tenant;
    if (!tenant) {
      return res.status(400).json({ success: false, message: 'Tenant no resuelto' });
    }

    try {
      const result = await PasswordResetService.requestReset({
        email: req.body.email,
        tenantId: tenant.id
      });

      if (result.shouldNotify) {
        await MailersendService.sendPasswordResetCode({
          user: result.user,
          tenant: normalizeTenant(tenant),
          code: result.code,
          expiresAt: result.expiresAt
        });
      }

      return res.json({
        success: true,
        message: 'Si el correo existe, se ha enviado un código de verificación'
      });
    } catch (error) {
      logger.error('Error al solicitar código de recuperación', {
        error: error.message
      });
      return res.status(500).json({
        success: false,
        message: 'No se pudo procesar la solicitud de recuperación'
      });
    }
  }

  static async verifyCode(req, res) {
    const tenant = req.tenant;
    if (!tenant) {
      return res.status(400).json({ success: false, message: 'Tenant no resuelto' });
    }

    try {
      await PasswordResetService.verifyCode({
        email: req.body.email,
        tenantId: tenant.id,
        code: req.body.code
      });

      return res.json({ success: true });
    } catch (error) {
      if (error instanceof PasswordResetError) {
        const status = error.code === 'code_expired' ? 410 : 400;
        return res.status(status).json({ success: false, message: error.message, code: error.code });
      }

      logger.error('Error al verificar código de recuperación', { error: error.message });
      return res
        .status(500)
        .json({ success: false, message: 'No se pudo verificar el código de recuperación' });
    }
  }

  static async confirmReset(req, res) {
    const tenant = req.tenant;
    if (!tenant) {
      return res.status(400).json({ success: false, message: 'Tenant no resuelto' });
    }

    const { email, code, password } = req.body;

    try {
      await PasswordResetService.resetPassword({
        email,
        tenantId: tenant.id,
        code,
        newPassword: password
      });

      const authResult = await AuthService.validateCredentials({
        email,
        password,
        tenantId: tenant.id
      });

      if (!authResult || !authResult.user) {
        return res.status(401).json({
          success: false,
          message: 'No fue posible iniciar sesión tras el cambio de contraseña'
        });
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
      if (error instanceof PasswordResetError) {
        const status = error.code === 'code_expired' ? 410 : 400;
        return res.status(status).json({ success: false, message: error.message, code: error.code });
      }

      logger.error('Error al confirmar restablecimiento de contraseña', {
        error: error.message
      });
      return res
        .status(500)
        .json({ success: false, message: 'No se pudo restablecer la contraseña' });
    }
  }
}


