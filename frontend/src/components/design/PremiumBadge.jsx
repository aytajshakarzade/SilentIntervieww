import { motion } from 'framer-motion';
import { Chip } from '@mui/material';
import { forwardRef } from 'react';

const PremiumBadge = forwardRef(({ children, color = 'default', ...props }, ref) => {
  const MotionChip = motion(Chip);

  const colorMap = {
    default: {
      bgcolor: 'grey.100',
      color: 'grey.700',
      borderColor: 'grey.300',
    },
    success: {
      bgcolor: 'success.100',
      color: 'success.700',
      borderColor: 'success.300',
    },
    warning: {
      bgcolor: 'warning.100',
      color: 'warning.700',
      borderColor: 'warning.300',
    },
    error: {
      bgcolor: 'error.100',
      color: 'error.700',
      borderColor: 'error.300',
    },
    info: {
      bgcolor: 'info.100',
      color: 'info.700',
      borderColor: 'info.300',
    },
    primary: {
      bgcolor: 'primary.50',
      color: 'primary.700',
      borderColor: 'primary.300',
    },
  };

  const colors = colorMap[color] || colorMap.default;

  return (
    <MotionChip
      ref={ref}
      label={children}
      variant="outlined"
      {...props}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.15 }}
      sx={{
        borderRadius: 3,
        fontWeight: 600,
        fontSize: '0.8rem',
        padding: '6px 12px',
        borderWidth: 1.5,
        bgcolor: colors.bgcolor,
        color: colors.color,
        borderColor: colors.borderColor,
        ...props.sx,
      }}
    />
  );
});

PremiumBadge.displayName = 'PremiumBadge';

export default PremiumBadge;