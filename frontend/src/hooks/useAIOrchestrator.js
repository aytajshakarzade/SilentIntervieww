import { useCallback, useEffect, useRef, useState } from 'react';
import { requestMicrophone } from '../services/cameraService';
import { aiDraftKey } from '../components/interview/InterviewUIShared';

// Mirrors the IS state machine used by the classic LiveInterviewPage, so the
// same camera/microphone/speech-recognition lifecycle guarantees apply here.
export const AI_IS = Object.freeze({
  IDLE: 'IDLE', INITIALIZING: 'INITIALIZING', READY: 'READY',
  STARTING: 'STARTING', RUNNING: 'RUNNING',
  CHANGING_QUESTION: 'CHANGING_QUESTION', SUBMITTING: 'SUBMITTING',
  COMPLETED: 'COMPLETED', ERROR: 'ERROR', DISPOSED: 'DISPOSED',
});

const VALID_TRANSITIONS = {
  [AI_IS.IDLE]: [AI_IS.INITIALIZING, AI_IS.DISPOSED],
  [AI_IS.INITIALIZING]: [AI_IS.READY, AI_IS.ERROR, AI_IS.DISPOSED],
  [AI_IS.READY]: [AI_IS.STARTING, AI_IS.DISPOSED],
  [AI_IS.STARTING]: [AI_IS.RUNNING, AI_IS.ERROR, AI_IS.DISPOSED],
  [AI_IS.RUNNING]: [AI_IS.CHANGING_QUESTION, AI_IS.SUBMITTING, AI_IS.ERROR, AI_IS.DISPOSED],
  [AI_IS.CHANGING_QUESTION]: [AI_IS.RUNNING, AI_IS.SUBMITTING, AI_IS.ERROR, AI_IS.DISPOSED],
  [AI_IS.SUBMITTING]: [AI_IS.COMPLETED, AI_IS.ERROR, AI_IS.DISPOSED],
  [AI_IS.ERROR]: [AI_IS.DISPOSED],
  [AI_IS.COMPLETED]: [AI_IS.DISPOSED],
  [AI_IS.DISPOSED]: [],
};

/**
 * Orchestrates camera/microphone/speech-recognition/timer lifecycle around
 * the AI-driven, dynamic question flow (useAIInterview). Device handling is
 * unchanged from useOrchestrator — only question navigation differs: instead
 * of moving an index through a static array, each "next" is resolved live
 * from the AI after the current answer is evaluated.
 */
