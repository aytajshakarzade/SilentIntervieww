import { motion } from 'framer-motion';
import { Drawer, Box, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { forwardRef } from 'react';

const PremiumDrawer = forwardRef(({ open, onClose, title, children, anchor = 'right', width = 400, ...props }, ref) => {
  return (
    <Drawer
      ref={ref}
      anchor={anchor}
      open={open}
      onClose={onClose}
      PaperComponent={motion.div}
      PaperProps={{
        initial: { x: anchor === 'right' ? '100%' : anchor === 'left' ? '-100%' : 0 },
        animate: { x: 0 },
        exit: { x: anchor === 'right' ? '100%' : anchor === 'left' ? '-100%' : 0 },
        transition: { duration: 0.3, ease: 'easeOut' },
        sx: {
          width,
          bgcolor: 'background.paper',
          border: 'none',
          boxShadow: '0 0 50px rgba(0,0,0,0.2)',
        },
      }}
      {...props}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
          {title && (
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
              {title}
            </Typography>
          )}
          <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          {children}
        </Box>
      </Box>
    </Drawer>
  );
});

PremiumDrawer.displayName = 'PremiumDrawer';

export default PremiumDrawer;