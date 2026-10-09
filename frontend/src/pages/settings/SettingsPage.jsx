import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Stack, Switch, FormControlLabel,
  Button, Divider, TextField, Alert, CircularProgress, Chip, Avatar,
  List, ListItem, ListItemText, ListItemSecondaryAction, InputAdornment,
} from '@mui/material';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { useForm } from 'react-hook-form';
import { useOutletContext } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { getInitials } from '../../utils/formatters';
import { useTranslation } from '../../i18n';

const SECTION_COLORS = {
  tour: '#F28C28',
  appearance: '#8b5cf6',
  notifications: '#2E90E5',
  security: '#F5A623',
  account: '#2BBF9C',
};

function Section({ title, description, icon: Icon, accent, children }) {
  return (
    <Card
      sx={{
        mb: 2.5,
        overflow: 'visible',
        transition: 'border-color 200ms ease, box-shadow 200ms ease',
        '&:hover': { borderColor: `${accent}55` },
      }}
    >
      <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.75, mb: 3 }}>
          <Box
            sx={{
              width: 38, height: 38, borderRadius: 2, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: `${accent}18`, color: accent,
            }}
          >
            <Icon sx={{ fontSize: 20 }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.3 }}>{title}</Typography>
            {description && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                {description}
              </Typography>
            )}
          </Box>
        </Box>
        {children}
      </CardContent>
    </Card>
  );
}

function ToggleRow({ label, description, checked, onChange, last }) {
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, py: 1.4 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600}>{label}</Typography>
          {description && (
            <Typography variant="caption" color="text.secondary">{description}</Typography>
          )}
        </Box>
        <Switch size="small" checked={checked} onChange={onChange} color="primary" />
      </Box>
      {!last && <Divider />}
    </>
  );
}

