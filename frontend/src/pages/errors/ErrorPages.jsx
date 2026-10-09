import { Box, Button, Typography, Stack } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LockIcon from '@mui/icons-material/Lock';
import BlockIcon from '@mui/icons-material/Block';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../hooks/useAuth';
import { getRoleBase } from '../../constants/routes';
import { useTranslation } from '../../i18n';

function ErrorPage({ code, titleKey, descriptionKey, icon: Icon, iconColor }) {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 3,
        flexDirection: 'column',
        textAlign: 'center',
      }}
    >
      <Box
        sx={{
          display: 'inline-flex',
          p: 3,
          borderRadius: 4,
          bgcolor: `${iconColor}15`,
          mb: 3,
        }}
      >
        <Icon sx={{ fontSize: 56, color: iconColor }} />
      </Box>

      <Typography
        variant="h1"
        sx={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: { xs: '4rem', sm: '6rem' }, lineHeight: 1, mb: 1, color: 'text.disabled' }}
      >
        {code}
      </Typography>

      <Typography variant="h4" fontWeight={700} gutterBottom>
        {t(titleKey)}
      </Typography>

      <Typography color="text.secondary" sx={{ maxWidth: 420, mb: 4, lineHeight: 1.7 }}>
        {t(descriptionKey)}
      </Typography>

      <Stack direction="row" spacing={1.5}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
        >
          {t('common.goBack')}
        </Button>
        <Button
          variant="contained"
          startIcon={<HomeIcon />}
          onClick={() => navigate(isAuthenticated ? getRoleBase(user?.role) : ROUTES.LOGIN)}
        >
          {isAuthenticated ? t('nav.dashboard') : t('common.signIn')}
        </Button>
      </Stack>
    </Box>
  );
}

export function NotFoundPage() {
  return (
    <ErrorPage
      code="404"
      titleKey="errors.notFoundTitle"
      descriptionKey="errors.notFoundBody"
      icon={SearchOffIcon}
      iconColor="#F28C28"
    />
  );
}

export function UnauthorizedPage() {
  return (
    <ErrorPage
      code="401"
      titleKey="errors.unauthorizedTitle"
      descriptionKey="errors.unauthorizedBody"
      icon={LockIcon}
      iconColor="#f59e0b"
    />
  );
}

export function ForbiddenPage() {
  return (
    <ErrorPage
      code="403"
      titleKey="errors.forbiddenTitle"
      descriptionKey="errors.forbiddenBody"
      icon={BlockIcon}
      iconColor="#f43f5e"
    />
  );
}
