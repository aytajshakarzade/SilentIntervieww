import { Box, CircularProgress, Typography } from '@mui/material';
import { useTranslation } from '../../i18n';

export default function LoadingSpinner({ message, fullPage = false }) {
  const { t } = useTranslation();
  const resolvedMessage = message ?? t('common.loading');
  const content = (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <CircularProgress size={40} thickness={3} />
      {resolvedMessage && <Typography color="text.secondary" variant="body2">{resolvedMessage}</Typography>}
    </Box>
  );

  if (fullPage) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        {content}
      </Box>
    );
  }

  return content;
}
