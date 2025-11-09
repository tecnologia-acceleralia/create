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

export async function requestPasswordResetCode(payload: PasswordResetRequestPayload) {
  return apiClient.post('/auth/password-reset/request', payload);
}

export async function verifyPasswordResetCode(payload: PasswordResetVerifyPayload) {
  return apiClient.post('/auth/password-reset/verify', payload);
}

export async function confirmPasswordReset(payload: PasswordResetConfirmPayload) {
  return apiClient.post('/auth/password-reset/confirm', payload);
}

