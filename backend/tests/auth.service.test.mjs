process.env.JWT_SECRET = 'unit-test-secret';
process.env.JWT_REFRESH_SECRET = 'unit-test-refresh';

import { describe, it, expect } from '@jest/globals';
import jwt from 'jsonwebtoken';

import { AuthService } from '../src/services/auth.service.js';

describe('AuthService.generateTokens', () => {
  it('includes role scopes and membership in access token', () => {
    const user = {
      id: 42,
      is_super_admin: false
    };

    const tenant = { id: 7 };

    const membership = {
      id: 88,
      assignedRoles: [
        { id: 1, name: 'Administrador', scope: 'tenant_admin' },
        { id: 2, name: 'Organizador', scope: 'organizer' }
      ]
    };

    const { token, refreshToken } = AuthService.generateTokens({ user, tenant, membership });

    const decodedAccess = jwt.verify(token, process.env.JWT_SECRET);
    expect(decodedAccess).toMatchObject({
      sub: 42,
      tenantId: 7,
      membershipId: 88,
      roleScopes: ['tenant_admin', 'organizer'],
      isSuperAdmin: false
    });

    const decodedRefresh = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    expect(decodedRefresh).toMatchObject({
      sub: 42,
      tenantId: 7,
      membershipId: 88,
      roleScopes: ['tenant_admin', 'organizer'],
      isSuperAdmin: false,
      type: 'refresh'
    });
    expect(typeof decodedRefresh.jti).toBe('string');
  });

  it('handles super admin tokens without membership', () => {
    const user = {
      id: 5,
      is_super_admin: true
    };

    const { token } = AuthService.generateTokens({ user, tenant: null, membership: null });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    expect(decoded).toMatchObject({
      sub: 5,
      tenantId: null,
      membershipId: null,
      roleScopes: [],
      isSuperAdmin: true
    });
  });
});

describe('AuthService.refreshToken', () => {
  it('re-issues an access token with the same payload', () => {
    const user = { id: 10, is_super_admin: false };
    const tenant = { id: 2 };
    const membership = {
      id: 99,
      assignedRoles: [{ id: 1, name: 'Evaluator', scope: 'evaluator' }]
    };

    const { refreshToken } = AuthService.generateTokens({ user, tenant, membership });
    const { token: refreshedAccess } = AuthService.refreshToken(refreshToken);
    const decoded = jwt.verify(refreshedAccess, process.env.JWT_SECRET);

    expect(decoded).toMatchObject({
      sub: 10,
      tenantId: 2,
      membershipId: 99,
      roleScopes: ['evaluator'],
      isSuperAdmin: false
    });
  });

  it('throws for invalid refresh tokens', () => {
    expect(() => AuthService.refreshToken('not-a-real-token')).toThrow('Token inválido');
  });
});

