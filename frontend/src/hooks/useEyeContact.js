import { useCallback, useEffect, useRef, useState } from 'react';
import { createEyeContactSession } from '../services/eyeContactService';

const DEFAULT_STATUS = Object.freeze({
  faceCount: 0,
  faceDetected: false,
  multipleFaces: false,
  lookingAtCamera: false,
  faceCentered: false,
  noseOffset: 0,
  direction: 'unknown',
  eyeContactPct: null,
  lookingAwayMs: 0,
  lookingAwayWarn: false,
});

const HISTORY_MAX = 20;

export function useEyeContact() {
  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(false);

  const sessionRef = useRef(null);
  const isDisposedRef = useRef(false);

  const start = useCallback(async (videoEl) => {
    if (!videoEl) return;
    if (sessionRef.current) return;

    setLoading(true);
    setError(null);
    setHistory([]);
    try {
      const session = await createEyeContactSession({
        onFrame: (frame) => {
          if (isDisposedRef.current) return;
          setStatus(frame);
          // Real, deterministic per-frame log built from the same values
          // already reported by eyeContactService — no fabricated data.
          setHistory((prev) => {
            const next = [...prev, {
              lookingAtCamera: frame.lookingAtCamera,
              eyeContactPct: frame.eyeContactPct,
              faceDetected: frame.faceDetected,
              ts: Date.now(),
            }];
            return next.length > HISTORY_MAX ? next.slice(-HISTORY_MAX) : next;
          });
        },
      });
      if (isDisposedRef.current) {
        session.stop();
        return;
      }
      sessionRef.current = session;
      session.start(videoEl);
      setActive(true);
    } catch (err) {
      if (isDisposedRef.current) return;
      setError(err.message || 'Eye contact detection unavailable.');
      setActive(false);
    } finally {
      if (!isDisposedRef.current) setLoading(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.stop();
      sessionRef.current = null;
    }
    setActive(false);
    setStatus(DEFAULT_STATUS);
    // history is intentionally left as-is: submitInterview() reads
    // eyeContact.history immediately after calling stop(), and the next
    // start() call resets it for the new session.
  }, []);

  useEffect(() => {
    isDisposedRef.current = false;
    return () => {
      isDisposedRef.current = true;
      if (sessionRef.current) {
        sessionRef.current.stop();
        sessionRef.current = null;
      }
    };
  }, []);

  return { status, history, loading, error, active, start, stop };
}