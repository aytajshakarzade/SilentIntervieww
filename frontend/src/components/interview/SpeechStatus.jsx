/**
 * SpeechStatus
 *
 * Shows the speech recognition state:
 * - Wave animation when listening
 * - Interim transcript preview (faded text)
 * - Error state
 */

import { memo } from 'react';
import { Box, Typography } from '@mui/material';

const SpeechStatus = memo(({ listening = false, interim = '', error = null, t }) => {
  if (!listening && !interim && !error) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}>
      {/* Wave animation + label */}
      {listening && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box className="wave-bars">
            {[1, 2, 3, 4, 5].map((i) => (
              <Box key={i} className="wave-bar" />
            ))}
          </Box>
          <Typography
            variant="caption"
            sx={{ color: 'primary.main', fontWeight: 500, fontSize: '0.7rem' }}
          >
            {t.listeningSpeak}
          </Typography>
        </Box>
      )}

      {/* Interim transcript preview */}
      {interim && (
        <Typography
          variant="caption"
          sx={{
            color: 'text.disabled',
            fontStyle: 'italic',
            lineHeight: 1.5,
            fontSize: '0.8rem',
            pl: 0.5,
            borderLeft: '2px solid',
            borderColor: 'primary.light',
          }}
        >
          {interim}
        </Typography>
      )}

      {/* Error */}
      {error && (
        <Typography
          variant="caption"
          sx={{ color: 'error.main', fontSize: '0.7rem' }}
        >
          {error}
        </Typography>
      )}
    </Box>
  );
});

SpeechStatus.displayName = 'SpeechStatus';
export default SpeechStatus;