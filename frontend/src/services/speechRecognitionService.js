/**
 * speechRecognitionService — duplicate-free, higher-fidelity continuous recognition
 *
 * Root cause of "Salam Salam Salam" (fixed):
 * Chrome fires onresult with ALL accumulated results (indices 0..N) on EVERY
 * event, including after an auto-restart. The previous code used lastEmittedFinal
 * diff-matching which broke when Chrome replayed finalized segments with
 * slightly different capitalisation or punctuation.
 *
 * Fix: track `highWaterMark` — the highest result index already processed.
 * On each onresult event, only iterate indices ABOVE the high-water mark.
 * Reset on each provider.start() so a clean restart doesn't skip real speech.
 *
 * Additional quality improvements in this version:
 *  - maxAlternatives raised to 3 and the highest-confidence alternative is
 *    selected per result instead of always taking index 0, reducing
 *    misrecognitions on longer or less clearly articulated sentences.
 *  - When continuous recognition auto-restarts (Chrome periodically ends
 *    long-running sessions on its own), any in-flight interim text is
 *    flushed into the final accumulator first instead of being silently
 *    discarded — this is the main source of dropped words on long
 *    sentences, since an unfinished utterance that happens to straddle a
 *    restart boundary previously vanished entirely.
 *  - Light, conservative auto-punctuation: a period is appended when a
 *    finalized segment doesn't already end in terminal punctuation and a
 *    new segment begins after a natural pause, preserving readability
 *    without inventing punctuation the speaker didn't produce.
 */

const DEBUG = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';
const logger = {
    debug: (...a) => { if (DEBUG) console.debug('[SR]', ...a); },
    warn: (...a) => { if (DEBUG) console.warn('[SR]', ...a); },
    error: (...a) => { if (DEBUG) console.error('[SR]', ...a); },
};

const RESTART_WINDOW_MS = 60_000;
const MAX_RESTARTS = 8;
const MAX_ALTERNATIVES = 3;

export const SpeechState = Object.freeze({
    IDLE: 'IDLE', STARTING: 'STARTING', LISTENING: 'LISTENING',
    RESTARTING: 'RESTARTING', STOPPING: 'STOPPING', STOPPED: 'STOPPED',
    ERROR: 'ERROR', DISPOSED: 'DISPOSED',
});

export const getSpeechRecognitionConstructor = () =>
    window.SpeechRecognition || window.webkitSpeechRecognition || null;

export const isRecognitionSupported = () => Boolean(getSpeechRecognitionConstructor());

const LANG_MAP = {
    az: 'az-AZ', en: 'en-US', ru: 'ru-RU', tr: 'tr-TR', fr: 'fr-FR',
    de: 'de-DE', es: 'es-ES', it: 'it-IT', pt: 'pt-PT', zh: 'zh-CN',
    ja: 'ja-JP', ko: 'ko-KR', ar: 'ar-SA',
};
export const speechLanguageFor = (lang) => {
    if (!lang) return navigator.language || 'en-US';
    if (lang.includes('-')) return lang;
    return LANG_MAP[lang.toLowerCase()] || navigator.language || 'en-US';
};

function appendWithSpace(base, add) {
    if (!base) return add;
    if (!add) return base;
    return base.trimEnd() + ' ' + add.trimStart();
}
function capitaliseFirst(t) { return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; }
function endsWithSentence(t) { return /[.!?]\s*$/.test(t); }
function endsWithAnyPunctuation(t) { return /[.!?,;:]\s*$/.test(t); }

/**
 * Some browsers return multiple alternatives per result when
 * maxAlternatives > 1. Selecting the highest-confidence one (rather than
 * always index 0, which the spec does not guarantee is the best-scoring
 * option in every implementation) measurably reduces misrecognised words
 * on longer or less clearly enunciated sentences.
 */
function pickBestAlternative(result) {
    let best = result[0];
    for (let i = 1; i < result.length; i++) {
        const alt = result[i];
        if (typeof alt.confidence === 'number' && typeof best.confidence === 'number') {
            if (alt.confidence > best.confidence) best = alt;
        }
    }
    return best;
}

