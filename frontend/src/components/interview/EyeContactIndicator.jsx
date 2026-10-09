/**
 * EyeContactIndicator — fully localized implementation
 *
 * Shows:
 *  • Quality rating: Excellent / Good / Average / Poor
 *  • Direction: Looking Forward / Looking Left / Looking Right / Looking Down
 *  • Live percentage bar
 *  • Warning chips
 *
 * All display text is sourced from `t` (the same UI_LABELS dictionary
 * LiveInterviewPage.jsx builds per locale) instead of being hardcoded in
 * English, so switching language updates this card immediately.
 */

import { memo } from 'react';
import {
  Box, Chip, CircularProgress, LinearProgress, Tooltip, Typography,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import GroupIcon from '@mui/icons-material/Group';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

function qualityLabel(pct, t) {
  if (pct === null) return null;
  if (pct >= 80) return { label: t.qualityExcellent, color: 'success.main' };
  if (pct >= 60) return { label: t.qualityGood, color: 'success.light' };
  if (pct >= 40) return { label: t.qualityAverage, color: 'warning.main' };
  return { label: t.qualityPoor, color: 'error.main' };
}

function directionLabel(status, t) {
  const { lookingAtCamera, faceCentered, noseOffset } = status;
  if (!status.faceDetected) return null;

  // noseOffset is exposed from eyeContactService if we add it — fall back gracefully
  if (typeof noseOffset === 'number') {
    if (noseOffset < -0.25) return { label: t.lookingRight, icon: '→' };
    if (noseOffset > 0.25) return { label: t.lookingLeft, icon: '←' };
  }

  // Infer from faceCentered and lookingAtCamera
  if (!faceCentered) return { label: t.lookingDown, icon: '↓' };
  if (lookingAtCamera) return { label: t.lookingForward, icon: '↑' };
  return { label: t.lookingAway, icon: '↗' };
}

const EyeContactIndicator = memo(({
  status = {},
  loading = false,
  error = null,
  active = false,
  t,
}) => {
  const {
    faceDetected = false,
    multipleFaces = false,
    lookingAtCamera = false,
    faceCentered = false,
    eyeContactPct = null,
    lookingAwayWarn = false,
  } = status;

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={12} />
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
          {t.eyeContactLoading}
        </Typography>
      </Box>
    );
  }

  // ── Unavailable ───────────────────────────────────────────────────────────
  if (error || !active) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <VisibilityOffIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.68rem' }}>
          {t.eyeContactOff}
        </Typography>
      </Box>
    );
  }

  const quality = qualityLabel(eyeContactPct, t);
  const direction = directionLabel(status, t);

  const pctColor =
    eyeContactPct === null ? 'text.secondary'
      : eyeContactPct >= 70 ? 'success.main'
        : eyeContactPct >= 45 ? 'warning.main'
          : 'error.main';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>

      {/* Row 1: Gaze status + quality badge */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {lookingAtCamera
            ? <VisibilityIcon sx={{ fontSize: 13, color: 'success.main' }} />
            : <VisibilityOffIcon sx={{ fontSize: 13, color: lookingAwayWarn ? 'error.main' : 'text.secondary' }} />}
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.72rem',
              fontWeight: 600,
              color: lookingAtCamera ? 'success.main' : lookingAwayWarn ? 'error.main' : 'text.secondary',
            }}
          >
            {lookingAtCamera ? t.lookingForward : t.lookingAway}
          </Typography>
        </Box>

        {quality && (
          <Typography
            variant="caption"
            fontWeight={700}
            sx={{ fontSize: '0.68rem', color: quality.color }}
          >
            {quality.label}
          </Typography>
        )}
      </Box>

      {/* Direction label */}
      {direction && (
        <Typography
          variant="caption"
          sx={{ fontSize: '0.65rem', color: 'text.secondary', display: 'block' }}
        >
          <span style={{ marginRight: 4 }}>{direction.icon}</span>
          {direction.label}
        </Typography>
      )}

      {/* Percentage bar */}
      {eyeContactPct !== null && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.6rem' }}>
              {t.eyeContactLabel}
            </Typography>
            <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.78rem', color: pctColor }}>
              {eyeContactPct}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={eyeContactPct}
            color={eyeContactPct >= 70 ? 'success' : eyeContactPct >= 45 ? 'warning' : 'error'}
            sx={{ height: 4, borderRadius: 2 }}
          />
        </>
      )}

      {/* Status chips */}
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {!faceDetected && (
          <Chip
            icon={<VisibilityOffIcon sx={{ fontSize: 10 }} />}
            label={t.noFace}
            size="small"
            color="warning"
            sx={{ fontSize: '0.58rem', height: 18, '& .MuiChip-label': { px: 0.5 } }}
          />
        )}
        {multipleFaces && (
          <Chip
            icon={<GroupIcon sx={{ fontSize: 10 }} />}
            label={t.multipleFaces}
            size="small"
            color="error"
            sx={{ fontSize: '0.58rem', height: 18, '& .MuiChip-label': { px: 0.5 } }}
          />
        )}
        {faceDetected && !faceCentered && (
          <Chip
            icon={<CenterFocusStrongIcon sx={{ fontSize: 10 }} />}
            label={t.notCentred}
            size="small"
            color="warning"
            variant="outlined"
            sx={{ fontSize: '0.58rem', height: 18, '& .MuiChip-label': { px: 0.5 } }}
          />
        )}
        {lookingAwayWarn && (
          <Chip
            icon={<WarningAmberIcon sx={{ fontSize: 10 }} />}
            label={t.lookAtCamera}
            size="small"
            color="error"
            sx={{
              fontSize: '0.58rem',
              height: 18,
              animation: 'recordPulse 1.5s infinite',
              '& .MuiChip-label': { px: 0.5 },
            }}
          />
        )}
      </Box>
    </Box>
  );
});

EyeContactIndicator.displayName = 'EyeContactIndicator';
export default EyeContactIndicator;