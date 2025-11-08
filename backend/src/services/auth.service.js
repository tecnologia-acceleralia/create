import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { appConfig } from '../config/env.js';
import { getModels } from '../models/index.js';

const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? `${appConfig.jwtSecret}-refresh`;
const REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';

export class AuthService {
  static async validateCredentials(email, password) {
    const { User, Role } = getModels();

    const user = await User.scope('withPassword').findOne({
      where: { email },
      include: [{ model: Role, as: 'role' }]
    });

    if (!user) {
      return null;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return null;
    }

    return user;
  }

  static generateTokens(user, tenant) {
    const payload = {
      sub: user.id,
      tenantId: tenant.id,
      role: user.role?.scope
    };

    const token = jwt.sign(payload, appConfig.jwtSecret, {
      expiresIn: appConfig.jwtExpiresIn
    });

    const refreshToken = jwt.sign({
      ...payload,
      type: 'refresh',
      jti: crypto.randomUUID()
    }, REFRESH_SECRET, {
      expiresIn: REFRESH_EXPIRATION
    });

    return { token, refreshToken };
  }

  static refreshToken(refreshToken) {
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
    if (decoded.type !== 'refresh') {
      throw new Error('Token inválido');
    }

    const token = jwt.sign({
      sub: decoded.sub,
      tenantId: decoded.tenantId,
      role: decoded.role
    }, appConfig.jwtSecret, {
      expiresIn: appConfig.jwtExpiresIn
    });

    return { token };
  }
}

