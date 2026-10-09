export const supportsCameraAccess = () => Boolean(navigator.mediaDevices?.getUserMedia);
export const requestInterviewMedia = () => navigator.mediaDevices.getUserMedia({ video: true, audio: true });
export const stopMediaStream = (stream) => stream?.getTracks().forEach((track) => track.stop());