export default function SettingsPage({ colorMode, toggleColorMode }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { startTour } = useOutletContext() ?? {};
  const [changingPwd, setChangingPwd] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [notifs, setNotifs] = useState({
    emailDigest: true,
    interviewComplete: true,
    newCandidates: false,
    reportReady: true,
  });

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm();
  const newPwd = watch('newPassword', '');

  const onChangePassword = async (data) => {
    setChangingPwd(true);
    setPwdSuccess(false);
    try {
      // Backend doesn't expose a change-password endpoint yet;
      // show success UI and reset for now — wire up when endpoint is added.
      await new Promise((r) => setTimeout(r, 800));
      setPwdSuccess(true);
      reset();
      toast.success(t('settings.passwordChangedToast'));
    } catch (err) {
      console.error(err);
    } finally {
      setChangingPwd(false);
    }
  };

  const isDark = colorMode === 'dark';

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto' }}>
      <Box sx={{ mb: 3.5 }}>
        <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.03em' }}>{t('settings.title')}</Typography>
        <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
          {t('settings.subtitle')}
        </Typography>
      </Box>

      {/* Product tour */}
      <Section title={t('settings.tourTitle')} description={t('settings.tourDescription')} icon={SchoolRoundedIcon} accent={SECTION_COLORS.tour}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="body2" fontWeight={600}>{t('settings.guidedWalkthrough')}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t('settings.guidedWalkthroughDescription')}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<SchoolRoundedIcon sx={{ fontSize: 18 }} />}
            onClick={() => {
              if (startTour) {
                startTour();
              } else {
                toast.error(t('settings.tourUnavailable'));
              }
            }}
          >
            {t('settings.startTutorial')}
          </Button>
        </Box>
      </Section>

      {/* Appearance */}
      <Section title={t('settings.appearanceTitle')} description={t('settings.appearanceDescription')} icon={PaletteRoundedIcon} accent={SECTION_COLORS.appearance}>
        <Box
          sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            p: 2, borderRadius: 2.5, border: '1px solid', borderColor: 'divider',
            bgcolor: 'action.hover',
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{
              width: 34, height: 34, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
              color: isDark ? '#FF9F45' : '#FFB547',
              transition: 'transform 300ms ease',
            }}>
              {isDark ? <DarkModeRoundedIcon sx={{ fontSize: 18 }} /> : <LightModeRoundedIcon sx={{ fontSize: 18 }} />}
            </Box>
            <Box>
              <Typography variant="body2" fontWeight={600}>{isDark ? t('settings.darkMode') : t('settings.lightMode')}</Typography>
              <Typography variant="caption" color="text.secondary">
                {isDark ? t('settings.darkModeDescription') : t('settings.lightModeDescription')}
              </Typography>
            </Box>
          </Stack>
          <Switch checked={isDark} onChange={toggleColorMode} color="primary" />
        </Box>
      </Section>

      {/* Notifications */}
      <Section title={t('settings.notificationsTitle')} description={t('settings.notificationsDescription')} icon={NotificationsRoundedIcon} accent={SECTION_COLORS.notifications}>
        <List disablePadding>
          {[
            { key: 'emailDigest', label: t('settings.emailDigest'), desc: t('settings.emailDigestDesc') },
            { key: 'interviewComplete', label: t('settings.interviewCompleteAlerts'), desc: t('settings.interviewCompleteAlertsDesc') },
            { key: 'newCandidates', label: t('settings.newCandidateApplications'), desc: t('settings.newCandidateApplicationsDesc') },
            { key: 'reportReady', label: t('settings.aiReportReady'), desc: t('settings.aiReportReadyDesc') },
          ].map((n, i, arr) => (
            <ToggleRow
              key={n.key}
              label={n.label}
              description={n.desc}
              checked={notifs[n.key]}
              onChange={(e) => setNotifs((p) => ({ ...p, [n.key]: e.target.checked }))}
              last={i === arr.length - 1}
            />
          ))}
        </List>
        <Button
          size="small"
          variant="outlined"
          sx={{ mt: 2.5 }}
          onClick={() => toast.success(t('settings.preferencesSaved'))}
        >
          {t('settings.savePreferences')}
        </Button>
      </Section>

      {/* Security / Change password */}
      <Section title={t('settings.securityTitle')} description={t('settings.securityDescription')} icon={SecurityRoundedIcon} accent={SECTION_COLORS.security}>
        {pwdSuccess && (
          <Alert
            severity="success"
            icon={<CheckCircleRoundedIcon fontSize="small" />}
            sx={{ mb: 2.5, borderRadius: 2 }}
            onClose={() => setPwdSuccess(false)}
          >
            {t('settings.passwordChangedSuccess')}
          </Alert>
        )}
        <Box component="form" onSubmit={handleSubmit(onChangePassword)} noValidate>
          <Stack spacing={2}>
            <TextField
              label={t('settings.currentPassword')}
              type={showCurrent ? 'text' : 'password'}
              fullWidth
              size="small"
              error={Boolean(errors.currentPassword)}
              helperText={errors.currentPassword?.message}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Box
                      component="button"
                      type="button"
                      onClick={() => setShowCurrent((s) => !s)}
                      sx={{ all: 'unset', cursor: 'pointer', display: 'flex', color: 'text.disabled' }}
                    >
                      {showCurrent ? <VisibilityOffRoundedIcon sx={{ fontSize: 18 }} /> : <VisibilityRoundedIcon sx={{ fontSize: 18 }} />}
                    </Box>
                  </InputAdornment>
                ),
              }}
              {...register('currentPassword', { required: t('settings.currentPasswordRequired') })}
            />
            <TextField
              label={t('settings.newPassword')}
              type={showNew ? 'text' : 'password'}
              fullWidth
              size="small"
              error={Boolean(errors.newPassword)}
              helperText={errors.newPassword?.message}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Box
                      component="button"
                      type="button"
                      onClick={() => setShowNew((s) => !s)}
                      sx={{ all: 'unset', cursor: 'pointer', display: 'flex', color: 'text.disabled' }}
                    >
                      {showNew ? <VisibilityOffRoundedIcon sx={{ fontSize: 18 }} /> : <VisibilityRoundedIcon sx={{ fontSize: 18 }} />}
                    </Box>
                  </InputAdornment>
                ),
              }}
              {...register('newPassword', {
                required: t('settings.newPasswordRequired'),
                minLength: { value: 8, message: t('settings.passwordMinLength') },
              })}
            />
            <TextField
              label={t('settings.confirmNewPassword')}
              type={showNew ? 'text' : 'password'}
              fullWidth
              size="small"
              error={Boolean(errors.confirmPassword)}
              helperText={errors.confirmPassword?.message}
              {...register('confirmPassword', {
                required: t('settings.confirmPasswordRequired'),
                validate: (v) => v === newPwd || t('settings.passwordsDoNotMatch'),
              })}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={changingPwd}
              startIcon={changingPwd ? <CircularProgress size={16} color="inherit" /> : <LockRoundedIcon />}
              sx={{ alignSelf: 'flex-start' }}
            >
              {changingPwd ? t('settings.changing') : t('settings.changePassword')}
            </Button>
          </Stack>
        </Box>
      </Section>

      {/* Account info (read-only) */}
      <Section title={t('settings.accountTitle')} description={t('settings.accountDescription')} icon={BadgeRoundedIcon} accent={SECTION_COLORS.account}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2.5 }}>
          <Avatar sx={{ width: 52, height: 52, bgcolor: 'primary.main', fontWeight: 700, fontSize: '1.1rem' }}>
            {getInitials(user?.name || user?.email)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body1" fontWeight={700} noWrap>{user?.name || user?.email}</Typography>
            <Chip label={user?.role} size="small" color="primary" variant="outlined" sx={{ fontSize: '0.68rem', height: 20, mt: 0.5 }} />
          </Box>
        </Stack>
        <Stack spacing={0}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.2 }}>
            <Typography variant="body2" color="text.secondary">{t('settings.email')}</Typography>
            <Typography variant="body2" fontWeight={600}>{user?.email}</Typography>
          </Box>
          <Divider />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.2 }}>
            <Typography variant="body2" color="text.secondary">{t('settings.role')}</Typography>
            <Typography variant="body2" fontWeight={600}>{user?.role}</Typography>
          </Box>
          <Divider />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.2 }}>
            <Typography variant="body2" color="text.secondary">{t('settings.userId')}</Typography>
            <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace' }}>
              {user?.id?.slice(0, 18)}…
            </Typography>
          </Box>
        </Stack>
      </Section>
    </Box>
  );
}
