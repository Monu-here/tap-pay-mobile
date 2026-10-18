/**
 * OTP service selector.
 *
 * Screens import `otpService` from here and never pick an implementation
 * themselves. Mock mode is only reachable when `IS_MOCK_OTP_ENABLED` is
 * true, which is dev-only by default — so a staging or production build falls
 * through to the Laravel service and cannot verify a code locally.
 */

import { IS_MOCK_OTP_ENABLED } from '../../config/otp';
import { laravelOtpService } from './laravelOtpService';
import { mockOtpService } from './mockOtpService';
import type { OtpService } from './types';

export const otpService: OtpService = IS_MOCK_OTP_ENABLED ? mockOtpService : laravelOtpService;

export type {
  OtpDestination,
  OtpService,
  SendOtpResult,
  VerifyOtpFailureReason,
  VerifyOtpResult,
} from './types';
