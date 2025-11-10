import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { AuthService } from '../services/auth.service.js';
import { getModels } from '../models/index.js';
import { logger } from '../utils/logger.js';

const AUTH_MESSAGES = {
  TENANT_NOT_RESOLVED: 'Tenant no resuelto',
  INVALID_CREDENTIALS: 'Credenciales inválidas',
  USER_NOT_IN_TENANT: 'El usuario no pertenece a este espacio',
  USER_INACTIVE: 'El usuario no tiene acceso activo a este espacio',
  LOGIN_ERROR: 'Error al iniciar sesión',
  REFRESH_TOKEN_INVALID: 'Refresh token inválido',
  SUPERADMIN_ONLY: 'Acceso restringido a super-administradores',
  SUPERADMIN_LOGIN_ERROR: 'Error en login de superadmin',
  REGISTRATION_DISABLED: 'El registro no está habilitado en este espacio',
  EMAIL_ALREADY_TAKEN: 'Este correo ya está registrado. Inicia sesión para continuar',
  REGISTRATION_ERROR: 'No se pudo completar el registro'
};

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
  static async register(req, res) {
    const models = getModels();
    const { User, Event, Role, UserTenant, UserTenantRole, Tenant } = models;
    const transaction = await User.sequelize.transaction();
    try {
      const tenant = req.tenant;
      if (!tenant) {
        await transaction.rollback();
        return res
          .status(400)
          .json({ success: false, message: AUTH_MESSAGES.TENANT_NOT_RESOLVED });
      }

      const {
        first_name: rawFirstName,
        last_name: rawLastName,
        email: rawEmail,
        password,
        language,
        event_id: eventId
      } = req.body;

      const firstName = rawFirstName.trim();
      const lastName = rawLastName.trim();
      const email = rawEmail.toLowerCase();

      const now = new Date();
      const baseEventFilters = {
        tenant_id: tenant.id,
        status: 'published',
        is_public: true,
        allow_open_registration: true,
        [Op.and]: [
          {
            [Op.or]: [
              { publish_start_at: { [Op.is]: null } },
              { publish_start_at: { [Op.lte]: now } }
            ]
          },
          {
            [Op.or]: [
              { publish_end_at: { [Op.is]: null } },
              { publish_end_at: { [Op.gte]: now } }
            ]
          }
        ]
      };

      let registrationEvent = null;
      if (eventId) {
        registrationEvent = await Event.findOne({
          where: {
            ...baseEventFilters,
            id: eventId
          },
          transaction
        });

        if (!registrationEvent) {
          await transaction.rollback();
          return res
            .status(403)
            .json({ success: false, message: AUTH_MESSAGES.REGISTRATION_DISABLED });
        }
      } else {
        const existingOpenRegistration = await Event.findOne({
          where: baseEventFilters,
          transaction
        });

        if (!existingOpenRegistration) {
          await transaction.rollback();
          return res
            .status(403)
            .json({ success: false, message: AUTH_MESSAGES.REGISTRATION_DISABLED });
        }
      }

      const existingUser = await User.findOne({
        where: { email },
        transaction
      });

      if (existingUser) {
        await transaction.rollback();
        return res
          .status(409)
          .json({ success: false, message: AUTH_MESSAGES.EMAIL_ALREADY_TAKEN });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await User.create(
        {
          email,
          password: hashedPassword,
          first_name: firstName,
          last_name: lastName,
          language: language?.toLowerCase() ?? 'es',
          status: 'active',
          is_super_admin: false
        },
        { transaction }
      );

      const membership = await UserTenant.create(
        {
          user_id: newUser.id,
          tenant_id: tenant.id,
          status: 'active'
        },
        { transaction }
      );

      const participantRole = await Role.findOne({
        where: {
          tenant_id: tenant.id,
          scope: 'participant'
        },
        transaction
      });

      if (participantRole) {
        await UserTenantRole.create(
          {
            tenant_id: tenant.id,
            user_tenant_id: membership.id,
            role_id: participantRole.id
          },
          { transaction }
        );
      }

      await transaction.commit();

      const freshUser = await User.findByPk(newUser.id, {
        include: [
          {
            model: UserTenant,
            as: 'tenantMemberships',
            include: [
              {
                model: Role,
                as: 'assignedRoles',
                attributes: ['id', 'name', 'scope']
              },
              {
                model: Tenant,
                as: 'tenant',
                attributes: ['id', 'slug', 'name', 'status']
              }
            ]
          }
        ]
      });

      if (!freshUser) {
        return res
          .status(500)
          .json({ success: false, message: AUTH_MESSAGES.REGISTRATION_ERROR });
      }

      const memberships = freshUser.tenantMemberships ?? [];
      const activeMembership =
        memberships.find(
          membershipInstance =>
            Number(membershipInstance.tenant_id) === Number(tenant.id) &&
            membershipInstance.status === 'active'
        ) ?? null;

      const tokens = AuthService.generateTokens({
        user: freshUser,
        tenant,
        membership: activeMembership
      });

      return res.status(201).json({
        success: true,
        data: {
          tokens,
          user: freshUser.toSafeJSON(),
          tenant: tenant.toJSON(),
          isSuperAdmin: false,
          memberships: memberships.map(serializeMembership),
          activeMembership: serializeMembership(activeMembership),
          metadata: registrationEvent
            ? {
                registered_event_id: registrationEvent.id
              }
            : null
        }
      });
    } catch (error) {
      await transaction.rollback();
      logger.error(AUTH_MESSAGES.REGISTRATION_ERROR, { error: error.message });
      return res
        .status(500)
        .json({ success: false, message: AUTH_MESSAGES.REGISTRATION_ERROR });
    }
  }

  static async login(req, res) {
    try {
      const tenant = req.tenant;
      const { email, password } = req.body;

      if (!tenant) {
        return res
          .status(400)
          .json({ success: false, message: AUTH_MESSAGES.TENANT_NOT_RESOLVED });
      }

      const authResult = await AuthService.validateCredentials({
        email,
        password,
        tenantId: tenant.id
      });

      if (!authResult || !authResult.user) {
        return res
          .status(401)
          .json({ success: false, message: AUTH_MESSAGES.INVALID_CREDENTIALS });
      }

      const { user, memberships, activeMembership } = authResult;

      if (!user.is_super_admin && !activeMembership) {
        return res.status(403).json({
          success: false,
          message: AUTH_MESSAGES.USER_NOT_IN_TENANT
        });
      }

      if (activeMembership && activeMembership.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: AUTH_MESSAGES.USER_INACTIVE
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
      logger.error(AUTH_MESSAGES.LOGIN_ERROR, { error: error.message });
      return res.status(500).json({ success: false, message: AUTH_MESSAGES.LOGIN_ERROR });
    }
  }

  static async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;
      const tokens = AuthService.refreshToken(refreshToken);
      return res.json({ success: true, data: tokens });
    } catch (error) {
      logger.warn(AUTH_MESSAGES.REFRESH_TOKEN_INVALID, { error: error.message });
      return res
        .status(401)
        .json({ success: false, message: AUTH_MESSAGES.REFRESH_TOKEN_INVALID });
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
        return res
          .status(401)
          .json({ success: false, message: AUTH_MESSAGES.INVALID_CREDENTIALS });
      }

      const { user, memberships } = authResult;

      if (!user.is_super_admin) {
        return res.status(403).json({
          success: false,
          message: AUTH_MESSAGES.SUPERADMIN_ONLY
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
      logger.error(AUTH_MESSAGES.SUPERADMIN_LOGIN_ERROR, { error: error.message });
      return res.status(500).json({ success: false, message: AUTH_MESSAGES.LOGIN_ERROR });
    }
  }
}

