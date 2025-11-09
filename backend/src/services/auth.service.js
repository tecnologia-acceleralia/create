import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { appConfig } from '../config/env.js';
import { getModels } from '../models/index.js';

const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? `${appConfig.jwtSecret}-refresh`;
const REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';

export class AuthService {
  static async validateCredentials({ email, password, tenantId }) {
    const { User, UserTenant, Tenant, Role } = getModels();

    const user = await User.scope('withPassword').findOne({
      where: { email }
    });

    if (!user) {
      return null;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return null;
    }

    const memberships = await UserTenant.findAll({
      where: { user_id: user.id },
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

    const activeMembership = tenantId
      ? memberships.find(
          membership =>
            Number(membership.tenant_id) === Number(tenantId) && membership.status === 'active'
        ) ?? null
      : null;

    return {
      user,
      memberships,
      activeMembership
    };
  }

  static generateTokens({ user, tenant, membership }) {
    const roleScopes = membership?.assignedRoles?.map(role => role.scope) ?? [];

    const payload = {
      sub: user.id,
      tenantId: tenant?.id ?? null,
      membershipId: membership?.id ?? null,
      roleScopes,
      isSuperAdmin: Boolean(user.is_super_admin)
    };

    const token = jwt.sign(payload, appConfig.jwtSecret, {
      expiresIn: appConfig.jwtExpiresIn
    });

    const refreshToken = jwt.sign(
      {
        ...payload,
        type: 'refresh',
        jti: crypto.randomUUID()
      },
      REFRESH_SECRET,
      {
        expiresIn: REFRESH_EXPIRATION
      }
    );

    return { token, refreshToken };
  }

  static refreshToken(refreshToken) {
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
    if (decoded.type !== 'refresh') {
      throw new Error('Token inválido');
    }

    const token = jwt.sign(
      {
        sub: decoded.sub,
        tenantId: decoded.tenantId ?? null,
        membershipId: decoded.membershipId ?? null,
        roleScopes: decoded.roleScopes ?? [],
        isSuperAdmin: Boolean(decoded.isSuperAdmin)
      },
      appConfig.jwtSecret,
      {
        expiresIn: appConfig.jwtExpiresIn
      }
    );

    return { token };
  }
}

