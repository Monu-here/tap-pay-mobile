/**
 * Laravel-backed OTP service — integration point for the
 * registration flow.
 *
 * PRODUCTION STATUS: the deployed backend does NOT expose
 * registration OTP endpoints. The routes this flow needs are
 * missing and must be added before phone/email OTP verification
 * can work outside a development build:
 *
 *   POST /api/v1/register/email-otp         { email }  -> { expires_at }
 *   POST /api/v1/register/email-otp/verify  { email, code } -> { verified: true }
 *   POST /api/v1/register/phone-otp         { phone } -> { expires_at }
 *   POST /api/v1/register/phone-otp/verify  { phone, code } -> { verified: true }
 *
 * What the backend DOES have today:
 *   - POST /api/v1/auth/verification/send   { channel }   (auth:sanctum)
 *   - POST /api/v1/auth/verification/verify { channel, code } (auth:sanctum)
 *
 * Those two require an authenticated user, so they cannot drive
 * the registration flow (a brand-new registrant has no token
 * until they have logged in, which itself requires a verified
 * account). They are already used by the post-login
 * `VerificationScreen` via `auth/services/verification.ts`.
 *
 * Until the registration OTP routes above are built, every call
 * here resolves to `unavailable` rather than pretending to
 * succeed. That is deliberate — a silent success would be far
 * worse than a visible "not configured" error during
 * integration. Local development uses the isolated
 * `MockOtpService` (code `123456`) instead — see `otp/index.ts`.
 *
 * The server owns code generation, expiry, resend limits and
 * attempt caps. The client must never generate or trust a code.
 */

import type {
  OtpDestination,
  OtpService,
  SendOtpResult,
  VerifyOtpResult,
} from './types';

/**
 * Base URL of the Laravel API for the registration OTP routes.
 * `null` until the backend exposes them — the guard that keeps
 * this service from pretending to verify against routes that do
 * not exist yet.
 */
const API_BASE_URL: string | null = null;

const NOT_CONFIGURED_SEND: SendOtpResult = {
  ok: false,
  message:
    'Verification is not configured for this build. Contact support.',
};

const NOT_CONFIGURED_VERIFY: VerifyOtpResult = {
  ok: false,
  reason: 'unavailable',
  message:
    'Verification is not configured for this build. Contact support.',
};

/**
 * Request path for a channel and action.
 *
 * Exported so the paths live in exactly one place while the API
 * is unbuilt, and so the commented implementations below stay in
 * sync if they change.
 */
export function resolveEndpoint(
  channel: OtpDestination['channel'],
  action: 'send' | 'verify',
): string {
  const base = '/register';
  const resource = channel === 'email' ? 'email-otp' : 'phone-otp';
  return action === 'send' ? `${base}/${resource}` : `${base}/${resource}/verify`;
}

export class LaravelOtpService implements OtpService {
  async send(destination: OtpDestination): Promise<SendOtpResult> {
    if (!API_BASE_URL) return NOT_CONFIGURED_SEND;

    // Intended implementation once the routes exist:
    //   const res = await fetch(`${API_BASE_URL}${resolveEndpoint(destination.channel, 'send')}`, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    //     body: JSON.stringify({ [destination.channel]: destination.value }),
    //   });
    //   if (!res.ok) return { ok: false, message: 'Could not send the code.' };
    //   const { expires_at } = await res.json();
    //   return { ok: true, expiresAt: expires_at };
    return NOT_CONFIGURED_SEND;
  }

  async verify(destination: OtpDestination, code: string): Promise<VerifyOtpResult> {
    if (!API_BASE_URL) return NOT_CONFIGURED_VERIFY;

    // Intended implementation once the routes exist:
    //   const res = await fetch(`${API_BASE_URL}${resolveEndpoint(destination.channel, 'verify')}`, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    //     body: JSON.stringify({ [destination.channel]: destination.value, code }),
    //   });
    //   if (res.status === 401) return { ok: false, reason: 'invalid', message: 'Incorrect code.' };
    //   if (res.status === 410) return { ok: false, reason: 'expired', message: 'Code expired.' };
    //   if (res.status === 429) return { ok: false, reason: 'locked', message: 'Too many attempts.' };
    //   if (!res.ok) return { ok: false, reason: 'unavailable', message: 'Verification failed.' };
    //   return { ok: true, verifiedValue: destination.value };
    return NOT_CONFIGURED_VERIFY;
  }
}

export const laravelOtpService = new LaravelOtpService();
