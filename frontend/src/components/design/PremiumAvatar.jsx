import { motion } from 'framer-motion';
import { Avatar, Box } from '@mui/material';
import { forwardRef } from 'react';

const PremiumAvatar = forwardRef(({ src, alt, name, size = 'medium', ...props }, ref) => {
  const MotionAvatar = motion(Avatar);

  const sizeMap = {
    small: { width: 32, height: 32, fontSize: '0.75rem' },
    medium: { width: 40, height: 40, fontSize: '0.875rem' },
    large: { width: 56, height: 56, fontSize: '1.25rem' },
    xlarge: { width: 72, height: 72, fontSize: '1.5rem' },
  };

  const sizes = sizeMap[size] || sizeMap.medium;

  const getInitials = (name) => {
    if (!name) return '';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <MotionAvatar
      ref={ref}
      src={src}
      alt={alt}
      {...props}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.2 }}
      sx={{
        width: sizes.width,
        height: sizes.height,
        fontSize: sizes.fontSize,
        fontWeight: 600,
        bgcolor: 'primary.main',
        color: 'white',
        boxShadow: '0 4px 12px rgba(234,118,0,0.2)',
        ...props.sx,
      }}
    >
      {!src && getInitials(name || alt)}
    </MotionAvatar>
  );
});

PremiumAvatar.displayName = 'PremiumAvatar';

export default PremiumAvatar;