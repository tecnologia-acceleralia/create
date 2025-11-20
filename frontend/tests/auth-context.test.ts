import { describe, it, expect } from 'vitest';

import { buildAvatarUrl } from '@/utils/avatar';
import { mapUser } from '@/context/AuthContext';

describe('AuthContext helpers', () => {
  it('returns stored profile image when available', () => {
    const avatarUrl = buildAvatarUrl({
      email: 'user@example.com',
      profile_image_url: 'https://example.com/avatar.png'
    });

    expect(avatarUrl).toBe('https://example.com/avatar.png');
  });

  it('generates deterministic avatar when profile image missing', () => {
    const first = buildAvatarUrl({
      email: 'person@example.com',
      first_name: 'Ada',
      last_name: 'Lovelace',
      profile_image_url: null
    });

    const second = buildAvatarUrl({
      email: 'person@example.com',
      first_name: 'Ada',
      last_name: 'Lovelace',
      profile_image_url: undefined
    });

    expect(first).toBe(second);
    expect(first).toMatch(/^data:image\/svg\+xml;base64,/);
    // Verificar que contiene las iniciales "AL"
    const decoded = atob(first.split(',')[1] ?? '');
    expect(decoded).toContain('AL');
  });

  it('uses email as fallback when name is missing', () => {
    const avatarUrl = buildAvatarUrl({
      email: 'test@example.com',
      profile_image_url: null
    });

    expect(avatarUrl).toMatch(/^data:image\/svg\+xml;base64,/);
    // Verificar que contiene las iniciales del email "TE"
    const decoded = atob(avatarUrl.split(',')[1] ?? '');
    expect(decoded).toContain('TE');
  });

  it('uses generic fallback when email is also missing', () => {
    const avatarUrl = buildAvatarUrl({
      profile_image_url: null
    });

    expect(avatarUrl).toMatch(/^data:image\/svg\+xml;base64,/);
    // Verificar que contiene la inicial genérica "U"
    const decoded = atob(avatarUrl.split(',')[1] ?? '');
    expect(decoded).toContain('U');
  });

  it('maps raw user payload into view model with role scopes', () => {
    const mapped = mapUser(
      {
        id: 1,
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        profile_image_url: null,
        is_super_admin: false
      },
      ['tenant_admin', 'organizer']
    );

    expect(mapped).toMatchObject({
      id: 1,
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      profile_image_url: null,
      is_super_admin: false,
      roleScopes: ['tenant_admin', 'organizer']
    });
    expect(typeof mapped.avatarUrl).toBe('string');
  });
});

