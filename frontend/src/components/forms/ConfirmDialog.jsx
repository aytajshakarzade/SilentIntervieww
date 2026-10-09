import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, CircularProgress, Alert,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { getErrorMessage } from "../../utils/errorUtils";
import { useTranslation } from '../../i18n';

/**
 * ConfirmDialog — generic confirmation modal.
 *
 * Props:
 *   open, onClose, onConfirm, title, message,
 *   confirmLabel, confirmColor ('error'|'primary'|'warning'),
 *   danger (bool) — shows a warning icon
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  confirmColor = 'primary',
  danger = false,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('common.areYouSure');
  const resolvedConfirmLabel = confirmLabel ?? t('common.confirm');

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 700 }}>
        {danger && <WarningAmberIcon color="error" />}
        {resolvedTitle}
      </DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {message && <Typography color="text.secondary" variant="body2">{message}</Typography>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} disabled={loading} variant="outlined" color="inherit">
          {t('common.cancel')}
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={loading}
          variant="contained"
          color={confirmColor}
          startIcon={danger ? <DeleteOutlineIcon /> : undefined}
        >
          {loading ? <CircularProgress size={18} color="inherit" /> : resolvedConfirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
