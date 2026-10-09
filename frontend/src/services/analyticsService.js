/**
 * analyticsService
 *
 * Calculates and tracks interview speaking analytics:
 * - Word / character count
 * - Words per minute
 * - Filler word detection
 * - Speaking / silence duration tracking
 * - Pause analysis
 */

// ─── Text analysis ────────────────────────────────────────────────────────────

export function countWords(text) {
  if (!text?.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

export function countChars(text) {
  return text?.length ?? 0;
}

/**
 * Calculate words per minute.
 * Returns 0 if not enough data (< 10 seconds elapsed).
 */
export function calculateWPM(wordCount, elapsedSeconds) {
  if (!elapsedSeconds || elapsedSeconds < 10 || !wordCount) return 0;
  return Math.round((wordCount / elapsedSeconds) * 60);
}

// ─── Filler word detection ────────────────────────────────────────────────────

const FILLER_WORDS = [
  'um', 'uh', 'er', 'ah',
  'like', 'you know', 'you see',
  'basically', 'literally', 'actually',
  'honestly', 'truthfully',
  'right', 'ok', 'okay',
  'so', 'well',
  'kind of', 'kinda', 'sort of', 'sorta',
  'i mean', 'i guess', 'i think',
  'just', 'really', 'very',
];

/**
 * Count occurrences of filler words in text.
 * Returns an object with total count and breakdown per word.
 */
export function analyseFillerWords(text) {
  if (!text) return { total: 0, breakdown: {} };
  const lower = text.toLowerCase();
  const breakdown = {};
  let total = 0;

  for (const filler of FILLER_WORDS) {
    const escaped = filler.replace(/\s+/g, '\\s+');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    const matches = lower.match(regex);
    if (matches && matches.length > 0) {
      breakdown[filler] = matches.length;
      total += matches.length;
    }
  }

  return { total, breakdown };
}

// ─── Speaking duration tracker ────────────────────────────────────────────────

/**
 * createSpeakingTracker() → tracker
 *
 * Tracks speaking segments and pauses over the course of an answer.
 * Call onSpeakingStart / onSpeakingStop as the VAD fires.
 */
export function createSpeakingTracker() {
  let speakingStart = null;
  let totalSpeakingMs = 0;
  let pauseStart = null;
  let longestSilenceMs = 0;
  const pauseDurations = [];

  return {
    onSpeakingStart() {
      const now = Date.now();
      if (pauseStart !== null) {
        const pauseMs = now - pauseStart;
        if (pauseMs > 300) {
          pauseDurations.push(pauseMs);
          if (pauseMs > longestSilenceMs) longestSilenceMs = pauseMs;
        }
        pauseStart = null;
      }
      if (speakingStart === null) {
        speakingStart = now;
      }
    },

    onSpeakingStop() {
      if (speakingStart !== null) {
        totalSpeakingMs += Date.now() - speakingStart;
        speakingStart = null;
      }
      if (pauseStart === null) {
        pauseStart = Date.now();
      }
    },

    getStats() {
      const activeSpeakingMs =
        speakingStart !== null ? Date.now() - speakingStart : 0;
      const totalMs = totalSpeakingMs + activeSpeakingMs;
      const avgPauseMs =
        pauseDurations.length > 0
          ? Math.round(
              pauseDurations.reduce((a, b) => a + b, 0) / pauseDurations.length
            )
          : 0;

      return {
        speakingDurationMs: totalMs,
        speakingDurationSec: Math.round(totalMs / 1000),
        longestSilenceSec: Math.round(longestSilenceMs / 1000),
        averagePauseSec: Math.round(avgPauseMs / 1000),
        pauseCount: pauseDurations.length,
      };
    },

    reset() {
      speakingStart = null;
      totalSpeakingMs = 0;
      pauseStart = null;
      longestSilenceMs = 0;
      pauseDurations.length = 0;
    },
  };
}

// ─── Per-question answer analytics ───────────────────────────────────────────

/**
 * Compute a full analytics snapshot for a given answer text.
 */
export function analyseAnswer(text, elapsedSeconds = 0, speakingStats = {}) {
  const wordCount = countWords(text);
  const charCount = countChars(text);
  const wpm = calculateWPM(wordCount, elapsedSeconds);
  const fillerAnalysis = analyseFillerWords(text);

  return {
    wordCount,
    charCount,
    wpm,
    fillerWordCount: fillerAnalysis.total,
    fillerBreakdown: fillerAnalysis.breakdown,
    speakingDurationSec: speakingStats.speakingDurationSec ?? 0,
    longestSilenceSec: speakingStats.longestSilenceSec ?? 0,
    averagePauseSec: speakingStats.averagePauseSec ?? 0,
    pauseCount: speakingStats.pauseCount ?? 0,
  };
}