export function useAIOrchestrator({
  jobId, interview, sr, mic, camera, eyeContact, emotion,
  timer, analytics, navigate, ensureProfile, resultsRoute, t,
}) {
  const [state, setState] = useState(AI_IS.IDLE);
  const [initError, setInitError] = useState('');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [timerPaused, setTimerPaused] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;
  const isDisposedRef = useRef(false);
  const audioRef = useRef(null);

  const transition = useCallback((next) => {
    const allowed = VALID_TRANSITIONS[stateRef.current];
    if (allowed?.includes(next)) { setState(next); stateRef.current = next; return true; }
    console.warn(`[AIOrch] Bad transition: ${stateRef.current} → ${next}`);
    return false;
  }, []);

  const initialize = useCallback(async () => {
    if (stateRef.current !== AI_IS.IDLE) return;
    transition(AI_IS.INITIALIZING);
    setInitError('');
    try {
      await ensureProfile();
      if (isDisposedRef.current) return;
      transition(AI_IS.READY);
    } catch {
      setInitError(t.errInitFailed);
      transition(AI_IS.ERROR);
    }
  }, [ensureProfile, transition, t]);

  const startInterview = useCallback(async () => {
    if (!transition(AI_IS.STARTING)) return;
    try {
      await interview.startSession();

      try { await camera.start(); } catch (e) { console.error('Camera:', e); }

      try {
        const audioStream = await requestMicrophone();
        audioRef.current = audioStream;
        await mic.start(audioStream);
      } catch (e) { console.error('Mic:', e); }

      timer.start();

      try { sr.start('', (text) => interview.setAnswer(text)); } catch (e) { console.error('SR:', e); }

      transition(AI_IS.RUNNING);
    } catch (err) {
      if (err?.response?.status === 402 || err?.status === 402) {
        setInitError('PLAN_LIMIT_REACHED');
      } else {
        setInitError(err.message || t.errStartFailed);
      }
      transition(AI_IS.ERROR);
    }
  }, [interview, camera, mic, timer, sr, transition, t]);

  /** Submits the current answer, lets the AI evaluate + decide what's next, then advances. */
  const submitAndAdvance = useCallback(async () => {
    if (stateRef.current !== AI_IS.RUNNING) return;
    if (!transition(AI_IS.CHANGING_QUESTION)) return;

    try {
      const snapshot = {
        timeSpentSec: analytics.stats.speakingDurationSec + analytics.stats.silenceDurationSec || null,
        eyeContactPct: eyeContact.status.eyeContactPct ?? null,
        dominantEmotion: emotion.result.emotion ?? null,
        speechWpm: analytics.stats.avgWpm || analytics.stats.wpm || null,
        fillerWordCount: analytics.stats.fillerWordCount ?? null,
        longestPauseSec: analytics.stats.longestSilenceSec ?? null,
      };

      const next = await interview.submitCurrentAnswer(snapshot);
      analytics.resetTracker();

      if (next?.interviewComplete) {
        // Transition directly to SUBMITTING so the button is disabled and
        // submitInterview() runs exactly once. Do NOT go back to RUNNING first,
        // which would leave a window where a second click could re-enter this path.
        transition(AI_IS.SUBMITTING);
        try {
          timer.stop(); sr.dispose(); mic.stop(); eyeContact.stop(); emotion.stop(); camera.stop();
          const audioStream = audioRef.current;
          if (audioStream) {
            audioStream.getTracks().forEach((t) => t.stop());
            audioRef.current = null;
          }
          await interview.finishInterview();
          transition(AI_IS.COMPLETED);
          try { localStorage.removeItem(aiDraftKey(jobId)); } catch { /* noop */ }
          navigate(resultsRoute, {
            state: {
              report: interview.report,
              sessionId: interview.sessionId,
              speechMetrics: {
                wpm: analytics.stats.wpm,
                wordCount: analytics.stats.wordCount,
                charCount: analytics.stats.charCount,
                fillerWordCount: analytics.stats.fillerWordCount,
                speakingDurationSec: analytics.stats.speakingDurationSec,
                longestSilenceSec: analytics.stats.longestSilenceSec,
                averagePauseSec: analytics.stats.averagePauseSec,
                pauseCount: analytics.stats.pauseCount,
              },
              eyeContactPct: eyeContact.status.eyeContactPct,
              dominantEmotion: emotion.result.emotion,
            },
          });
        } catch (err) {
          console.error('Finish interview failed:', err);
          transition(AI_IS.ERROR);
        }
        return { interviewComplete: true };
      }

      const nextBase = '';
      if (typeof sr.changeQuestion === 'function') {
        sr.changeQuestion(nextBase, (text) => interview.setAnswer(text));
      } else {
        sr.stop();
        setTimeout(() => {
          if (isDisposedRef.current) return;
          const s = stateRef.current;
          if (s === AI_IS.CHANGING_QUESTION || s === AI_IS.RUNNING) {
            sr.start(nextBase, (text) => interview.setAnswer(text));
          }
        }, 150);
      }

      transition(AI_IS.RUNNING);
      return { interviewComplete: false };
    } catch (err) {
      console.error('Submit/advance failed:', err);
      transition(AI_IS.RUNNING);
      return { interviewComplete: false, error: err };
    }
  }, [interview, sr, analytics, eyeContact, emotion, transition]);

  const toggleTimerPause = useCallback(() => {
    if (timerPaused) { timer.start(); setTimerPaused(false); }
    else { timer.stop(); setTimerPaused(true); }
  }, [timerPaused, timer]);

  const submitInterview = useCallback(async () => {
    if (stateRef.current !== AI_IS.RUNNING) return;
    if (!transition(AI_IS.SUBMITTING)) return;
    try {
      timer.stop(); sr.dispose(); mic.stop(); eyeContact.stop(); emotion.stop(); camera.stop();
      if (audioRef.current) {
        audioRef.current.getTracks().forEach((t) => t.stop());
        audioRef.current = null;
      }

      await interview.finishInterview();
      transition(AI_IS.COMPLETED);
      try { localStorage.removeItem(aiDraftKey(jobId)); } catch { /* noop */ }

      navigate(resultsRoute, {
        state: {
          report: interview.report,
          sessionId: interview.sessionId,
          speechMetrics: {
            wpm: analytics.stats.wpm,
            wordCount: analytics.stats.wordCount,
            charCount: analytics.stats.charCount,
            fillerWordCount: analytics.stats.fillerWordCount,
            speakingDurationSec: analytics.stats.speakingDurationSec,
            longestSilenceSec: analytics.stats.longestSilenceSec,
            averagePauseSec: analytics.stats.averagePauseSec,
            pauseCount: analytics.stats.pauseCount,
          },
          eyeContactPct: eyeContact.status.eyeContactPct,
          dominantEmotion: emotion.result.emotion,
        },
      });
    } catch (err) {
      console.error('Submission failed:', err);
      transition(AI_IS.ERROR);
    }
  }, [timer, sr, mic, eyeContact, emotion, camera, interview, analytics, jobId, navigate, resultsRoute, transition]);

  // Online/offline
  useEffect(() => {
    const on = () => setIsOffline(false);
    const off = () => setIsOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Eye Contact + Emotion lifecycle — identical trigger to the classic room:
  // driven by camera.videoReady, never a guessed timeout.
  useEffect(() => {
    const s = stateRef.current;
    if (s !== AI_IS.STARTING && s !== AI_IS.RUNNING) return;
    if (!camera.videoReady) return;

    const videoEl = camera.videoRef?.current;
    if (!videoEl) return;

    eyeContact.start(videoEl);
    emotion.start(videoEl);
  }, [camera.videoReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const wasVideoReadyRef = useRef(false);
  useEffect(() => {
    if (wasVideoReadyRef.current && !camera.videoReady) {
      eyeContact.stop();
      emotion.stop();
    }
    wasVideoReadyRef.current = camera.videoReady;
  }, [camera.videoReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Init + cleanup
  useEffect(() => {
    initialize();
    return () => {
      isDisposedRef.current = true;
      sr.dispose(); mic.stop(); eyeContact.stop(); emotion.stop(); camera.stop(); timer.stop();
      if (audioRef.current) {
        audioRef.current.getTracks().forEach((t) => t.stop());
        audioRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    state, initError, isOffline, timerPaused,
    startInterview, submitAndAdvance, submitInterview, toggleTimerPause,
  };
}