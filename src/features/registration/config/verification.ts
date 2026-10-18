/**
 * Email + phone OTP verification configuration.
 */

const isDevBuild = typeof __DEV__ !== 'undefined' && __DEV__;

/**
 * When true, a user with any unverified channel must finish the
 * VerificationScreen before reaching the app. When false, a "Skip for now"
 * action is offered.
 */
export const REQUIRE_VERIFICATION = true;

/** OTP length (digits). */
export const VERIFICATION_CODE_LENGTH = 6;

/** A code is valid for 10 minutes from when it was issued. */
export const VERIFICATION_CODE_TTL_SECONDS = 10 * 60;

/** Wrong attempts allowed per code before the user must request a new one. */
export const VERIFICATION_MAX_ATTEMPTS = 5;

/** Default resend cooldown (seconds); a 429 `retry_after` overrides it. */
export const VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;

/**
 * In local/testing, when TAPPAY_VERIFICATION_PHONE_DEV_MODE=true is set on the
 * backend, the backend uses this fixed OTP for PHONE verification only.
 *
 * Email verification ALWAYS requires a real randomly generated OTP sent to the
 * user's inbox — the fixed dev code is never accepted for email in any environment.
 *
 * Displayed in the UI only during development builds (phone card only).
 */
export const VERIFICATION_PHONE_DEV_CODE = '123456';
export const VERIFICATION_DEV_CODE_FOR_DISPLAY: string | null = isDevBuild
  ? VERIFICATION_PHONE_DEV_CODE
  : null;

/**
 * @deprecated Use VERIFICATION_PHONE_DEV_CODE. Kept for backward-compatibility.
 */
export const VERIFICATION_DEV_CODE = VERIFICATION_PHONE_DEV_CODE;
