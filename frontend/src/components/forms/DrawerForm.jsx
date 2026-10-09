import {
  Drawer, Box, Typography, IconButton, Divider, Button, CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from '../../i18n';

/**
 * DrawerForm — right-side drawer for inline CRUD forms.
 *
 * Props:
 *   open, onClose, title, subtitle,
 *   onSubmit (async fn — receives form submit event),
 *   loading, submitLabel, children
 */
export default function DrawerForm({
  open,
  onClose,
  title,
  subtitle,
  onSubmit,
  loading = false,
  submitLabel,
  children,
  width = 480,
}) {
  const { t } = useTranslation();
  const resolvedSubmitLabel = submitLabel ?? t('drawerFormComponent.save');
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={loading ? undefined : onClose}
      PaperProps={{ sx: { width: { xs: '100vw', sm: width }, display: 'flex', flexDirection: 'column' } }}
    >
      {/* Header */}
      <Box sx={{ px: 3, py: 2.5, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>{title}</Typography>
          {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
        </Box>
        <IconButton onClick={onClose} disabled={loading} size="small" sx={{ mt: 0.5 }}>
          <CloseIcon />
        </IconButton>
      </Box>
      <Divider />

      {/* Scrollable content */}
      <Box sx={{ flex: 1, overflow: 'auto', px: 3, py: 3 }}>
        {children}
      </Box>

      {/* Footer */}
      {onSubmit && (
        <>
          <Divider />
          <Box sx={{ px: 3, py: 2, display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
            <Button onClick={onClose} disabled={loading} variant="outlined" color="inherit">
              {t('drawerFormComponent.cancel')}
            </Button>
            <Button onClick={onSubmit} disabled={loading} variant="contained">
              {loading ? <CircularProgress size={18} color="inherit" /> : resolvedSubmitLabel}
            </Button>
          </Box>
        </>
      )}
    </Drawer>
  );
}
