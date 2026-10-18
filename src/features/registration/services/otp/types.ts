/**
 * OTP service contract.
 *
 * The screens depend only on this interface, so swapping the local mock for
 * real Laravel calls is a one-line change in `otpService.ts` and no screen
 * has to be touched.
 */

import type { VerificationChannel } from '../../types';

export type OtpDestination = {
  channel: VerificationChannel;
  /** Canonical value the code was sent to (email, or `977…` phone key). */
  value: string;
};

export type SendOtpResult =
  | {
      ok: true;
      /** ISO timestamp after which the code is no longer accepted. */
      expiresAt: string;
    }
  | { ok: false; message: string };

export type VerifyOtpFailureReason =
  /** Code wrong, or shaped incorrectly. */
  | 'invalid'
  /** Code was right but the window elapsed. */
  | 'expired'
  /** Too many consecutive wrong guesses. */
  | 'locked'
  /** No backend configured — production only. */
  | 'unavailable';

export type VerifyOtpResult =
  | { ok: true; verifiedValue: string }
  | { ok: false; message: string; reason: VerifyOtpFailureReason };

export interface OtpService {
  /**
   * Issues a code for one channel and starts its validity window.
   * Called on first entry and on every resend.
   */
  send(destination: OtpDestination): Promise<SendOtpResult>;

  /**
   * Checks a code for one channel. Attempt counting and expiry are enforced
   * here, not in the UI, so the limits cannot be bypassed from a screen.
   */
  verify(destination: OtpDestination, code: string): Promise<VerifyOtpResult>;
}
