/**
 * CameraPreview
 *
 * The <video> element is now ALWAYS mounted, even before a stream exists.
 * Previously the element was conditionally rendered based on `hasStream`,
 * which meant React unmounted/remounted the DOM node every time the stream
 * appeared or disappeared. Each remount destroyed the ref and any
 * previously assigned srcObject, and created a race where useCamera's
 * attach logic could run against a node that no longer existed by the
 * time the browser painted. Keeping one stable node for the whole
 * component lifetime removes that race entirely; a CSS-only placeholder
 * overlay is shown on top instead of swapping the DOM subtree.
 */

import { memo, useCallback } from 'react';
import { Box, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import FlipCameraAndroidIcon from '@mui/icons-material/FlipCameraAndroid';

const CameraPreview = memo(({
  videoRef,
  stream,
  hasStream,
  videoReady = true,
  videoEnabled = true,
  cameras = [],
  onToggleVideo,
  onSwitchCamera,
  t,
}) => {

  const attachVideo = useCallback((node) => {
    if (videoRef) {
      if (typeof videoRef === 'function') videoRef(node);
      else videoRef.current = node;
    }
    if (node && stream && node.srcObject !== stream) {
      node.srcObject = stream;
      node.play().catch(() => { });
    }
  }, [videoRef, stream]);

  // Visible as soon as there's real decoded frame data (videoReady, driven
  // by the video element's own loadedmetadata/canplay/playing events —
  // the same signal useCamera uses to gate MediaPipe's frame loop), not
  // merely when a MediaStream object exists. `stream` can become truthy
  // before the element has actually painted a frame, which left the
  // preview invisible even while MediaPipe was already receiving frames.
  const showVideo = hasStream && videoReady && videoEnabled;

  return (
    <Box
      sx={{
        width: '100%',
        aspectRatio: '16/9',
        minHeight: 189,
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: '#2B2623',
        position: 'relative',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <video
        ref={attachVideo}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)',
          opacity: showVideo ? 1 : 0,
          transition: 'opacity 300ms ease',
          display: 'block',
        }}
      />

      {!hasStream && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
          }}
        >
          <VideocamOffIcon sx={{ fontSize: '2rem', color: 'rgba(255,255,255,0.25)' }} />
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)' }}>
            {t.cameraUnavailable}
          </Typography>
        </Box>
      )}

      {hasStream && !videoEnabled && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: '#2B2623',
            pointerEvents: 'none',
          }}
        >
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
            {t.cameraPaused}
          </Typography>
        </Box>
      )}

      {hasStream && (
        <>
          <Box sx={{ position: 'absolute', top: 8, left: 8 }}>
            <Chip
              icon={
                <FiberManualRecordIcon
                  sx={{ fontSize: 10, color: '#f43f5e !important', animation: 'recordPulse 1.5s infinite' }}
                />
              }
              label={t.live}
              size="small"
              sx={{
                bgcolor: 'rgba(0,0,0,0.65)', color: 'white',
                fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em',
                backdropFilter: 'blur(6px)', height: 22,
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          </Box>

          <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 0.5 }}>
            {cameras.length > 1 && (
              <Tooltip title={t.switchCamera} placement="left">
                <IconButton size="small" onClick={onSwitchCamera} sx={ctrlBtn}>
                  <FlipCameraAndroidIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title={videoEnabled ? t.turnCameraOff : t.turnCameraOn} placement="left">
              <IconButton
                size="small"
                onClick={() => onToggleVideo?.(!videoEnabled)}
                sx={{ ...ctrlBtn, color: videoEnabled ? 'white' : '#f43f5e' }}
              >
                {videoEnabled
                  ? <VideocamIcon sx={{ fontSize: 16 }} />
                  : <VideocamOffIcon sx={{ fontSize: 16 }} />}
              </IconButton>
            </Tooltip>
          </Box>
        </>
      )}
    </Box>
  );
});

const ctrlBtn = {
  bgcolor: 'rgba(0,0,0,0.6)',
  color: 'white',
  backdropFilter: 'blur(6px)',
  '&:hover': { bgcolor: 'rgba(0,0,0,0.85)' },
  width: 28, height: 28,
};

CameraPreview.displayName = 'CameraPreview';
export default CameraPreview;