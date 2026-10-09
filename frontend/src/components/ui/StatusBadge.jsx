import { Chip } from '@mui/material';
import { useTranslation } from '../../i18n';

const STATUS_MAP = {
  // Application statuses
  PENDING: { key: 'status.pending', color: 'warning' },
  REVIEWING: { key: 'status.reviewing', color: 'info' },
  SHORTLISTED: { key: 'status.shortlisted', color: 'success' },
  REJECTED: { key: 'status.rejected', color: 'error' },
  HIRED: { key: 'status.hired', color: 'success' },
  QUALIFIED: { key: 'status.qualified', color: 'success' },

  // Interview statuses
  NOT_STARTED: { key: 'status.notStarted', color: 'default' },
  IN_PROGRESS: { key: 'status.inProgress', color: 'info' },
  COMPLETED: { key: 'status.completed', color: 'success' },

  // Role
  RECRUITER: { key: 'status.recruiter', color: 'primary' },
  CANDIDATE: { key: 'status.candidate', color: 'secondary' },
  SUPERADMIN: { key: 'status.admin', color: 'error' },
};

export default function StatusBadge({ status, size = 'small', variant = 'filled' }) {
  const { t } = useTranslation();
  const cfg = STATUS_MAP[status?.toUpperCase()];
  const label = cfg ? t(cfg.key) : (status || t('status.unknown'));
  const color = cfg ? cfg.color : 'default';
  return (
    <Chip
      label={label}
      color={color}
      size={size}
      variant={variant}
      sx={{ fontWeight: 600, fontSize: '0.7rem', height: 22 }}
    />
  );
}
