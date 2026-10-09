/**
 * emotionService — real-time facial emotion approximation.
 * Uses MediaPipe FaceMesh blendshape-style landmark heuristics
 * (no external ML model download required — runs fully client-side).
 *
 * Detects: Neutral, Happy, Confident, Nervous, Sad, Angry, Surprised, Distracted
 */

const CDN_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619';

function injectScript(src) {
  // Share one loader between eye-contact and emotion detection. A script tag
  // existing in the DOM does not mean its onload has fired yet; resolving at
  // that point can construct FaceMesh before the global is available.
  if (typeof window !== 'undefined' && window.FaceMesh) return Promise.resolve();
  if (typeof window !== 'undefined' && window.__silentInterviewFaceMeshPromise) {
    return window.__silentInterviewFaceMeshPromise;
  }

  const promise = new Promise((resolve, reject) => {
    let script = document.querySelector(`script[src="${src}"]`);
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      if (error) reject(error);
      else if (window.FaceMesh) resolve();
      else reject(new Error('MediaPipe FaceMesh script loaded, but FaceMesh is unavailable.'));
    };
    const timeoutId = setTimeout(() => {
      finish(new Error('Timed out loading MediaPipe FaceMesh. Check your internet connection or CDN access.'));
    }, 15000);

    if (!script) {
      script = document.createElement('script');
      script.src = src;
      script.crossOrigin = 'anonymous';
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', () => finish(), { once: true });
    script.addEventListener('error', () => finish(new Error(`Cannot load ${src}`)), { once: true });
    // Handle the case where another service loaded it just before listeners
    // were attached.
    if (window.FaceMesh) finish();
  });

  if (typeof window !== 'undefined') {
    window.__silentInterviewFaceMeshPromise = promise;
    promise.catch(() => { window.__silentInterviewFaceMeshPromise = null; });
  }
  return promise;
}

const LM = {
  MOUTH_LEFT: 61,
  MOUTH_RIGHT: 291,
  MOUTH_TOP: 13,
  MOUTH_BOTTOM: 14,
  L_EYE_TOP: 159,
  L_EYE_BOTTOM: 145,
  R_EYE_TOP: 386,
  R_EYE_BOTTOM: 374,
  L_BROW: 105,
  R_BROW: 334,
  L_EYE_OUTER: 33,
  R_EYE_OUTER: 263,
  NOSE_TIP: 1,
  CHIN: 152,
  FOREHEAD: 10,
};

