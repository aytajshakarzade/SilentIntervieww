import { motion } from 'framer-motion';
import { Box, Typography } from '@mui/material';
import { forwardRef } from 'react';

const PremiumEmptyState = forwardRef(({ icon, title, description, action, ...props }, ref) => {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 300,
          textAlign: 'center',
          p: 4,
          ...props.sx,
        }}
      >
        {icon && (
          <Box
            sx={{
              mb: 3,
              color: 'text.disabled',
              fontSize: 64,
              display: 'flex',
            }}
          >
            {icon}
          </Box>
        )}
        <Typography
          variant="h6"
          sx={{ mb: 1.5, fontWeight: 600, color: 'text.primary' }}
        >
          {title}
        </Typography>
        <Typography
          variant="body2"
          sx={{ mb: 3, maxWidth: 400, color: 'text.secondary' }}
        >
          {description}
        </Typography>
        {action && action}
      </Box>
    </motion.div>
  );
});

PremiumEmptyState.displayName = 'PremiumEmptyState';

export default PremiumEmptyState;