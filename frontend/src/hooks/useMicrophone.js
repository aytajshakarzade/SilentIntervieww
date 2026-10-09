import { useCallback, useEffect, useRef, useState } from 'react';

const SPEAKING_THRESHOLD = 0.045;
const SILENCE_HOLD_MS = 400;

export function useMicrophone({ onSpeakingStart, onSpeakingStop } = {}) {
  const [active, setActive] = useState(false);
  const [level, setLevel] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [noMicrophone, setNoMicrophone] = useState(false);

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);
  const speakingRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const isDisposedRef = useRef(false);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;

    if (sourceRef.current) { try { sourceRef.current.disconnect(); } catch { } sourceRef.current = null; }
    if (analyserRef.current) { try { analyserRef.current.disconnect(); } catch { } analyserRef.current = null; }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => { });
    }
    audioCtxRef.current = null;

    setActive(false);
    setLevel(0);
    setSpeaking(false);
    speakingRef.current = false;
  }, []);

  const start = useCallback(async (existingStream = null) => {
    setError(null);
    setPermissionDenied(false);
    setNoMicrophone(false);
    try {
      let stream = existingStream;
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.6;
      analyserRef.current = analyser;

      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      function tick() {
        if (isDisposedRef.current || !analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(dataArray);

        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const norm = (dataArray[i] - 128) / 128;
          sumSquares += norm * norm;
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);
        const normalizedLevel = Math.min(1, rms * 4);

        setLevel(normalizedLevel);

        if (normalizedLevel > SPEAKING_THRESHOLD) {
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
          if (!speakingRef.current) {
            speakingRef.current = true;
            setSpeaking(true);
            onSpeakingStart?.();
          }
        } else if (speakingRef.current && !silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            speakingRef.current = false;
            setSpeaking(false);
            onSpeakingStop?.();
            silenceTimerRef.current = null;
          }, SILENCE_HOLD_MS);
        }

        rafRef.current = requestAnimationFrame(tick);
      }
      tick();

      setActive(true);
      return stream;
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
        setError('Microphone permission denied.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setNoMicrophone(true);
        setError('No microphone found.');
      } else {
        setError(err.message || 'Failed to access microphone.');
      }
      throw err;
    }
  }, [onSpeakingStart, onSpeakingStop]);

  useEffect(() => {
    isDisposedRef.current = false;
    return () => {
      isDisposedRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (sourceRef.current) { try { sourceRef.current.disconnect(); } catch { } }
      if (analyserRef.current) { try { analyserRef.current.disconnect(); } catch { } }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => { });
      }
    };
  }, []);

  return {
    active,
    level,
    speaking,
    error,
    permissionDenied,
    noMicrophone,
    start,
    stop,
  };
}