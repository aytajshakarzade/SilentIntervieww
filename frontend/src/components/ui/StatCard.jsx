import { Box, Card, CardContent, Typography, Skeleton } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import { useTranslation } from '../../i18n';

export default function StatCard({ title, value, subtitle, icon: Icon, color = '#F28C28', trend, loading }) {
  const { t } = useTranslation();
  const trendIcon = trend > 0
    ? <TrendingUpIcon sx={{ fontSize: 14, color: 'success.main' }} />
    : trend < 0
    ? <TrendingDownIcon sx={{ fontSize: 14, color: 'error.main' }} />
    : <TrendingFlatIcon sx={{ fontSize: 14, color: 'text.disabled' }} />;

  const trendColor = trend > 0 ? 'success.main' : trend < 0 ? 'error.main' : 'text.disabled';
  const trendLabel = trend != null ? `${trend > 0 ? '+' : ''}${trend}%` : null;

  return (
    <Card
      sx={{
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 200ms ease, box-shadow 200ms ease',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
      }}
    >
      {/* Subtle accent bar on top */}
      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${color}, ${color}88)` }} />

      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.7rem' }}>
            {title}
          </Typography>
          {Icon && (
            <Box
              sx={{
                width: 36, height: 36,
                borderRadius: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: `${color}15`,
              }}
            >
              <Icon sx={{ fontSize: 18, color }} />
            </Box>
          )}
        </Box>

        {loading ? (
          <>
            <Skeleton variant="text" width="60%" height={48} />
            <Skeleton variant="text" width="40%" height={20} />
          </>
        ) : (
          <>
            <Typography variant="h4" fontWeight={700} sx={{ lineHeight: 1.1, mb: 0.5, fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
              {value}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {trendLabel && (
                <>
                  {trendIcon}
                  <Typography variant="caption" color={trendColor} fontWeight={600}>
                    {trendLabel}
                  </Typography>
                  <Typography variant="caption" color="text.disabled">{t('statCardComponent.vsLastMonth')}</Typography>
                </>
              )}
              {subtitle && !trendLabel && (
                <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
              )}
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
}
