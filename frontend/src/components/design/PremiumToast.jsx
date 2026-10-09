import { motion } from 'framer-motion';
import { Box, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';

const PremiumToast = ({ message, type = 'info', onClose, ...props }) => {
  const icons = {
    success: <CheckCircleIcon />,
    error: <ErrorIcon />,
    warning: <WarningIcon />,
    info: <InfoIcon />,
  };

  const colors = {
    success: { bgcolor: 'success.50', color: 'success.main', border: 'success.200' },
    error: { bgcolor: 'error.50', color: 'error.main', border: 'error.200' },
    warning: { bgcolor: 'warning.50', color: 'warning.main', border: 'warning.200' },
    info: { bgcolor: 'info.50', color: 'info.main', border: 'info.200' },
  };

  const theme = colors[type] || colors.info;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.3 }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 2.5,
          borderRadius: 3,
          bgcolor: theme.bgcolor,
          border: `1px solid ${theme.border}`,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          minWidth: 300,
          maxWidth: 400,
          ...props.sx,
        }}
      >
        <Box sx={{ color: theme.color, display: 'flex' }}>
          {icons[type]}
        </Box>
        <Typography
          variant="body2"
          sx={{ flex: 1, fontWeight: 500, color: 'text.primary' }}
        >
          {message}
        </Typography>
        <IconButton
          size="small"
          onClick={onClose}
          sx={{ color: 'text.secondary' }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    </motion.div>
  );
};

export default PremiumToast;