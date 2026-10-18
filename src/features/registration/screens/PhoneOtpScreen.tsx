/**
 * Screen 6 — Phone OTP verification.
 *
 * Verifies the phone channel only. The redirect to the email step when the
 * email is not yet verified is what stops a user skipping straight here, and
 * the check against the current phone number is what makes an edited number
 * need verifying again.
 */

import { Redirect, router } from 'expo-router';
import { useCallback } from 'react';

import { MOCK_OTP_CODE_FOR_DISPLAY } from '../config/otp';
import { OtpVerificationLayout } from '../components/OtpVerificationLayout';
import { useOtpVerification } from '../hooks/useOtpVerification';
import { useRegistration } from '../RegistrationContext';
import { canonicalPhoneKey, formatNepalPhone } from '../utils/phone';
import { validatePhone } from '../validation';

export function PhoneOtpScreen() {
  const { data, markChannelVerified, isChannelVerified } = useRegistration();
  const phone = data.personal.phoneNumber.trim();

  const handleVerified = useCallback(
    (verifiedValue: string) => {
      markChannelVerified('phone', verifiedValue);
      router.push('/register/success');
    },
    [markChannelVerified],
  );

  const phoneError = phone ? validatePhone(phone) : 'Phone number is required';
  // The code is verified against the canonical phone key (`977` + the 10
  // local digits), which is exactly what `isChannelVerified('phone')`
  // compares the stored value against — so a successful verify counts.
  const verification = useOtpVerification({
    channel: 'phone',
    destination: canonicalPhoneKey(phone),
    onVerified: handleVerified,
  });

  // Guard: the email must be verified before the phone can be. Verified
  // against the *current* email, so editing it after verifying sends the
  // user back to the email step.
  if (!data.personal.email.trim() || !isChannelVerified('email')) {
    return <Redirect href="/register/email-otp" />;
  }

  if (phoneError || !data.userType || !data.documents) {
    return <Redirect href="/register/personal-info" />;
  }

  return (
    <OtpVerificationLayout
      step={6}
      heading="Verify Your Phone Number"
      destinationLabel="Phone number"
      destination={formatNepalPhone(phone)}
      message="Enter the 6-digit verification code sent to your phone."
      code={verification.code}
      onCodeChange={verification.handleCodeChange}
      codeError={verification.codeError}
      formError={verification.formError}
      isVerifying={verification.isVerifying}
      isVerifyDisabled={verification.isVerifyDisabled}
      verifyLabel="Verify Phone Number"
      onVerify={verification.handleVerify}
      onBack={() => router.back()}
      secondsLeft={verification.secondsLeft}
      canResend={verification.canResend}
      onResend={verification.handleResend}
      changeLabel="Change Phone Number"
      devHint={MOCK_OTP_CODE_FOR_DISPLAY}
      otpInputRef={verification.inputRef}
      footerNote="Only your phone number is verified by this step. Your email was verified separately."
    />
  );
}
