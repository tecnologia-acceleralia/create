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
  avatar?: string; // base64 image
  avatar_url?: string | null;
  profile_image?: string; // base64 image
  profile_image_url?: string | null;
  grade?: string | null;
};

export async function updateProfile(payload: UpdateProfilePayload) {
  const response = await apiClient.patch<{ success: boolean; data: { user: unknown } }>('/users/me', payload);
  return response.data;
}

