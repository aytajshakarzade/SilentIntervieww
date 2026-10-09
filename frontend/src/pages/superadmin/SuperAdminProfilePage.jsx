import { Box, Card, CardContent, Chip, Avatar, Stack, Typography, Divider } from '@mui/material';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import { useAuth } from '../../hooks/useAuth';
import { getInitials } from '../../utils/formatters';
import { useTranslation } from '../../i18n';

export default function SuperAdminProfilePage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  return (
    <Box sx={{ maxWidth: 980, mx: 'auto', pb: 6 }}>
      <Box sx={{ mb: 3.5 }}>
        <Typography variant="h4" fontWeight={900}>{t('superAdminExtra.profileTitle')}</Typography>
        <Typography color="text.secondary" sx={{ mt: .5 }}>{t('superAdminExtra.profileSubtitle')}</Typography>
      </Box>
      <Card sx={{ overflow: 'hidden', mb: 2.5 }}>
        <Box sx={{ p: { xs: 2.5, md: 3.5 }, background: 'linear-gradient(135deg, rgba(242,124,0,.14), rgba(124,108,255,.10))' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Avatar sx={{ width: 82, height: 82, bgcolor: 'primary.main', fontSize: '1.45rem', fontWeight: 900, boxShadow: '0 18px 40px rgba(242,124,0,.20)' }}>{getInitials(user?.name)}</Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap"><Typography variant="h5" fontWeight={900}>{user?.name}</Typography><Chip icon={<ShieldRoundedIcon />} label={t('status.admin')} color="primary" variant="outlined" /></Stack>
              <Typography color="text.secondary" sx={{ mt: .3 }}>{user?.email}</Typography>
              <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>{t('superAdminExtra.accountId')}: {user?.id}</Typography>
            </Box>
          </Stack>
        </Box>
        <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
          <Typography fontWeight={900} sx={{ mb: 1.5 }}>{t('superAdminExtra.administrativeAccess')}</Typography>
          <Stack spacing={1.25}>
            {[t('superAdminExtra.userManagement'), t('superAdminExtra.companyOversight'), t('superAdminExtra.plansBillingAccess'), t('superAdminExtra.auditActivityAccess'), t('superAdminExtra.systemHealthAccess')].map((label) => <Box key={label} sx={{ display: 'flex', gap: 1.1, alignItems: 'center', p: 1.15, borderRadius: 2.3, bgcolor: 'action.hover' }}><SecurityRoundedIcon sx={{ fontSize: 18, color: 'success.main' }} /><Typography variant="body2" fontWeight={700}>{label}</Typography><Chip label={t('superAdminExtra.granted')} size="small" color="success" variant="outlined" sx={{ ml: 'auto', height: 25, fontSize: '.65rem', fontWeight: 800 }} /></Box>)}
          </Stack>
          <Divider sx={{ my: 2.5 }} />
          <Typography variant="caption" color="text.secondary">{t('superAdminExtra.backendPrivileges')}</Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