const COLOR_MAP = {
  Neutral: '#94a3b8',
  Happy: '#22c55e',
  Confident: '#0ea5e9',
  Nervous: '#f59e0b',
  Sad: '#6366f1',
  Angry: '#ef4444',
  Surprised: '#eab308',
  Distracted: '#71717a',
};
export function getEmotionColor(emotion) {
  return COLOR_MAP[emotion] || '#94a3b8';
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function classifyEmotion(lm) {
  const mouthL = lm[LM.MOUTH_LEFT];
  const mouthR = lm[LM.MOUTH_RIGHT];
  const mouthT = lm[LM.MOUTH_TOP];
  const mouthB = lm[LM.MOUTH_BOTTOM];
  const lEyeT = lm[LM.L_EYE_TOP];
  const lEyeB = lm[LM.L_EYE_BOTTOM];
  const rEyeT = lm[LM.R_EYE_TOP];
  const rEyeB = lm[LM.R_EYE_BOTTOM];
  const lBrow = lm[LM.L_BROW];
  const rBrow = lm[LM.R_BROW];
  const lEyeOuter = lm[LM.L_EYE_OUTER];
  const rEyeOuter = lm[LM.R_EYE_OUTER];
  const nose = lm[LM.NOSE_TIP];

  if (!mouthL || !mouthR || !mouthT || !mouthB || !lEyeT || !lEyeB) {
    return { emotion: 'Neutral', score: 50 };
  }

  const faceWidth = dist(lEyeOuter, rEyeOuter) || 0.001;

  // Mouth metrics
  const mouthWidth = dist(mouthL, mouthR) / faceWidth;
  const mouthOpen = dist(mouthT, mouthB) / faceWidth;
  const mouthCornerLift = ((mouthT.y - mouthL.y) + (mouthT.y - mouthR.y)) / 2 / faceWidth;

  // Eye openness
  const lEyeOpen = dist(lEyeT, lEyeB) / faceWidth;
  const rEyeOpen = dist(rEyeT, rEyeB) / faceWidth;
  const avgEyeOpen = (lEyeOpen + rEyeOpen) / 2;

  // Brow position (lower y = raised brow)
  const browHeight = lBrow && rBrow ? ((lEyeT.y - lBrow.y) + (rEyeT.y - rBrow.y)) / 2 / faceWidth : 0.1;

  const scores = {
    Neutral: 30,
    Happy: 0,
    Confident: 0,
    Nervous: 0,
    Sad: 0,
    Angry: 0,
    Surprised: 0,
    Distracted: 0,
  };

  // Happy: wide mouth + corners lifted
  if (mouthWidth > 0.42 && mouthCornerLift > 0.01) {
    scores.Happy += 45 + Math.min(mouthWidth * 40, 25);
  }

  // Surprised: wide eyes + open mouth + raised brows
  if (avgEyeOpen > 0.16 && browHeight > 0.14) {
    scores.Surprised += 40 + Math.min(mouthOpen * 60, 20);
  }

  // Sad: mouth corners down + narrow mouth + lower brow
  if (mouthCornerLift < -0.005 && mouthWidth < 0.38) {
    scores.Sad += 35;
  }

  // Angry: brows lowered/furrowed + narrow eyes + tight mouth
  if (browHeight < 0.10 && avgEyeOpen < 0.11 && mouthWidth < 0.36) {
    scores.Angry += 30;
  }

  // Nervous: narrow eyes + tight small mouth + minimal movement
  if (avgEyeOpen < 0.10 && mouthOpen < 0.02 && mouthWidth < 0.35) {
    scores.Nervous += 25;
  }

  // Confident: moderate open eyes, level mouth, steady gaze (approximated: centered head + composed mouth)
  if (avgEyeOpen > 0.11 && avgEyeOpen < 0.16 && Math.abs(mouthCornerLift) < 0.01 && mouthWidth > 0.36 && mouthWidth < 0.44) {
    scores.Confident += 28;
  }

  // Distracted: low eye openness sustained without other strong signals + off-center nose
  if (avgEyeOpen < 0.08) {
    scores.Distracted += 20;
  }

  scores.Neutral += 15;

  let best = 'Neutral';
  let bestScore = scores.Neutral;
  for (const [emo, val] of Object.entries(scores)) {
    if (val > bestScore) { best = emo; bestScore = val; }
  }

  const confidence = Math.min(95, Math.max(35, Math.round(bestScore)));

  // Normalized percentage breakdown across all 8 emotions, derived from the
  // same `scores` used to pick `best` above — purely a re-expression of the
  // existing scores as percentages (summing to 100) for UI display; it does
  // not change which emotion wins or its confidence value.
  const total = Object.values(scores).reduce((sum, v) => sum + v, 0) || 1;
  const breakdown = Object.fromEntries(
    Object.entries(scores).map(([emo, val]) => [emo, Math.round((val / total) * 100)])
  );

  return { emotion: best, score: confidence, breakdown };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createEmotionSession({ onFrame } = {}) {
  console.log('[EMOTION-TRACE] createEmotionSession() entered');
  await injectScript(`${CDN_BASE}/face_mesh.js`);
  console.log('[EMOTION-TRACE] injectScript resolved', { hasFaceMesh: !!window.FaceMesh });
  if (!window.FaceMesh) throw new Error('MediaPipe FaceMesh unavailable.');

  const mesh = new window.FaceMesh({ locateFile: (f) => `${CDN_BASE}/${f}` });
  console.log('[EMOTION-TRACE] FaceMesh instance constructed');
  mesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  const history = [];
  const HISTORY_MAX = 20;
  let smoothed = null;
  let smoothCounter = 0;
  const SMOOTH_FRAMES = 6; // require consistent reading before switching label

  mesh.onResults((results) => {
    const faces = results.multiFaceLandmarks || [];
    console.log('[EMOTION-TRACE] mesh.onResults fired', { faceCount: faces.length });
    if (faces.length === 0) {
      onFrame?.({ emotion: null, score: 0, history: [...history], faceFound: false, breakdown: null });
      return;
    }

    const { emotion, score, breakdown } = classifyEmotion(faces[0]);

    if (smoothed === emotion) {
      smoothCounter = Math.min(smoothCounter + 1, SMOOTH_FRAMES);
    } else {
      smoothCounter -= 1;
      if (smoothCounter <= 0) {
        smoothed = emotion;
        smoothCounter = 1;
      }
    }

    const finalEmotion = smoothed || emotion;

    history.push({ emotion: finalEmotion, score, ts: Date.now() });
    if (history.length > HISTORY_MAX) history.shift();

    onFrame?.({ emotion: finalEmotion, score, history: [...history], faceFound: true, breakdown });
  });

  let rafId = null;
  let videoEl = null;
  let running = false;
  let processing = false;
  let frameCounter = 0;

  // Eye contact and emotion each run their own independent FaceMesh/WASM
  // instance against the same <video> element via their own
  // requestAnimationFrame loop. Submitting frames to both instances on the
  // exact same tick is a documented source of instability in this legacy
  // @mediapipe/face_mesh build (concurrent instances contending for the
  // same underlying WASM module can starve one another's send() calls).
  // Skipping every other frame here staggers emotion's submissions so it
  // isn't racing eyeContactService's send() call on the same tick, without
  // changing any classification logic or output shape.
  async function tick() {
    if (!running || !videoEl) return;
    frameCounter++;
    if (!processing && frameCounter % 2 === 0 && videoEl.readyState >= 2) {
      processing = true;
      try {
        await mesh.send({ image: videoEl });
      } catch (err) {
        console.log('[EMOTION-TRACE] mesh.send() THREW', err);
      }
      finally { processing = false; }
    }
    rafId = requestAnimationFrame(tick);
  }

  return {
    async start(video) {
      console.log('[EMOTION-TRACE] session.start() called', { readyState: video?.readyState });
      videoEl = video;
      running = true;
      await wait(500);
      if (!running) return;
      console.log('[EMOTION-TRACE] tick() loop starting now');
      tick();
    },
    stop() { running = false; if (rafId) cancelAnimationFrame(rafId); rafId = null; videoEl = null; },
  };
}