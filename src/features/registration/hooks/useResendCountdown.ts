/**
 * Resend countdown timer.
 *
 * The cooldown is the hook's initial state rather than something an effect
 * sets on mount, so the first render already shows a disabled button and no
 * state update happens inside the effect. A single interval subscription
 * decrements the counter and clears itself when it reaches zero; resends
 * restart it from an event handler, which is where state updates belong.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type UseResendCountdownResult = {
  secondsLeft: number;
  canResend: boolean;
  /** Restarts the countdown from the top. */
  start: () => void;
};

export function useResendCountdown(cooldownSeconds: number): UseResendCountdownResult {
  const [secondsLeft, setSecondsLeft] = useState(cooldownSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /** Called from an event handler when the user taps "Resend code". */
  const start = useCallback(() => {
    stop();
    setSecondsLeft(cooldownSeconds);
  }, [cooldownSeconds, stop]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          stop();
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return stop;
  }, [stop]);

  return { secondsLeft, canResend: secondsLeft === 0, start };
}
