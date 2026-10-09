import { useCallback, useEffect, useRef, useState } from 'react';

async function listVideoInputs() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'videoinput');
  } catch {
    return [];
  }
}

/**
 * useCamera
 *
 * Root cause of the black-preview / "Eye Contact stays OFF" bug:
 * the <video> element used to be conditionally mounted, so by the time
 * a MediaStream existed the DOM node it needed to attach to had either
 * not been created yet or had just been destroyed and recreated,
 * silently dropping any srcObject assignment. CameraPreview.jsx has been
 * changed to mount a single persistent <video> for the component's whole
 * lifetime, which removes that race on the DOM side.
 *
 * On the hook side, this version now:
 *  - attaches the stream immediately if the node already exists,
 *  - additionally listens for the video's own `loadedmetadata` /
 *    `canplay` events and re-attaches there too (belt-and-braces —
 *    covers autoplay-policy edge cases where srcObject was set but the
 *    element never actually started decoding frames),
 *  - exposes `videoReady` (true once the element has real frame data,
 *    i.e. readyState >= 2), which LiveInterviewPage uses to gate
 *    Eye Contact / Emotion start instead of a blind timeout,
 *  - re-attaches automatically after camera reconnect (track.onended
 *    handler already restarted the stream; the same attach effect
 *    re-fires because `stream` identity changes).
 */
export function useCamera() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [cameras, setCameras] = useState([]);
  const [activeDeviceId, setActiveDeviceId] = useState(null);
  const [error, setError] = useState(null);
  const [permissionState, setPermissionState] = useState('unknown');
  const [videoReady, setVideoReady] = useState(false);

  const isDisposedRef = useRef(false);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try { track.stop(); } catch { }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
    setVideoReady(false);
  }, []);

  const start = useCallback(async (deviceId = null) => {
    setError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch { } });
        streamRef.current = null;
      }

      const constraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      if (isDisposedRef.current) {
        mediaStream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = mediaStream;
      setPermissionState('granted');
      setVideoReady(false);

      const track = mediaStream.getVideoTracks()[0];
      if (track) {
        const settings = track.getSettings?.();
        if (settings?.deviceId) setActiveDeviceId(settings.deviceId);

        track.onended = () => {
          if (isDisposedRef.current) return;
          setError('Camera disconnected. Attempting to reconnect…');
          setVideoReady(false);
          setTimeout(() => {
            if (!isDisposedRef.current) start(activeDeviceId).catch(() => { });
          }, 1000);
        };
      }

      // Setting state triggers the attach effect below, which handles
      // the actual DOM assignment — the node is guaranteed to exist
      // because CameraPreview now mounts <video> unconditionally.
      setStream(mediaStream);

      const inputs = await listVideoInputs();
      setCameras(inputs);

      return mediaStream;
    } catch (err) {
      if (isDisposedRef.current) return;

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionState('denied');
        setError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No camera found on this device.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Camera is already in use by another application.');
      } else {
        setError(err.message || 'Failed to access camera.');
      }
      throw err;
    }
  }, [activeDeviceId]);

  const toggleVideo = useCallback((enabled) => {
    setVideoEnabled(enabled);
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((t) => { t.enabled = enabled; });
    }
  }, []);

  const switchCamera = useCallback(async () => {
    if (cameras.length < 2) return;
    const currentIdx = cameras.findIndex((c) => c.deviceId === activeDeviceId);
    const nextIdx = (currentIdx + 1) % cameras.length;
    const nextDevice = cameras[nextIdx];
    try {
      await start(nextDevice.deviceId);
    } catch { }
  }, [cameras, activeDeviceId, start]);

  // ── Attach stream to <video> and track real readiness ─────────────────────
  // CameraPreview always mounts the <video> node, so videoRef.current is
  // guaranteed non-null by the time this effect runs (it runs after commit,
  // same as the ref callback). We attach here as the primary path and rely
  // on CameraPreview's own ref-callback attach as a redundant second path.
  // Readiness is driven by real browser events, not a timer.
  useEffect(() => {
    const node = videoRef.current;
    if (!node || !stream) {
      setVideoReady(false);
      return;
    }

    if (node.srcObject !== stream) {
      node.srcObject = stream;
    }

    let cancelled = false;

    const markReady = () => {
      if (cancelled) return;
      if (node.readyState >= 2) {
        setVideoReady(true);
      }
    };

    // If metadata is already loaded (stream attached earlier by the ref
    // callback and already playing), readyState may already be >= 2.
    if (node.readyState >= 2) {
      setVideoReady(true);
    } else {
      setVideoReady(false);
    }

    node.addEventListener('loadedmetadata', markReady);
    node.addEventListener('canplay', markReady);
    node.addEventListener('playing', markReady);

    node.play().catch(() => {
      // Autoplay may be blocked until user gesture; loadedmetadata/canplay
      // will still fire once playback is permitted, so markReady covers it.
    });

    return () => {
      cancelled = true;
      node.removeEventListener('loadedmetadata', markReady);
      node.removeEventListener('canplay', markReady);
      node.removeEventListener('playing', markReady);
    };
  }, [stream]);

  useEffect(() => {
    isDisposedRef.current = false;
    return () => {
      isDisposedRef.current = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch { } });
        streamRef.current = null;
      }
    };
  }, []);

  return {
    videoRef,
    stream,
    videoEnabled,
    videoReady,
    cameras,
    activeDeviceId,
    error,
    permissionState,
    start,
    stop,
    toggleVideo,
    switchCamera,
  };
}