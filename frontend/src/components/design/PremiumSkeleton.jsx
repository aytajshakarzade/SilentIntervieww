import { motion } from 'framer-motion';
import { Box, Skeleton } from '@mui/material';

const PremiumSkeleton = ({ variant = 'rectangular', width, height, count = 1, ...props }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {Array.from({ length: count }).map((_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            repeatType: 'reverse',
            delay: index * 0.1,
          }}
        >
          <Skeleton
            variant={variant}
            width={width}
            height={height}
            sx={{
              bgcolor: 'grey.100',
              borderRadius: variant === 'rectangular' ? 2 : '50%',
              ...props.sx,
            }}
          />
        </motion.div>
      ))}
    </Box>
  );
};

export default PremiumSkeleton;