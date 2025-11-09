import { describe, it, expect } from 'vitest';

import { buildAvatarUrl, mapUser } from '@/context/AuthContext';

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
    expect(first).toMatch(/^https:\/\/api\.dicebear\.com\/7\.x\/initials\/svg\?seed=/);
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

