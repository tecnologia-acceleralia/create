import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getModels } from '../models/index.js';
import { logger } from '../utils/logger.js';

const CODE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CODE_LENGTH = 6;

export class PasswordResetError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'PasswordResetError';
    this.code = code;
  }
}

function generateCode() {
  return crypto.randomInt(0, 10 ** CODE_LENGTH).toString().padStart(CODE_LENGTH, '0');
}

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

export class PasswordResetService {
  static async requestReset({ email, tenantId }) {
    const normalizedEmail = normalizeEmail(email);
    const { User, UserTenant, PasswordResetToken, Tenant } = getModels();

    const user = await User.scope('withPassword').findOne({
      where: { email: normalizedEmail }
    });

    if (!user) {
      return { shouldNotify: false };
    }

    const membership = await UserTenant.findOne({
      where: {
        user_id: user.id,
        tenant_id: tenantId
      }
    });

    if (!membership) {
      return { shouldNotify: false };
    }

    const tenant = await Tenant.findByPk(tenantId);

    if (!tenant) {
      logger.warn('Tenant no encontrado durante solicitud de reseteo de contraseña', {
        tenantId
      });
      return { shouldNotify: false };
    }

    // Invalidate previous pending requests
    await PasswordResetToken.update(
      { consumed_at: new Date() },
      {
        where: {
          tenant_id: tenantId,
          user_id: user.id,
          consumed_at: null
        }
      }
    );

    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);

    await PasswordResetToken.create({
      tenant_id: tenantId,
      user_id: user.id,
      code_hash: hashCode(code),
      expires_at: expiresAt
    });

    return {
      shouldNotify: true,
      code,
      user,
      tenant,
      expiresAt
    };
  }

  static async verifyCode({ email, tenantId, code }) {
    const { token } = await this.#getValidToken({ email, tenantId, code });
    if (!token) {
      throw new PasswordResetError('Código inválido', 'code_invalid');
    }
    return true;
  }

  static async resetPassword({ email, tenantId, code, newPassword }) {
    const { token, user } = await this.#getValidToken({ email, tenantId, code, forReset: true });
    if (!token || !user) {
      throw new PasswordResetError('Código inválido', 'code_invalid');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await user.update({ password: hashedPassword });
    await token.update({
      consumed_at: new Date()
    });
  }

  static async #getValidToken({ email, tenantId, code, forReset = false }) {
    const normalizedEmail = normalizeEmail(email);
    const { User, UserTenant, PasswordResetToken } = getModels();

    const user = await User.scope('withPassword').findOne({
      where: { email: normalizedEmail }
    });

    if (!user) {
      throw new PasswordResetError('Código inválido', 'code_invalid');
    }

    const membership = await UserTenant.findOne({
      where: {
        user_id: user.id,
        tenant_id: tenantId
      }
    });

    if (!membership) {
      throw new PasswordResetError('Código inválido', 'code_invalid');
    }

    const token = await PasswordResetToken.findOne({
      where: {
        tenant_id: tenantId,
        user_id: user.id,
        consumed_at: null
      },
      order: [['created_at', 'DESC']]
    });

    if (!token) {
      throw new PasswordResetError('Código inválido', 'code_invalid');
    }

    if (token.expires_at && token.expires_at.getTime() < Date.now()) {
      if (forReset) {
        await token.update({ consumed_at: new Date() });
      }
      throw new PasswordResetError('Código expirado', 'code_expired');
    }

    const providedHash = hashCode(code);
    if (providedHash !== token.code_hash) {
      throw new PasswordResetError('Código inválido', 'code_invalid');
    }

    return { token, user };
  }
}


