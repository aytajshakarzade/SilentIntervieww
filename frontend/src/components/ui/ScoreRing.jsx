import { Box, Typography } from '@mui/material';

const COLOR_MAP = {
  high: ['#10b981', '#34d399'],
  mid: ['#f59e0b', '#fbbf24'],
  low: ['#f43f5e', '#fb7185'],
};

function getColorRange(score) {
  if (score >= 75) return COLOR_MAP.high;
  if (score >= 50) return COLOR_MAP.mid;
  return COLOR_MAP.low;
}

export default function ScoreRing({ score, size = 80, strokeWidth = 6, label }) {
  if (score == null) {
    return (
      <Box sx={{ width: size, height: size, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="caption" color="text.disabled">—</Typography>
      </Box>
    );
  }

  const r = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(Math.max(score, 0), 100);
  const offset = circumference - (pct / 100) * circumference;
  const [start, end] = getColorRange(pct);
  const gradId = `sg-${Math.round(pct)}`;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
      <Box sx={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={start} />
              <stop offset="100%" stopColor={end} />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke="#ECE8E2" strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="caption" fontWeight={700} sx={{ fontSize: size > 60 ? '0.9rem' : '0.7rem' }}>
            {Math.round(pct)}%
          </Typography>
        </Box>
      </Box>
      {label && <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', textAlign: 'center' }}>{label}</Typography>}
    </Box>
  );
}
