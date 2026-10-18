/**
 * Single source for all user-facing strings (error messages + feature copy),
 * plus the helper that turns a failed API result into a message.
 *
 * Error strings follow the required contract:
 *   - no response (network/timeout) -> "Could not reach the server…"
 *   - 401                            -> session expired
 *   - 429                            -> too many attempts
 *   - 5xx                            -> something on our side
 *   - 422/other                      -> the server's own message, else generic
 */

import type { ApiFailure } from '@/features/auth/services/apiClient';

/** Interpolates `{name}` placeholders, e.g. `t(greeting, { name: 'Sam' })`. */
export function t(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export const common = {
  network: 'Could not reach the server. Check your connection and try again.',
  sessionExpired: 'Your session expired. Please sign in again.',
  rateLimited: 'Too many attempts. Please wait and try again.',
  serverError: 'Something went wrong on our side. Please try again later.',
  generic: 'Something went wrong. Please try again.',
  signupThenLoginFailed:
    'Your account was created, but we could not sign you in. Please sign in manually.',
  accountCreatedTitle: 'Account created',
  accountCreatedBody: 'Please check your email and phone for verification codes.',
  goToLogin: 'Go to login',
};

/** Maps a failed API result to the correct user-facing message. */
export function messageForApiFailure(result: ApiFailure): string {
  if (result.kind === 'network' || result.kind === 'timeout' || result.status === 0) {
    return common.network;
  }
  if (result.status === 401) return common.sessionExpired;
  if (result.status === 429) return common.rateLimited;
  if (result.status >= 500) return common.serverError;
  return result.message ?? common.generic;
}

export const login = {
  title: 'Welcome back',
  subtitle: 'Log in to continue to Tap & Pay',
  emailLabel: 'Email',
  emailPlaceholder: 'you@example.com',
  passwordLabel: 'Password',
  passwordPlaceholder: 'Enter your password',
  showPassword: 'Show password',
  hidePassword: 'Hide password',
  loginCta: 'Log in',
  loggingIn: 'Logging in…',
  registerPrompt: "Don't have an account?",
  registerCta: 'Sign up',
  rateLimited: common.rateLimited,
  retryIn: 'You can try again in {seconds}s',
  error: {
    emailRequired: 'Email is required',
    emailInvalid: 'Enter a valid email address',
    passwordRequired: 'Password is required',
    network: common.network,
    sessionExpired: common.sessionExpired,
    generic: common.generic,
  },
};

export const verification = {
  title: 'Verify your account',
  subtitle: 'Confirm your email and phone number to finish setting up your account.',
  emailSectionTitle: 'Email address',
  phoneSectionTitle: 'Phone number',
  verifiedBadge: 'Verified',
  pendingBadge: 'Not verified yet',
  codeHelper: 'Enter the 6-digit code we sent you.',
  sending: 'Sending code…',
  verifying: 'Verifying…',
  sendCode: 'Send code',
  resendCode: 'Resend code',
  resendIn: 'Resend code in {seconds}s',
  codeSentTo: 'We sent a code to {destination}.',
  devCodeHint: 'Development build: phone code is 123456. Email requires a real code from your inbox.',
  skip: 'Skip for now',
  back: 'Go back',
  error: {
    incomplete: 'Enter all {length} digits.',
    invalid: 'Incorrect verification code. Please try again.',
    invalidOrExpired: 'Incorrect verification code. Please try again.',
    expired: 'Your verification code has expired. Request a new code.',
    tooManyAttempts: 'Too many incorrect attempts. Request a new code to continue.',
    mailSendFailed: 'Unable to send the email right now. Please try again later.',
    rateLimited: common.rateLimited,
    timeout: common.network,
    network: common.network,
    sessionExpired: common.sessionExpired,
    server: common.serverError,
  },
};
