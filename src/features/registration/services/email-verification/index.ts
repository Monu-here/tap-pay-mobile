/**
 * Email verification service selector.
 *
 * Screens import `emailVerificationService` from here and never construct an
 * implementation themselves, matching the OTP and registration selectors.
 */

import { LaravelEmailVerificationService } from './laravelEmailVerificationService';
import type { EmailVerificationService } from './types';

export const emailVerificationService: EmailVerificationService =
  new LaravelEmailVerificationService();

export type {
  EmailVerificationErrorReason,
  EmailVerificationOutcome,
  EmailVerificationService,
  VerifyEmailParams,
} from './types';
