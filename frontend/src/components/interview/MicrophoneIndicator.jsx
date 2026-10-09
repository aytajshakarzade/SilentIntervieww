import { memo } from 'react';
import { Box, Typography } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import MicNoneIcon from '@mui/icons-material/MicNone';

const BAR_COUNT = 12;

const MicrophoneIndicator = memo(({
  active = false,
  level = 0,
  speaking = false,
  permissionDenied = false,
  noMicrophone = false,
  t,
}) => {
  if (permissionDenied) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <MicOffIcon sx={{ fontSize: 14, color: 'error.main' }} />
        <Typography variant="caption" color="error.main" sx={{ fontSize: '0.68rem' }}>
          {t.micPermissionDenied}
        </Typography>
      </Box>
    );
  }

  if (noMicrophone) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <MicOffIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.68rem' }}>
          {t.micNoMicrophone}
        </Typography>
      </Box>
    );
  }

  if (!active) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <MicNoneIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.68rem' }}>
          {t.micMuted}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <MicIcon sx={{ fontSize: 14, color: speaking ? 'success.main' : 'text.secondary' }} />
        <Typography
          variant="caption"
          sx={{ fontSize: '0.68rem', color: speaking ? 'success.main' : 'text.secondary', fontWeight: speaking ? 700 : 400 }}
        >
          {speaking ? t.micSpeaking : t.micListening}
        </Typography>
      </Box>

      {/* Level meter — bars react to real RMS level from useMicrophone */}
      <Box sx={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: 18 }}>
        {Array.from({ length: BAR_COUNT }).map((_, i) => {
          const barThreshold = (i + 1) / BAR_COUNT;
          const isLit = level >= barThreshold * 0.9;
          const heightPct = 30 + (i / BAR_COUNT) * 70;
          return (
            <Box
              key={i}
              sx={{
                flex: 1,
                height: `${heightPct}%`,
                borderRadius: '1px',
                bgcolor: isLit
                  ? (i > BAR_COUNT * 0.8 ? 'error.main' : i > BAR_COUNT * 0.55 ? 'warning.main' : 'success.main')
                  : 'divider',
                opacity: isLit ? 1 : 0.4,
                transition: 'background-color 80ms linear, opacity 80ms linear',
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
});

MicrophoneIndicator.displayName = 'MicrophoneIndicator';
export default MicrophoneIndicator;