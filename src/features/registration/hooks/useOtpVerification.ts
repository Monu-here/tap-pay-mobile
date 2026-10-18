/**
 * OTP verification state machine shared by the email and phone screens.
 *
 * Owns the code, the in-flight states, the resend countdown and the initial
 * code request, so neither screen reimplements them. Both channels run their
 * own instance, which is what makes them verify independently.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  OTP_LENGTH,
  OTP_RESEND_COOLDOWN_SECONDS,
} from '../config/otp';
import { otpService } from '../services/otp';
import type { VerificationChannel } from '../types';
import { useResendCountdown } from './useResendCountdown';
import type { OtpInputRef } from '../components/OtpInput';

export type UseOtpVerificationOptions = {
  channel: VerificationChannel;
  /** Canonical value the code is sent to and verified against. */
  destination: string;
  onVerified: (verifiedValue: string) => void;
};

export function useOtpVerification({
  channel,
  destination,
  onVerified,
}: UseOtpVerificationOptions) {
  const inputRef = useRef<OtpInputRef>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Mirror `code` in a ref so the verify callback always submits the digits
  // the user has most recently typed. `handleVerify` is memoized with
  // `useCallback([channel, destination, onVerified])` and deliberately omits
  // `code`, so without this ref the closure would capture the code that was
  // in state when the hook last re-rendered — stale by the time the await
  // resolves, and wrong the moment the user edits the input mid-request.
  const codeRef = useRef(code);
  useEffect(() => {
    codeRef.current = code;
  }, [code]);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const { secondsLeft, canResend, start } = useResendCountdown(OTP_RESEND_COOLDOWN_SECONDS);

  const requestCode = useCallback(async () => {
    // Only ever called from a user action (resend), where resetting state
    // synchronously is fine and gives immediate feedback.
    setIsSending(true);
    setFormError(null);
    setCodeError(null);
    setCode('');

    const result = await otpService.send({ channel, value: destination });
    setIsSending(false);

    if (!result.ok) {
      setFormError(result.message);
      return;
    }

    start();
    inputRef.current?.focus();
  }, [channel, destination, start]);

  const hasDestination = destination.trim().length > 0;

  // Request a code when the screen opens. This deliberately does NOT clear
  // the code or toggle `isSending` before awaiting — the empty code already
  // keeps the verify button disabled, and avoiding synchronous state updates
  // here keeps the mount from cascading renders. Re-runs only when the
  // destination changes, which is exactly when a contact detail was edited
  // and the previous verification no longer applies.
  useEffect(() => {
    // The guards in the screens redirect when a contact is missing; don't
    // spend a request on a destination that isn't there yet.
    if (!hasDestination) return;

    let isActive = true;

    (async () => {
      const result = await otpService.send({ channel, value: destination });
      if (!isActive) return;

      if (!result.ok) {
        setFormError(result.message);
        return;
      }

      start();
      inputRef.current?.focus();
    })();

    return () => {
      isActive = false;
    };
  }, [channel, destination, hasDestination, start]);

  const handleResend = useCallback(() => {
    if (!canResend) return;
    requestCode();
  }, [canResend, requestCode]);

  const handleCodeChange = useCallback((next: string) => {
    setCode(next);
    if (codeError) setCodeError(null);
    if (formError) setFormError(null);
  }, [codeError, formError]);

  const handleVerify = useCallback(async () => {
    const verifyingCode = codeRef.current;
    if (verifyingCode.length < OTP_LENGTH) {
      setCodeError(`Enter all ${OTP_LENGTH} digits`);
      return;
    }

    setIsVerifying(true);
    setCodeError(null);
    setFormError(null);

    const result = await otpService.verify({ channel, value: destination }, verifyingCode);
    setIsVerifying(false);

    if (!result.ok) {
      // Expiry and lockout are not the user mistyping a digit, so they belong
      // on the form-level error rather than under the boxes.
      if (result.reason === 'expired' || result.reason === 'locked' || result.reason === 'unavailable') {
        setFormError(result.message);
      } else {
        setCodeError(result.message);
      }
      inputRef.current?.focus();
      return;
    }

    onVerified(result.verifiedValue);
  }, [channel, destination, onVerified]);

  return {
    inputRef,
    code,
    codeError,
    formError,
    isSending,
    isVerifying,
    secondsLeft,
    canResend,
    handleResend,
    handleCodeChange,
    handleVerify,
    isVerifyDisabled: isSending || code.length < OTP_LENGTH,
  };
}
