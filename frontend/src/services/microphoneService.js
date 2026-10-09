/**
 * microphoneService
 *
 * Audio level monitoring and voice activity detection via Web Audio API.
 * - Real-time RMS audio level (0–1)
 * - Speaking detection via configurable RMS threshold
 * - Silence detection with configurable timeout
 * - Background noise floor estimation
 * - Clean AudioContext lifecycle management
 */

const SPEAKING_THRESHOLD = 0.018;   // RMS level considered "speaking"
const SILENCE_TIMEOUT_MS = 1800;    // ms below threshold before "silence" fires
const NOISE_FLOOR_SAMPLES = 30;     // frames to average for background noise estimate
const FFT_SIZE = 2048;

/**
 * createMicrophoneMonitor(options) → monitor controller
 *
 * @param {object}   options
 * @param {function} options.onLevel     (level: 0–1) → void   — called every animation frame
 * @param {function} options.onSpeaking  () → void             — called when speaking starts
 * @param {function} options.onSilence   () → void             — called after sustained silence
 * @param {number}  [options.threshold]  Override speaking threshold (default: 0.018)
 */
export function createMicrophoneMonitor({
  onLevel,
  onSpeaking,
  onSilence,
  threshold = SPEAKING_THRESHOLD,
} = {}) {
  let audioContext = null;
  let analyser = null;
  let source = null;
  let animationId = null;
  let silenceTimer = null;
  let active = false;
  let isSpeakingNow = false;

  // Adaptive noise floor
  const noiseFloorSamples = [];
  let noiseFloor = 0;

  function updateNoiseFloor(rms) {
    noiseFloorSamples.push(rms);
    if (noiseFloorSamples.length > NOISE_FLOOR_SAMPLES) {
      noiseFloorSamples.shift();
    }
    const sorted = [...noiseFloorSamples].sort((a, b) => a - b);
    // Use the 20th percentile as the noise floor estimate
    const idx = Math.floor(sorted.length * 0.2);
    noiseFloor = sorted[idx] || 0;
  }

  function loop() {
    if (!active || !analyser) return;

    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);

    // Root Mean Square
    let sumSq = 0;
    for (let i = 0; i < buffer.length; i++) {
      sumSq += buffer[i] * buffer[i];
    }
    const rms = Math.sqrt(sumSq / buffer.length);

    updateNoiseFloor(rms);

    // Adaptive threshold: floor + base threshold
    const effectiveThreshold = noiseFloor + threshold;

    // Normalise level to 0–1 for display (capped at ~0.5 RMS being "max")
    const displayLevel = Math.min(rms / 0.4, 1);
    onLevel?.(displayLevel);

    const speakingNow = rms > effectiveThreshold;

    if (speakingNow && !isSpeakingNow) {
      // Speaking just started
      isSpeakingNow = true;
      clearTimeout(silenceTimer);
      silenceTimer = null;
      onSpeaking?.();
    } else if (!speakingNow && isSpeakingNow) {
      // Went quiet — wait before declaring silence
      if (!silenceTimer) {
        silenceTimer = setTimeout(() => {
          isSpeakingNow = false;
          silenceTimer = null;
          onSilence?.();
        }, SILENCE_TIMEOUT_MS);
      }
    }

    animationId = requestAnimationFrame(loop);
  }

  return {
    /**
     * Begin monitoring the provided MediaStream.
     * The stream must have at least one audio track.
     */
    async start(stream) {
      if (active) this.stop();
      if (!stream) throw new Error('No audio stream provided to microphone monitor.');

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) throw new Error('Web Audio API not supported.');

      audioContext = new AudioCtx();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      analyser = audioContext.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.7;

      source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      active = true;
      noiseFloorSamples.length = 0;
      noiseFloor = 0;
      isSpeakingNow = false;

      loop();
    },

    /** Stop monitoring and release AudioContext resources. */
    stop() {
      active = false;
      isSpeakingNow = false;
      clearTimeout(silenceTimer);
      silenceTimer = null;

      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      if (source) {
        try { source.disconnect(); } catch { /* ignore */ }
        source = null;
      }
      if (audioContext) {
        audioContext.close().catch(() => {});
        audioContext = null;
        analyser = null;
      }
      onLevel?.(0);
    },

    /** Whether the monitor is currently running. */
    isActive() { return active; },

    /** Current noise floor estimate (informational). */
    getNoiseFloor() { return noiseFloor; },

    /** Whether the user is currently speaking. */
    isSpeaking() { return isSpeakingNow; },
  };
}
