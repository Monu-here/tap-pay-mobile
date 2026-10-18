/**
 * OTP configuration.
 *
 * Mock OTP verification exists **for local development only**. It is off by
 * default in any release build, because `__DEV__` is only true when running
 * from Metro (Expo Go or a development client) and is false in every EAS
 * release build — which covers both staging and production.
 *
 * The `EXPO_PUBLIC_ENABLE_MOCK_OTP` environment variable allows an explicit
 * override, so the default can never be silently flipped in a release:
 *
 *   EXPO_PUBLIC_ENABLE_MOCK_OTP=true    forced on (debug only)
 *   EXPO_PUBLIC_ENABLE_MOCK_OTP=false   forced off
 *   unset                               follows __DEV__
 *
 * Set it in an EAS build profile's `env` block if a staging build ever needs
 * it, never in the production profile.
 */

const explicitMockSetting = process.env.EXPO_PUBLIC_ENABLE_MOCK_OTP;

/**
 * `__DEV__` is a React Native global that is true only under Metro (Expo Go
 * or a development client) and false in every release build. It is absent in
 * plain Node, hence the `typeof` guard, which also keeps this module
 * importable in a test runner.
 */
const isDevBuild = typeof __DEV__ !== 'undefined' && __DEV__;

export const IS_MOCK_OTP_ENABLED: boolean =
  explicitMockSetting === 'true'
    ? true
    : explicitMockSetting === 'false'
      ? false
      : isDevBuild;

/**
 * The development mock code.
 *
 * This constant is bundled regardless of environment — what keeps it out of
 * production is `IS_MOCK_OTP_ENABLED`, which is the only switch the service
 * consults. `MOCK_OTP_CODE_FOR_DISPLAY` narrows the type to make it visually
 * obvious in the UI where the value is safe to surface.
 */
export const MOCK_OTP_CODE = '123456';

/** Same code, but only non-null when mock mode is actually active. */
export const MOCK_OTP_CODE_FOR_DISPLAY: string | null = IS_MOCK_OTP_ENABLED
  ? MOCK_OTP_CODE
  : null;

/** How long a mock code stays valid. */
export const MOCK_OTP_TTL_MS = 5 * 60 * 1000;

/** Consecutive wrong guesses allowed before the code is locked out. */
export const MOCK_OTP_MAX_ATTEMPTS = 5;

/** Seconds the resend button stays disabled. */
export const OTP_RESEND_COOLDOWN_SECONDS = 30;

/** Number of OTP input boxes. */
export const OTP_LENGTH = 6;
