/**
 * EmotionIndicator — fully localized implementation
 *
 * Detects: Neutral | Happy | Confident | Nervous | Sad | Angry | Surprised | Distracted
 * Shows: label, emoji, confidence bar, mini timeline
 *
 * emotionService.js always returns the raw English key (e.g. "Nervous")
 * since it's also used for color lookups and history entries — that raw
 * key is mapped through `t` here purely for display, so switching
 * language does not require changing the underlying detection contract.
 */

import { memo } from 'react';
import { Box, CircularProgress, LinearProgress, Tooltip, Typography } from '@mui/material';
import { getEmotionColor } from '../../services/emotionService';

const EMOJI_MAP = {
  Neutral: '😐',
  Happy: '😊',
  Confident: '💪',
  Nervous: '😰',
  Sad: '😔',
  Angry: '😤',
  Surprised: '😮',
  Distracted: '😒',
};

function emotionLabel(emotion, t) {
  const map = {
    Neutral: t.emotionNeutral,
    Happy: t.emotionHappy,
    Confident: t.emotionConfident,
    Nervous: t.emotionNervous,
    Sad: t.emotionSad,
    Angry: t.emotionAngry,
    Surprised: t.emotionSurprised,
    Distracted: t.emotionDistracted,
  };
  return map[emotion] || emotion;
}

function emotionDescription(emotion, t) {
  const map = {
    Neutral: t.emotionDescNeutral,
    Happy: t.emotionDescHappy,
    Confident: t.emotionDescConfident,
    Nervous: t.emotionDescNervous,
    Sad: t.emotionDescSad,
    Angry: t.emotionDescAngry,
    Surprised: t.emotionDescSurprised,
    Distracted: t.emotionDescDistracted,
  };
  return map[emotion] || '';
}

const EmotionIndicator = memo(({ result = {}, loading = false, error = null, active = false, t }) => {
  const { emotion, score = 0, history = [], faceFound = false, breakdown = null } = result;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={12} />
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
          {t.emotionLoading}
        </Typography>
      </Box>
    );
  }

  if (error || !active) {
    return (
      <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.68rem' }}>
        {t.emotionOff}
      </Typography>
    );
  }

  const color = emotion ? getEmotionColor(emotion) : '#94a3b8';
  const emoji = emotion ? (EMOJI_MAP[emotion] || '😐') : '—';
  const label = emotion ? emotionLabel(emotion, t) : t.emotionDetecting;

  // Top emotion chips, ranked by the real per-emotion breakdown percentages
  // computed in emotionService.js — no fabricated or hardcoded values.
  const topChips = breakdown
    ? Object.entries(breakdown)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    : [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>

      {/* Current emotion row */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography sx={{ fontSize: '1.1rem', lineHeight: 1 }}>{emoji}</Typography>
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, fontSize: '0.85rem', color, display: 'block', lineHeight: 1.2 }}
          >
            {label}
          </Typography>
        </Box>

        {emotion && (
          <Typography variant="caption" sx={{ fontSize: '0.85rem', color, fontWeight: 700 }}>
            {score}%
          </Typography>
        )}
      </Box>

      {/* Confidence bar */}
      {emotion && (
        <LinearProgress
          variant="determinate"
          value={score}
          sx={{
            height: 4,
            borderRadius: 2,
            bgcolor: 'divider',
            '& .MuiLinearProgress-bar': { bgcolor: color, transition: 'transform 500ms ease' },
          }}
        />
      )}

      {/* Face not detected notice */}
      {active && !faceFound && !emotion && (
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.63rem' }}>
          {t.noFaceDetected}
        </Typography>
      )}

      {/* Emotion breakdown chips — real values from the classifier's score
          distribution, not fabricated. */}
      {topChips.length > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0.5, mt: 0.5 }}>
          {topChips.map(([emo, pct]) => {
            const chipColor = getEmotionColor(emo);
            const isTop = emo === emotion;
            return (
              <Box
                key={emo}
                sx={{
                  textAlign: 'center',
                  borderRadius: 1.5,
                  py: 0.5,
                  px: 0.25,
                  bgcolor: isTop ? `${chipColor}22` : 'action.hover',
                  border: '1px solid',
                  borderColor: isTop ? chipColor : 'divider',
                }}
              >
                <Typography sx={{ fontSize: '0.85rem', lineHeight: 1 }}>
                  {EMOJI_MAP[emo] || '😐'}
                </Typography>
                <Typography
                  sx={{ fontSize: '0.55rem', fontWeight: 600, color: chipColor, mt: 0.25, whiteSpace: 'nowrap' }}
                >
                  {emotionLabel(emo, t)}
                </Typography>
                <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: chipColor }}>
                  {pct}%
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Mini timeline — last 8 readings */}
      {history.length > 1 && (
        <Box sx={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: 20, mt: 0.25 }}>
          {history.slice(-8).map((h, i) => (
            <Tooltip key={i} title={`${emotionLabel(h.emotion, t)} (${h.score}%)`} placement="top">
              <Box
                sx={{
                  flex: 1,
                  height: `${30 + h.score * 0.7}%`,
                  minHeight: 4,
                  borderRadius: '2px 2px 0 0',
                  bgcolor: getEmotionColor(h.emotion),
                  opacity: 0.5 + (i / 8) * 0.5,
                  cursor: 'default',
                  transition: 'height 300ms ease',
                }}
              />
            </Tooltip>
          ))}
        </Box>
      )}

      <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.58rem' }}>
        {t.approxVisualCue}
      </Typography>
    </Box>
  );
});

EmotionIndicator.displayName = 'EmotionIndicator';
export default EmotionIndicator;