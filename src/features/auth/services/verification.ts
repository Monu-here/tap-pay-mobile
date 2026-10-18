/**
 * Email + phone verification API.
 *
 * Wraps the shared `apiRequest` client (which injects the bearer token, parses
 * the `{ message, data }` envelope, handles 401 globally and surfaces 429) and
 * returns small, discriminatable outcomes so the verification hook and screen
 * can reason about the result without touching HTTP details.
 */

import { apiRequest } from './apiClient';

export type VerificationChannel = 'email' | 'phone';

const SEND_CODE_PATH = '/auth/verification/send';
const VERIFY_CODE_PATH = '/auth/verification/verify';

export type VerificationErrorReason =
  | 'invalid'
  | 'invalidOrExpired'
  | 'expired'
  | 'tooManyAttempts'
  | 'rateLimited'
  /** Delivery failure for either email (SMTP) or phone (WhatsApp). */
  | 'deliveryFailed'
  /** @deprecated Use deliveryFailed. Kept for any cached API response compatibility. */
  | 'mailSendFailed'
  | 'unauthorized'
  | 'network'
  | 'server';

export type SendCodeOutcome =
  | { ok: true; message?: string }
  /** `retryAfter` (seconds) is present only when `reason === 'rateLimited'`. */
  | { ok: false; reason: VerificationErrorReason; message?: string; retryAfter?: number };

type VerifyCodeServerData = {
  channel?: VerificationChannel;
  verified?: boolean;
  email_verified?: boolean;
  phone_verified?: boolean;
};

export type VerifyCodeOutcome =
  | { ok: true; channel: VerificationChannel; emailVerified: boolean; phoneVerified: boolean; message?: string }
  | { ok: false; reason: VerificationErrorReason; message?: string; retryAfter?: number; attemptsLeft?: number };

/** POST /auth/verification/send — issue a code for one channel. */
export async function sendVerificationCode(channel: VerificationChannel): Promise<SendCodeOutcome> {
  const result = await apiRequest<{ channel: VerificationChannel }>(SEND_CODE_PATH, {
    method: 'POST',
    body: { channel },
  });

  if (result.ok) {
    return { ok: true, message: result.message ?? undefined };
  }

  const rawData = result.data as Record<string, unknown> | null;
  const errorCode = (rawData?.error_code as string) ?? '';

  if (result.status === 429) {
    return { ok: false, reason: 'rateLimited', retryAfter: result.retryAfter, message: result.message ?? undefined };
  }
  // delivery_failed (new) and mail_send_failed (legacy) both map to deliveryFailed.
  if (result.status === 503 || errorCode === 'delivery_failed' || errorCode === 'mail_send_failed') {
    return {
      ok: false,
      reason: 'deliveryFailed',
      message: result.message ?? 'Unable to deliver the verification code. Please try again later.',
    };
  }
  if (result.status === 401) {
    return { ok: false, reason: 'unauthorized', message: result.message ?? undefined };
  }
  if (result.kind === 'network' || result.kind === 'timeout') {
    return {
      ok: false,
      reason: 'network',
      message: 'Unable to connect to the server. Check your connection.',
    };
  }
  return { ok: false, reason: 'server', message: result.message ?? undefined };
}

/** POST /auth/verification/verify — check a 6-digit code for one channel. */
export async function verifyCode(
  channel: VerificationChannel,
  code: string,
): Promise<VerifyCodeOutcome> {
  const result = await apiRequest<VerifyCodeServerData>(VERIFY_CODE_PATH, {
    method: 'POST',
    body: { channel, code },
  });

  if (result.ok) {
    const data = result.data;
    return {
      ok: true,
      channel: data?.channel ?? channel,
      emailVerified: data?.email_verified === true,
      phoneVerified: data?.phone_verified === true,
      message: result.message ?? undefined,
    };
  }

  const rawData = result.data as Record<string, unknown> | null;
  const innerData =
    rawData && typeof rawData.data === 'object' && rawData.data !== null
      ? (rawData.data as Record<string, unknown>)
      : null;
  const errorCode =
    (rawData?.error_code as string) ??
    (innerData?.code as string) ??
    (rawData?.code as string) ??
    '';
  const attemptsLeft =
    typeof innerData?.attempts_left === 'number'
      ? innerData.attempts_left
      : typeof rawData?.attempts_left === 'number'
        ? rawData.attempts_left
        : undefined;

  if (result.status === 422) {
    if (errorCode === 'expired_code') {
      return {
        ok: false,
        reason: 'expired',
        message: result.message ?? 'Your verification code has expired. Request a new code.',
      };
    }
    if (errorCode === 'too_many_attempts') {
      return {
        ok: false,
        reason: 'tooManyAttempts',
        message: result.message ?? 'Too many incorrect attempts. Request a new code to continue.',
      };
    }
    if (errorCode === 'invalid_code') {
      return {
        ok: false,
        reason: 'invalid',
        message: result.message ?? 'Incorrect verification code. Please try again.',
        attemptsLeft,
      };
    }
    return {
      ok: false,
      reason: 'invalidOrExpired',
      message: result.message ?? 'Incorrect verification code. Please try again.',
    };
  }

  if (result.status === 429) {
    return { ok: false, reason: 'rateLimited', retryAfter: result.retryAfter, message: result.message ?? undefined };
  }
  if (result.status === 401) {
    return { ok: false, reason: 'unauthorized', message: result.message ?? undefined };
  }
  if (result.kind === 'network' || result.kind === 'timeout') {
    return {
      ok: false,
      reason: 'network',
      message: 'Unable to connect to the server. Check your connection.',
    };
  }
  return { ok: false, reason: 'server', message: result.message ?? undefined };
}

// `getCurrentUser` lives in `./auth` (shared with login). Re-exported here so the
// verification screen keeps importing it from this module.
export { getMe as getCurrentUser } from './auth';
