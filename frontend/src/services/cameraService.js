/**
 * cameraService
 *
 * Manages camera MediaStream lifecycle.
 * - HD video constraints
 * - Device enumeration and selection
 * - Track-level enable/disable (mute without stopping stream)
 * - Clean stream teardown
 */

export const HD_VIDEO_CONSTRAINTS = {
  width: { ideal: 1280, min: 640 },
  height: { ideal: 720, min: 480 },
  facingMode: 'user',
  frameRate: { ideal: 30, max: 30 },
};

/**
 * Request camera access with HD defaults.
 * @param {string|null} deviceId - Specific camera device ID, or null for default
 * @returns {Promise<MediaStream>}
 */
export async function requestCamera(deviceId = null) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera API not supported in this browser.');
  }
  const constraints = {
    video: {
      ...HD_VIDEO_CONSTRAINTS,
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    },
    audio: false,
  };
  return navigator.mediaDevices.getUserMedia(constraints);
}

/**
 * Request microphone access for voice monitoring.
 * Returns an audio-only stream.
 * @returns {Promise<MediaStream>}
 */
export async function requestMicrophone() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone API not supported in this browser.');
  }
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 44100,
    },
    video: false,
  });
}

/**
 * Enumerate available camera devices.
 * @returns {Promise<MediaDeviceInfo[]>}
 */
export async function getCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'videoinput');
  } catch {
    return [];
  }
}

/**
 * Stop all tracks in a MediaStream.
 * @param {MediaStream|null} stream
 */
export function stopStream(stream) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

/**
 * Check whether a stream's video track is live.
 */
export function isCameraLive(stream) {
  if (!stream) return false;
  return stream.getVideoTracks().some(
    (t) => t.enabled && t.readyState === 'live'
  );
}

/**
 * Enable or disable video tracks without stopping the stream.
 * This "mutes" the camera without releasing the hardware.
 */
export function setCameraEnabled(stream, enabled) {
  if (!stream) return;
  stream.getVideoTracks().forEach((t) => {
    t.enabled = enabled;
  });
}

/**
 * Enable or disable audio tracks without stopping the stream.
 */
export function setMicEnabled(stream, enabled) {
  if (!stream) return;
  stream.getAudioTracks().forEach((t) => {
    t.enabled = enabled;
  });
}
