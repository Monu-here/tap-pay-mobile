/**
 * Authentication API: login, current user, logout.
 *
 * All calls go through the shared `apiRequest` client (bearer token from the
 * session, `{ message, data }` envelope, global 401 + 429 handling). Login is
 * unauthenticated, so it passes `skipAuthError` to keep the client from logging
 * the user out on its own 401/422 and instead maps them to a "wrong
 * credentials" / validation result.
 */

import { router } from 'expo-router';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { common } from '@/constants/strings';

import { apiRequest, type ApiResult } from './apiClient';
import {
  clearSession,
  normalizeUser,
  setPendingAuthMessage,
  type SessionUser,
} from '../session';

const LOGIN_PATH = '/auth/login';
const LOGOUT_PATH = '/auth/logout';
const ME_PATH = '/auth/me';

type LoginData = {
  user?: Record<string, unknown> | null;
  access_token?: string;
  expires_at?: string | null;
};
type CurrentUserData = {
  user?: Record<string, unknown> | null;
};

export type LoginFailureReason =
  | 'invalidCredentials'
  | 'validation'
  | 'rateLimited'
  | 'network'
  | 'unauthorized'
  | 'server';

export type LoginResult =
  | { ok: true; user: SessionUser; token: string; expiresAt: string | null }
  | {
      ok: false;
      reason: LoginFailureReason;
      message: string;
      /** Field-level errors keyed by the API field name (422). */
      fieldErrors?: Record<string, string>;
      retryAfter?: number;
    };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Reads Laravel-style `{ errors: { field: [messages] } }` into `{ field: message }`. */
function fieldErrorsOf(data: Record<string, unknown> | null): Record<string, string> | undefined {
  const errors = data ? asRecord(data.errors) : null;
  if (!errors) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(errors)) {
    const message = Array.isArray(value)
      ? value.find((entry): entry is string => typeof entry === 'string')
      : typeof value === 'string'
        ? value
        : undefined;
    if (message) out[key] = message;
  }
  return Object.keys(out).length ? out : undefined;
}

/** POST /auth/login — email is trimmed and lowercased before sending. */
export async function login(
  email: string,
  password: string,
  deviceName?: string,
): Promise<LoginResult> {
  const result = await apiRequest<LoginData>(LOGIN_PATH, {
    method: 'POST',
    // Unauthenticated: never redirect on this call's own 401.
    skipAuthError: true,
    body: {
      email: email.trim().toLowerCase(),
      password,
      ...(deviceName ? { device_name: deviceName.slice(0, 80) } : {}),
    },
  });

  if (result.ok) {
    const data = result.data ?? {};
    const token = typeof data.access_token === 'string' ? data.access_token : null;
    const user = normalizeUser(asRecord(data.user));
    if (!token || !user.email) {
      return {
        ok: false,
        reason: 'server',
        message: result.message ?? common.generic,
      };
    }
    return {
      ok: true,
      user,
      token,
      expiresAt: typeof data.expires_at === 'string' ? data.expires_at : null,
    };
  }

  if (result.status === 429) {
    return {
      ok: false,
      reason: 'rateLimited',
      message: result.message ?? common.rateLimited,
      retryAfter: result.retryAfter,
      fieldErrors: fieldErrorsOf(result.data),
    };
  }
  if (result.status === 401 || result.status === 422) {
    // Wrong credentials (no body fields), or a format error with per-field reasons.
    const fieldErrors = fieldErrorsOf(result.data);
    if (fieldErrors) {
      return {
        ok: false,
        reason: 'validation',
        message: result.message ?? 'Please fix the highlighted fields.',
        fieldErrors,
      };
    }
    return {
      ok: false,
      reason: 'invalidCredentials',
      message: result.message ?? 'Incorrect email or password.',
    };
  }
  if (result.kind === 'network' || result.kind === 'timeout' || result.status === 0) {
    return { ok: false, reason: 'network', message: common.network };
  }
  if (result.status >= 500) {
    return { ok: false, reason: 'server', message: common.serverError };
  }
  return { ok: false, reason: 'server', message: result.message ?? common.generic };
}

/** GET /auth/me — current user (with verification flags); refreshes the stored user. */
export async function getMe(): Promise<ApiResult<SessionUser>> {
  const result = await apiRequest<CurrentUserData>(ME_PATH);
  if (!result.ok) return result;
  return {
    ok: true,
    status: result.status,
    message: result.message,
    data: normalizeUser(asRecord(result.data?.user)),
  };
}

/**
 * Logout: revoke the current token, then clear the local session and return to
 * login. The local session is cleared even if the request fails or the token is
 * already invalid (the client also logs out on a 401).
 */
export async function logout(): Promise<void> {
  try {
    await apiRequest<unknown>(LOGOUT_PATH, { method: 'POST', body: {} });
  } catch {
    // Ignored — the local session is cleared regardless.
  } finally {
    try {
      await clearSession();
    } catch {
      setPendingAuthMessage('Could not clear the saved secure session. Please sign in again.');
    }
    router.replace('/login');
  }
}

/** Human-friendly device label for the login `device_name` (max 80 chars). */
export function getDeviceName(): string {
  const os = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : String(Platform.OS);
  const model = Device.modelName;
  return `${model ? `${model} - ` : ''}${os}`.slice(0, 80);
}

/** POST /auth/forgot-password */
export function forgotPassword(email: string): Promise<ApiResult<{ email: string }>> {
  return apiRequest('/auth/forgot-password', {
    method: 'POST',
    skipAuthError: true,
    body: { email: email.trim().toLowerCase() },
  });
}

/** POST /auth/reset-password */
export function resetPassword(
  email: string,
  token: string,
  password: string,
  passwordConfirmation: string,
): Promise<ApiResult<unknown>> {
  return apiRequest('/auth/reset-password', {
    method: 'POST',
    skipAuthError: true,
    body: {
      email: email.trim().toLowerCase(),
      token: token.trim(),
      password,
      password_confirmation: passwordConfirmation,
    },
  });
}

/** POST /auth/change-password */
export function changePassword(
  currentPassword: string,
  newPassword: string,
  newPasswordConfirmation: string,
): Promise<ApiResult<{ other_sessions_revoked: number }>> {
  return apiRequest('/auth/change-password', {
    method: 'POST',
    body: {
      current_password: currentPassword,
      password: newPassword,
      password_confirmation: newPasswordConfirmation,
    },
  });
}

export type UserSessionItem = {
  id: number;
  name: string;
  abilities: string[];
  is_current: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string | null;
};

/** GET /auth/sessions */
export function getSessions(): Promise<ApiResult<{ sessions: UserSessionItem[] }>> {
  return apiRequest('/auth/sessions');
}

/** DELETE /auth/sessions/{tokenId} */
export function destroySession(tokenId: number): Promise<ApiResult<{ current_session_revoked: boolean }>> {
  return apiRequest(`/auth/sessions/${tokenId}`, { method: 'DELETE' });
}

/** POST /auth/logout-all */
export function logoutAll(): Promise<ApiResult<{ sessions_revoked: number }>> {
  return apiRequest('/auth/logout-all', { method: 'POST', body: {} });
}
