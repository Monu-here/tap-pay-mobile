/**
 * Local mock OTP service — DEVELOPMENT ONLY.
 *
 * Simulates the behaviour a real backend would own: issuing a code, a
 * validity window, resend, and an attempt limit. Nothing is sent anywhere —
 * no email, no SMS. Codes are held in memory only and vanish when the app
 * restarts.
 *
 * This service refuses to operate unless `IS_MOCK_OTP_ENABLED` is true, so a
 * staging or production build cannot verify with a mock code even if it is
 * entered.
 */

import {
  IS_MOCK_OTP_ENABLED,
  MOCK_OTP_CODE,
  MOCK_OTP_MAX_ATTEMPTS,
  MOCK_OTP_TTL_MS,
} from '../../config/otp';
import type {
  OtpDestination,
  OtpService,
  SendOtpResult,
  VerifyOtpResult,
} from './types';

type Challenge = {
  code: string;
  expiresAt: number;
  attempts: number;
};

/** Fake network latency so loading states are exercised, as a real call would. */
const NETWORK_DELAY_MS = 700;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** One challenge per channel+destination, so email and phone are independent. */
const challenges = new Map<string, Challenge>();

function challengeKey(destination: OtpDestination): string {
  return `${destination.channel}:${destination.value}`;
}

const UNAVAILABLE_SEND: SendOtpResult = {
  ok: false,
  message: 'Verification is unavailable in this build.',
};

const UNAVAILABLE_VERIFY: VerifyOtpResult = {
  ok: false,
  reason: 'unavailable',
  message: 'Verification is unavailable in this build.',
};

export class MockOtpService implements OtpService {
  /** Guards against a code that somehow reaches a release build. */
  private assertEnabled(): void {
    if (!IS_MOCK_OTP_ENABLED) {
      throw new Error(
        'MockOtpService is development only and is disabled in this build. ' +
          'Configure the Laravel OTP service instead.',
      );
    }
  }

  async send(destination: OtpDestination): Promise<SendOtpResult> {
    this.assertEnabled();
    await delay(NETWORK_DELAY_MS);

    challenges.set(challengeKey(destination), {
      code: MOCK_OTP_CODE,
      expiresAt: Date.now() + MOCK_OTP_TTL_MS,
      attempts: 0,
    });

    // Intentionally does not return the code — the UI must not rely on the
    // answer being handed to it, the way a real backend never does.
    return { ok: true, expiresAt: new Date(Date.now() + MOCK_OTP_TTL_MS).toISOString() };
  }

  async verify(destination: OtpDestination, code: string): Promise<VerifyOtpResult> {
    this.assertEnabled();
    await delay(NETWORK_DELAY_MS);

    const challenge = challenges.get(challengeKey(destination));
    if (!challenge) {
      return {
        ok: false,
        reason: 'invalid',
        message: 'No code was requested. Tap "Resend code" to get a new one.',
      };
    }

    if (challenge.attempts >= MOCK_OTP_MAX_ATTEMPTS) {
      return {
        ok: false,
        reason: 'locked',
        message: 'Too many incorrect attempts. Tap "Resend code" to try again.',
      };
    }

    if (Date.now() > challenge.expiresAt) {
      challenges.delete(challengeKey(destination));
      return {
        ok: false,
        reason: 'expired',
        message: 'This code has expired. Tap "Resend code" for a new one.',
      };
    }

    if (code !== challenge.code) {
      challenge.attempts += 1;
      const remaining = MOCK_OTP_MAX_ATTEMPTS - challenge.attempts;
      return {
        ok: false,
        reason: 'invalid',
        message:
          remaining > 0
            ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`
            : 'Too many incorrect attempts. Tap "Resend code" to try again.',
      };
    }

    challenges.delete(challengeKey(destination));
    return { ok: true, verifiedValue: destination.value };
  }
}

export const mockOtpService = new MockOtpService();
export { UNAVAILABLE_SEND, UNAVAILABLE_VERIFY };
