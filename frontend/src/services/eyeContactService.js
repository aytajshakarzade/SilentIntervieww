/**
 * eyeContactService
 *
 * Loads MediaPipe FaceMesh from CDN (no npm install required) and provides
 * real-time gaze estimation from facial landmarks.
 *
 * Outputs per frame:
 *   faceCount        — number of faces in frame
 *   faceDetected     — at least one face visible
 *   multipleFaces    — more than one face (integrity issue)
 *   lookingAtCamera  — gaze directed toward the camera
 *   faceCentered     — face is reasonably centred in the frame
 *   eyeContactPct    — rolling percentage of frames with eye contact (null until 5 frames)
 *   lookingAwayMs    — continuous ms spent looking away
 *   lookingAwayWarn  — true after WARN_MS consecutive ms away
 */

const CDN_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619';
const WARN_MS  = 3000;  // warn after 3 s looking away

// ─── CDN loader ───────────────────────────────────────────────────────────────

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

// ─── Landmark indices (MediaPipe 468-point model) ─────────────────────────────

const LM = {
  NOSE_TIP:     1,
  L_EYE_OUTER: 33,
  R_EYE_OUTER: 263,
};

// ─── Gaze estimation from normalised (0-1) landmarks ─────────────────────────

function estimateGaze(landmarks) {
  const nose = landmarks[LM.NOSE_TIP];
  const lEye = landmarks[LM.L_EYE_OUTER];
  const rEye = landmarks[LM.R_EYE_OUTER];
  if (!nose || !lEye || !rEye) return { looking: false, centered: false };

  const span     = Math.abs(rEye.x - lEye.x);
  const faceX    = (lEye.x + rEye.x) / 2;
  const faceY    = (lEye.y + rEye.y) / 2;
  const offset   = span > 0 ? (nose.x - faceX) / span : 1;

  // |offset| < 0.15 → nose within ±15 % of the eye mid-point → frontal gaze
  const looking  = Math.abs(offset) < 0.15;
  // face bounding box must be inside a reasonable region of the frame
  const centered = faceX > 0.15 && faceX < 0.85 && faceY > 0.05 && faceY < 0.70;

  return { looking: looking && centered, centered, noseOffset: offset };
}

// ─── Session factory ──────────────────────────────────────────────────────────

/**
 * createEyeContactSession({ onFrame, onError })
 *
 * Returns a session object with { start(videoEl), stop(), reset() }.
 * Throws if MediaPipe cannot be loaded.
 */
export async function createEyeContactSession({ onFrame, onError } = {}) {
  // 1. Load the CDN script
  try {
    await injectScript(`${CDN_BASE}/face_mesh.js`);
  } catch (err) {
    throw new Error(`MediaPipe FaceMesh failed to load: ${err.message}`);
  }

  if (!window.FaceMesh) {
    throw new Error('MediaPipe FaceMesh is not available after script load.');
  }

  // 2. Instantiate FaceMesh
  const mesh = new window.FaceMesh({
    locateFile: (file) => `${CDN_BASE}/${file}`,
  });
  mesh.setOptions({
    maxNumFaces:            2,
    refineLandmarks:        false,   // avoids the larger iris model
    minDetectionConfidence: 0.5,
    minTrackingConfidence:  0.5,
  });

  // 3. Running stats
  let totalFrames = 0;
  let goodFrames  = 0;
  let awayStart   = null;

  mesh.onResults((results) => {
    const faces = results.multiFaceLandmarks || [];
    totalFrames++;

    let looking  = false;
    let centered = false;

    if (faces.length === 1) {
      const g = estimateGaze(faces[0]);
      looking  = g.looking;
      centered = g.centered;
    }

    if (looking) {
      goodFrames++;
      awayStart = null;
    } else if (faces.length > 0 && !awayStart) {
      awayStart = Date.now();
    }

    const pct    = totalFrames > 5 ? Math.round((goodFrames / totalFrames) * 100) : null;
    const awayMs = awayStart ? Date.now() - awayStart : 0;

    onFrame?.({
      faceCount:       faces.length,
      faceDetected:    faces.length > 0,
      multipleFaces:   faces.length > 1,
      lookingAtCamera: looking,
      faceCentered:    centered,
      eyeContactPct:   pct,
      lookingAwayMs:   awayMs,
      lookingAwayWarn: awayMs > WARN_MS,
    });
  });

  // 4. Per-frame detection loop.
  // NOTE: mesh.initialize() is deliberately NOT called here. In this
  // legacy @mediapipe/face_mesh "solutions" build, initialize() is an
  // internal helper that is not used in any of Google's official JS
  // examples. Awaiting it here was the actual pipeline break: the
  // promise can resolve before the WASM graph is truly ready, after
  // which the first mesh.send() call stalls indefinitely — and since
  // `processing` is set true right before that stalled send() and never
  // reset, tick() stops recursing and the whole detection loop silently
  // dies with zero console errors. That exactly matches the reported
  // "Eye Contact always stays OFF" symptom. The documented pattern is to
  // call setOptions()/onResults() (already done above) and then just
  // start feeding frames via send(); FaceMesh lazily loads and
  // initializes its WASM graph on the first send() call.
  let rafId      = null;
  let videoEl    = null;
  let running    = false;
  let processing = false;

  async function tick() {
    if (!running || !videoEl) return;

    if (!processing && videoEl.readyState >= 2) {
      processing = true;
      try {
        await mesh.send({ image: videoEl });
      } catch {
        /* single-frame errors are non-fatal */
      } finally {
        processing = false;
      }
    }

    rafId = requestAnimationFrame(tick);
  }

  return {
    start(video) {
      videoEl = video;
      running = true;
      tick();
    },

    stop() {
      running = false;
      cancelAnimationFrame(rafId);
      rafId   = null;
      videoEl = null;
    },

    reset() {
      totalFrames = 0;
      goodFrames  = 0;
      awayStart   = null;
    },
  };
}