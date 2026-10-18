/**
 * Screen 5 — Email OTP verification.
 *
 * Verifies the email channel only. A valid code here advances to the phone
 * step; it does not mark registration complete. The guard below prevents a
 * user reaching this screen without the earlier steps, and prevents reaching
 * the *next* step by any route other than a successful verification here.
 *
 * Alongside the code, a secondary action re-sends the backend verification
 * email (`POST /auth/resend-verification`) for users who prefer to follow the
 * link in their inbox. The OTP flow and this resend are independent.
 */

import { Redirect, router } from 'expo-router';
import { useCallback, useState } from 'react';

import { MOCK_OTP_CODE_FOR_DISPLAY } from '../config/otp';
import { OtpVerificationLayout } from '../components/OtpVerificationLayout';
import { useOtpVerification } from '../hooks/useOtpVerification';
import { useRegistration } from '../RegistrationContext';
import { emailVerificationService } from '../services/email-verification';
import { validateEmail } from '../validation';

export function EmailOtpScreen() {
  const { data, markChannelVerified, isChannelVerified } = useRegistration();
  const email = data.personal.email.trim();

  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [resendEmailStatus, setResendEmailStatus] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleVerified = useCallback(
    (verifiedValue: string) => {
      markChannelVerified('email', verifiedValue);
      router.push('/register/phone-otp');
    },
    [markChannelVerified],
  );

  const destination = email.toLowerCase();
  const verification = useOtpVerification({
    channel: 'email',
    destination,
    onVerified: handleVerified,
  });

  // Re-sends the backend verification email. No auth token is required in the
  // current build; the returned flag/message is surfaced directly to the user.
  const handleResendVerificationEmail = useCallback(async () => {
    setIsResendingEmail(true);
    const result = await emailVerificationService.resend();
    setIsResendingEmail(false);
    setResendEmailStatus({ tone: result.ok ? 'success' : 'error', message: result.message });
  }, []);

  // Guard: cannot verify an email that was never provided, and cannot arrive
  // here before the user type and documents are complete.
  if (!email || validateEmail(email) || !data.userType || !data.documents) {
    return <Redirect href="/register/personal-info" />;
  }

  // Already verified with the current address: skip straight to the phone step
  // so the user is never asked to verify the same email twice.
  if (isChannelVerified('email')) {
    return <Redirect href="/register/phone-otp" />;
  }

  return (
    <OtpVerificationLayout
      step={5}
      heading="Verify Your Email"
      destinationLabel="Email address"
      destination={email}
      message="Enter the 6-digit verification code sent to your email."
      code={verification.code}
      onCodeChange={verification.handleCodeChange}
      codeError={verification.codeError}
      formError={verification.formError}
      isVerifying={verification.isVerifying}
      isVerifyDisabled={verification.isVerifyDisabled}
      verifyLabel="Verify Email"
      onVerify={verification.handleVerify}
      onBack={() => router.back()}
      secondsLeft={verification.secondsLeft}
      canResend={verification.canResend}
      onResend={verification.handleResend}
      changeLabel="Change Email"
      devHint={MOCK_OTP_CODE_FOR_DISPLAY}
      otpInputRef={verification.inputRef}
      footerNote="Only your email is verified by this step. Your phone number is verified next."
      onResendEmail={handleResendVerificationEmail}
      resendEmailLabel="Resend verification email"
      isResendingEmail={isResendingEmail}
      resendEmailStatus={resendEmailStatus}
    />
  );
}
