/**
 * useTimer
 *
 * Countdown timer with elapsed tracking.
 * Extracted from LiveInterviewPage for reuse and testability.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * @param {number} initialSeconds — starting countdown value (default 15 min)
 */
export function useTimer(initialSeconds = 900) {
  const [seconds, setSeconds]   = useState(initialSeconds);  // remaining
  const [elapsed, setElapsed]   = useState(0);               // total time elapsed
  const [running, setRunning]   = useState(false);

  const intervalRef  = useRef(null);
  const runningRef   = useRef(false);   // ref for use inside the interval callback

  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setSeconds((s) => Math.max(s - 1, 0));
      setElapsed((e) => e + 1);
    }, 1000);
  }, []);

  const stop = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  const reset = useCallback((newInitial = initialSeconds) => {
    stop();
    setSeconds(newInitial);
    setElapsed(0);
  }, [stop, initialSeconds]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);

  return { seconds, elapsed, running, start, stop, reset };
}
