import { motion } from 'framer-motion';
import { Box, Typography } from '@mui/material';
import { TrendingUp, TrendingDown, TrendingFlat } from '@mui/icons-material';
import PremiumCard from './PremiumCard';

const PremiumMetricCard = ({ title, value, change, icon, color = 'primary', subtitle, ...props }) => {
  const getTrendIcon = (trend) => {
    if (trend > 0) return <TrendingUp fontSize="small" />;
    if (trend < 0) return <TrendingDown fontSize="small" />;
    return <TrendingFlat fontSize="small" />;
  };

  const getTrendColor = (trend) => {
    if (trend > 0) return 'success.main';
    if (trend < 0) return 'error.main';
    return 'text.secondary';
  };

  return (
    <PremiumCard {...props}>
      <Box sx={{ minHeight: 148, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2.8,
              display: 'grid',
              placeItems: 'center',
              bgcolor: (theme) => theme.palette[color]?.main ? `${theme.palette[color].main}14` : 'action.hover',
              color: (theme) => theme.palette[color]?.main || theme.palette.text.primary,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
          {change !== undefined && change !== null && Number.isFinite(Number(change)) && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.45, px: 1.15, py: .48, borderRadius: 2, bgcolor: 'action.hover' }}>
              <Box sx={{ color: getTrendColor(change), display: 'flex' }}>{getTrendIcon(change)}</Box>
              <Typography variant="caption" sx={{ fontWeight: 850, color: getTrendColor(change) }}>{Math.abs(change)}%</Typography>
            </Box>
          )}
        </Box>
        <Box sx={{ mt: 2.4 }}>
          <Typography variant="h4" sx={{ fontWeight: 900, lineHeight: 1.05, letterSpacing: '-.045em', color: 'text.primary' }}>
            {value}
          </Typography>
          <Typography variant="body2" sx={{ mt: .75, color: 'text.primary', fontWeight: 750 }}>
            {title}
          </Typography>
          {subtitle && <Typography variant="caption" sx={{ display: 'block', mt: .55, color: 'text.secondary', lineHeight: 1.55 }}>
            {subtitle}
          </Typography>}
        </Box>
      </Box>
    </PremiumCard>
  );
};

export default PremiumMetricCard;
