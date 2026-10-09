import { useCallback, useEffect, useRef, useState } from 'react';

const FILLER_WORDS = new Set([
  'um', 'uh', 'like', 'you know', 'actually', 'basically',
  'literally', 'sort of', 'kind of', 'i mean', 'so yeah',
  'əə', 'yəni', 'deməli',
  'э', 'эм', 'ну', 'типа', 'значит',
]);

function countWords(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function countFillerWords(text) {
  if (!text) return 0;
  const lower = text.toLowerCase();
  let count = 0;
  for (const filler of FILLER_WORDS) {
    const escaped = filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'g');
    const matches = lower.match(re);
    if (matches) count += matches.length;
  }
  return count;
}

/**
 * Tracks live speaking analytics for the current question:
 * words, characters, WPM, speaking/silence time, pause count/avg/longest.
 *
 * @param {string} answerText - current answer text (updates trigger word/char recompute)
 * @param {number} elapsedSec - total elapsed interview seconds (for avg WPM across session)
 */
export function useInterviewAnalytics(answerText, elapsedSec = 0) {
  const [stats, setStats] = useState({
    wordCount: 0,
    charCount: 0,
    wpm: 0,
    avgWpm: 0,
    fillerWordCount: 0,
    speakingDurationSec: 0,
    silenceDurationSec: 0,
    longestSilenceSec: 0,
    pauseCount: 0,
    averagePauseSec: 0,
  });

  const questionStartRef = useRef(Date.now());
  const speakingStartRef = useRef(null);
  const totalSpeakingMsRef = useRef(0);
  const pausesRef = useRef([]); // durations in ms
  const currentPauseStartRef = useRef(null);
  const wasSpeakingRef = useRef(false);
  const totalWordsSessionRef = useRef(0);

  const onSpeakingStart = useCallback(() => {
    speakingStartRef.current = Date.now();
    wasSpeakingRef.current = true;

    if (currentPauseStartRef.current) {
      const pauseDuration = Date.now() - currentPauseStartRef.current;
      if (pauseDuration > 300) {
        pausesRef.current.push(pauseDuration);
      }
      currentPauseStartRef.current = null;
    }
  }, []);

  const onSpeakingStop = useCallback(() => {
    if (speakingStartRef.current) {
      totalSpeakingMsRef.current += Date.now() - speakingStartRef.current;
      speakingStartRef.current = null;
    }
    wasSpeakingRef.current = false;
    currentPauseStartRef.current = Date.now();
  }, []);

  const resetTracker = useCallback(() => {
    questionStartRef.current = Date.now();
    speakingStartRef.current = null;
    totalSpeakingMsRef.current = 0;
    pausesRef.current = [];
    currentPauseStartRef.current = null;
    wasSpeakingRef.current = false;
    setStats((prev) => ({
      ...prev,
      wordCount: 0,
      charCount: 0,
      wpm: 0,
      fillerWordCount: 0,
      speakingDurationSec: 0,
      silenceDurationSec: 0,
      longestSilenceSec: 0,
      pauseCount: 0,
      averagePauseSec: 0,
    }));
  }, []);

  // Recompute word/char/wpm/filler whenever text changes
  useEffect(() => {
    const wordCount = countWords(answerText);
    const charCount = (answerText || '').length;
    const fillerWordCount = countFillerWords(answerText);

    const elapsedMinutes = Math.max((Date.now() - questionStartRef.current) / 60000, 1 / 60);
    const currentWpm = wordCount > 0 ? Math.round(wordCount / elapsedMinutes) : 0;

    totalWordsSessionRef.current = Math.max(totalWordsSessionRef.current, wordCount);
    const avgWpm = elapsedSec > 0 ? Math.round((totalWordsSessionRef.current / elapsedSec) * 60) : 0;

    setStats((prev) => ({
      ...prev,
      wordCount,
      charCount,
      wpm: currentWpm,
      avgWpm,
      fillerWordCount,
    }));
  }, [answerText, elapsedSec]);

  // Live-tick speaking/silence/pause stats every second
  useEffect(() => {
    const interval = setInterval(() => {
      let speakingMs = totalSpeakingMsRef.current;
      if (speakingStartRef.current) {
        speakingMs += Date.now() - speakingStartRef.current;
      }

      const totalElapsedMs = Date.now() - questionStartRef.current;
      const silenceMs = Math.max(0, totalElapsedMs - speakingMs);

      let currentPauseMs = 0;
      if (currentPauseStartRef.current) {
        currentPauseMs = Date.now() - currentPauseStartRef.current;
      }

      const allPauses = [...pausesRef.current];
      if (currentPauseMs > 300) allPauses.push(currentPauseMs);

      const longestPauseMs = allPauses.length > 0 ? Math.max(...allPauses) : 0;
      const avgPauseMs = allPauses.length > 0
        ? allPauses.reduce((a, b) => a + b, 0) / allPauses.length
        : 0;

      setStats((prev) => ({
        ...prev,
        speakingDurationSec: Math.round(speakingMs / 1000),
        silenceDurationSec: Math.round(silenceMs / 1000),
        longestSilenceSec: Math.round(longestPauseMs / 1000),
        pauseCount: pausesRef.current.length,
        averagePauseSec: Math.round((avgPauseMs / 1000) * 10) / 10,
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return { stats, onSpeakingStart, onSpeakingStop, resetTracker };
}