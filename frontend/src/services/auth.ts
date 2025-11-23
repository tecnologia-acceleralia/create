import { apiClient } from './api';

type PasswordResetRequestPayload = {
  email: string;
};

type PasswordResetVerifyPayload = {
  email: string;
  code: string;
};

type PasswordResetConfirmPayload = {
  email: string;
  code: string;
  password: string;
};

type RegisterPayload = {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  language?: 'es' | 'en' | 'ca';
  event_id?: number;
  grade?: string;
  registration_answers?: Record<string, unknown> | null;
};

export async function requestPasswordResetCode(payload: PasswordResetRequestPayload) {
  return apiClient.post('/auth/password-reset/request', payload);
}

export async function verifyPasswordResetCode(payload: PasswordResetVerifyPayload) {
  return apiClient.post('/auth/password-reset/verify', payload);
}

export async function confirmPasswordReset(payload: PasswordResetConfirmPayload) {
  return apiClient.post('/auth/password-reset/confirm', payload);
}

export async function registerUser(payload: RegisterPayload) {
  return apiClient.post('/auth/register', payload);
}

export type UpdateProfilePayload = {
  first_name?: string;
  last_name?: string;
  email?: string;
  language?: 'es' | 'en' | 'ca';
  profile_image?: string; // base64 image
  profile_image_url?: string | null;
  grade?: string | null;
};

export async function updateProfile(payload: UpdateProfilePayload) {
  const response = await apiClient.patch<{ success: boolean; data: { user: unknown } }>('/users/me', payload);
  return response.data;
}

export type EnsureMembershipResponse = {
  success: boolean;
  data: {
    tokens: {
      token: string;
      refreshToken: string;
    };
    user: {
      id: number;
      email: string;
      first_name: string;
      last_name: string;
      profile_image_url: string | null;
      is_super_admin: boolean;
      roleScopes: string[];
      avatarUrl: string;
    };
    tenant: {
      id: number;
      slug: string;
      name: string;
      status: string;
    };
    isSuperAdmin: boolean;
    memberships: Array<{
      id: number;
      tenantId: number;
      status: string;
      tenant: {
        id: number;
        slug: string;
        name: string;
        status: string;
      } | null;
      roles: Array<{
        id: number;
        name: string;
        scope: string;
      }>;
    }>;
    activeMembership: {
      id: number;
      tenantId: number;
      status: string;
      tenant: {
        id: number;
        slug: string;
        name: string;
        status: string;
      } | null;
      roles: Array<{
        id: number;
        name: string;
        scope: string;
      }>;
    } | null;
  };
};

/**
 * Asegura que un superadmin tenga membresía activa en el tenant actual
 * Crea la membresía si no existe o la activa si está inactiva
 * @param superAdminToken Token opcional de superadmin para usar cuando no hay token de tenant
 */
export async function ensureSuperAdminMembership(superAdminToken?: string | null): Promise<EnsureMembershipResponse> {
  const config = superAdminToken ? {
    headers: {
      Authorization: `Bearer ${superAdminToken}`
    }
  } : undefined;
  const response = await apiClient.post<EnsureMembershipResponse>('/auth/ensure-membership', {}, config);
  return response.data;
}

/**
 * Refresca la sesión del usuario actualizando membresías y roles
 * Útil después de cambios de roles que no requieren re-login
 */
export async function refreshSession(): Promise<EnsureMembershipResponse> {
  const response = await apiClient.get<EnsureMembershipResponse>('/auth/refresh-session');
  return response.data;
}

export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
};

export async function changePassword(payload: ChangePasswordPayload) {
  const response = await apiClient.post<{ success: boolean; message: string }>(
    '/users/me/change-password',
    payload
  );
  return response.data;
}

type CompleteRegistrationPayload = {
  grade?: string;
  registration_answers?: Record<string, unknown>;
  event_id?: number;
};

export async function completeRegistration(payload: CompleteRegistrationPayload) {
  const response = await apiClient.post<{ success: boolean; data: { user: unknown; message: string } }>(
    '/auth/complete-registration',
    payload
  );
  return response.data;
}

type LoginPayload = {
  email: string;
  password: string;
  event_id?: number;
};

export type LoginResponse = {
  tokens: {
    token: string;
    refreshToken: string;
  };
  user: unknown;
  tenant: unknown;
  isSuperAdmin: boolean;
  memberships: unknown[];
  activeMembership: unknown | null;
  missingFields?: {
    tenant?: {
      schema: unknown;
      missingFields: Array<{
        id: string;
        label: Record<string, string> | string;
        type: string;
        required: boolean;
        options: Array<{ value: string; label?: Record<string, string> | string }>;
      }>;
    } | null;
    event?: {
      eventId: number;
      schema: unknown;
      missingFields: Array<{
        id: string;
        label: Record<string, string> | string;
        type: string;
        required: boolean;
        options: Array<{ value: string; label?: Record<string, string> | string }>;
      }>;
    } | null;
  };
};

export async function loginUser(payload: LoginPayload) {
  const response = await apiClient.post<{ success: boolean; data: LoginResponse }>('/auth/login', payload);
  return response.data;
}

