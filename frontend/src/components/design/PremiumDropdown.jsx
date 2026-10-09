import { motion } from 'framer-motion';
import { Menu, MenuItem, Box, Paper } from '@mui/material';
import { forwardRef } from 'react';

const PremiumDropdown = forwardRef(({ anchorEl, open, onClose, items, ...props }, ref) => {
  const handleClose = () => {
    onClose();
  };

  return (
    <Menu
      ref={ref}
      anchorEl={anchorEl}
      open={open}
      onClose={handleClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      PaperComponent={motion.div}
      PaperProps={{
        initial: { scale: 0.95, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        exit: { scale: 0.95, opacity: 0 },
        transition: { duration: 0.15 },
        sx: {
          mt: 1,
          minWidth: 180,
          borderRadius: 3,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          border: '1px solid',
          borderColor: 'divider',
        },
      }}
      {...props}
    >
      {items.map((item, index) => (
        <MenuItem
          key={index}
          onClick={() => {
            item.onClick?.();
            handleClose();
          }}
          sx={{
            borderRadius: 1,
            mx: 1,
            my: 0.5,
            fontWeight: 500,
            fontSize: '0.9rem',
            '&:hover': {
              bgcolor: 'primary.50',
              color: 'primary.main',
            },
          }}
        >
          {item.icon && (
            <Box sx={{ mr: 1.5, color: 'text.secondary', display: 'flex' }}>
              {item.icon}
            </Box>
          )}
          {item.label}
        </MenuItem>
      ))}
    </Menu>
  );
});

PremiumDropdown.displayName = 'PremiumDropdown';

export default PremiumDropdown;