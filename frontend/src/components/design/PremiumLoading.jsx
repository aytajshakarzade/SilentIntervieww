import { motion } from 'framer-motion';
import { Box, Typography, CircularProgress } from '@mui/material';

const PremiumLoading = ({ message = 'Loading...', size = 40 }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 200,
        gap: 2,
      }}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
      >
        <CircularProgress
          size={size}
          sx={{
            color: 'primary.main',
            '& .MuiCircularProgress-circle': {
              strokeLinecap: 'round',
            },
          }}
        />
      </motion.div>
      <Typography
        variant="body2"
        sx={{ color: 'text.secondary', fontWeight: 500 }}
      >
        {message}
      </Typography>
    </Box>
  );
};

export default PremiumLoading;