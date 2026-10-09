import { motion } from 'framer-motion';
import { Dialog, Box, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { forwardRef } from 'react';

const PremiumModal = forwardRef(({ open, onClose, title, children, maxWidth = 'sm', ...props }, ref) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth
      PaperComponent={motion.div}
      PaperProps={{
        initial: { scale: 0.9, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        exit: { scale: 0.9, opacity: 0 },
        transition: { duration: 0.2, ease: 'easeOut' },
        sx: {
          borderRadius: 6,
          bgcolor: 'background.paper',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        },
      }}
      {...props}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 3, pb: 2 }}>
        {title && (
          <DialogTitle sx={{ p: 0, fontSize: '1.25rem', fontWeight: 600, color: 'text.primary' }}>
            {title}
          </DialogTitle>
        )}
        <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
          <CloseIcon />
        </IconButton>
      </Box>
      <Box sx={{ p: 3, pt: 1 }}>
        {children}
      </Box>
    </Dialog>
  );
});

PremiumModal.displayName = 'PremiumModal';

export default PremiumModal;