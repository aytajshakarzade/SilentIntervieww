import { useCallback, useEffect, useRef, useState } from 'react';
import { createEmotionSession } from '../services/emotionService';

const DEFAULT_RESULT = Object.freeze({
  emotion: null,
  score: 0,
  history: [],
  faceFound: false,
  breakdown: null,
});

export function useEmotion() {
  const [result, setResult] = useState(DEFAULT_RESULT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(false);

  const sessionRef = useRef(null);
  const isDisposedRef = useRef(false);
  // Tracks whether a createEmotionSession() call is in flight, synchronously,
  // before the awaited promise settles. sessionRef alone isn't enough: in
  // React StrictMode (dev), the mount effect runs, is cleaned up, then runs
  // again — both calling start(videoEl). The first call's `await
  // createEmotionSession(...)` hasn't resolved yet when the second call
  // checks `if (sessionRef.current) return`, so both proceed and construct
  // two competing FaceMesh instances against the same shared WASM module.
  // Whichever resolves second overwrites sessionRef.current, orphaning the
  // other's session object — but the mount/cleanup/remount cycle also flips
  // isDisposedRef.current false→true→false, so the orphaned call's
  // `isDisposedRef.current` check (after its own await) can read `false`
  // again and let a stale session through anyway. Guarding here,
  // synchronously, before any await, closes that window entirely.
  const startingRef = useRef(false);

  const start = useCallback(async (videoEl) => {
    console.log('[EMOTION-TRACE] useEmotion.start() entered', { hasVideo: !!videoEl, alreadySession: !!sessionRef.current, starting: startingRef.current });
    if (!videoEl) return;
    if (sessionRef.current || startingRef.current) { console.log('[EMOTION-TRACE] blocked re-entry'); return; }
    startingRef.current = true;

    setLoading(true);
    setError(null);
    try {
      const session = await createEmotionSession({
        onFrame: (frame) => {
          if (isDisposedRef.current) return;
          console.log('[EMOTION-TRACE] onFrame received', frame);
          setResult(frame);
        },
      });
      console.log('[EMOTION-TRACE] createEmotionSession resolved', { disposed: isDisposedRef.current, hasExistingSession: !!sessionRef.current });
      if (isDisposedRef.current || sessionRef.current) {
        session.stop();
        return;
      }
      sessionRef.current = session;
      session.start(videoEl);
      console.log('[EMOTION-TRACE] session.start() called, setting active=true');
      setActive(true);
    } catch (err) {
      console.log('[EMOTION-TRACE] createEmotionSession THREW', err);
      if (isDisposedRef.current) return;
      setError(err.message || 'Emotion detection unavailable.');
      setActive(false);
    } finally {
      startingRef.current = false;
      if (!isDisposedRef.current) setLoading(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.stop();
      sessionRef.current = null;
    }
    startingRef.current = false;
    setActive(false);
    setResult(DEFAULT_RESULT);
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

  return { result, loading, error, active, start, stop };
}