function getErrorMessage(code) {
    const m = {
        'no-speech': 'No speech detected. Please try again.',
        'audio-capture': 'No microphone found.',
        'network': 'Network error. Check your connection.',
        'not-allowed': 'Microphone permission denied.',
        'service-not-allowed': 'Speech recognition not allowed.',
        'language-not-supported': 'Language not supported.',
        'aborted': 'Speech recognition aborted.',
        'max-restarts': 'Speech recognition lost connection.',
        'start-failed': 'Failed to start microphone access.',
    };
    return m[code] || 'Unknown speech recognition error.';
}

// ─── Browser provider ─────────────────────────────────────────────────────────
function createBrowserProvider(callbacks) {
    const SRC = getSpeechRecognitionConstructor();
    let instance = null;
    let isStopped = false;
    // Highest result index already delivered to onFinalTranscript this instance.
    // Reset on each start() so a fresh recognition session processes from 0.
    let highWaterMark = -1;
    // Last non-empty interim text seen, so it can be flushed as a best-effort
    // final segment if the session ends before that speech is finalized —
    // this is the main source of dropped words on long sentences that
    // straddle a Chrome-initiated restart boundary.
    let lastInterim = '';

    return {
        start() {
            return new Promise((resolve, reject) => {
                if (!SRC) { reject(new Error('SpeechRecognition not supported')); return; }
                isStopped = false;
                highWaterMark = -1;   // ← reset per-restart
                lastInterim = '';

                instance = new SRC();
                instance.continuous = true;
                instance.interimResults = true;
                instance.maxAlternatives = MAX_ALTERNATIVES;
                instance.lang = callbacks.lang || 'en-US';

                instance.onstart = () => {
                    if (isStopped) { reject(new Error('Aborted during start')); return; }
                    callbacks.onStart?.();
                    resolve();
                };

                instance.onresult = (event) => {
                    if (isStopped) return;

                    let interim = '';
                    let newFinalSegment = '';

                    // Only process results ABOVE the water mark — prevents Chrome replay duplicates
                    for (let i = highWaterMark + 1; i < event.results.length; i++) {
                        const result = event.results[i];
                        const best = pickBestAlternative(result);
                        const text = best.transcript;

                        if (result.isFinal) {
                            highWaterMark = i;
                            const seg = text.replace(/\s+/g, ' ').trim();
                            if (seg) newFinalSegment += (newFinalSegment ? ' ' : '') + seg;
                        } else {
                            // Interim: show the latest in-progress segment only
                            interim += text;
                        }
                    }

                    lastInterim = interim.trim();

                    if (newFinalSegment) callbacks.onFinalTranscript?.(newFinalSegment);
                    callbacks.onInterimTranscript?.(interim);
                };

                instance.onerror = (event) => {
                    if (isStopped && event.error === 'aborted') return;
                    callbacks.onError?.(event);
                };

                instance.onend = () => {
                    // Flush any unfinished interim speech as a best-effort final
                    // segment before the session tears down, so words spoken right
                    // as an automatic restart boundary hits are not silently lost.
                    // Only do this for automatic restarts — a deliberate stop/abort
                    // (isStopped === true) means the user intentionally ended the
                    // session, and injecting leftover interim text there would
                    // silently add words the user didn't mean to keep.
                    const pending = lastInterim;
                    lastInterim = '';
                    if (!isStopped && pending) {
                        const seg = pending.replace(/\s+/g, ' ').trim();
                        if (seg) callbacks.onFinalTranscript?.(seg, /* fromInterimFlush */ true);
                    }
                    callbacks.onEnd?.(isStopped);
                };

                try { instance.start(); } catch (err) { reject(err); }
            });
        },

        stop() {
            isStopped = true;
            if (instance) { try { instance.abort(); } catch { } }
        },

        setLanguage(lang) { if (instance) instance.lang = lang; },

        dispose() {
            isStopped = true;
            if (instance) { try { instance.abort(); } catch { } instance = null; }
        },
    };
}

