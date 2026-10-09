import { motion } from 'framer-motion';
import { TextField, Box, InputAdornment } from '@mui/material';
import { forwardRef } from 'react';

const MotionTextField = motion(TextField);

const PremiumInput = forwardRef(({ icon, label, ...props }, ref) => {

  return (
    <MotionTextField
      ref={ref}
      label={label}
      variant="outlined"
      size="medium"
      InputProps={{
        startAdornment: icon ? (
          <InputAdornment position="start">
            <Box sx={{ color: 'text.secondary', display: 'flex' }}>
              {icon}
            </Box>
          </InputAdornment>
        ) : null,
      }}
      {...props}
      whileFocus={{
        scale: 1.01,
      }}
      transition={{ duration: 0.2 }}
      sx={{
        '& .MuiOutlinedInput-root': {
          borderRadius: 4,
          fontSize: '1rem',
          transition: 'box-shadow 200ms ease, border-color 200ms ease',
          '&.Mui-focused': {
            boxShadow: `0 0 0 4px rgba(234,118,0,0.15)`,
            borderColor: '#EA7600',
          },
        },
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: 'rgba(191,191,191,0.5)',
          borderWidth: 2,
        },
        '& .MuiInputLabel-root': {
          fontWeight: 500,
          color: 'text.secondary',
        },
        ...props.sx,
      }}
    />
  );
});

PremiumInput.displayName = 'PremiumInput';

export default PremiumInput;