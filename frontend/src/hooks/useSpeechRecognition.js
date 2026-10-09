/**
 * useSpeechRecognition
 *
 * React hook that wraps createSpeechSession.
 * Re-creates the session when the language changes so the browser
 * speech engine switches locale immediately.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createSpeechSession,
  isRecognitionSupported,
  speechLanguageFor,
} from '../services/speechRecognitionService';

export function useSpeechRecognition(lang = null) {
  const [listening, setListening] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState(null);
  const [errorCode, setErrorCode] = useState(null);

  const sessionRef = useRef(null);
  const onFinalRef = useRef(null);
  const baseAnswerRef = useRef('');
  const langRef = useRef(lang);

  const language = lang ? speechLanguageFor(lang) : (navigator.language || 'en-US');
  const wasListeningRef = useRef(false);

  // ─── (Re-)create session when language changes ──────────────────────────────
  useEffect(() => {
    if (!isRecognitionSupported()) return;

    // Remember whether we were actively listening so we can seamlessly
    // resume after rebuilding the session for the new language, instead
    // of silently going quiet until the user manually toggles the mic.
    const shouldResume = wasListeningRef.current;

    // Dispose previous session
    sessionRef.current?.dispose();

    const session = createSpeechSession({
      lang: language,
      onFinalTranscript: (finalText) => {
        // finalText is the full accumulator for THIS question session.
        // Combine with any base text that existed before mic was enabled.
        const combined = baseAnswerRef.current
          ? baseAnswerRef.current.trimEnd() + ' ' + finalText
          : finalText;
        onFinalRef.current?.(combined.trim());
      },
      onInterimTranscript: setInterim,
      onError: (err) => {
        setError(err.message || `Speech error: ${err.code}`);
        setErrorCode(err.code || null);
      },
      onStateChange: ({ listening: l, recognizing: r }) => {
        setListening(l);
        setRecognizing(r);
        wasListeningRef.current = l;
      },
    });

    sessionRef.current = session;
    langRef.current = lang;

    if (shouldResume && session) {
      // baseAnswerRef already holds the answer accumulated before the
      // language switch (set by the previous start()/changeQuestion()
      // call and never cleared here), so resuming continues appending
      // to it rather than losing or duplicating anything.
      session.resetAccumulator();
      session.start();
    }

    return () => {
      session?.dispose();
      sessionRef.current = null;
    };
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Start recognition.
   * @param {string}   baseText — current answer text; new speech appends to it
   * @param {function} onFinal  — called with the full updated answer
   */
  const start = useCallback((baseText = '', onFinal) => {
    if (!sessionRef.current) return;
    setError(null);
    setErrorCode(null);
    setInterim('');
    baseAnswerRef.current = baseText || '';
    onFinalRef.current = onFinal;
    sessionRef.current.resetAccumulator();
    sessionRef.current.start();
  }, []);

  /**
   * Stop recognition. Does not clear the accumulated answer.
   */
  const stop = useCallback(() => {
    sessionRef.current?.stop();
    setInterim('');
  }, []);

  /**
   * Transition to the next question — stop, clear interim, restart.
   */
  const changeQuestion = useCallback((newBaseText = '', onFinal) => {
    const session = sessionRef.current;
    if (!session) return;

    session.stop();
    setInterim('');

    // Brief pause so the browser releases the recognition session cleanly
    setTimeout(() => {
      if (!sessionRef.current) return;
      baseAnswerRef.current = newBaseText || '';
      onFinalRef.current = onFinal;
      sessionRef.current.resetAccumulator();
      sessionRef.current.start();
    }, 250);
  }, []);

  /**
   * Permanently stop and dispose. Call when the interview finishes.
   */
  const dispose = useCallback(() => {
    sessionRef.current?.dispose();
    setListening(false);
    setRecognizing(false);
    setInterim('');
  }, []);

  return {
    supported: isRecognitionSupported(),
    listening,
    recognizing,
    interim,
    error,
    errorCode,
    start,
    stop,
    changeQuestion,
    dispose,
  };
}