/**
 * Email verification service contract (link-based).
 *
 * The backend does not verify email with an in-app code: it emails a signed
 * link that hits `GET /auth/verify-email/{id}/{hash}` (guarded by the `signed`
 * middleware), and `POST /auth/resend-verification` re-issues that mail for the
 * authenticated user. This mirrors the OTP service split (interface +
 * implementation + selector) so screens depend only on `EmailVerificationService`.
 */

export type EmailVerificationErrorReason =
  /** Bad or expired signed link, or an unknown user id (403/404 on verify). */
  | 'invalid'
  /** Rate-limited by `throttle:public` / `throttle:auth` (429). */
  | 'throttled'
  /** No valid Sanctum token for the authenticated resend route (401). */
  | 'unauthenticated'
  /** Transport failure or timeout. */
  | 'network'
  | 'unknown';

export type EmailVerificationOutcome =
  | {
      ok: true;
      /**
       * `verify`: true once the address is verified. `resend`: the backend's
       * own flag — true when the address was already verified, false when a
       * fresh mail was dispatched.
       */
      verified: boolean;
      message: string;
    }
  | { ok: false; message: string; reason: EmailVerificationErrorReason };

export type VerifyEmailParams = {
  id: string | number;
  /** sha1 of the user's email, as embedded in the signed link. */
  hash: string;
  /** Query params lifted from the signed link. */
  query?: {
    signature: string;
    expires: number | string;
  };
};

export interface EmailVerificationService {
  /**
   * Re-issue the verification mail. The route is declared `auth:sanctum`, but
   * the current build calls it unauthenticated, so the token is optional and
   * only attached when a caller supplies one.
   */
  resend(accessToken?: string): Promise<EmailVerificationOutcome>;

  /** Complete verification from the parameters of a signed emailed link. */
  verify(params: VerifyEmailParams): Promise<EmailVerificationOutcome>;
}
