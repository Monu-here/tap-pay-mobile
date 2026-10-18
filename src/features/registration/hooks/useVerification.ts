/**
 * Per-channel OTP verification state machine.
 *
 * Owns a channel's code, the send/resend cooldown, the wrong-attempt lockout
 * and the in-flight states, so the screen itself stays declarative. Both the
 * email and phone sections run their own instance, which is what makes them
 * independent. Requesting a new code resets the attempt counter, matching the
 * backend rule that a new code invalidates the previous one.
 *
 * The OTP `TextInput` ref is owned by the screen and passed in, so this hook
 * returns only plain values (never a ref) — keeping it safe to read during
 * render under the React Compiler.
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

import {
  sendVerificationCode,
  verifyCode,
  type VerificationChannel,
} from '../../auth/services/verification';
import type { OtpCodeInputHandle } from '../components/OtpCodeInput';
import {
  VERIFICATION_CODE_LENGTH,
  VERIFICATION_CODE_TTL_SECONDS,
  VERIFICATION_MAX_ATTEMPTS,
  VERIFICATION_RESEND_COOLDOWN_SECONDS,
} from '../config/verification';

const debug = (msg: string, ...optionalParams: unknown[]) => {
  console.log('[VERIFICATION]', msg, ...optionalParams);
};

export type VerificationStatus = 'idle' | 'sending' | 'awaiting' | 'verifying' | 'locked';

export type VerificationChannelState = {
  isVerified: boolean;
  status: VerificationStatus;
  code: string;
  /** True once a code has been successfully requested at least once. */
  codeSent: boolean;
  /** Resend cooldown remaining, in seconds. */
  secondsLeft: number;
  canResend: boolean;
  attemptsLeft: number;
  isBusy: boolean;
  error: { key: string; message?: string; params?: Record<string, string | number> } | null;
  setCode: (code: string) => void;
  send: () => void;
  submit: (code: string) => void;
};

export function useVerification(options: {
  channel: VerificationChannel;
  verified: boolean;
  onVerified: () => void;
  inputRef: RefObject<OtpCodeInputHandle | null>;
}): VerificationChannelState {
  const { channel, verified, onVerified, inputRef } = options;

  const [localVerified, setLocalVerified] = useState(false);
  const [status, setStatus] = useState<VerificationStatus>('idle');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [error, setError] = useState<{
    key: string;
    message?: string;
    params?: Record<string, string | number>;
  } | null>(null);

  // Double-tap guards
  const isSendingRef = useRef(false);
  const isVerifyingRef = useRef(false);

  const isVerified = verified || localVerified;
  const isBusy = status === 'sending' || status === 'verifying';
  const canResend = !isVerified && !isBusy && secondsLeft <= 0;

  const focus = useCallback(() => inputRef.current?.focus(), [inputRef]);
  const startCooldown = useCallback((seconds: number) => {
    setSecondsLeft(Math.max(0, Math.round(seconds)));
  }, []);

  const applyRateLimit = useCallback(
    (retryAfter?: number) => {
      const wait = retryAfter ?? VERIFICATION_RESEND_COOLDOWN_SECONDS;
      setError({ key: 'rateLimited', params: { seconds: wait } });
      startCooldown(wait);
    },
    [startCooldown],
  );

  // Cooldown timer; re-created whenever `secondsLeft` changes and cleared on
  // unmount or when it reaches zero.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          clearInterval(id);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const send = useCallback(async () => {
    if (isVerified || isBusy || isSendingRef.current) return;
    isSendingRef.current = true;
    setError(null);
    setStatus('sending');
    setCode('');

    try {
      debug('send called', { channel, isVerified, isBusy });
      const outcome = await sendVerificationCode(channel);
      if (outcome.ok) {
        debug('send outcome ok', { channel });
        setSentAt(Date.now());
        setAttempts(0);
        setCodeSent(true);
        setStatus('awaiting');
        startCooldown(VERIFICATION_RESEND_COOLDOWN_SECONDS);
        focus();
        return;
      }

      setStatus('idle');
      debug('send outcome not ok', { outcome, channel });
      if (outcome.reason === 'rateLimited') {
        applyRateLimit(outcome.retryAfter);
        return;
      }
      setError({ key: outcome.reason, message: outcome.message });
    } finally {
      isSendingRef.current = false;
    }
  }, [applyRateLimit, channel, focus, isBusy, isVerified, startCooldown]);

  const submit = useCallback(
    async (submitted: string) => {
      if (isVerified || isBusy || isVerifyingRef.current) return;
      if (status === 'locked') {
        setError({ key: 'tooManyAttempts' });
        return;
      }
      if (submitted.length < VERIFICATION_CODE_LENGTH) {
        setError({ key: 'incomplete', params: { length: VERIFICATION_CODE_LENGTH } });
        return;
      }
      // Proactive client-side expiry: skip a doomed request past the 10-minute window.
      if (sentAt && Date.now() - sentAt > VERIFICATION_CODE_TTL_SECONDS * 1000) {
        debug('code expired', { sentAt, now: Date.now(), ttl: VERIFICATION_CODE_TTL_SECONDS * 1000 });
        setError({ key: 'expired' });
        return;
      }

      isVerifyingRef.current = true;
      debug('submit called', { submitted, codeLength: submitted.length, channel, status, isVerified, isBusy });

      setStatus('verifying');
      setError(null);

      try {
        const outcome = await verifyCode(channel, submitted);
        debug('verifyCode outcome', { outcome, ok: outcome.ok });

        if (outcome.ok) {
          debug('verify successful');
          setLocalVerified(true);
          setSecondsLeft(0);
          setStatus('awaiting');
          onVerified();
          return;
        }

        setStatus('awaiting');
        if (outcome.reason === 'rateLimited') {
          debug('rate limited');
          applyRateLimit(outcome.retryAfter);
          return;
        }
        if (outcome.reason === 'expired') {
          debug('expired code');
          setCode('');
          setError({ key: 'expired', message: outcome.message });
          focus();
          return;
        }
        if (outcome.reason === 'tooManyAttempts') {
          debug('too many attempts');
          setStatus('locked');
          setCode('');
          setError({ key: 'tooManyAttempts', message: outcome.message });
          return;
        }
        if (outcome.reason === 'invalid' || outcome.reason === 'invalidOrExpired') {
          debug('invalid code');
          const nextAttempt = attempts + 1;
          setAttempts(nextAttempt);
          setCode('');
          if (nextAttempt >= VERIFICATION_MAX_ATTEMPTS) {
            debug('max attempts reached', { nextAttempt, max: VERIFICATION_MAX_ATTEMPTS });
            setStatus('locked');
            setError({ key: 'tooManyAttempts' });
          } else {
            setError({ key: 'invalid', message: outcome.message });
          }
          focus();
          return;
        }

        debug('unknown outcome reason', { outcome });
        setError({ key: outcome.reason, message: outcome.message });
      } finally {
        isVerifyingRef.current = false;
      }
    },
    [applyRateLimit, attempts, channel, focus, isBusy, isVerified, onVerified, sentAt, status],
  );

  return {
    isVerified,
    status,
    code,
    codeSent,
    secondsLeft,
    canResend,
    attemptsLeft: Math.max(0, VERIFICATION_MAX_ATTEMPTS - attempts),
    isBusy,
    error,
    setCode,
    send,
    submit,
  };
}