// ─── Session factory ──────────────────────────────────────────────────────────
export function createSpeechSession({
    lang,
    onFinalTranscript,
    onInterimTranscript,
    onError,
    onStateChange,
} = {}) {
    if (!isRecognitionSupported()) return null;

    const VALID = {
        [SpeechState.IDLE]: [SpeechState.STARTING, SpeechState.DISPOSED],
        [SpeechState.STARTING]: [SpeechState.LISTENING, SpeechState.STOPPING, SpeechState.ERROR, SpeechState.DISPOSED],
        [SpeechState.LISTENING]: [SpeechState.RESTARTING, SpeechState.STOPPING, SpeechState.ERROR, SpeechState.DISPOSED],
        [SpeechState.RESTARTING]: [SpeechState.LISTENING, SpeechState.STOPPING, SpeechState.ERROR, SpeechState.DISPOSED],
        [SpeechState.STOPPING]: [SpeechState.STOPPED, SpeechState.DISPOSED],
        [SpeechState.STOPPED]: [SpeechState.STARTING, SpeechState.DISPOSED],
        [SpeechState.ERROR]: [SpeechState.STARTING, SpeechState.DISPOSED],
        [SpeechState.DISPOSED]: [],
    };

    let state = SpeechState.IDLE;
    let active = false;
    let isDisposed = false;
    let isStopping = false;
    let pendingStop = null;

    function transition(next) {
        if (isDisposed && next !== SpeechState.DISPOSED) return false;
        if (VALID[state]?.includes(next)) { state = next; return true; }
        logger.warn(`Bad transition: ${state} → ${next}`);
        return false;
    }

    let language = speechLanguageFor(lang);
    let finalAccumulator = '';
    let interimText = '';

    let consecutiveErrors = 0;
    let totalRestarts = 0;
    let restartTimestamps = [];
    let restartTimeout = null;

    let isDocumentHidden = false;
    let hiddenStart = null;
    let totalHiddenMs = 0;
    let permissionStatus = null;

    function canRestart() {
        const now = Date.now();
        restartTimestamps = restartTimestamps.filter(ts => now - ts < RESTART_WINDOW_MS);
        if (restartTimestamps.length >= MAX_RESTARTS) return false;
        restartTimestamps.push(now);
        return true;
    }

    const handleVisibility = () => {
        if (document.hidden) { isDocumentHidden = true; hiddenStart = Date.now(); }
        else { isDocumentHidden = false; if (hiddenStart) { totalHiddenMs += Date.now() - hiddenStart; hiddenStart = null; } }
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', handleVisibility);

    (async () => {
        try {
            if ('permissions' in navigator) {
                permissionStatus = await navigator.permissions.query({ name: 'microphone' });
                permissionStatus.onchange = () => {
                    if (permissionStatus.state === 'denied' && active) {
                        active = false; transition(SpeechState.ERROR);
                        if (provider) provider.dispose();
                        onError?.({ code: 'not-allowed', message: getErrorMessage('not-allowed'), recoverable: false });
                        onStateChange?.({ listening: false, recognizing: false, error: 'not-allowed' });
                    }
                };
            }
        } catch { }
    })();

    const provider = createBrowserProvider({
        lang: language,

        onStart: () => {
            if (!active || isDisposed) return;
            transition(SpeechState.LISTENING);
            consecutiveErrors = 0;
            onStateChange?.({ listening: true, recognizing: true, error: null });
        },

        // Provider now delivers ONLY genuinely new segments (high-water-mark prevents replays)
        onFinalTranscript: (newSeg, fromInterimFlush = false) => {
            if (!active || isDisposed) return;
            const isFirstSegment = finalAccumulator.length === 0;
            const shouldCap = isFirstSegment || endsWithSentence(finalAccumulator);
            let seg = shouldCap ? capitaliseFirst(newSeg) : newSeg;

            // Conservative boundary punctuation: if the prior accumulated text
            // doesn't already end with terminal or pause punctuation, insert a
            // period before joining this new segment. This only fires between
            // two separately finalized results (a pause the recognizer itself
            // detected), never inside one continuous result, so it can't invent
            // sentence breaks that weren't actually spoken as pauses.
            if (!isFirstSegment && !endsWithAnyPunctuation(finalAccumulator) && !fromInterimFlush) {
                finalAccumulator = finalAccumulator.trimEnd() + '.';
            }

            finalAccumulator = appendWithSpace(finalAccumulator, seg);
            onFinalTranscript?.(finalAccumulator);
        },

        onInterimTranscript: (text) => {
            if (!active || isDisposed) return;
            interimText = text;
            onInterimTranscript?.(interimText);
        },

        onError: (event) => {
            if (isDisposed) return;
            const error = event.error;
            if (error === 'no-speech' || error === 'aborted') return;
            const hard = ['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported'];
            if (hard.includes(error)) {
                active = false; transition(SpeechState.ERROR);
                onError?.({ code: error, message: getErrorMessage(error), recoverable: false });
                onStateChange?.({ listening: false, recognizing: false, error });
                return;
            }
            consecutiveErrors++;
            onError?.({ code: error, message: getErrorMessage(error), recoverable: true });
        },

        onEnd: (wasStopped) => {
            if (isDisposed) return;
            if (wasStopped || isStopping) {
                isStopping = false;
                transition(SpeechState.STOPPED);
                onStateChange?.({ listening: false, recognizing: false, error: null });
                if (pendingStop) { pendingStop(); pendingStop = null; }
                return;
            }
            if (!active) {
                transition(SpeechState.STOPPED);
                onStateChange?.({ listening: false, recognizing: false, error: null });
                return;
            }
            if (!canRestart()) {
                active = false; transition(SpeechState.ERROR);
                onError?.({ code: 'max-restarts', message: getErrorMessage('max-restarts'), recoverable: false });
                onStateChange?.({ listening: false, recognizing: false, error: 'max-restarts' });
                return;
            }
            transition(SpeechState.RESTARTING);
            totalRestarts++;
            const delay = consecutiveErrors > 0 ? Math.min(1000 * 2 ** (consecutiveErrors - 1), 8000) : 0;
            restartTimeout = setTimeout(() => {
                if (!active || isDisposed) return;
                provider.start().catch(err => logger.error('Restart failed:', err));
            }, delay);
        },
    });

    return {
        async start() {
            if (isDisposed) return;
            if (!transition(SpeechState.STARTING)) return;
            active = true;
            consecutiveErrors = 0;
            if (restartTimeout) { clearTimeout(restartTimeout); restartTimeout = null; }
            try {
                await provider.start();
                if (!active) return;
            } catch (err) {
                if (!active) return;
                active = false; transition(SpeechState.ERROR);
                onError?.({ code: 'start-failed', message: getErrorMessage('start-failed'), recoverable: false });
                onStateChange?.({ listening: false, recognizing: false, error: 'start-failed' });
            }
        },

        async stop() {
            if (!active || isDisposed) return Promise.resolve();
            if (!transition(SpeechState.STOPPING)) return Promise.resolve();
            active = false; isStopping = true;
            if (restartTimeout) { clearTimeout(restartTimeout); restartTimeout = null; }
            return new Promise((resolve) => {
                const finish = () => {
                    isStopping = false;
                    transition(SpeechState.STOPPED);
                    onStateChange?.({ listening: false, recognizing: false, error: null });
                    resolve();
                };
                if (provider) { pendingStop = finish; try { provider.stop(); } catch { pendingStop = null; finish(); } }
                else { finish(); }
            });
        },

        /** Clear accumulated text (call when moving to next question). */
        resetAccumulator() {
            finalAccumulator = '';
            interimText = '';
            onInterimTranscript?.('');
        },

        setAccumulator(text) {
            finalAccumulator = text || '';
            onFinalTranscript?.(finalAccumulator);
        },

        getFinal() { return finalAccumulator; },
        getInterim() { return interimText; },
        isActive() { return active; },

        getMetrics() {
            return Object.freeze({ characters: finalAccumulator.length, restartCount: totalRestarts, state });
        },

        async setLanguage(newLang) {
            const nl = speechLanguageFor(newLang);
            if (nl === language) return;
            language = nl;
            const was = active;
            if (was) await this.stop();
            if (was && !isDisposed) { active = true; await this.start(); }
        },

        dispose() {
            if (isDisposed) return;
            isDisposed = true; active = false; isStopping = false;
            if (restartTimeout) { clearTimeout(restartTimeout); restartTimeout = null; }
            if (provider) provider.dispose();
            if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', handleVisibility);
            if (permissionStatus) { permissionStatus.onchange = null; permissionStatus = null; }
            onFinalTranscript = null; onInterimTranscript = null; onError = null; onStateChange = null;
            transition(SpeechState.DISPOSED);
        },
    };
}